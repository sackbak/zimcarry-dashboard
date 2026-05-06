"use client";

/**
 * Dashboard 상단 KPI 카드 — 클릭 시 모달로 정의 + 5년 추이 + 건강기준 표시.
 * 짐캐리 legacy KPICard의 모달 패턴을 generic하게 재구성.
 */

import { useState } from "react";
import { ArrowDownRight, ArrowUpRight, Minus, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Modal } from "@/components/Modal";
import { TrendChart } from "@/components/TrendChart";
import { SIGNAL_BAR, SIGNAL_TEXT } from "@/lib/signal";
import { fmtPct } from "@/lib/format";
import { lookup } from "@/lib/glossary";
import type { ComputedTopKpi } from "@/types/CompanyAnalysis";
import type { Signal } from "@/lib/data";

export type KpiSeriesKind = "percent" | "month" | "day" | "ratio_x" | "raw";

type Props = {
  kpi: ComputedTopKpi;
  years: number[];
  series?: (number | null)[];
  /** 시리즈 값 종류 — TrendChart 표시 단위 결정 */
  seriesKind?: KpiSeriesKind;
  color?: string;
};

function formatValue(kpi: ComputedTopKpi): string {
  const v = kpi.value_latest;
  if (v == null || !Number.isFinite(v)) return "-";
  switch (kpi.unit) {
    case "%":
    case "ratio":
      return fmtPct(v, { digits: 1 });
    case "x":
    case "배":
      return `${v.toFixed(2)}x`;
    case "월":
    case "개월":
    case "month":
      return `${v.toFixed(1)}개월`;
    case "일":
    case "day":
      return `${v.toFixed(0)}일`;
    default:
      return v.toLocaleString();
  }
}

function transformSeries(
  values: (number | null)[],
  kind: KpiSeriesKind
): (number | null)[] {
  if (kind === "percent") {
    return values.map((v) => (v == null ? null : v * 100));
  }
  return values;
}

function unitLabelForKind(kind: KpiSeriesKind): string | undefined {
  if (kind === "percent") return "%";
  if (kind === "month") return "개월";
  if (kind === "day") return "일";
  if (kind === "ratio_x") return "배";
  return undefined;
}

export function DashboardKpiCard({ kpi, years, series, seriesKind = "raw", color }: Props) {
  const [open, setOpen] = useState(false);
  const sig = (kpi.signal ?? "yellow") as Signal;
  const entry = lookup(kpi.label);
  const hasModal = !!(series && series.length > 0) || !!entry;

  const display = formatValue(kpi);
  const yoy = kpi.yoy;
  const isPositive = yoy != null && yoy > 0;
  const isNegative = yoy != null && yoy < 0;
  const Arrow = isPositive ? ArrowUpRight : isNegative ? ArrowDownRight : Minus;
  const arrowClass = isPositive
    ? "text-emerald-600"
    : isNegative
      ? "text-rose-600"
      : "text-gray-400";

  const transformedSeries = series ? transformSeries(series, seriesKind) : undefined;
  const chartUnit = unitLabelForKind(seriesKind);

  return (
    <>
      <button
        type="button"
        onClick={() => hasModal && setOpen(true)}
        disabled={!hasModal}
        className={cn(
          "group/kpi relative overflow-hidden rounded-xl border border-[var(--border)] bg-white p-5 text-left shadow-sm transition-all",
          hasModal &&
            "cursor-pointer hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md"
        )}
      >
        <div className={cn("absolute inset-x-0 top-0 h-1", SIGNAL_BAR[sig])} />
        <div className="flex items-start justify-between gap-2">
          <div className="text-[10px] font-medium uppercase tracking-wide text-gray-400">
            {kpi.label}
          </div>
          {hasModal && (
            <Search className="h-3 w-3 shrink-0 text-gray-300 transition-colors group-hover/kpi:text-blue-500" />
          )}
        </div>
        <div className="mt-1.5 flex items-baseline gap-1.5">
          <span
            className={cn(
              "text-xl font-bold tabular-nums",
              sig === "red"
                ? "text-rose-700"
                : sig === "yellow"
                  ? "text-amber-700"
                  : "text-emerald-700"
            )}
          >
            {display}
          </span>
        </div>
        {yoy != null && (
          <div className="mt-1 flex items-center gap-1.5 text-[11px]">
            <span className={cn("inline-flex items-center gap-0.5 font-medium", arrowClass)}>
              <Arrow className="h-3 w-3" />
              YoY {fmtPct(yoy, { sign: true, digits: 1 })}
            </span>
            <span className={cn("text-gray-500", SIGNAL_TEXT[sig])}>·</span>
          </div>
        )}
      </button>

      {hasModal && (
        <Modal open={open} onClose={() => setOpen(false)} className="max-w-2xl">
          <div className="space-y-5 p-6 pt-7">
            <header className="pr-8">
              <div className="text-[10px] font-medium uppercase tracking-wider text-blue-500">
                KPI 상세
              </div>
              <h3 className="mt-1 flex flex-wrap items-baseline gap-2 text-xl font-bold text-gray-900">
                {entry?.term ?? kpi.label}
                <span
                  className={cn(
                    "text-base font-semibold",
                    sig === "red"
                      ? "text-rose-700"
                      : sig === "yellow"
                        ? "text-amber-700"
                        : "text-emerald-700"
                  )}
                >
                  {display}
                </span>
                {yoy != null && (
                  <span
                    className={cn(
                      "text-xs font-semibold",
                      isPositive
                        ? "text-emerald-600"
                        : isNegative
                          ? "text-rose-600"
                          : "text-gray-500"
                    )}
                  >
                    YoY {fmtPct(yoy, { sign: true, digits: 1 })}
                  </span>
                )}
              </h3>
            </header>

            {entry && (
              <div className="rounded-lg bg-blue-50/60 p-4">
                <p className="text-sm leading-relaxed text-gray-800">
                  {entry.short}
                </p>
                {entry.formula && (
                  <div className="mt-2 text-[11px] text-gray-600">
                    공식 ·{" "}
                    <code className="rounded bg-white px-1.5 py-0.5 font-mono">
                      {entry.formula}
                    </code>
                  </div>
                )}
              </div>
            )}

            {transformedSeries && years.length > 0 && (
              <div>
                <div className="mb-2 text-xs font-medium text-gray-500">
                  {years[0]}~{years.at(-1)} 추이
                </div>
                <TrendChart
                  years={years}
                  series={[
                    {
                      key: "v",
                      label: kpi.label,
                      color: color ?? "#0f172a",
                      values: transformedSeries,
                    },
                  ]}
                  unitLabel={chartUnit}
                />
              </div>
            )}

            {(entry?.good || entry?.bad) && (
              <div className="grid gap-2 sm:grid-cols-2">
                {entry?.good && (
                  <div className="rounded-md border-l-4 border-l-emerald-400 bg-emerald-50/30 px-3 py-2">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700">
                      건강 기준
                    </div>
                    <div className="mt-0.5 text-sm text-gray-700">{entry.good}</div>
                  </div>
                )}
                {entry?.bad && (
                  <div className="rounded-md border-l-4 border-l-rose-400 bg-rose-50/30 px-3 py-2">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-rose-700">
                      위험 신호
                    </div>
                    <div className="mt-0.5 text-sm text-gray-700">{entry.bad}</div>
                  </div>
                )}
              </div>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
