/**
 * computed.ts — RawCompanyData → ComputedMetrics 자동 계산.
 *
 * 결정적, 비용 0. 모든 식은 docs/SCHEMA.md §1.2 참조.
 *
 * 주의:
 *   - 모든 입력 배열은 fiscal_years와 길이 일치 가정.
 *   - null이 섞일 수 있으므로 모든 산술은 safe wrapper 통해.
 *   - 배수/비율은 분모 0/null/음수 케이스 일관 처리.
 */

import type {
  RawCompanyData,
  RawIncomeStatement,
  RawBalanceSheet,
  RawCashFlow,
  ComputedMetrics,
  ComputedTopKpi,
  RatioGrowth,
  RatioProfitability,
  RatioStability,
  RatioActivity,
  DerivedCashFlow,
} from "@/types/CompanyAnalysis";
import { classifySignal, type ThresholdKey } from "@/lib/thresholds";

// ── helpers ──────────────────────────────────────────────────────────

function safeDiv(a: number | null, b: number | null): number | null {
  if (a == null || b == null || b === 0) return null;
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return a / b;
}

function ratioYoY(arr: (number | null)[]): (number | null)[] {
  return arr.map((v, i) => {
    if (i === 0) return null;
    const prev = arr[i - 1];
    if (v == null || prev == null || prev === 0) return null;
    // 음수 → 양수 전환 등 부호 바뀌는 경우 % 의미가 깨짐. 이 경우 null.
    if (Math.sign(prev) !== Math.sign(v)) return null;
    return v / prev - 1;
  });
}

function delta(arr: (number | null)[]): (number | null)[] {
  return arr.map((v, i) => {
    if (i === 0) return null;
    const prev = arr[i - 1];
    if (v == null || prev == null) return null;
    return v - prev;
  });
}

function lastNonNull(arr: (number | null)[]): number | null {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (arr[i] != null) return arr[i];
  }
  return null;
}

// ── ratios ────────────────────────────────────────────────────────────

function computeGrowth(is: RawIncomeStatement, bs: RawBalanceSheet): RatioGrowth {
  const rev = is.revenue;
  const revYoY = ratioYoY(rev);

  // CAGR — 마지막 4년 (3년 간격)
  let cagr3y: number | undefined;
  if (rev.length >= 4) {
    const start = rev[rev.length - 4];
    const end = rev[rev.length - 1];
    if (start != null && end != null && start > 0 && end > 0) {
      cagr3y = Math.pow(end / start, 1 / 3) - 1;
    }
  }

  // 5y multiple — 첫 해 / 마지막 해
  let multiple: number | undefined;
  const first = rev[0];
  const last = lastNonNull(rev);
  if (first != null && last != null && first > 0) {
    multiple = last / first;
  }

  return {
    revenue_yoy: revYoY,
    revenue_5y_multiple: multiple,
    cagr_3y: cagr3y,
    asset_yoy: ratioYoY(bs.total_assets),
  };
}

function computeProfitability(is: RawIncomeStatement): RatioProfitability {
  const rev = is.revenue;
  const elementWise = (arr: (number | null)[] | undefined) =>
    rev.map((r, i) => safeDiv(arr?.[i] ?? null, r));

  const dep = is.depreciation;
  const amort = is.amortization;
  const ebitda = rev.map((_, i) => {
    const op = is.operating_income[i];
    if (op == null) return null;
    const d = dep?.[i] ?? 0;
    const a = amort?.[i] ?? 0;
    return op + d + a;
  });

  return {
    gross_margin: elementWise(is.gross_profit),
    operating_margin: elementWise(is.operating_income),
    ebitda_margin: elementWise(ebitda),
    net_margin: elementWise(is.net_income),
    sga_ratio: elementWise(is.sga),
    personnel_ratio: elementWise(is.salary_total),
    rent_ratio: elementWise(is.rent),
  };
}

function computeStability(bs: RawBalanceSheet): RatioStability {
  const N = bs.total_assets.length;
  const range = Array.from({ length: N }, (_, i) => i);

  const current_ratio = range.map((i) =>
    safeDiv(bs.current_assets[i], bs.current_liab[i])
  );
  // quick = (current_assets - 재고) / current_liab. 재고 별도 키 없음 → 보수적으로 ar+cash 합 가정.
  const quick_ratio = range.map((i) => {
    const cash = bs.cash?.[i] ?? null;
    const ar = bs.ar?.[i] ?? null;
    if (cash == null && ar == null) return null;
    const liquid = (cash ?? 0) + (ar ?? 0);
    return safeDiv(liquid, bs.current_liab[i]);
  });
  const debt_ratio = range.map((i) =>
    safeDiv(bs.total_liab[i], bs.total_equity[i])
  );
  const equity_ratio = range.map((i) =>
    safeDiv(bs.total_equity[i], bs.total_assets[i])
  );
  const short_debt_ratio = range.map((i) =>
    safeDiv(bs.short_borrow?.[i] ?? null, bs.total_liab[i])
  );
  const current_liab_ratio = range.map((i) =>
    safeDiv(bs.current_liab[i], bs.total_liab[i])
  );
  const intangible_ratio = range.map((i) =>
    safeDiv(bs.intangible?.[i] ?? null, bs.total_assets[i])
  );
  // 자본잠식 = 완전잠식(total_equity < 0) OR 부분잠식(total_equity < capital_stock).
  // 한국 상법상 자본금 미달 = 부분잠식도 잠식으로 분류 (배당 제한 등 동일 효과).
  const capital_erosion = range.map((i) => {
    const eq = bs.total_equity[i];
    const cap = bs.capital_stock?.[i];
    if (eq == null) return false;
    if (eq < 0) return true;
    if (cap != null && eq < cap) return true;
    return false;
  });

  return {
    current_ratio,
    quick_ratio,
    debt_ratio,
    equity_ratio,
    short_debt_ratio,
    current_liab_ratio,
    intangible_ratio,
    capital_erosion,
  };
}

function computeActivity(
  is: RawIncomeStatement,
  bs: RawBalanceSheet
): RatioActivity {
  const N = is.revenue.length;
  const range = Array.from({ length: N }, (_, i) => i);

  const asset_turnover = range.map((i) =>
    safeDiv(is.revenue[i], bs.total_assets[i])
  );
  const ar_turnover = range.map((i) =>
    safeDiv(is.revenue[i], bs.ar?.[i] ?? null)
  );
  const ar_days = ar_turnover.map((t) =>
    t == null || t === 0 ? null : 365 / t
  );

  return { asset_turnover, ar_turnover, ar_days };
}

// ── derived cash flow ─────────────────────────────────────────────────

function computeDerivedCF(
  is: RawIncomeStatement,
  bs: RawBalanceSheet,
  cfRaw: RawCashFlow | undefined
): DerivedCashFlow {
  const N = is.revenue.length;
  const range = Array.from({ length: N }, (_, i) => i);
  const dep = is.depreciation;
  const amort = is.amortization;

  // EBITDA = 영업이익 + 감가 + 무형상각
  const ebitda = range.map((i) => {
    const op = is.operating_income[i];
    if (op == null) return null;
    const d = dep?.[i] ?? 0;
    const a = amort?.[i] ?? 0;
    return op + d + a;
  });
  const ebitda_margin = range.map((i) =>
    safeDiv(ebitda[i], is.revenue[i])
  );

  // OCF — DART raw 우선, 없으면 추정 (순이익 + D&A − ΔNWC)
  // ΔNWC = Δ(current_assets - cash) − Δcurrent_liab (영업운전자본 변동, 현금 제외)
  const ocf_estimate = range.map((i) => {
    if (cfRaw?.operating?.[i] != null) return cfRaw.operating[i];
    if (i === 0) return null;
    const ni = is.net_income[i];
    if (ni == null) return null;
    const d = dep?.[i] ?? 0;
    const a = amort?.[i] ?? 0;
    const ca = bs.current_assets[i];
    const caPrev = bs.current_assets[i - 1];
    const cash = bs.cash?.[i] ?? 0;
    const cashPrev = bs.cash?.[i - 1] ?? 0;
    const cl = bs.current_liab[i];
    const clPrev = bs.current_liab[i - 1];
    if (ca == null || caPrev == null || cl == null || clPrev == null) return null;
    const opWC = ca - cash - (caPrev - cashPrev); // 영업 유동자산 변동 (현금 제외)
    const dCL = cl - clPrev;
    const dNWC = opWC - dCL;
    return ni + d + a - dNWC;
  });

  // CAPEX = Δ(tangible + intangible) + D&A — 음수면 0으로 cap.
  const capex = range.map((i) => {
    if (i === 0) return null;
    const tan = bs.tangible?.[i];
    const tanPrev = bs.tangible?.[i - 1];
    const intg = bs.intangible?.[i];
    const intgPrev = bs.intangible?.[i - 1];
    if (tan == null && intg == null) return null;
    const dTan = (tan ?? 0) - (tanPrev ?? 0);
    const dIntg = (intg ?? 0) - (intgPrev ?? 0);
    const d = dep?.[i] ?? 0;
    const a = amort?.[i] ?? 0;
    const c = dTan + dIntg + d + a;
    return c < 0 ? 0 : c;
  });

  const fcf = range.map((i) => {
    const ocf = ocf_estimate[i];
    const cx = capex[i];
    if (ocf == null || cx == null) return null;
    return ocf - cx;
  });
  const fcf_margin = range.map((i) => safeDiv(fcf[i], is.revenue[i]));

  // Runway = cash / (월간 -fcf) — fcf가 음수일 때만 의미.
  const runway_months = range.map((i) => {
    const cash = bs.cash?.[i];
    const f = fcf[i];
    if (cash == null || f == null) return null;
    if (f >= 0) return null; // 양수면 runway 무한, UI에선 별도 처리
    const monthly = -f / 12;
    if (monthly <= 0) return null;
    return cash / monthly;
  });

  const interest_coverage = range.map((i) =>
    safeDiv(is.operating_income[i], is.interest_expense?.[i] ?? null)
  );

  // total_debt = short_borrow + long_borrow
  const total_debt = range.map((i) => {
    const s = bs.short_borrow?.[i];
    const l = bs.long_borrow?.[i];
    if (s == null && l == null) return null;
    return (s ?? 0) + (l ?? 0);
  });

  return {
    ebitda,
    ebitda_margin,
    ocf_estimate,
    capex,
    fcf,
    fcf_margin,
    runway_months,
    interest_coverage,
    total_debt,
  };
}

// ── top KPIs ──────────────────────────────────────────────────────────

function computeTopKpis(
  ratios: ComputedMetrics["ratios"],
  cf: DerivedCashFlow,
  is: RawIncomeStatement
): ComputedTopKpi[] {
  const N = is.revenue.length;
  const last = N - 1;
  const lastNonNullVal = (arr: (number | null)[]) => arr[last] ?? lastNonNull(arr);
  const yoyAt = (arr: (number | null)[], idx: number) => {
    const v = arr[idx];
    const p = arr[idx - 1];
    if (v == null || p == null || p === 0) return null;
    if (Math.sign(p) !== Math.sign(v)) return null;
    return v / p - 1;
  };

  const make = (
    label: string,
    valueArr: (number | null)[] | undefined,
    unit: string,
    thresholdKey: ThresholdKey | null
  ): ComputedTopKpi | null => {
    if (!valueArr) return null;
    const v = lastNonNullVal(valueArr);
    if (v == null) return null;
    return {
      label,
      value_latest: v,
      unit,
      yoy: yoyAt(valueArr, last),
      signal: thresholdKey ? classifySignal(thresholdKey, v) : "yellow",
    };
  };

  const kpis: (ComputedTopKpi | null)[] = [
    make("매출 YoY", ratios.growth.revenue_yoy, "%", "revenue_yoy"),
    make("영업이익률", ratios.profitability.operating_margin, "%", "operating_margin"),
    make("EBITDA 마진", cf.ebitda_margin, "%", "ebitda_margin"),
    make("부채비율", ratios.stability.debt_ratio, "%", "debt_ratio"),
    make("유동비율", ratios.stability.current_ratio, "%", "current_ratio"),
    make("자기자본비율", ratios.stability.equity_ratio, "%", "equity_ratio"),
    make("FCF 마진", cf.fcf_margin, "%", "fcf_margin"),
    make("Runway", cf.runway_months, "개월", "runway_months"),
    make("이자보상배율", cf.interest_coverage, "배", "interest_coverage"),
    make("매출채권 회수기간", ratios.activity.ar_days, "일", "ar_days"),
  ];

  return kpis.filter((k): k is ComputedTopKpi => k !== null);
}

// ── per-item ──────────────────────────────────────────────────────────

/**
 * RawIncomeStatement의 모든 line item을 ComputedItem 배열로 변환.
 * share_latest는 매출 대비, balance_sheet는 총자산 대비.
 */
function computeIncomeItems(
  is: RawIncomeStatement
): ComputedMetrics["per_item"]["income"] {
  const rev = is.revenue;
  const lastIdx = rev.length - 1;
  const revLast = rev[lastIdx] ?? lastNonNull(rev);

  const items: { name: string; values: (number | null)[] }[] = [];
  for (const [k, v] of Object.entries(is)) {
    if (k === "revenue_breakdown") continue;
    if (Array.isArray(v)) items.push({ name: k, values: v });
  }
  // revenue_breakdown 평탄화
  if (is.revenue_breakdown) {
    for (const [k, v] of Object.entries(is.revenue_breakdown)) {
      items.push({ name: k, values: v });
    }
  }

  return items.map((it) => ({
    name: it.name,
    values: it.values,
    yoy_latest: (() => {
      const v = it.values[lastIdx];
      const p = it.values[lastIdx - 1];
      if (v == null || p == null || p === 0) return null;
      if (Math.sign(p) !== Math.sign(v)) return null;
      return v / p - 1;
    })(),
    share_latest: (() => {
      const v = it.values[lastIdx];
      if (v == null || revLast == null || revLast === 0) return null;
      return v / revLast;
    })(),
    trend_5y_multiple: (() => {
      const first = it.values[0];
      const last = it.values[lastIdx] ?? lastNonNull(it.values);
      if (first == null || last == null || first === 0) return undefined;
      if (Math.sign(first) !== Math.sign(last)) return undefined;
      return last / first;
    })(),
  }));
}

function computeBalanceItems(
  bs: RawBalanceSheet
): ComputedMetrics["per_item"]["balance"] {
  const lastIdx = bs.total_assets.length - 1;
  const totalLast = bs.total_assets[lastIdx] ?? lastNonNull(bs.total_assets);

  const items: { name: string; values: (number | null)[] }[] = [];
  for (const [k, v] of Object.entries(bs)) {
    if (Array.isArray(v)) items.push({ name: k, values: v });
  }

  return items.map((it) => ({
    name: it.name,
    values: it.values,
    yoy_latest: (() => {
      const v = it.values[lastIdx];
      const p = it.values[lastIdx - 1];
      if (v == null || p == null || p === 0) return null;
      if (Math.sign(p) !== Math.sign(v)) return null;
      return v / p - 1;
    })(),
    share_latest: (() => {
      const v = it.values[lastIdx];
      if (v == null || totalLast == null || totalLast === 0) return null;
      return v / totalLast;
    })(),
    trend_5y_multiple: (() => {
      const first = it.values[0];
      const last = it.values[lastIdx] ?? lastNonNull(it.values);
      if (first == null || last == null || first === 0) return undefined;
      if (Math.sign(first) !== Math.sign(last)) return undefined;
      return last / first;
    })(),
  }));
}

// ── public API ────────────────────────────────────────────────────────

export function computeMetrics(raw: RawCompanyData): ComputedMetrics {
  const is = raw.financials.income_statement;
  const bs = raw.financials.balance_sheet;
  const cfRaw = raw.financials.cash_flow_raw;

  const ratios: ComputedMetrics["ratios"] = {
    growth: computeGrowth(is, bs),
    profitability: computeProfitability(is),
    stability: computeStability(bs),
    activity: computeActivity(is, bs),
  };
  const derived_cf = computeDerivedCF(is, bs, cfRaw);
  const top_kpis = computeTopKpis(ratios, derived_cf, is);
  const per_item = {
    income: computeIncomeItems(is),
    balance: computeBalanceItems(bs),
  };

  return { ratios, derived_cf, top_kpis, per_item };
}

// 내부 사용 + 테스트 노출
export const __internal = {
  safeDiv,
  ratioYoY,
  delta,
  lastNonNull,
};
