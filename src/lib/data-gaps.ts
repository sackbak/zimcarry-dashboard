/**
 * 회사 데이터 누락 진단 — DART 매핑이 못 잡은 항목 찾기.
 *
 * UI에 "이 데이터에 빠진 부분 있음" 배지 표시용. 사용자가 신뢰도 판단할 수 있게.
 */

import type { RawCompanyData } from "@/types/CompanyAnalysis";

export type DataGap = {
  /** 분류 — UI 색상·심각도용 */
  severity: "info" | "warn";
  field: string;
  label: string;
  impact: string;
};

function fillRate(arr: (number | null)[] | undefined, n: number): number {
  if (!arr) return 0;
  return arr.filter((x) => x != null).length / n;
}

function lastVal(arr: (number | null)[] | undefined): number | null {
  if (!arr || arr.length === 0) return null;
  for (let i = arr.length - 1; i >= 0; i--) {
    if (arr[i] != null) return arr[i];
  }
  return null;
}

export function detectDataGaps(raw: RawCompanyData): DataGap[] {
  const gaps: DataGap[] = [];
  const N = raw.meta.fiscal_years.length;
  const is = raw.financials.income_statement;
  const bs = raw.financials.balance_sheet;
  const cf = raw.financials.cash_flow_raw;

  // 1. D&A — EBITDA 정확도 영향
  const depFill = fillRate(is.depreciation, N);
  const amoFill = fillRate(is.amortization, N);
  if (depFill === 0 && amoFill === 0) {
    gaps.push({
      severity: "warn",
      field: "depreciation_amortization",
      label: "감가상각·무형상각 (D&A) 미공시",
      impact:
        "사업보고서 본문엔 없고 주석에만 들어가는 회사. EBITDA = 영업이익으로 계산됨 → 실제 EBITDA보다 낮게 추정. EV/EBITDA 추정이 보수적으로 나옴.",
    });
  }

  // 2. 매출원가·판관비 분리 안 됨 — 마진 분석 영향
  const cogsFill = fillRate(is.cogs, N);
  const sgaFill = fillRate(is.sga, N);
  const gpFill = fillRate(is.gross_profit, N);
  if (cogsFill < 0.6 && sgaFill < 0.6 && gpFill < 0.6) {
    gaps.push({
      severity: "info",
      field: "cogs_sga_split",
      label: "매출원가/판관비 분리 미공시",
      impact:
        "서비스업·플랫폼 회사 특성. 영업비용 lump sum만 공시. 영업이익률은 정확하지만 매출총이익률은 산출 불가.",
    });
  }

  // 3. 차입금 — Net Debt / Equity 추정 영향
  const shortFill = fillRate(bs.short_borrow, N);
  const longFill = fillRate(bs.long_borrow, N);
  if (shortFill < 0.5 && longFill < 0.5) {
    gaps.push({
      severity: "warn",
      field: "borrowings",
      label: "차입금 정보 누락",
      impact:
        "단기·장기차입금이 대부분 누락. Net Debt = 0으로 가정해 Equity = EV가 됨 → Equity 추정이 실제보다 큼.",
    });
  } else if (shortFill < 0.5 || longFill < 0.5) {
    gaps.push({
      severity: "info",
      field: "borrowings_partial",
      label: "차입금 일부 연도 누락",
      impact:
        "단기 또는 장기차입금이 일부 연도만 있음. 그 해 진짜 0이거나 분류 차이일 수 있음.",
    });
  }

  // 4. 현금흐름표 raw 없음
  const opCfFill = cf?.operating ? fillRate(cf.operating, N) : 0;
  if (opCfFill === 0) {
    gaps.push({
      severity: "info",
      field: "cash_flow_raw",
      label: "현금흐름표 정형 데이터 없음",
      impact:
        "OCF/투자/재무활동 raw 없음 (DART에 정형 미공시). FCF는 BS+IS에서 역산한 추정치 사용.",
    });
  }

  // 5. 이자비용
  const intFill = fillRate(is.interest_expense, N);
  if (intFill < 0.5) {
    gaps.push({
      severity: "info",
      field: "interest_expense",
      label: "이자비용 일부 누락",
      impact:
        "이자보상배율 일부 연도 산출 불가. 차입 의존도 큰 회사면 cross-check 권장.",
    });
  }

  // 6. 자본잉여금
  const surplusFill = fillRate(bs.capital_surplus, N);
  if (surplusFill < 0.5) {
    gaps.push({
      severity: "info",
      field: "capital_surplus",
      label: "자본잉여금 누락",
      impact:
        "자본 효율성 지표가 자본금만 봐서 누적 외부 조달 underestimate. 증자 패턴 분석 부정확.",
    });
  }

  return gaps;
}

/** 데모용 한 줄 요약 */
export function summarizeGaps(gaps: DataGap[]): string {
  if (gaps.length === 0) return "데이터 무결";
  const warns = gaps.filter((g) => g.severity === "warn").length;
  if (warns > 0) return `⚠ ${warns}건 주의 + ${gaps.length - warns}건 참고`;
  return `${gaps.length}건 참고사항`;
}
