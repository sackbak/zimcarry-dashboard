/**
 * 밸류에이션 추정 — EV/EBITDA + EV/Sales 멀티플 기반.
 *
 * M&A 가격 협상의 1차 시작점. 산업별 표준 multiple (Korea market median, 공개 데이터 종합)
 * 을 회사의 EBITDA·매출에 곱해서 EV(기업가치) 범위 산출, net debt 차감해서 equity value.
 *
 * 정확한 밸류에이션은 peer comp + DCF + control premium 등 종합해야 하지만,
 * 이 함수는 **range floor·ceiling**만 빠르게 보여줌. 가격 시작 포인트.
 */

import type {
  RawCompanyData,
  ComputedMetrics,
} from "@/types/CompanyAnalysis";

export type MultipleRange = { low: number; mid: number; high: number };

export type IndustryMultiples = {
  key: string;
  label: string;
  ev_ebitda: MultipleRange;
  ev_sales: MultipleRange;
  notes: string;
};

/**
 * 산업별 표준 multiple — Korea market 기준.
 * 출처: 한국공인회계사회 가치평가 가이드 + Bloomberg / Capital IQ Korea median + 공개 M&A 거래 사례.
 * 2024~2025 기준 보수적 합의 범위.
 */
export const INDUSTRY_MULTIPLES: Record<string, IndustryMultiples> = {
  tech_saas: {
    key: "tech_saas",
    label: "Tech / SaaS / 플랫폼",
    ev_ebitda: { low: 12, mid: 18, high: 25 },
    ev_sales: { low: 3, mid: 6, high: 10 },
    notes: "성장률 40%↑ rule-of-40 충족 시 high 적용. 매출 다수면 EV/Sales가 더 의미.",
  },
  manufacturing: {
    key: "manufacturing",
    label: "제조업 (반도체·자동차·기계)",
    ev_ebitda: { low: 5, mid: 8, high: 11 },
    ev_sales: { low: 0.7, mid: 1.2, high: 2.0 },
    notes: "장치산업 특성상 EBITDA 변동성 큼. cyclical 고려.",
  },
  retail_ecommerce: {
    key: "retail_ecommerce",
    label: "유통 / 이커머스",
    ev_ebitda: { low: 8, mid: 12, high: 16 },
    ev_sales: { low: 0.8, mid: 1.8, high: 3.5 },
    notes: "마진 낮은 산업. 매출 성장률·반복구매율이 multiple 좌우.",
  },
  fnb_consumer: {
    key: "fnb_consumer",
    label: "F&B / 소비재",
    ev_ebitda: { low: 8, mid: 12, high: 16 },
    ev_sales: { low: 1.0, mid: 2.0, high: 3.5 },
    notes: "브랜드 가치·D2C 비중에 따라 변동. 점포 다수 모델은 lower.",
  },
  logistics: {
    key: "logistics",
    label: "물류 / 운송",
    ev_ebitda: { low: 5, mid: 9, high: 13 },
    ev_sales: { low: 0.5, mid: 1.0, high: 1.8 },
    notes: "자산 중심·저마진 사업. 마지막 마일·SaaS형 결합 시 high.",
  },
  healthcare_bio: {
    key: "healthcare_bio",
    label: "헬스케어 / 바이오",
    ev_ebitda: { low: 12, mid: 20, high: 30 },
    ev_sales: { low: 4, mid: 8, high: 15 },
    notes: "파이프라인·승인 단계가 multiple 좌우. 임상 3상 통과 시 high+.",
  },
  financial: {
    key: "financial",
    label: "금융 (은행·증권·보험)",
    ev_ebitda: { low: 0, mid: 0, high: 0 },
    ev_sales: { low: 1.0, mid: 2.0, high: 3.5 },
    notes: "전통 멀티플 미적용 (P/B·P/E 사용 권장). 본 dashboard는 미지원 산업.",
  },
  real_estate: {
    key: "real_estate",
    label: "부동산 / 건설",
    ev_ebitda: { low: 8, mid: 12, high: 16 },
    ev_sales: { low: 2.5, mid: 4, high: 6 },
    notes: "프로젝트 단가·진행 단계에 따라 큰 변동. NAV 기반도 병행.",
  },
  default: {
    key: "default",
    label: "기타 / 분류 미정",
    ev_ebitda: { low: 7, mid: 11, high: 15 },
    ev_sales: { low: 1.0, mid: 1.8, high: 3.0 },
    notes: "산업 분류 못 잡았을 때 default. 회사 industry 명확하면 수동 override 권장.",
  },
};

/**
 * DART industry code (KSIC 5자리) 또는 free-form 문자열 → INDUSTRY_MULTIPLES 키.
 *
 * KSIC 2자리 prefix 매핑:
 *   10~14: 식료품·음료 → fnb_consumer
 *   17~20: 종이·화학 → manufacturing
 *   21:    의약품 → healthcare_bio
 *   22~25: 고무·금속·기계 → manufacturing
 *   26~28: 전자·전기·자동차 → manufacturing
 *   29~33: 기타제조 → manufacturing
 *   45~47: 도소매 → retail_ecommerce
 *   49~52: 운수·창고 → logistics
 *   55~56: 숙박·음식 → fnb_consumer
 *   58~63: 출판·방송·정보·통신 → tech_saas
 *   64~66: 금융 → financial
 *   68:    부동산 → real_estate
 *   86~87: 의료·복지 → healthcare_bio
 *   기타: default
 */
export function classifyIndustry(
  industry: string | undefined | null
): IndustryMultiples {
  if (!industry) return INDUSTRY_MULTIPLES.default;

  // KSIC 숫자 코드인지 확인
  const numeric = industry.match(/^(\d{2,5})/);
  if (numeric) {
    const prefix = parseInt(numeric[1].slice(0, 2));
    if (prefix === 21) return INDUSTRY_MULTIPLES.healthcare_bio;
    if ((prefix >= 10 && prefix <= 12) || prefix === 11)
      return INDUSTRY_MULTIPLES.fnb_consumer;
    if (prefix >= 17 && prefix <= 33) return INDUSTRY_MULTIPLES.manufacturing;
    if (prefix >= 45 && prefix <= 47) return INDUSTRY_MULTIPLES.retail_ecommerce;
    if (prefix >= 49 && prefix <= 52) return INDUSTRY_MULTIPLES.logistics;
    if (prefix >= 55 && prefix <= 56) return INDUSTRY_MULTIPLES.fnb_consumer;
    if (prefix >= 58 && prefix <= 63) return INDUSTRY_MULTIPLES.tech_saas;
    if (prefix >= 64 && prefix <= 66) return INDUSTRY_MULTIPLES.financial;
    if (prefix === 68) return INDUSTRY_MULTIPLES.real_estate;
    if (prefix >= 86 && prefix <= 87) return INDUSTRY_MULTIPLES.healthcare_bio;
    return INDUSTRY_MULTIPLES.default;
  }

  // free-form 문자열 keyword 매칭 (PDF·Excel 추출 시 한글로 들어옴)
  const lower = industry.toLowerCase();
  if (/saas|소프트웨어|플랫폼|it서비스|tech|software|app/i.test(lower))
    return INDUSTRY_MULTIPLES.tech_saas;
  if (/제조|반도체|자동차|기계|장비|화학|철강|금속/i.test(lower))
    return INDUSTRY_MULTIPLES.manufacturing;
  if (/유통|이커머스|소매|쇼핑|retail|commerce/i.test(lower))
    return INDUSTRY_MULTIPLES.retail_ecommerce;
  if (/식품|음료|f&b|푸드|레스토랑|소비재|consumer/i.test(lower))
    return INDUSTRY_MULTIPLES.fnb_consumer;
  if (/물류|운송|배송|특송|logistics|shipping/i.test(lower))
    return INDUSTRY_MULTIPLES.logistics;
  if (/제약|바이오|의료|헬스|biotech|pharma|health/i.test(lower))
    return INDUSTRY_MULTIPLES.healthcare_bio;
  if (/은행|증권|보험|카드|금융|finance|bank|insurance/i.test(lower))
    return INDUSTRY_MULTIPLES.financial;
  if (/부동산|건설|건축|real estate|construction/i.test(lower))
    return INDUSTRY_MULTIPLES.real_estate;

  return INDUSTRY_MULTIPLES.default;
}

function lastVal(arr: (number | null)[] | undefined): number | null {
  if (!arr || arr.length === 0) return null;
  for (let i = arr.length - 1; i >= 0; i--) {
    if (arr[i] != null) return arr[i];
  }
  return null;
}

export type ValuationResult = {
  industry: IndustryMultiples;
  inputs: {
    ebitda_mil: number | null;
    revenue_mil: number | null;
    net_debt_mil: number | null;
    cash_mil: number | null;
    total_debt_mil: number | null;
  };
  /** EV (기업가치) 범위 — EBITDA × multiple */
  ev_from_ebitda: MultipleRange | null;
  ev_from_sales: MultipleRange | null;
  /** Equity (지분가치) = EV − net debt */
  equity_from_ebitda: MultipleRange | null;
  equity_from_sales: MultipleRange | null;
  /** EBITDA가 음수면 EV/EBITDA 무효 — 사유 표시 */
  ebitda_negative: boolean;
  /** 결합 추정 — EV/EBITDA mid + EV/Sales mid 평균 */
  blended_ev_mid_mil: number | null;
  blended_equity_mid_mil: number | null;
};

function applyMultiples(
  base: number,
  range: MultipleRange
): MultipleRange {
  return {
    low: base * range.low,
    mid: base * range.mid,
    high: base * range.high,
  };
}

function subtractDebt(
  ev: MultipleRange | null,
  netDebt: number | null
): MultipleRange | null {
  if (!ev) return null;
  const d = netDebt ?? 0;
  return {
    low: ev.low - d,
    mid: ev.mid - d,
    high: ev.high - d,
  };
}

export function computeValuation(
  raw: RawCompanyData,
  computed: ComputedMetrics
): ValuationResult {
  const ebitda = lastVal(computed.derived_cf?.ebitda);
  const revenue = lastVal(raw.financials.income_statement.revenue);
  const cash = lastVal(raw.financials.balance_sheet.cash);
  const shortBorrow = lastVal(raw.financials.balance_sheet.short_borrow);
  const longBorrow = lastVal(raw.financials.balance_sheet.long_borrow);
  const totalDebt =
    shortBorrow != null || longBorrow != null
      ? (shortBorrow ?? 0) + (longBorrow ?? 0)
      : null;
  const netDebt =
    totalDebt != null || cash != null ? (totalDebt ?? 0) - (cash ?? 0) : null;

  const industry = classifyIndustry(raw.company.industry);

  const ebitdaNegative = ebitda != null && ebitda <= 0;
  const evFromEbitda =
    ebitda != null && ebitda > 0
      ? applyMultiples(ebitda, industry.ev_ebitda)
      : null;
  const evFromSales =
    revenue != null && revenue > 0
      ? applyMultiples(revenue, industry.ev_sales)
      : null;

  const equityFromEbitda = subtractDebt(evFromEbitda, netDebt);
  const equityFromSales = subtractDebt(evFromSales, netDebt);

  let blendedEvMid: number | null = null;
  if (evFromEbitda && evFromSales) {
    blendedEvMid = (evFromEbitda.mid + evFromSales.mid) / 2;
  } else if (evFromEbitda) {
    blendedEvMid = evFromEbitda.mid;
  } else if (evFromSales) {
    blendedEvMid = evFromSales.mid;
  }
  const blendedEquityMid =
    blendedEvMid != null ? blendedEvMid - (netDebt ?? 0) : null;

  return {
    industry,
    inputs: {
      ebitda_mil: ebitda,
      revenue_mil: revenue,
      net_debt_mil: netDebt,
      cash_mil: cash,
      total_debt_mil: totalDebt,
    },
    ev_from_ebitda: evFromEbitda,
    ev_from_sales: evFromSales,
    equity_from_ebitda: equityFromEbitda,
    equity_from_sales: equityFromSales,
    ebitda_negative: ebitdaNegative,
    blended_ev_mid_mil: blendedEvMid,
    blended_equity_mid_mil: blendedEquityMid,
  };
}
