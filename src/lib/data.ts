import raw from "@/data/zimcarry_data.json";

export type Signal = "green" | "yellow" | "red";

export type Tag =
  | "매출"
  | "수익"
  | "인건비"
  | "임차료"
  | "플랫폼"
  | "운송"
  | "시설운영"
  | "마케팅"
  | "금융"
  | "현금성"
  | "운전자본"
  | "인프라"
  | "무형"
  | "담보금"
  | "차입"
  | "이자부채"
  | "투자자금"
  | "결손"
  | "기타";

export interface IncomeItem {
  name: string;
  category?: string;
  tag: Tag | string;
  values_mil: (number | null)[];
  yoy_2025: number | null;
  trend: string;
  rev_share_2025: number;
  learn_note: string;
  investment_note: string;
}

export interface BalanceItem {
  name: string;
  tag: Tag | string;
  values_mil: (number | null)[];
  yoy_2025: number | null;
  trend: string;
  asset_share_2025: number;
  category_share?: number;
  learn_note: string;
  investment_note: string;
}

export interface KPI {
  label: string;
  value_2025: number;
  unit: string;
  yoy: number | null;
  trend: string;
  signal: Signal;
}

export interface CategoryKPI {
  name: string;
  value: number | string;
  unit: string;
  signal: Signal;
  benchmark: string;
}

export interface DashboardCategory {
  name: string;
  signal: Signal;
  summary: string;
  comment: string;
  kpis: CategoryKPI[];
}

export interface OverallAssessment {
  signal: Signal;
  label: string;
  summary: string;
  key_question: string;
  scenarios: {
    bullish: string;
    base: string;
    bearish: string;
  };
}

export const data = raw as unknown as {
  meta: {
    company: string;
    report_date: string;
    data_period: string;
    currency_unit: string;
    version: string;
    source: string;
  };
  company: {
    name: string;
    name_en: string;
    ceo: string;
    founded: string;
    biz_no: string;
    headquarters: string;
    employees_2026_02: number;
    homepage: string;
    industry: string;
    subsidiary: {
      name: string;
      since: string;
      business: string;
      financials: string;
    };
    investment: {
      rounds: Array<{
        year: number;
        round: string;
        amount_mil: number;
        investors: string[];
      }>;
      cumulative_capital_mil: number;
      cumulative_vc_only_mil: number;
      note: string;
    };
    milestones_post_ir2024: Array<{ date: string; event: string }>;
    stores_total: number;
    stores_domestic: number;
    stores_overseas: number;
  };
  financials: {
    years: number[];
    income_statement: Record<string, (number | null)[]>;
    balance_sheet: Record<string, (number | null)[]>;
    investment_analysis: {
      cumulative_inv: (number | null)[];
      annual_raised: (number | null)[];
      round_label: string[];
    };
    cash_flow: Record<string, (number | null)[]>;
  };
  ratios: {
    growth: Record<string, number | (number | null)[]>;
    profitability: Record<string, (number | null)[]>;
    stability: Record<string, (number | boolean | null)[]>;
    activity: Record<string, (number | null)[]>;
    investment_recovery: { remaining_pct: number[]; note: string };
  };
  income_items: Array<{ section: string; items: IncomeItem[] }>;
  balance_items: Array<{ section: string; items: BalanceItem[] }>;
  business_structure: {
    summary: {
      total_stores: number;
      domestic: number;
      overseas: number;
      ir_2024_included: number;
      ir_2024_new: number;
    };
    categories: Array<{
      id: number;
      name: string;
      ir_match: string;
      is_new: boolean;
      details: string;
      type: string;
    }>;
    stores: Array<{
      id: number;
      name: string;
      type: string;
      region: string;
      category: string;
      ir_2024: boolean;
      is_new?: boolean;
      is_big4?: boolean;
      is_big5?: boolean;
      is_overseas?: boolean;
      note?: string;
    }>;
    ir_segment_2024: Record<string, unknown>;
  };
  dashboard: {
    top_kpis: KPI[];
    categories: DashboardCategory[];
    overall_assessment: OverallAssessment;
  };
};

export const years = data.financials.years;
