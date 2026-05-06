/**
 * DART 응답 → RawCompanyData 매핑.
 *
 * DART는 K-IFRS account_id 표준 사용 (e.g., "ifrs-full_Assets").
 * 한국 기업 일반회계기준은 "-CON_" 접두 또는 한국식 키 사용. 둘 다 매핑 시도.
 *
 * 주의:
 *   - 금액 단위: DART는 원 단위. RawCompanyData는 백만원 단위로 정규화 (÷ 1,000,000).
 *   - 매핑 누락된 키는 무시 (모든 line item을 강제 매핑하지 않음 — 핵심 키만).
 *   - 분기보고서는 thstrm_amount = 누적값. 사업보고서는 연간 합계.
 */

import type {
  DartFnAccount,
  DartCompanyInfo,
} from "@/lib/dart/client";
import type {
  RawCompanyData,
  RawIncomeStatement,
  RawBalanceSheet,
  RawCashFlow,
} from "@/types/CompanyAnalysis";

// ────────────────────────────────────────────────────────────────────
// account_id → 표준 키 매핑
// ────────────────────────────────────────────────────────────────────

/**
 * DART account_id → RawIncomeStatement 키.
 * 같은 키에 여러 account_id 매핑 시 첫 매치 우선.
 * 한국 기업이 IFRS 외 자체 account_id 쓰는 경우도 있어 account_nm fallback 사용.
 */
const IS_MAP: Record<string, keyof RawIncomeStatement> = {
  "ifrs-full_Revenue": "revenue",
  "ifrs-full_RevenueFromContractsWithCustomers": "revenue",
  "ifrs-full_CostOfSales": "cogs",
  "ifrs-full_GrossProfit": "gross_profit",
  "dart_OperatingIncomeLoss": "operating_income",
  "ifrs-full_ProfitLossFromOperatingActivities": "operating_income",
  "ifrs-full_ProfitLoss": "net_income",
  "ifrs-full_FinanceCosts": "interest_expense",
};

/** 한국어 account_nm fallback (account_id 매칭 실패 시) */
const IS_NAME_MAP: Record<string, keyof RawIncomeStatement> = {
  "매출액": "revenue",
  "수익(매출액)": "revenue",
  "영업수익": "revenue",
  "매출원가": "cogs",
  "매출총이익": "gross_profit",
  "판매비와관리비": "sga",
  "영업이익": "operating_income",
  "영업이익(손실)": "operating_income",
  "당기순이익": "net_income",
  "당기순이익(손실)": "net_income",
  "이자비용": "interest_expense",
};

const BS_MAP: Record<string, keyof RawBalanceSheet> = {
  "ifrs-full_Assets": "total_assets",
  "ifrs-full_CurrentAssets": "current_assets",
  "ifrs-full_CashAndCashEquivalents": "cash",
  "ifrs-full_TradeAndOtherCurrentReceivables": "ar",
  "ifrs-full_NoncurrentAssets": "non_current",
  "ifrs-full_PropertyPlantAndEquipment": "tangible",
  "ifrs-full_IntangibleAssetsOtherThanGoodwill": "intangible",
  "ifrs-full_Liabilities": "total_liab",
  "ifrs-full_CurrentLiabilities": "current_liab",
  "ifrs-full_NoncurrentLiabilities": "non_current_liab",
  "ifrs-full_Equity": "total_equity",
  "ifrs-full_IssuedCapital": "capital_stock",
  "ifrs-full_RetainedEarnings": "retained_earnings",
};

const BS_NAME_MAP: Record<string, keyof RawBalanceSheet> = {
  "자산총계": "total_assets",
  "유동자산": "current_assets",
  "현금및현금성자산": "cash",
  "매출채권": "ar",
  "비유동자산": "non_current",
  "유형자산": "tangible",
  "무형자산": "intangible",
  "부채총계": "total_liab",
  "유동부채": "current_liab",
  "단기차입금": "short_borrow",
  "비유동부채": "non_current_liab",
  "장기차입금": "long_borrow",
  "자본총계": "total_equity",
  "자본금": "capital_stock",
  "자본잉여금": "capital_surplus",
  "이익잉여금": "retained_earnings",
};

const CF_MAP: Record<string, keyof RawCashFlow> = {
  "ifrs-full_CashFlowsFromUsedInOperatingActivities": "operating",
  "ifrs-full_CashFlowsFromUsedInInvestingActivities": "investing",
  "ifrs-full_CashFlowsFromUsedInFinancingActivities": "financing",
  "ifrs-full_IncreaseDecreaseInCashAndCashEquivalents": "net_change",
};

const CF_NAME_MAP: Record<string, keyof RawCashFlow> = {
  "영업활동현금흐름": "operating",
  "영업활동으로인한현금흐름": "operating",
  "투자활동현금흐름": "investing",
  "투자활동으로인한현금흐름": "investing",
  "재무활동현금흐름": "financing",
  "재무활동으로인한현금흐름": "financing",
  "현금및현금성자산의증가": "net_change",
};

// ────────────────────────────────────────────────────────────────────
// 변환 헬퍼
// ────────────────────────────────────────────────────────────────────

/** "1,234,567" → 1234567 (백만원 단위로 ÷ 1M). null 보존. */
function parseAmountToMil(s: string | undefined | null): number | null {
  if (!s || s === "" || s === "-") return null;
  const cleaned = s.replace(/,/g, "").trim();
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  return n / 1_000_000;
}

function findMappedKey<T extends string>(
  account: DartFnAccount,
  idMap: Record<string, T>,
  nameMap: Record<string, T>
): T | null {
  const byId = idMap[account.account_id];
  if (byId) return byId;
  // 정규화 — 한국 기업 자체 account_id는 "dart_..." 또는 "entity..."
  const normalizedNm = account.account_nm.replace(/\s+/g, "");
  return nameMap[normalizedNm] ?? null;
}

// ────────────────────────────────────────────────────────────────────
// public API
// ────────────────────────────────────────────────────────────────────

/**
 * 5개년 DART 응답 → RawCompanyData (financials only).
 * 회사 메타는 별도로 fetchCompanyInfo + 사용자 입력 보완.
 *
 * @param yearlyData [{ year, data: DartFnAccount[] }] — 오름차순
 */
export function transformFinancials(
  yearlyData: { year: number; data: DartFnAccount[] }[]
): {
  fiscal_years: number[];
  income_statement: RawIncomeStatement;
  balance_sheet: RawBalanceSheet;
  cash_flow_raw: RawCashFlow;
} {
  // 오름차순 정렬 보장
  const sorted = [...yearlyData].sort((a, b) => a.year - b.year);
  const fiscal_years = sorted.map((y) => y.year);
  const N = fiscal_years.length;

  // 결과 buckets — 각 키에 길이 N 배열 (null 초기화)
  const initArr = (): (number | null)[] => Array(N).fill(null);

  const is: RawIncomeStatement = {
    revenue: initArr(),
    sga: initArr(),
    operating_income: initArr(),
    net_income: initArr(),
    cogs: initArr(),
    gross_profit: initArr(),
    interest_expense: initArr(),
  };
  const bs: RawBalanceSheet = {
    total_assets: initArr(),
    current_assets: initArr(),
    cash: initArr(),
    ar: initArr(),
    non_current: initArr(),
    tangible: initArr(),
    intangible: initArr(),
    total_liab: initArr(),
    current_liab: initArr(),
    short_borrow: initArr(),
    non_current_liab: initArr(),
    long_borrow: initArr(),
    total_equity: initArr(),
    capital_stock: initArr(),
    capital_surplus: initArr(),
    retained_earnings: initArr(),
  };
  const cf: RawCashFlow = {
    operating: initArr(),
    investing: initArr(),
    financing: initArr(),
    net_change: initArr(),
  };

  for (let i = 0; i < N; i++) {
    const accounts = sorted[i].data;
    for (const acc of accounts) {
      const amount = parseAmountToMil(acc.thstrm_amount);
      if (amount == null) continue;

      if (acc.sj_div === "IS" || acc.sj_div === "CIS") {
        const k = findMappedKey(acc, IS_MAP, IS_NAME_MAP);
        if (k && Array.isArray(is[k])) {
          (is[k] as (number | null)[])[i] = amount;
        }
      } else if (acc.sj_div === "BS") {
        const k = findMappedKey(acc, BS_MAP, BS_NAME_MAP);
        if (k && Array.isArray(bs[k])) {
          (bs[k] as (number | null)[])[i] = amount;
        }
      } else if (acc.sj_div === "CF") {
        const k = findMappedKey(acc, CF_MAP, CF_NAME_MAP);
        if (k && Array.isArray(cf[k])) {
          (cf[k] as (number | null)[])[i] = amount;
        }
      }
    }
  }

  return {
    fiscal_years,
    income_statement: is,
    balance_sheet: bs,
    cash_flow_raw: cf,
  };
}

/**
 * DART 회사 메타 → RawCompanyData.meta + .company.
 */
export function transformCompanyInfo(
  info: DartCompanyInfo
): {
  meta: Pick<RawCompanyData["meta"], "company_name" | "company_name_en" | "corp_code">;
  company: RawCompanyData["company"];
} {
  return {
    meta: {
      company_name: info.corp_name,
      company_name_en: info.corp_name_eng || undefined,
      corp_code: info.corp_code,
    },
    company: {
      ceo: info.ceo_nm || undefined,
      founded: info.est_dt
        ? `${info.est_dt.slice(0, 4)}-${info.est_dt.slice(4, 6)}-${info.est_dt.slice(6, 8)}`
        : undefined,
      biz_no: info.bizr_no || undefined,
      headquarters: info.adres || undefined,
      homepage: info.hm_url || undefined,
      industry: info.induty_code || undefined,
      is_listed: info.corp_cls === "Y" || info.corp_cls === "K",
    },
  };
}

/**
 * Fully assemble RawCompanyData from DART responses.
 */
export function buildRawFromDart(
  info: DartCompanyInfo,
  yearlyData: { year: number; data: DartFnAccount[] }[],
  reportDate: string
): RawCompanyData {
  const fin = transformFinancials(yearlyData);
  const meta = transformCompanyInfo(info);
  return {
    meta: {
      company_name: meta.meta.company_name,
      company_name_en: meta.meta.company_name_en,
      corp_code: meta.meta.corp_code,
      fiscal_years: fin.fiscal_years,
      currency_unit: "백만원",
      report_date: reportDate,
      source: "DART",
      data_period: `${fin.fiscal_years[0]}-${fin.fiscal_years[fin.fiscal_years.length - 1]}`,
    },
    company: meta.company,
    financials: {
      income_statement: fin.income_statement,
      balance_sheet: fin.balance_sheet,
      cash_flow_raw: fin.cash_flow_raw,
    },
  };
}
