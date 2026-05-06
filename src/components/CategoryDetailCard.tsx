"use client";

/**
 * 5대 카테고리 카드 — 클릭 시 모달로 카테고리 정의 + 관련 KPI 리스트 + LLM 코멘트.
 *
 * narrative 모드(LLM 분석 후): comment + categories[].signal 사용.
 * lite 모드(분석 전): 결정적 신호등만 + 관련 KPI 리스트만.
 */

import { useState } from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Modal } from "@/components/Modal";
import { RichText } from "@/components/RichText";
import { SIGNAL_BAR, SIGNAL_BG, SIGNAL_DOT, SIGNAL_TEXT } from "@/lib/signal";
import { fmtPct } from "@/lib/format";
import { THRESHOLDS, type ThresholdKey } from "@/lib/thresholds";
import type { ComputedMetrics } from "@/types/CompanyAnalysis";
import type { Signal } from "@/lib/data";

type CategoryName = "성장성" | "수익성" | "안정성" | "활동성" | "현금흐름";

const CATEGORY_INTRO: Record<CategoryName, string> = {
  성장성:
    "매출이 시간이 지나며 얼마나 커졌는지. PMF 검증과 시장 수용 여부를 가늠하는 지표.",
  수익성:
    "매출 한 단위에서 이익이 얼마나 남는지. 영업이익률·EBITDA 마진은 본업의 효율성, 순이익률은 최종 회수율.",
  안정성:
    "외부 자금에 얼마나 의존하는지. 부채·자본 구조가 단기 충격을 견딜 수 있는지 본다.",
  활동성:
    "자산을 얼마나 효율적으로 매출로 돌리는지. 매출채권 회수 속도가 핵심.",
  현금흐름:
    "장부 이익이 아닌 진짜 현금. FCF가 음수면 외부 자금으로 연명, 양수면 자력 생존.",
};

type KpiRow = {
  label: string;
  value: number | null;
  display: string;
  signal: Signal;
  benchmark: string;
};

const RANK: Record<Signal, number> = { red: 0, yellow: 1, green: 2 };

function pickWorst(signals: Signal[]): Signal {
  if (signals.length === 0) return "yellow";
  return signals.reduce((acc, s) => (RANK[s] < RANK[acc] ? s : acc), "green" as Signal);
}

function lastVal(arr: (number | null)[] | undefined): number | null {
  if (!arr || arr.length === 0) return null;
  for (let i = arr.length - 1; i >= 0; i--) {
    if (arr[i] != null) return arr[i];
  }
  return null;
}

function classify(key: ThresholdKey, v: number | null): Signal {
  if (v == null || !Number.isFinite(v)) return "yellow";
  const rule = THRESHOLDS[key];
  if (rule.direction === "higher") {
    if (v >= rule.green) return "green";
    if (v >= rule.yellow) return "yellow";
    return "red";
  } else {
    if (v <= rule.green) return "green";
    if (v <= rule.yellow) return "yellow";
    return "red";
  }
}

function formatPct(v: number | null) {
  return v == null ? "-" : fmtPct(v, { digits: 1 });
}

function categoryKpis(name: CategoryName, c: ComputedMetrics): KpiRow[] {
  const r = c.ratios;
  const cf = c.derived_cf;
  const rows: KpiRow[] = [];
  const add = (
    label: string,
    key: ThresholdKey,
    raw: number | null,
    fmt: (v: number | null) => string
  ) => {
    rows.push({
      label,
      value: raw,
      display: fmt(raw),
      signal: classify(key, raw),
      benchmark: THRESHOLDS[key].benchmark ?? "",
    });
  };
  switch (name) {
    case "성장성":
      add("매출 YoY", "revenue_yoy", lastVal(r.growth?.revenue_yoy), formatPct);
      add("CAGR (3년)", "cagr_3y", r.growth?.cagr_3y ?? null, formatPct);
      add(
        "5년 매출 배수",
        "revenue_5y_multiple",
        r.growth?.revenue_5y_multiple ?? null,
        (v) => (v == null ? "-" : `${v.toFixed(1)}x`)
      );
      break;
    case "수익성":
      add(
        "영업이익률",
        "operating_margin",
        lastVal(r.profitability?.operating_margin),
        formatPct
      );
      add("EBITDA 마진", "ebitda_margin", lastVal(cf?.ebitda_margin), formatPct);
      add(
        "순이익률",
        "net_margin",
        lastVal(r.profitability?.net_margin),
        formatPct
      );
      break;
    case "안정성":
      add(
        "부채비율",
        "debt_ratio",
        lastVal(r.stability?.debt_ratio),
        formatPct
      );
      add(
        "유동비율",
        "current_ratio",
        lastVal(r.stability?.current_ratio),
        formatPct
      );
      add(
        "자기자본비율",
        "equity_ratio",
        lastVal(r.stability?.equity_ratio),
        formatPct
      );
      break;
    case "활동성":
      add(
        "총자산회전율",
        "asset_turnover",
        lastVal(r.activity?.asset_turnover),
        (v) => (v == null ? "-" : `${v.toFixed(2)}x`)
      );
      add(
        "매출채권 회수기간",
        "ar_days",
        lastVal(r.activity?.ar_days),
        (v) => (v == null ? "-" : `${v.toFixed(0)}일`)
      );
      break;
    case "현금흐름":
      add("FCF 마진", "fcf_margin", lastVal(cf?.fcf_margin), formatPct);
      add(
        "Runway",
        "runway_months",
        lastVal(cf?.runway_months),
        (v) => (v == null ? "-" : `${v.toFixed(1)}개월`)
      );
      add(
        "이자보상배율",
        "interest_coverage",
        lastVal(cf?.interest_coverage),
        (v) => (v == null ? "-" : `${v.toFixed(2)}x`)
      );
      break;
  }
  return rows;
}

export type CategoryCardData = {
  name: CategoryName;
  signal: Signal;
  summary: string;
  /** narrative 모드에서만 채워짐 — LLM이 쓴 1~2문장 코멘트 */
  comment?: string;
};

export function CategoryDetailCard({
  category,
  computed,
  isLite,
}: {
  category: CategoryCardData;
  computed: ComputedMetrics;
  isLite: boolean;
}) {
  const [open, setOpen] = useState(false);
  const sig = category.signal;
  const rows = categoryKpis(category.name, computed);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "group/cat flex h-full flex-col overflow-hidden rounded-xl border bg-white text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md",
          isLite ? "border-dashed border-[var(--border)]" : "border-[var(--border)]"
        )}
      >
        <div className={cn("h-1 w-full", SIGNAL_BAR[sig])} />
        <div className="flex flex-1 flex-col gap-3 p-5">
          <div className="flex items-center justify-between gap-2">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">
              {category.name}
              <Search className="h-3 w-3 text-gray-300 transition-colors group-hover/cat:text-blue-500" />
            </h3>
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
                SIGNAL_BG[sig]
              )}
            >
              <span>{SIGNAL_DOT[sig]}</span>
              {category.summary.replace(/^[^\s]+\s/, "")}
            </span>
          </div>
          {category.comment ? (
            <p className="text-sm leading-relaxed text-gray-600">
              <RichText text={category.comment} />
            </p>
          ) : (
            <p className="text-xs leading-relaxed text-gray-400">
              {rows.length}개 KPI · 클릭해서 상세 보기
            </p>
          )}
        </div>
      </button>

      <Modal open={open} onClose={() => setOpen(false)} className="max-w-2xl">
        <div className="space-y-5 p-6 pt-7">
          <header className="pr-8">
            <div className="text-[10px] font-medium uppercase tracking-wider text-blue-500">
              5대 재무 카테고리
            </div>
            <h3 className="mt-1 flex items-baseline gap-2 text-xl font-bold text-gray-900">
              {category.name}
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
                  SIGNAL_BG[sig]
                )}
              >
                <span>{SIGNAL_DOT[sig]}</span>
                {category.summary.replace(/^[^\s]+\s/, "")}
              </span>
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-gray-700">
              {CATEGORY_INTRO[category.name]}
            </p>
          </header>

          {category.comment && (
            <div className="rounded-md border-l-4 border-l-blue-400 bg-blue-50/40 px-3 py-2">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-blue-700">
                AI 분석
              </div>
              <p className="mt-1 text-sm leading-relaxed text-gray-800">
                <RichText text={category.comment} />
              </p>
            </div>
          )}

          <div>
            <div className="mb-2 text-xs font-medium text-gray-500">
              관련 KPI · 최근 결산 기준
            </div>
            <div className="overflow-hidden rounded-lg border border-gray-200">
              <table className="w-full text-sm">
                <tbody className="divide-y divide-gray-100">
                  {rows.map((row) => (
                    <tr key={row.label}>
                      <td className="px-3 py-2 text-gray-900">{row.label}</td>
                      <td
                        className={cn(
                          "px-3 py-2 text-right font-semibold tabular-nums",
                          SIGNAL_TEXT[row.signal]
                        )}
                      >
                        {row.display}
                      </td>
                      <td className="px-3 py-2 text-right text-[11px] text-gray-500">
                        {row.benchmark}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <span className="text-[12px]">{SIGNAL_DOT[row.signal]}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-[11px] text-gray-400">
              종합 신호등은 위 KPI 중 worst signal로 결정. 자본잠식 1회라도 있으면
              안정성은 최소 yellow.
            </p>
          </div>
        </div>
      </Modal>
    </>
  );
}

/** narrative.categories를 CategoryCardData로 정규화 (worst signal 도출용) */
export function summarizeWorstSignal(rows: KpiRow[]): Signal {
  return pickWorst(rows.map((r) => r.signal));
}
