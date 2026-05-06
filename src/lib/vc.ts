/**
 * VC·투자 관점 지표 — raw + computed에서 결정적 산출.
 *
 * 모든 금액 단위는 백만원. 비율은 소수(0.20 = 20%).
 *
 * 핵심 지표:
 *   1. 자본 효율성 — 누적 매출 / 누적 조달 자본 (얼마 받아 얼마 벌었나)
 *   2. Burn rate — 월평균 적자 (FCF 음수 기준)
 *   3. Burn multiple — 연간 burn / 연간 매출 증가분 (SaaS 표준)
 *   4. BEP 도달 예측 — 영업이익률 trend 선형회귀
 *   5. 청산가치 — 자산 회수율 가정 - 부채
 *   6. Asset-light score — 무형자산 비중
 *   7. 자본금 변화 — 증자 패턴
 */

import type {
  RawCompanyData,
  ComputedMetrics,
} from "@/types/CompanyAnalysis";

export type VCMetrics = {
  capital_efficiency: {
    cumulative_revenue_mil: number | null;
    invested_capital_mil: number | null; // 마지막 해 자본금 + 자본잉여금
    ratio: number | null; // revenue / invested_capital
  };
  burn: {
    /** 마지막 해 FCF (음수면 burn) */
    annual_fcf_mil: number | null;
    monthly_burn_mil: number | null; // -fcf / 12
    runway_months: number | null;
  };
  burn_multiple: {
    annual_burn_mil: number | null; // -fcf
    annual_revenue_growth_mil: number | null; // 마지막해 - 직전해 매출
    multiple: number | null; // burn / growth — SaaS 기준 1 이하 양호, 3↑ 비효율
    /** SaaS 표준 grade — Bessemer 기준 */
    grade: "amazing" | "great" | "ok" | "poor" | "bad" | null;
  };
  bep_estimate: {
    last_op_margin: number | null;
    op_margin_yoy_delta: number | null; // 직전해 대비 op margin 변화
    /** linear extrapolation으로 흑자 도달까지 남은 연수. 이미 흑자면 0. 둔화 중이면 null. */
    years_to_bep: number | null;
    bep_year: number | null;
  };
  liquidation: {
    cash_mil: number | null;
    ar_recoverable_mil: number | null; // ar * 0.7
    tangible_recoverable_mil: number | null; // 유형자산 * 0.3
    intangible_recoverable_mil: number; // 0 — 청산 시 회수 어려움
    total_recoverable_mil: number | null;
    total_liab_mil: number | null;
    net_liquidation_mil: number | null; // recoverable - 부채
    book_equity_mil: number | null;
    /** 청산가치 / 장부 자본 — 1 이상이면 청산이 책 자본 보호, 0.5 이하면 worthless 시그널 */
    coverage_ratio: number | null;
  };
  asset_light: {
    intangible_mil: number | null;
    tangible_mil: number | null;
    total_assets_mil: number | null;
    intangible_ratio: number | null; // intangible / total
  };
  capital_history: {
    capital_stock_first_mil: number | null;
    capital_stock_last_mil: number | null;
    surplus_first_mil: number | null;
    surplus_last_mil: number | null;
    /** 자본금 + 자본잉여금 5년 증가량 (대략 누적 외부 조달 추정) */
    estimated_raised_5y_mil: number | null;
  };
};

function lastVal(arr: (number | null)[] | undefined): number | null {
  if (!arr || arr.length === 0) return null;
  for (let i = arr.length - 1; i >= 0; i--) {
    if (arr[i] != null) return arr[i];
  }
  return null;
}

function firstVal(arr: (number | null)[] | undefined): number | null {
  if (!arr) return null;
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] != null) return arr[i];
  }
  return null;
}

function sumNonNull(arr: (number | null)[] | undefined): number | null {
  if (!arr) return null;
  let s = 0;
  let any = false;
  for (const v of arr) {
    if (v != null) {
      s += v;
      any = true;
    }
  }
  return any ? s : null;
}

function gradeBurnMultiple(
  m: number | null
): VCMetrics["burn_multiple"]["grade"] {
  if (m == null) return null;
  // Bessemer / SaaStr 표준
  if (m < 1) return "amazing";
  if (m < 1.5) return "great";
  if (m < 2) return "ok";
  if (m < 3) return "poor";
  return "bad";
}

export function computeVCMetrics(
  raw: RawCompanyData,
  computed: ComputedMetrics
): VCMetrics {
  const is = raw.financials.income_statement;
  const bs = raw.financials.balance_sheet;
  const cf = computed.derived_cf;
  const N = raw.meta.fiscal_years.length;
  const lastIdx = N - 1;

  // 1. 자본 효율성
  const capitalStockLast = lastVal(bs.capital_stock);
  const surplusLast = lastVal(bs.capital_surplus);
  const investedCapital =
    capitalStockLast != null || surplusLast != null
      ? (capitalStockLast ?? 0) + (surplusLast ?? 0)
      : null;
  const cumRevenue = sumNonNull(is.revenue);
  const capEff =
    investedCapital != null && investedCapital !== 0 && cumRevenue != null
      ? cumRevenue / investedCapital
      : null;

  // 2. Burn / Runway
  const lastFcf = lastVal(cf.fcf);
  const monthlyBurn = lastFcf != null && lastFcf < 0 ? -lastFcf / 12 : null;
  const lastRunway = lastVal(cf.runway_months);

  // 3. Burn multiple — SaaS 표준 = 연간 cash burn / 연간 ARR(매출) 증가분
  const lastRev = is.revenue[lastIdx];
  const prevRev = is.revenue[lastIdx - 1];
  const revGrowth =
    lastRev != null && prevRev != null && lastRev > prevRev
      ? lastRev - prevRev
      : null;
  const annualBurn = lastFcf != null && lastFcf < 0 ? -lastFcf : null;
  const burnMultiple =
    annualBurn != null && revGrowth != null && revGrowth > 0
      ? annualBurn / revGrowth
      : null;

  // 4. BEP 예측 — 직전 2년 op margin trend로 선형 외삽
  const opMargin = computed.ratios.profitability?.operating_margin;
  const lastMargin = opMargin?.[lastIdx] ?? null;
  const prevMargin = opMargin?.[lastIdx - 1] ?? null;
  const yoyDelta =
    lastMargin != null && prevMargin != null ? lastMargin - prevMargin : null;
  let yearsToBep: number | null = null;
  let bepYear: number | null = null;
  if (lastMargin != null) {
    if (lastMargin >= 0) {
      yearsToBep = 0;
      bepYear = raw.meta.fiscal_years[lastIdx];
    } else if (yoyDelta != null && yoyDelta > 0) {
      yearsToBep = Math.ceil(-lastMargin / yoyDelta);
      bepYear = raw.meta.fiscal_years[lastIdx] + yearsToBep;
    }
    // 둔화 중(yoyDelta <= 0)이면 둘 다 null
  }

  // 5. 청산가치
  const cashLast = lastVal(bs.cash);
  const arLast = lastVal(bs.ar);
  const tangibleLast = lastVal(bs.tangible);
  const totalLiabLast = lastVal(bs.total_liab);
  const totalEquityLast = lastVal(bs.total_equity);
  const arRecoverable = arLast != null ? arLast * 0.7 : null;
  const tangRecoverable = tangibleLast != null ? tangibleLast * 0.3 : null;
  const totalRecoverable =
    cashLast != null || arRecoverable != null || tangRecoverable != null
      ? (cashLast ?? 0) + (arRecoverable ?? 0) + (tangRecoverable ?? 0)
      : null;
  const netLiquidation =
    totalRecoverable != null && totalLiabLast != null
      ? totalRecoverable - totalLiabLast
      : null;
  const coverageRatio =
    netLiquidation != null && totalEquityLast != null && totalEquityLast > 0
      ? netLiquidation / totalEquityLast
      : null;

  // 6. Asset-light
  const intangibleLast = lastVal(bs.intangible);
  const totalAssetsLast = lastVal(bs.total_assets);
  const intangibleRatio =
    intangibleLast != null && totalAssetsLast != null && totalAssetsLast > 0
      ? intangibleLast / totalAssetsLast
      : null;

  // 7. Capital history
  const capStockFirst = firstVal(bs.capital_stock);
  const surplusFirst = firstVal(bs.capital_surplus);
  const stockDelta =
    capStockFirst != null && capitalStockLast != null
      ? capitalStockLast - capStockFirst
      : 0;
  const surplusDelta =
    surplusFirst != null && surplusLast != null
      ? surplusLast - surplusFirst
      : 0;
  const estRaised5y =
    capStockFirst != null || surplusFirst != null
      ? stockDelta + surplusDelta
      : null;

  return {
    capital_efficiency: {
      cumulative_revenue_mil: cumRevenue,
      invested_capital_mil: investedCapital,
      ratio: capEff,
    },
    burn: {
      annual_fcf_mil: lastFcf,
      monthly_burn_mil: monthlyBurn,
      runway_months: lastRunway,
    },
    burn_multiple: {
      annual_burn_mil: annualBurn,
      annual_revenue_growth_mil: revGrowth,
      multiple: burnMultiple,
      grade: gradeBurnMultiple(burnMultiple),
    },
    bep_estimate: {
      last_op_margin: lastMargin,
      op_margin_yoy_delta: yoyDelta,
      years_to_bep: yearsToBep,
      bep_year: bepYear,
    },
    liquidation: {
      cash_mil: cashLast,
      ar_recoverable_mil: arRecoverable,
      tangible_recoverable_mil: tangRecoverable,
      intangible_recoverable_mil: 0,
      total_recoverable_mil: totalRecoverable,
      total_liab_mil: totalLiabLast,
      net_liquidation_mil: netLiquidation,
      book_equity_mil: totalEquityLast,
      coverage_ratio: coverageRatio,
    },
    asset_light: {
      intangible_mil: intangibleLast,
      tangible_mil: tangibleLast,
      total_assets_mil: totalAssetsLast,
      intangible_ratio: intangibleRatio,
    },
    capital_history: {
      capital_stock_first_mil: capStockFirst,
      capital_stock_last_mil: capitalStockLast,
      surplus_first_mil: surplusFirst,
      surplus_last_mil: surplusLast,
      estimated_raised_5y_mil: estRaised5y,
    },
  };
}
