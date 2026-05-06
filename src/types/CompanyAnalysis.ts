/**
 * CompanyAnalysis — 회사 재무 분석 데이터 contract.
 *
 * 3-layer 구조:
 *   raw       : DART API / Vision LLM이 채우는 원시 숫자 (회사 invariant)
 *   computed  : raw에서 코드가 자동 계산 (결정적, 비용 0)
 *   narrative : raw + computed 보고 LLM이 생성하는 텍스트
 *
 * 자세한 분리축 + LLM prompt는 docs/SCHEMA.md 참조.
 */

export type Signal = "green" | "yellow" | "red";

// ────────────────────────────────────────────────────────────────────
// Layer 1: RAW — DART API 또는 Vision LLM(PDF)에서 채움
// ────────────────────────────────────────────────────────────────────

export type DataSource = "DART" | "PDF" | "Manual";

export interface RawCompanyMeta {
  company_name: string;
  company_name_en?: string;
  fiscal_years: number[];          // 오름차순. 예: [2021, 2022, 2023, 2024, 2025]
  currency_unit: "백만원" | "원" | "USD";
  report_date: string;             // ISO yyyy-mm-dd
  source: DataSource;
  corp_code?: string;              // DART 종목코드 (상장사)
  data_period?: string;            // "2021-2025" 같은 표시용 라벨
  fiscal_year_end?: string;        // "12-31"
}

export interface RawCompanyProfile {
  ceo?: string;
  founded?: string;                // "2018-03-15"
  biz_no?: string;                 // 사업자등록번호
  headquarters?: string;
  employees?: number;
  homepage?: string;
  industry?: string;               // 한국표준산업분류 또는 DART 업종
  is_listed: boolean;
}

/**
 * 손익계산서 — line item key는 표준 영문 키 사용 (DART 매핑 + 회계 표준 명명).
 * 모든 값은 raw.meta.currency_unit 단위. null = 해당 연도 미보고.
 */
export interface RawIncomeStatement {
  revenue: (number | null)[];
  cogs?: (number | null)[];
  gross_profit?: (number | null)[];
  sga: (number | null)[];
  operating_income: (number | null)[];
  interest_expense?: (number | null)[];
  non_op_income?: (number | null)[];
  non_op_expense?: (number | null)[];
  net_income: (number | null)[];
  // 감가/상각 — EBITDA 역산에 필요. DART는 보통 별도 공시, PDF는 노트에서 추출.
  depreciation?: (number | null)[];
  amortization?: (number | null)[];
  // SGA 분해 (Optional, DART에 안 나오면 빈 채로 — UI는 있을 때만 표시)
  salary_total?: (number | null)[];
  rent?: (number | null)[];
  fees_total?: (number | null)[];
  transport?: (number | null)[];
  // 회사별 매출 분해 (Optional)
  revenue_breakdown?: Record<string, (number | null)[]>;
}

export interface RawBalanceSheet {
  total_assets: (number | null)[];
  current_assets: (number | null)[];
  cash: (number | null)[];
  ar?: (number | null)[];          // 매출채권
  non_current?: (number | null)[];
  tangible?: (number | null)[];
  intangible?: (number | null)[];
  deposits?: (number | null)[];
  total_liab: (number | null)[];
  current_liab: (number | null)[];
  short_borrow?: (number | null)[];
  accrued_exp?: (number | null)[];
  non_current_liab?: (number | null)[];
  long_borrow?: (number | null)[];
  total_equity: (number | null)[];
  capital_stock?: (number | null)[];
  common_stock?: (number | null)[];
  preferred_stock?: (number | null)[];
  capital_surplus?: (number | null)[];
  retained_earnings?: (number | null)[];
}

/**
 * 현금흐름표 raw — DART 상장사는 정형 제공, 비상장사는 보통 없음.
 * 없으면 ComputedMetrics.derived_cf로 BS+IS 역산.
 */
export interface RawCashFlow {
  operating?: (number | null)[];
  investing?: (number | null)[];
  financing?: (number | null)[];
  net_change?: (number | null)[];
}

export interface RawCompanyData {
  meta: RawCompanyMeta;
  company: RawCompanyProfile;
  financials: {
    income_statement: RawIncomeStatement;
    balance_sheet: RawBalanceSheet;
    cash_flow_raw?: RawCashFlow;     // DART 있을 때만
  };
}

// ────────────────────────────────────────────────────────────────────
// Layer 2: COMPUTED — 코드가 raw에서 자동 계산
// ────────────────────────────────────────────────────────────────────

export interface RatioGrowth {
  revenue_yoy: (number | null)[];           // 연도별 YoY
  revenue_5y_multiple?: number;             // 첫 해 대비 마지막 해 배수
  cagr_3y?: number;
  asset_yoy?: (number | null)[];
}

export interface RatioProfitability {
  gross_margin?: (number | null)[];
  operating_margin: (number | null)[];
  ebitda_margin?: (number | null)[];
  net_margin: (number | null)[];
  sga_ratio: (number | null)[];
  personnel_ratio?: (number | null)[];
  rent_ratio?: (number | null)[];
}

export interface RatioStability {
  current_ratio: (number | null)[];
  quick_ratio?: (number | null)[];
  debt_ratio: (number | null)[];
  equity_ratio: (number | null)[];
  short_debt_ratio?: (number | null)[];
  current_liab_ratio?: (number | null)[];
  intangible_ratio?: (number | null)[];
  capital_erosion: boolean[];               // 자본총계 (-) ? true
}

export interface RatioActivity {
  asset_turnover?: (number | null)[];
  ar_turnover?: (number | null)[];
  ar_days?: (number | null)[];
}

/**
 * 파생 현금흐름 — DART에 cash_flow_raw 있어도 항상 계산.
 * UI는 raw 우선, 없으면 derived 사용.
 */
export interface DerivedCashFlow {
  ebitda: (number | null)[];                // 영업이익 + 감가 + 무형상각
  ebitda_margin: (number | null)[];
  ocf_estimate: (number | null)[];          // 순이익 + D&A - NWC 변동
  capex: (number | null)[];
  fcf: (number | null)[];                   // OCF - CAPEX
  fcf_margin: (number | null)[];
  runway_months?: (number | null)[];
  interest_coverage?: (number | null)[];    // 영업이익 / 이자비용
  total_debt?: (number | null)[];
}

export interface ComputedItem {
  name: string;                              // line item 이름
  values: (number | null)[];                 // 연도별 값
  yoy_latest: number | null;                 // 마지막 해 YoY
  share_latest: number | null;               // 매출/자산 대비 비중 (해당 항목 종류에 따라)
  trend_5y_multiple?: number;                // 첫 해 대비 마지막 해 배수
}

/**
 * Top KPI — dashboard 상단 표시용. signal은 룰 기반 자동 분류.
 * 임계치는 vendor-neutral한 표준치 사용 (docs/SCHEMA.md 참조).
 */
export interface ComputedTopKpi {
  label: string;
  value_latest: number;
  unit: string;                              // "%" | "억" | "배" | "개월" | ...
  yoy: number | null;
  signal: Signal;                            // 자동 분류
}

export interface ComputedMetrics {
  ratios: {
    growth: RatioGrowth;
    profitability: RatioProfitability;
    stability: RatioStability;
    activity: RatioActivity;
  };
  derived_cf: DerivedCashFlow;
  per_item: {
    income: ComputedItem[];
    balance: ComputedItem[];
  };
  top_kpis: ComputedTopKpi[];
}

// ────────────────────────────────────────────────────────────────────
// Layer 3: NARRATIVE — LLM이 raw + computed 보고 생성
// ────────────────────────────────────────────────────────────────────

/**
 * RichText 마크업 허용:
 *   **bold** — 강조 (현재 RichText는 마커 strip — 일반 표시)
 *   ==red==  — 위험 신호 빨강 강조
 * 모든 narrative 텍스트 필드에 적용 가능.
 */

export interface InsightSection {
  conclusion: string;                        // 1~2 문장 결론
  evidence: string[];                        // 5~10개 데이터 근거
  reasoning: string;                         // 3~5 문장 이유 설명
  accounting?: string[];                     // 3~7개 K-IFRS 회계 watchpoint
  mna?: string[];                            // 3~7개 M&A 관점
  monitoring?: string[];                     // 3~7개 추적 지표
}

export interface PageNarrative {
  headline: string;                          // 페이지 제목 한 줄 (RichText)
  message: string;                           // 보조 설명 1~2 문장 (RichText)
  insight: InsightSection;
}

export interface CategoryNarrative {
  name: "성장성" | "수익성" | "안정성" | "활동성" | "현금흐름";
  signal: Signal;                            // LLM 종합 판단 (개별 ratio signal 종합)
  summary: string;                           // "🟢 우수" 같은 한 줄 라벨
  comment: string;                           // 1~2 문장 코멘트 (RichText)
  kpi_refs: string[];                        // computed.top_kpis 또는 ratios의 어떤 키 참조
}

export interface ItemNote {
  trend: string;                             // "11.5배 증가" — 한 줄
  learn_note: string;                        // 비전공자용 설명 (1~2 문장)
  investment_note: string;                   // 투자/M&A 관점 (1~2 문장)
}

export interface TopVerdict {
  signal: Signal;
  label: string;                             // "🟡 전환기" 같은 라벨
  summary: string;                           // 1 문장 종합
  key_question: string;                      // 투자/M&A 핵심 질문
  scenarios: {
    bullish: string;
    base: string;
    bearish: string;
  };
}

export interface CompanyNarrative {
  top_verdict: TopVerdict;
  pages: {
    dashboard: PageNarrative;
    balance_sheet: PageNarrative;
    income_statement: PageNarrative;
    cash_flow: PageNarrative;
  };
  categories: CategoryNarrative[];
  item_notes: {
    income: Record<string, ItemNote>;        // key = line item name
    balance: Record<string, ItemNote>;
  };
}

// ────────────────────────────────────────────────────────────────────
// Layer 4: OPTIONAL CONTEXT — 회사마다 가용성 다름
// ────────────────────────────────────────────────────────────────────

export interface InvestmentRound {
  year: number;
  round: string;                             // "Series A" | "Bridge" | "Pre-A" | ...
  amount_mil: number;
  investors: string[];
}

export interface InvestmentHistory {
  rounds: InvestmentRound[];
  cumulative_capital_mil?: number;
  cumulative_vc_only_mil?: number;
  note?: string;
}

export interface Subsidiary {
  name: string;
  since?: string;
  business?: string;
  financials?: string;
}

export interface Milestone {
  date: string;
  event: string;
}

export interface CompanyContext {
  investment_history?: InvestmentHistory;
  milestones?: Milestone[];
  subsidiary?: Subsidiary;
  business_structure?: unknown;              // 회사별 구조 너무 다양 — 추후 정형화
}

// ────────────────────────────────────────────────────────────────────
// 최종 입력 — dashboard가 받는 단일 객체
// ────────────────────────────────────────────────────────────────────

export interface CompanyAnalysis {
  raw: RawCompanyData;
  computed: ComputedMetrics;
  /** LLM 생성 narrative — 동적 입력 모드에선 미생성 상태로 둘 수 있음 */
  narrative?: CompanyNarrative;
  context?: CompanyContext;
}
