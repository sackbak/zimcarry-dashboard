/**
 * 한국어 계정명 → schema 필드 매핑 — DART/Cretop/엑셀 양식 공통 사용.
 *
 * 단일 소스 — 새 계정명 변형 발견 시 여기만 추가하면 DART transform과
 * 엑셀 deterministic parser 양쪽에 자동 적용됨.
 *
 * 정규화 규칙 (소비자 측에서 적용):
 *   1. 모든 공백 제거 (\s+ → "")
 *   2. 들여쓰기·*마크·괄호 마커 제거
 *   3. NFC normalize
 * 정규화 결과로 키 조회.
 */

import type {
  RawIncomeStatement,
  RawBalanceSheet,
  RawCashFlow,
} from "@/types/CompanyAnalysis";

/** 계정명 → IS 필드. 키는 정규화된 형식 (공백·*·괄호마커 제거 후) */
export const IS_NAME_MAP: Record<string, keyof RawIncomeStatement> = {
  // 매출 (revenue)
  매출액: "revenue",
  매출: "revenue",
  영업수익: "revenue",
  "수익(매출액)": "revenue",
  매출수익: "revenue",
  영업매출: "revenue",

  // 매출원가 (cogs)
  매출원가: "cogs",
  영업비용: "cogs",
  매출액원가: "cogs",

  // 매출총이익 (gross_profit)
  매출총이익: "gross_profit",
  "매출총이익(손실)": "gross_profit",
  매출총손실: "gross_profit",

  // 판매비와관리비 (sga)
  판매비와관리비: "sga",
  판매관리비: "sga",
  판관비: "sga",

  // 영업이익 (operating_income)
  영업이익: "operating_income",
  "영업이익(손실)": "operating_income",
  영업손실: "operating_income",
  영업손익: "operating_income",
  연결영업이익: "operating_income",
  "연결영업이익(손실)": "operating_income",

  // 순이익 (net_income)
  당기순이익: "net_income",
  "당기순이익(손실)": "net_income",
  당기순손실: "net_income",
  순이익: "net_income",
  "당기순이익(순손실)": "net_income",
  계속사업이익: "net_income",
  "계속사업이익(손실)": "net_income",
  계속영업이익: "net_income",
  연결당기순이익: "net_income",
  "연결당기순이익(손실)": "net_income",
  연결당기순손실: "net_income",
  계속영업연결당기순이익: "net_income",

  // 이자비용 (interest_expense)
  이자비용: "interest_expense",
  금융비용: "interest_expense",
  이자및금융비용: "interest_expense",

  // 영업외 (non_op_income / non_op_expense)
  영업외수익: "non_op_income",
  기타영업외수익: "non_op_income",
  금융수익: "non_op_income",
  기타수익: "non_op_income",
  영업외비용: "non_op_expense",
  기타영업외비용: "non_op_expense",
  기타비용: "non_op_expense",

  // 감가상각·무형상각 (depreciation / amortization)
  감가상각비: "depreciation",
  유형자산감가상각비: "depreciation",
  "유형,임대주택자산감가상각비": "depreciation",
  무형자산상각비: "amortization",
  무형자산상각: "amortization",

  // 인건비·임차료·수수료·운반 (선택적 — SGA 분해)
  인건비: "salary_total",
  종업원급여: "salary_total",
  직원급여: "salary_total",
  급여: "salary_total",
  임금: "salary_total",
  임차료: "rent",
  지급임차료: "rent",
  지급수수료: "fees_total",
  수수료비용: "fees_total",
  운반비: "transport",
};

/** 계정명 → BS 필드 */
export const BS_NAME_MAP: Record<string, keyof RawBalanceSheet> = {
  // 자산 (assets)
  자산: "total_assets",
  자산총계: "total_assets",
  총자산: "total_assets",
  자산합계: "total_assets",

  유동자산: "current_assets",
  단기자산: "current_assets",

  // 현금 (cash)
  현금및현금성자산: "cash",
  현금밎현금성자산: "cash", // 오타 케이스
  현금성자산: "cash",
  현금: "cash",

  // 매출채권 (ar)
  매출채권: "ar",
  매출채권및기타채권: "ar",
  매출채권등: "ar",
  외상매출금: "ar",

  // 비유동 (non_current)
  비유동자산: "non_current",
  고정자산: "non_current",

  // 유형 (tangible)
  유형자산: "tangible",
  부동산: "tangible",

  // 무형 (intangible)
  무형자산: "intangible",
  영업권: "intangible",
  영업권및무형자산: "intangible",
  기타무형자산: "intangible",

  // 보증금 (deposits — 선택)
  보증금: "deposits",
  보증금등: "deposits",

  // 부채 (liabilities)
  부채: "total_liab",
  부채총계: "total_liab",
  총부채: "total_liab",
  부채합계: "total_liab",

  유동부채: "current_liab",
  단기부채: "current_liab",

  // 단기차입금 (short_borrow)
  단기차입금: "short_borrow",
  유동성장기차입금: "short_borrow", // 1년 내 만기 도래
  유동성장기부채: "short_borrow",
  단기사채: "short_borrow",
  단기금융부채: "short_borrow",
  유동성차입금: "short_borrow",

  // 미지급비용 (accrued_exp)
  미지급비용: "accrued_exp",

  // 비유동부채 (non_current_liab)
  비유동부채: "non_current_liab",
  고정부채: "non_current_liab",
  장기부채: "non_current_liab",

  // 장기차입금 (long_borrow)
  장기차입금: "long_borrow",
  사채: "long_borrow",
  비유동사채: "long_borrow",
  장기금융부채: "long_borrow",

  // 자본 (equity)
  자본: "total_equity",
  자본총계: "total_equity",
  자기자본: "total_equity",
  자본합계: "total_equity",
  총자본: "total_equity",

  자본금: "capital_stock",
  보통주자본금: "capital_stock",

  자본잉여금: "capital_surplus",
  주식발행초과금: "capital_surplus",
  자본준비금: "capital_surplus",

  이익잉여금: "retained_earnings",
  "이익잉여금(결손금)": "retained_earnings",
  결손금: "retained_earnings",
  미처분이익잉여금: "retained_earnings",
};

/** 계정명 → CF 필드 */
export const CF_NAME_MAP: Record<string, keyof RawCashFlow> = {
  영업활동현금흐름: "operating",
  영업활동으로인한현금흐름: "operating",
  영업활동순현금흐름: "operating",
  영업현금흐름: "operating",

  투자활동현금흐름: "investing",
  투자활동으로인한현금흐름: "investing",
  투자활동순현금흐름: "investing",

  재무활동현금흐름: "financing",
  재무활동으로인한현금흐름: "financing",
  재무활동순현금흐름: "financing",

  현금및현금성자산의증가: "net_change",
  "현금의증가(감소)": "net_change",
  현금의증감: "net_change",
  "현금및현금성자산의순증가(감소)": "net_change",
};

/**
 * 한국어 계정명 정규화 — 매핑 키 조회용.
 *
 * 처리:
 *   - 모든 공백 제거 ("매출 채권" → "매출채권")
 *   - 들여쓰기·bullet·dash 제거
 *   - 끝 (*) 마커 제거
 *   - NFC 유니코드 정규화
 */
export function normalizeAccountName(s: string): string {
  return s
    .trim()
    .replace(/^[\s\*\-•·•]+/, "")
    .replace(/\s*\(\*\)\s*$/, "")
    .replace(/\s+/g, "") // 모든 공백 제거 (DART transform 방식과 일치)
    .normalize("NFC");
}
