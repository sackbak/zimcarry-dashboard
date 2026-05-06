import type { Signal } from "@/lib/data";
import { classifySignal, type ThresholdKey } from "@/lib/thresholds";
import type { ComputedMetrics } from "@/types/CompanyAnalysis";

export const SIGNAL_LABEL: Record<Signal, string> = {
  green: "우수",
  yellow: "주의",
  red: "위험",
};

export const SIGNAL_DOT: Record<Signal, string> = {
  green: "🟢",
  yellow: "🟡",
  red: "🔴",
};

export const SIGNAL_BG: Record<Signal, string> = {
  green: "bg-emerald-50 text-emerald-700 border-emerald-200",
  yellow: "bg-amber-50 text-amber-700 border-amber-200",
  red: "bg-rose-50 text-rose-700 border-rose-200",
};

export const SIGNAL_BAR: Record<Signal, string> = {
  green: "bg-emerald-500",
  yellow: "bg-amber-500",
  red: "bg-rose-500",
};

export const SIGNAL_TEXT: Record<Signal, string> = {
  green: "text-emerald-600",
  yellow: "text-amber-600",
  red: "text-rose-600",
};

/**
 * Lite 모드 5대 카테고리 신호등 — LLM 없이 결정적 임계치만으로 산출.
 * 각 카테고리에서 여러 지표의 worst signal을 채택.
 * (red > yellow > green 우선순위)
 */
export type LiteCategory = {
  name: "성장성" | "수익성" | "안정성" | "활동성" | "현금흐름";
  signal: Signal;
  summary: string;
};

const RANK: Record<Signal, number> = { red: 0, yellow: 1, green: 2 };
const SUMMARY: Record<Signal, string> = {
  green: "🟢 양호",
  yellow: "🟡 주의",
  red: "🔴 위험",
};

function lastOf(arr: (number | null)[] | undefined): number | null {
  if (!arr || arr.length === 0) return null;
  for (let i = arr.length - 1; i >= 0; i--) {
    if (arr[i] != null) return arr[i];
  }
  return null;
}

/** 여러 (key, value) 쌍에서 worst signal 채택. 데이터 없으면 yellow. */
function worstSignal(
  pairs: { key: ThresholdKey; value: number | null }[]
): Signal {
  let worst: Signal = "green";
  let hasAny = false;
  for (const { key, value } of pairs) {
    if (value == null) continue;
    hasAny = true;
    const s = classifySignal(key, value);
    if (RANK[s] < RANK[worst]) worst = s;
  }
  return hasAny ? worst : "yellow";
}

export function computeLiteCategories(
  computed: ComputedMetrics
): LiteCategory[] {
  const r = computed.ratios;
  const cf = computed.derived_cf;

  const growth = worstSignal([
    { key: "revenue_yoy", value: lastOf(r.growth?.revenue_yoy) },
    { key: "cagr_3y", value: r.growth?.cagr_3y ?? null },
    { key: "revenue_5y_multiple", value: r.growth?.revenue_5y_multiple ?? null },
  ]);

  const profitability = worstSignal([
    { key: "operating_margin", value: lastOf(r.profitability?.operating_margin) },
    { key: "ebitda_margin", value: lastOf(cf?.ebitda_margin) },
    { key: "net_margin", value: lastOf(r.profitability?.net_margin) },
  ]);

  // 안정성: 자본잠식이 한 번이라도 있으면 최소 yellow 강제
  const stabBase = worstSignal([
    { key: "debt_ratio", value: lastOf(r.stability?.debt_ratio) },
    { key: "current_ratio", value: lastOf(r.stability?.current_ratio) },
    { key: "equity_ratio", value: lastOf(r.stability?.equity_ratio) },
  ]);
  const everEroded = (r.stability?.capital_erosion ?? []).some((x) => x === true);
  const stability: Signal =
    everEroded && stabBase === "green" ? "yellow" : stabBase;

  const activity = worstSignal([
    { key: "asset_turnover", value: lastOf(r.activity?.asset_turnover) },
    { key: "ar_days", value: lastOf(r.activity?.ar_days) },
  ]);

  const cashflow = worstSignal([
    { key: "fcf_margin", value: lastOf(cf?.fcf_margin) },
    { key: "runway_months", value: lastOf(cf?.runway_months) },
    { key: "interest_coverage", value: lastOf(cf?.interest_coverage) },
  ]);

  return [
    { name: "성장성", signal: growth, summary: SUMMARY[growth] },
    { name: "수익성", signal: profitability, summary: SUMMARY[profitability] },
    { name: "안정성", signal: stability, summary: SUMMARY[stability] },
    { name: "활동성", signal: activity, summary: SUMMARY[activity] },
    { name: "현금흐름", signal: cashflow, summary: SUMMARY[cashflow] },
  ];
}
