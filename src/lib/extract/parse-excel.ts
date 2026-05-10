/**
 * 결정적 엑셀 파서 — LLM 없이 표준 K-IFRS 계정명 매핑.
 *
 * 작동 원리:
 *   1. xlsx로 모든 시트의 행 읽기
 *   2. 4자리 연도 2개 이상 있는 행 = 헤더 → 연도 컬럼 인덱스 확정
 *   3. 단위 감지 ("단위 : 천원" 등) → 백만원 변환 배수
 *   4. 각 행 첫 셀 = 계정명 → 정규화 → ACCOUNT_MAP 조회 → 값 추출
 *
 * 장점: 100ms, 비용 0, 타임아웃 불가능, 토큰 한도 무관.
 * 한계: 매핑 사전에 없는 계정명은 누락 (warnings로 노출).
 */

import * as XLSX from "xlsx";
import type { RawCompanyData } from "@/types/CompanyAnalysis";

type StatementKey = "is" | "bs" | "cf";
type FieldDef = { field: string; stmt: StatementKey };

/**
 * 한국 K-IFRS·일반회계기준 표준 계정명 → 우리 schema 필드 매핑.
 * Cretop, DART, 회사 내부 양식 모두 이 표준명 기반.
 */
const ACCOUNT_MAP: Record<string, FieldDef> = {
  // ── 손익계산서 ──
  "매출액": { field: "revenue", stmt: "is" },
  "매출": { field: "revenue", stmt: "is" },
  "영업수익": { field: "revenue", stmt: "is" },
  "수익(매출액)": { field: "revenue", stmt: "is" },
  "매출원가": { field: "cogs", stmt: "is" },
  "매출총이익": { field: "gross_profit", stmt: "is" },
  "매출총이익(손실)": { field: "gross_profit", stmt: "is" },
  "판매비와관리비": { field: "sga", stmt: "is" },
  "판매관리비": { field: "sga", stmt: "is" },
  "판관비": { field: "sga", stmt: "is" },
  "영업이익": { field: "operating_income", stmt: "is" },
  "영업이익(손실)": { field: "operating_income", stmt: "is" },
  "당기순이익": { field: "net_income", stmt: "is" },
  "순이익": { field: "net_income", stmt: "is" },
  "당기순이익(순손실)": { field: "net_income", stmt: "is" },
  "계속사업이익": { field: "net_income", stmt: "is" },
  "계속사업이익(손실)": { field: "net_income", stmt: "is" },
  "이자비용": { field: "interest_expense", stmt: "is" },
  "감가상각비": { field: "depreciation", stmt: "is" },
  "유형자산감가상각비": { field: "depreciation", stmt: "is" },
  "무형자산상각비": { field: "amortization", stmt: "is" },

  // ── 재무상태표 ──
  "자산": { field: "total_assets", stmt: "bs" },
  "자산총계": { field: "total_assets", stmt: "bs" },
  "유동자산": { field: "current_assets", stmt: "bs" },
  "현금 및 현금성자산": { field: "cash", stmt: "bs" },
  "현금및현금성자산": { field: "cash", stmt: "bs" },
  "매출채권": { field: "ar", stmt: "bs" },
  "매출채권 및 기타채권": { field: "ar", stmt: "bs" },
  "비유동자산": { field: "non_current", stmt: "bs" },
  "유형자산": { field: "tangible", stmt: "bs" },
  "무형자산": { field: "intangible", stmt: "bs" },
  "부채": { field: "total_liab", stmt: "bs" },
  "부채총계": { field: "total_liab", stmt: "bs" },
  "유동부채": { field: "current_liab", stmt: "bs" },
  "단기차입금": { field: "short_borrow", stmt: "bs" },
  "미지급비용": { field: "accrued_exp", stmt: "bs" },
  "비유동부채": { field: "non_current_liab", stmt: "bs" },
  "장기차입금": { field: "long_borrow", stmt: "bs" },
  "자본": { field: "total_equity", stmt: "bs" },
  "자본총계": { field: "total_equity", stmt: "bs" },
  "자본금": { field: "capital_stock", stmt: "bs" },
  "보통주자본금": { field: "capital_stock", stmt: "bs" },
  "자본잉여금": { field: "capital_surplus", stmt: "bs" },
  "이익잉여금": { field: "retained_earnings", stmt: "bs" },

  // ── 현금흐름표 ──
  "영업활동으로 인한 현금흐름": { field: "operating", stmt: "cf" },
  "영업활동현금흐름": { field: "operating", stmt: "cf" },
  "투자활동으로 인한 현금흐름": { field: "investing", stmt: "cf" },
  "투자활동현금흐름": { field: "investing", stmt: "cf" },
  "재무활동으로 인한 현금흐름": { field: "financing", stmt: "cf" },
  "재무활동현금흐름": { field: "financing", stmt: "cf" },
  "현금의 증가(감소)": { field: "net_change", stmt: "cf" },
  "현금의증감": { field: "net_change", stmt: "cf" },
};

/** 계정명 정규화 — 들여쓰기·*표·괄호 정리 */
function normalizeAccountName(s: string): string {
  return s
    .trim()
    .replace(/^[\s\*\-•·•]+/, "") // leading 공백·bullet·star·dash
    .replace(/\s*\(\*\)\s*$/, "") // trailing (*)
    .replace(/\s+/g, " ") // 내부 공백 정리
    .normalize("NFC");
}

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
  // "FY2024" 또는 "2021-12-31" 또는 "2021년"
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
        // 같은 행 다음 셀
        const next = String(row[i + 1] ?? "").trim();
        if (next && next.length < 80 && !/^\d{4}/.test(next)) return next;
      }
      // "회사명: ABC" 한 셀에 다 들어있는 경우
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

/** 헤더 행에서 첫 4자리 연도 패턴이 "YYYY-MM-DD" 면 결산일 추출 */
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

  // 헤더 행 찾기 — 4자리 연도가 2개 이상 있는 행
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
      // 연도 오름차순 정렬
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

  // 단위 감지
  const allText = allRows
    .flatMap((r) => (r ?? []).map((c) => String(c ?? "")))
    .join(" ");
  const { multiplier, label: detectedUnit } = detectUnit(allText);

  // 계정명 매칭
  const matches = new Map<string, (number | null)[]>();
  const unmatched = new Set<string>();

  for (const row of allRows) {
    if (!row || row.length === 0) continue;
    // 첫 번째 텍스트 셀 = 계정명
    let nameCell = "";
    for (let i = 0; i < row.length && i < headerColIdx[0]; i++) {
      const v = String(row[i] ?? "").trim();
      if (v) {
        nameCell = v;
        break;
      }
    }
    if (!nameCell) continue;

    const normalized = normalizeAccountName(nameCell);
    const def = ACCOUNT_MAP[normalized];

    if (!def) {
      // 매칭 안 됐는데 값은 있는 행 → 미매칭 로그
      const hasValue = headerColIdx.some((i) => parseNumber(row[i]) != null);
      if (hasValue && normalized.length < 30) unmatched.add(normalized);
      continue;
    }

    const values = headerColIdx.map((i) => {
      const n = parseNumber(row[i]);
      return n != null ? Math.round(n * multiplier) : null;
    });

    const mapKey = `${def.stmt}.${def.field}`;
    if (!matches.has(mapKey)) {
      matches.set(mapKey, values);
    }
  }

  if (matches.size === 0) {
    throw new Error(
      `매칭된 계정 0개. 한국 K-IFRS 표준 계정명(매출액, 자산총계, 영업이익 등) 사용해주세요. 발견된 미매칭 일부: ${Array.from(unmatched).slice(0, 8).join(", ")}`
    );
  }

  const get = (stmt: StatementKey, field: string): (number | null)[] => {
    return matches.get(`${stmt}.${field}`) ?? years.map(() => null);
  };

  const companyName = inferCompanyName(filename, allRows);
  const fiscalYearEnd = inferFiscalYearEnd(headerRow);

  const raw: RawCompanyData = {
    meta: {
      company_name: companyName,
      fiscal_years: years,
      currency_unit: "백만원",
      report_date: new Date().toISOString().slice(0, 10),
      source: "Manual",
      data_period: `${years[0]}-${years[years.length - 1]}`,
      fiscal_year_end: fiscalYearEnd,
    },
    company: {
      is_listed: false,
    },
    financials: {
      income_statement: {
        revenue: get("is", "revenue"),
        cogs: get("is", "cogs"),
        gross_profit: get("is", "gross_profit"),
        sga: get("is", "sga"),
        operating_income: get("is", "operating_income"),
        net_income: get("is", "net_income"),
        interest_expense: get("is", "interest_expense"),
        depreciation: get("is", "depreciation"),
        amortization: get("is", "amortization"),
      },
      balance_sheet: {
        total_assets: get("bs", "total_assets"),
        current_assets: get("bs", "current_assets"),
        cash: get("bs", "cash"),
        ar: get("bs", "ar"),
        non_current: get("bs", "non_current"),
        tangible: get("bs", "tangible"),
        intangible: get("bs", "intangible"),
        total_liab: get("bs", "total_liab"),
        current_liab: get("bs", "current_liab"),
        short_borrow: get("bs", "short_borrow"),
        accrued_exp: get("bs", "accrued_exp"),
        non_current_liab: get("bs", "non_current_liab"),
        long_borrow: get("bs", "long_borrow"),
        total_equity: get("bs", "total_equity"),
        capital_stock: get("bs", "capital_stock"),
        capital_surplus: get("bs", "capital_surplus"),
        retained_earnings: get("bs", "retained_earnings"),
      },
      cash_flow_raw: {
        operating: get("cf", "operating"),
        investing: get("cf", "investing"),
        financing: get("cf", "financing"),
        net_change: get("cf", "net_change"),
      },
    },
  };

  const warnings: string[] = [];
  if (detectedUnit !== "백만원") warnings.push(`단위 ${detectedUnit} → 백만원 자동 변환됨`);

  return {
    raw,
    warnings,
    matchedCount: matches.size,
    unmatchedAccounts: Array.from(unmatched).sort(),
    detectedUnit,
  };
}
