/**
 * Signal classification rules — vendor-neutral 표준 임계치.
 *
 * direction: "higher" → green ≥ value, yellow ≥ value, else red
 * direction: "lower"  → green ≤ value, yellow ≤ value, else red
 *
 * value 단위는 ratio(소수)로 통일 (e.g., 20% = 0.20).
 * 비율이 아닌 절대값(개월, 일, 배수)은 단위 그대로.
 *
 * 이 룰은 docs/SCHEMA.md §1.2와 동기화 필요.
 */

import type { Signal } from "@/types/CompanyAnalysis";

export type ThresholdRule = {
  green: number;
  yellow: number;
  direction: "higher" | "lower";
  /** 보조 설명 (UI benchmark 표시용) */
  benchmark?: string;
};

export const THRESHOLDS = {
  // ── 성장성 ────────────────────────────────────────────
  revenue_yoy: { green: 0.20, yellow: 0, direction: "higher",
    benchmark: "20%↑ 양호 / 0% 미만 역성장" },
  cagr_3y: { green: 0.20, yellow: 0, direction: "higher",
    benchmark: "20%↑ 양호 (3년 CAGR)" },
  revenue_5y_multiple: { green: 5, yellow: 2, direction: "higher",
    benchmark: "5배↑ 우수 (5년)" },

  // ── 수익성 ────────────────────────────────────────────
  operating_margin: { green: 0.05, yellow: 0, direction: "higher",
    benchmark: "5%↑ 양호 / 음수면 본업 적자" },
  ebitda_margin: { green: 0.10, yellow: 0, direction: "higher",
    benchmark: "10%↑ 우수 / 5%↑ 양호" },
  net_margin: { green: 0.05, yellow: 0, direction: "higher",
    benchmark: "5%↑ 양호" },
  gross_margin: { green: 0.30, yellow: 0.10, direction: "higher",
    benchmark: "서비스업 90%↑, 제조업 30%↑" },
  sga_ratio: { green: 0.50, yellow: 1.0, direction: "lower",
    benchmark: "SGA/매출 100% 미만이 BEP" },

  // ── 안정성 ────────────────────────────────────────────
  debt_ratio: { green: 2.0, yellow: 4.0, direction: "lower",
    benchmark: "200% 이하 양호 / 400%↑ 위험" },
  current_ratio: { green: 1.5, yellow: 1.0, direction: "higher",
    benchmark: "150%↑ 안전 / 100% 미만 위험" },
  equity_ratio: { green: 0.30, yellow: 0.15, direction: "higher",
    benchmark: "30%↑ 양호 / 15% 미만 취약" },
  quick_ratio: { green: 1.0, yellow: 0.5, direction: "higher",
    benchmark: "100%↑ 안전" },

  // ── 활동성 ────────────────────────────────────────────
  asset_turnover: { green: 1.0, yellow: 0.5, direction: "higher",
    benchmark: "1회↑ 양호" },
  ar_turnover: { green: 12, yellow: 6, direction: "higher",
    benchmark: "월 1회 이상이 양호" },
  ar_days: { green: 30, yellow: 60, direction: "lower",
    benchmark: "30일 이하 우수 / 60일↑ 회수 부담" },

  // ── 현금흐름 ──────────────────────────────────────────
  fcf_margin: { green: 0.05, yellow: 0, direction: "higher",
    benchmark: "5%↑ 양호 / 음수면 자력 생존 불가" },
  runway_months: { green: 18, yellow: 6, direction: "higher",
    benchmark: "18개월↑ 안전 / 6개월 미만 긴급" },
  interest_coverage: { green: 5, yellow: 1, direction: "higher",
    benchmark: "5배↑ 안전 / 1배 미만 이자도 못냄" },
} as const satisfies Record<string, ThresholdRule>;

export type ThresholdKey = keyof typeof THRESHOLDS;

export function classifySignal(
  key: ThresholdKey,
  value: number | null | undefined
): Signal {
  if (value == null || !Number.isFinite(value)) return "yellow";
  const rule = THRESHOLDS[key];
  if (rule.direction === "higher") {
    if (value >= rule.green) return "green";
    if (value >= rule.yellow) return "yellow";
    return "red";
  } else {
    if (value <= rule.green) return "green";
    if (value <= rule.yellow) return "yellow";
    return "red";
  }
}

/** capital_erosion 같은 boolean 판단용 별도 룰 */
export function classifyCapitalErosion(everEroded: boolean): Signal {
  return everEroded ? "yellow" : "green";
}
