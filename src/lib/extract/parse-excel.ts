/**
 * 결정적 엑셀 파서 — LLM 없이 표준 K-IFRS 계정명 매핑.
 *
 * 작동 원리:
 *   1. xlsx로 모든 시트의 행 읽기
 *   2. 4자리 연도 2개 이상 있는 행 = 헤더 → 연도 컬럼 인덱스 확정
 *   3. 단위 감지 ("단위 : 천원" 등) → 백만원 변환 배수
 *   4. 각 행 첫 셀 = 계정명 → 정규화 → name maps 조회 → 값 추출
 *
 * 매핑 사전은 src/lib/extract/account-names.ts 단일 소스 (DART와 공유).
 *
 * 장점: 100ms, 비용 0, 타임아웃 불가능, 토큰 한도 무관.
 */

import * as XLSX from "xlsx";
import type {
  RawCompanyData,
  RawIncomeStatement,
  RawBalanceSheet,
  RawCashFlow,
} from "@/types/CompanyAnalysis";
import {
  IS_NAME_MAP,
  BS_NAME_MAP,
  CF_NAME_MAP,
  normalizeAccountName,
} from "@/lib/extract/account-names";

/** 셀 값을 number 또는 null로 — 콤마·괄호·△·N/A 처리 */
function parseNumber(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (!s || s === "-" || s.toUpperCase() === "N/A" || s === "해당없음") return null;
  // (1,234) → -1234
  const negParen = /^\(([\d,.\s]+)\)$/.exec(s);
  if (negParen) {
    const n = parseFloat(negParen[1].replace(/,/g, "").trim());
    return Number.isFinite(n) ? -n : null;
  }
  // △1,234 → -1234
  if (s.startsWith("△")) {
    const n = parseFloat(s.slice(1).replace(/,/g, "").trim());
    return Number.isFinite(n) ? -n : null;
  }
  const n = parseFloat(s.replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : null;
}

/** 헤더 셀에서 4자리 연도 추출 (2021, "2021-12-31", "2021년", "FY2024") */
function parseYear(v: unknown): number | null {
  if (typeof v === "number" && v >= 1990 && v <= 2100) return Math.floor(v);
  if (typeof v !== "string") return null;
  const s = v.trim();
  const m = /(?:^|\D)(\d{4})(?:\D|$)/.exec(s);
  if (!m) return null;
  const y = parseInt(m[1], 10);
  return y >= 1990 && y <= 2100 ? y : null;
}

/** "단위" 키워드 찾아서 변환 배수 산출 */
function detectUnit(text: string): { multiplier: number; label: string } {
  if (/단위\s*[:：]?\s*억\s*원/.test(text)) return { multiplier: 100, label: "억원" };
  if (/단위\s*[:：]?\s*천\s*원/.test(text) || /\(천원\)/.test(text)) {
    return { multiplier: 1 / 1000, label: "천원" };
  }
  if (/단위\s*[:：]?\s*백\s*만\s*원/.test(text) || /\(백만원\)/.test(text)) {
    return { multiplier: 1, label: "백만원" };
  }
  if (/단위\s*[:：]?\s*원\b/.test(text) && !/천원|백만원|억원/.test(text)) {
    return { multiplier: 1 / 1_000_000, label: "원" };
  }
  return { multiplier: 1, label: "백만원" };
}

/** 회사명 — 자료 안에 라벨 있으면 거기서, 없으면 파일명에서 */
function inferCompanyName(filename: string, rows: unknown[][]): string {
  const labels = ["회사명", "기업명", "상호", "법인명"];
  for (const row of rows) {
    if (!row) continue;
    for (let i = 0; i < row.length - 1; i++) {
      const cell = String(row[i] ?? "").trim();
      if (labels.some((l) => cell === l || cell.startsWith(`${l}:`) || cell.startsWith(`${l} :`))) {
        const next = String(row[i + 1] ?? "").trim();
        if (next && next.length < 80 && !/^\d{4}/.test(next)) return next;
      }
      const inline = /^(?:회사명|기업명|상호|법인명)\s*[:：]\s*(.+)$/.exec(cell);
      if (inline) return inline[1].trim();
    }
  }
  // Fallback: 파일명
  let name = filename.replace(/\.[^.]+$/, "");
  name = name.replace(
    /[_\-\s]?(재무제표|재무|financials?|statements?|cretop|크레탑|export|raw|data|\d{4}).*$/i,
    ""
  );
  return name.replace(/[\s_\-.()]+$/, "").trim() || filename;
}

function inferFiscalYearEnd(headerRow: unknown[]): string {
  for (const cell of headerRow) {
    if (typeof cell !== "string") continue;
    const m = /(\d{4})-(\d{2})-(\d{2})/.exec(cell);
    if (m) return `${m[2]}-${m[3]}`;
  }
  return "12-31";
}

export type ParseResult = {
  raw: RawCompanyData;
  warnings: string[];
  matchedCount: number;
  unmatchedAccounts: string[];
  detectedUnit: string;
};

export function parseExcelToRaw(
  buffer: ArrayBuffer,
  filename: string
): ParseResult {
  const wb = XLSX.read(buffer, { type: "array" });
  const allRows: unknown[][] = [];
  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false }) as unknown[][];
    allRows.push(...aoa);
  }

  // 헤더 행 — 4자리 연도가 2개 이상
  let headerRow: unknown[] | null = null;
  let headerColIdx: number[] = [];
  let years: number[] = [];

  for (const row of allRows) {
    if (!row) continue;
    const yearCols: { idx: number; year: number }[] = [];
    for (let i = 0; i < row.length; i++) {
      const y = parseYear(row[i]);
      if (y) yearCols.push({ idx: i, year: y });
    }
    if (yearCols.length >= 2) {
      headerRow = row;
      yearCols.sort((a, b) => a.year - b.year);
      headerColIdx = yearCols.map((y) => y.idx);
      years = yearCols.map((y) => y.year);
      break;
    }
  }

  if (!headerRow) {
    throw new Error(
      "연도 컬럼 헤더를 찾을 수 없습니다. 4자리 연도(2021, 2022 등) 컬럼이 최소 2개 필요합니다."
    );
  }

  const allText = allRows.flatMap((r) => (r ?? []).map((c) => String(c ?? ""))).join(" ");
  const { multiplier, label: detectedUnit } = detectUnit(allText);

  // 매칭
  const isMatches = new Map<keyof RawIncomeStatement, (number | null)[]>();
  const bsMatches = new Map<keyof RawBalanceSheet, (number | null)[]>();
  const cfMatches = new Map<keyof RawCashFlow, (number | null)[]>();
  const unmatched = new Set<string>();

  for (const row of allRows) {
    if (!row || row.length === 0) continue;
    let nameCell = "";
    for (let i = 0; i < row.length && i < headerColIdx[0]; i++) {
      const v = String(row[i] ?? "").trim();
      if (v) {
        nameCell = v;
        break;
      }
    }
    if (!nameCell) continue;

    const norm = normalizeAccountName(nameCell);

    const values = headerColIdx.map((i) => {
      const n = parseNumber(row[i]);
      return n != null ? Math.round(n * multiplier) : null;
    });
    const hasValue = values.some((v) => v != null);

    // IS 먼저, 없으면 BS, 없으면 CF
    const isKey = IS_NAME_MAP[norm];
    if (isKey) {
      if (!isMatches.has(isKey)) isMatches.set(isKey, values);
      continue;
    }
    const bsKey = BS_NAME_MAP[norm];
    if (bsKey) {
      if (!bsMatches.has(bsKey)) bsMatches.set(bsKey, values);
      continue;
    }
    const cfKey = CF_NAME_MAP[norm];
    if (cfKey) {
      if (!cfMatches.has(cfKey)) cfMatches.set(cfKey, values);
      continue;
    }
    if (hasValue && norm.length < 30) unmatched.add(norm);
  }

  const totalMatches = isMatches.size + bsMatches.size + cfMatches.size;
  if (totalMatches === 0) {
    throw new Error(
      `매칭된 계정 0개. 한국 K-IFRS 표준 계정명(매출액, 자산총계, 영업이익 등) 사용해주세요. 발견된 미매칭 일부: ${Array.from(unmatched).slice(0, 8).join(", ")}`
    );
  }

  const initArr = (): (number | null)[] => years.map(() => null);
  const get = <T>(map: Map<T, (number | null)[]>, k: T): (number | null)[] =>
    map.get(k) ?? initArr();

  const raw: RawCompanyData = {
    meta: {
      company_name: inferCompanyName(filename, allRows),
      fiscal_years: years,
      currency_unit: "백만원",
      report_date: new Date().toISOString().slice(0, 10),
      source: "Manual",
      data_period: `${years[0]}-${years[years.length - 1]}`,
      fiscal_year_end: inferFiscalYearEnd(headerRow),
    },
    company: { is_listed: false },
    financials: {
      income_statement: {
        revenue: get(isMatches, "revenue"),
        cogs: get(isMatches, "cogs"),
        gross_profit: get(isMatches, "gross_profit"),
        sga: get(isMatches, "sga"),
        operating_income: get(isMatches, "operating_income"),
        net_income: get(isMatches, "net_income"),
        interest_expense: get(isMatches, "interest_expense"),
        non_op_income: get(isMatches, "non_op_income"),
        non_op_expense: get(isMatches, "non_op_expense"),
        depreciation: get(isMatches, "depreciation"),
        amortization: get(isMatches, "amortization"),
        salary_total: get(isMatches, "salary_total"),
        rent: get(isMatches, "rent"),
        fees_total: get(isMatches, "fees_total"),
        transport: get(isMatches, "transport"),
      },
      balance_sheet: {
        total_assets: get(bsMatches, "total_assets"),
        current_assets: get(bsMatches, "current_assets"),
        cash: get(bsMatches, "cash"),
        ar: get(bsMatches, "ar"),
        non_current: get(bsMatches, "non_current"),
        tangible: get(bsMatches, "tangible"),
        intangible: get(bsMatches, "intangible"),
        deposits: get(bsMatches, "deposits"),
        total_liab: get(bsMatches, "total_liab"),
        current_liab: get(bsMatches, "current_liab"),
        short_borrow: get(bsMatches, "short_borrow"),
        accrued_exp: get(bsMatches, "accrued_exp"),
        non_current_liab: get(bsMatches, "non_current_liab"),
        long_borrow: get(bsMatches, "long_borrow"),
        total_equity: get(bsMatches, "total_equity"),
        capital_stock: get(bsMatches, "capital_stock"),
        capital_surplus: get(bsMatches, "capital_surplus"),
        retained_earnings: get(bsMatches, "retained_earnings"),
      },
      cash_flow_raw: {
        operating: get(cfMatches, "operating"),
        investing: get(cfMatches, "investing"),
        financing: get(cfMatches, "financing"),
        net_change: get(cfMatches, "net_change"),
      },
    },
  };

  const warnings: string[] = [];
  if (detectedUnit !== "백만원") warnings.push(`단위 ${detectedUnit} → 백만원 자동 변환됨`);

  return {
    raw,
    warnings,
    matchedCount: totalMatches,
    unmatchedAccounts: Array.from(unmatched).sort(),
    detectedUnit,
  };
}
