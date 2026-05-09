/**
 * RawCompanyData + ComputedMetrics → 페이지(BS/IS/CF)별 섹션 그룹.
 *
 * 짐캐리 legacy의 income_items / balance_items 구조를 새 schema에서 자동 생성:
 *   - 라인아이템 키 → 한국어 라벨 + 그룹(자산/부채/자본 또는 매출/원가·판관비/...) 매핑
 *   - share = 마지막 연도 비중
 *   - yoy = 마지막 연도 대비 직전 연도
 *   - trend = "X.X배 증가" 같은 한 줄 문자열
 *   - learn_note / investment_note = narrative.item_notes 있으면 인용, 없으면 빈 문자열
 */

import type {
  RawCompanyData,
  ComputedMetrics,
  CompanyNarrative,
  RawIncomeStatement,
  RawBalanceSheet,
  RawCashFlow,
} from "@/types/CompanyAnalysis";
import type { TableItem } from "@/components/ItemTableSection";

// ─────────────────────────────────────────────────────────────────
// 라벨 + 그룹 매핑
// ─────────────────────────────────────────────────────────────────

const BS_GROUPS: Array<{
  section: "자산" | "부채" | "자본";
  totalKey: keyof RawBalanceSheet;
  items: Array<{ key: keyof RawBalanceSheet; label: string; tag: string }>;
}> = [
  {
    section: "자산",
    totalKey: "total_assets",
    items: [
      { key: "total_assets", label: "자산총계", tag: "현금성" },
      { key: "current_assets", label: "유동자산", tag: "현금성" },
      { key: "cash", label: "현금 및 현금성자산", tag: "현금성" },
      { key: "ar", label: "매출채권", tag: "운전자본" },
      { key: "non_current", label: "비유동자산", tag: "인프라" },
      { key: "tangible", label: "유형자산", tag: "인프라" },
      { key: "intangible", label: "무형자산", tag: "무형" },
      { key: "deposits", label: "임차보증금", tag: "담보금" },
    ],
  },
  {
    section: "부채",
    totalKey: "total_liab",
    items: [
      { key: "total_liab", label: "부채총계", tag: "차입" },
      { key: "current_liab", label: "유동부채", tag: "차입" },
      { key: "short_borrow", label: "단기차입금", tag: "이자부채" },
      { key: "accrued_exp", label: "미지급비용", tag: "운전자본" },
      { key: "non_current_liab", label: "비유동부채", tag: "차입" },
      { key: "long_borrow", label: "장기차입금", tag: "이자부채" },
    ],
  },
  {
    section: "자본",
    totalKey: "total_equity",
    items: [
      { key: "total_equity", label: "자본총계", tag: "투자자금" },
      { key: "capital_stock", label: "자본금", tag: "투자자금" },
      { key: "retained_earnings", label: "이익잉여금", tag: "결손" },
    ],
  },
];

const IS_GROUPS: Array<{
  section: string;
  items: Array<{ key: keyof RawIncomeStatement; label: string; tag: string }>;
}> = [
  {
    section: "매출",
    items: [
      { key: "revenue", label: "매출액", tag: "매출" },
    ],
  },
  {
    section: "매출원가·매출총이익",
    items: [
      { key: "cogs", label: "매출원가", tag: "운송" },
      { key: "gross_profit", label: "매출총이익", tag: "수익" },
    ],
  },
  {
    section: "판매비와관리비",
    items: [
      { key: "sga", label: "판매비와관리비", tag: "기타" },
      { key: "salary_total", label: "급여 합계", tag: "인건비" },
      { key: "rent", label: "임차료", tag: "임차료" },
      { key: "fees_total", label: "지급수수료·플랫폼", tag: "플랫폼" },
      { key: "transport", label: "운반비", tag: "운송" },
      { key: "depreciation", label: "감가상각비", tag: "인프라" },
      { key: "amortization", label: "무형상각비", tag: "무형" },
    ],
  },
  {
    section: "영업이익·순이익",
    items: [
      { key: "operating_income", label: "영업이익", tag: "수익" },
      { key: "interest_expense", label: "이자비용", tag: "금융" },
      { key: "net_income", label: "당기순이익", tag: "수익" },
    ],
  },
];

const CF_GROUPS: Array<{
  section: string;
  items: Array<{ key: keyof RawCashFlow; label: string; tag: string }>;
}> = [
  {
    section: "현금흐름",
    items: [
      { key: "operating", label: "영업활동현금흐름 (OCF)", tag: "현금성" },
      { key: "investing", label: "투자활동현금흐름", tag: "투자자금" },
      { key: "financing", label: "재무활동현금흐름", tag: "차입" },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────
// 변환 함수
// ─────────────────────────────────────────────────────────────────

function fmtTrend(values: (number | null)[]): string {
  const filled = values.filter((v): v is number => v != null);
  if (filled.length < 2) return "—";
  const first = filled[0];
  const last = filled[filled.length - 1];
  if (first === 0) return last > 0 ? "0→증가" : "0→감소";
  const ratio = last / first;
  const sign = first < 0 ? -1 : 1;
  if (Math.abs(ratio) >= 1.5 || ratio < 0) {
    return `${(Math.abs(ratio) * sign).toFixed(2)}배`;
  }
  if (ratio < 0.5) return `${(ratio * 100).toFixed(0)}% 수준으로 감소`;
  return `${((ratio - 1) * 100).toFixed(1)}% 변화`;
}

function lastYoY(values: (number | null)[]): number | null {
  if (values.length < 2) return null;
  const last = values[values.length - 1];
  const prev = values[values.length - 2];
  if (last == null || prev == null || prev === 0) return null;
  return (last - prev) / Math.abs(prev);
}

function shareOf(
  values: (number | null)[],
  totalValues: (number | null)[]
): number {
  const last = values[values.length - 1];
  const total = totalValues[totalValues.length - 1];
  if (last == null || total == null || total === 0) return 0;
  return last / total;
}

function buildItem<K extends string>(
  key: K,
  label: string,
  tag: string,
  values: (number | null)[],
  totals: (number | null)[],
  itemNotes?: Record<string, { insight?: string; learn_note?: string; investment_note?: string }>
): TableItem | null {
  const filled = values.filter((v): v is number => v != null).length;
  if (filled === 0) return null;
  const note = itemNotes?.[key] ?? itemNotes?.[label] ?? {};
  // insight 우선 — 없으면 legacy learn_note + investment_note 결합
  const insight = note.insight ??
    [note.learn_note, note.investment_note].filter(Boolean).join(" ");
  return {
    name: label,
    tag,
    values_mil: values,
    yoy_2025: lastYoY(values),
    trend: fmtTrend(values),
    share: shareOf(values, totals),
    shareLabel: undefined,
    insight,
  };
}

// ─────────────────────────────────────────────────────────────────
// 페이지별 외부 API
// ─────────────────────────────────────────────────────────────────

export type Section = {
  section: string;
  total?: { values: (number | null)[]; yoy: number | null };
  items: TableItem[];
};

export function balanceSections(
  raw: RawCompanyData,
  _computed: ComputedMetrics,
  narrative?: CompanyNarrative
): Section[] {
  const bs = raw.financials.balance_sheet;
  const notes = (narrative?.item_notes?.balance ?? {}) as Record<
    string,
    { insight?: string; learn_note?: string; investment_note?: string }
  >;
  return BS_GROUPS.map((g) => {
    const totalValues = (bs[g.totalKey] ?? []) as (number | null)[];
    const items: TableItem[] = [];
    for (const i of g.items) {
      const values = (bs[i.key] ?? []) as (number | null)[];
      const item = buildItem(
        i.key,
        i.label,
        i.tag,
        values,
        totalValues,
        notes
      );
      if (item) {
        item.shareLabel =
          g.section === "자산"
            ? "자산비중"
            : g.section === "부채"
              ? "부채비중"
              : "자본비중";
        items.push(item);
      }
    }
    return {
      section: g.section,
      total: {
        values: totalValues,
        yoy: lastYoY(totalValues),
      },
      items,
    };
  }).filter((s) => s.items.length > 0);
}

export function incomeSections(
  raw: RawCompanyData,
  _computed: ComputedMetrics,
  narrative?: CompanyNarrative
): Section[] {
  const is = raw.financials.income_statement;
  const notes = (narrative?.item_notes?.income ?? {}) as Record<
    string,
    { insight?: string; learn_note?: string; investment_note?: string }
  >;
  const revenueArr = (is.revenue ?? []) as (number | null)[];
  return IS_GROUPS.map((g) => {
    const items: TableItem[] = [];
    for (const i of g.items) {
      const values = (is[i.key] ?? []) as (number | null)[];
      const item = buildItem(
        i.key,
        i.label,
        i.tag,
        values,
        revenueArr,
        notes
      );
      if (item) {
        item.shareLabel = "매출비중";
        items.push(item);
      }
    }
    return { section: g.section, items };
  }).filter((s) => s.items.length > 0);
}

export function cashflowSections(
  raw: RawCompanyData,
  computed: ComputedMetrics
): Section[] {
  const cfRaw = raw.financials.cash_flow_raw;
  const items: TableItem[] = [];
  if (cfRaw) {
    for (const g of CF_GROUPS) {
      for (const i of g.items) {
        const values = (cfRaw[i.key] ?? []) as (number | null)[];
        const item = buildItem(i.key, i.label, i.tag, values, values, undefined);
        if (item) items.push(item);
      }
    }
  }
  // computed.derived_cf — FCF, runway 등 항상 추가
  const dcf = computed.derived_cf;
  if (dcf) {
    const lastYearIdx = dcf.fcf.length - 1;
    if (dcf.fcf.some((v) => v != null)) {
      items.push({
        name: "FCF (잉여현금흐름)",
        tag: "현금성",
        values_mil: dcf.fcf,
        yoy_2025: lastYoY(dcf.fcf),
        trend: fmtTrend(dcf.fcf),
        share: 0,
        shareLabel: undefined,
        insight: "",
      });
    }
    if (dcf.capex && dcf.capex.some((v) => v != null)) {
      items.push({
        name: "CAPEX (자본적지출)",
        tag: "투자자금",
        values_mil: dcf.capex,
        yoy_2025: lastYoY(dcf.capex),
        trend: fmtTrend(dcf.capex),
        share: 0,
        shareLabel: undefined,
        insight: "",
      });
    }
    if (dcf.runway_months && dcf.runway_months[lastYearIdx] != null) {
      // runway는 백만원이 아니라 월수 — 일반 row에 표시하기 까다로워 스킵
    }
  }
  return [{ section: "현금흐름", items }];
}
