"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { KPI } from "@/lib/data";
import { SIGNAL_BAR, SIGNAL_TEXT } from "@/lib/signal";
import { fmtPct, fmtMil } from "@/lib/format";
import { ArrowUpRight, ArrowDownRight, Minus, Search } from "lucide-react";
import { Modal } from "@/components/Modal";
import { TrendChart } from "@/components/TrendChart";
import { lookup } from "@/lib/glossary";

export function KPICard({
  kpi,
  years,
  series,
  seriesUnit = "백만원",
  color,
}: {
  kpi: KPI;
  years?: number[];
  series?: (number | null)[];
  seriesUnit?: string;
  color?: string;
}) {
  const [open, setOpen] = useState(false);
  const entry = lookup(kpi.label);
  const hasDetail = !!(series && years) || !!entry;

  const yoy = kpi.yoy;
  const isPositive = yoy != null && yoy > 0;
  const isNegative = yoy != null && yoy < 0;
  const Arrow = isPositive ? ArrowUpRight : isNegative ? ArrowDownRight : Minus;
  const arrowClass = isPositive
    ? "text-emerald-600"
    : isNegative
      ? "text-rose-600"
      : "text-gray-400";

  return (
    <>
      <button
        type="button"
        onClick={() => hasDetail && setOpen(true)}
        disabled={!hasDetail}
        className={cn(
          "group/kpi relative overflow-hidden rounded-xl border border-[var(--border)] bg-white p-5 text-left shadow-sm transition-all",
          hasDetail &&
            "cursor-pointer hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md"
        )}
      >
        <div className={cn("absolute inset-x-0 top-0 h-1", SIGNAL_BAR[kpi.signal])} />
        <div className="flex items-center justify-between">
          <div className="text-xs font-medium text-gray-500">{kpi.label}</div>
          {hasDetail && (
            <Search className="h-3 w-3 text-gray-300 transition-colors group-hover/kpi:text-blue-500" />
          )}
        </div>
        <div className="mt-2 flex items-baseline gap-1">
          <span className="text-2xl font-bold tracking-tight text-gray-900">
            {Number.isInteger(kpi.value_2025)
              ? kpi.value_2025
              : kpi.value_2025.toFixed(2)}
          </span>
          <span className="text-sm font-medium text-gray-500">{kpi.unit}</span>
        </div>
        <div className="mt-2 flex items-center gap-2 text-xs">
          {yoy != null ? (
            <span className={cn("inline-flex items-center gap-0.5 font-medium", arrowClass)}>
              <Arrow className="h-3.5 w-3.5" />
              YoY {fmtPct(yoy, { sign: true })}
            </span>
          ) : (
            <span className="text-gray-400">YoY -</span>
          )}
          <span className={cn("text-gray-500", SIGNAL_TEXT[kpi.signal])}>
            · {kpi.trend}
          </span>
        </div>
      </button>

      {hasDetail && (
        <Modal open={open} onClose={() => setOpen(false)} className="max-w-2xl">
          <div className="space-y-5 p-6 pt-7">
            <header className="pr-8">
              <div className="text-[10px] font-medium uppercase tracking-wider text-blue-500">
                KPI 상세 · {kpi.trend}
              </div>
              <h3 className="mt-1 flex items-baseline gap-2 text-xl font-bold text-gray-900">
                {kpi.label}
                <span className="text-base font-semibold text-gray-700">
                  {kpi.value_2025} {kpi.unit}
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
                    YoY {fmtPct(yoy, { sign: true })}
                  </span>
                )}
              </h3>
            </header>

            {entry && (
              <div className="rounded-lg bg-blue-50/60 p-4">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-blue-700">
                  {entry.term}
                </div>
                <p className="mt-1 text-sm leading-relaxed text-gray-800">
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

            {series && years && (
              <div>
                <div className="mb-2 text-xs font-medium text-gray-500">
                  5개년 추이 ({years[0]}~{years[years.length - 1]})
                </div>
                <TrendChart
                  years={years}
                  series={[
                    {
                      key: "v",
                      label: kpi.label,
                      color: color ?? "#0f172a",
                      values: series,
                    },
                  ]}
                  unitLabel={seriesUnit}
                />
                <div className="mt-2 grid grid-cols-5 gap-1 text-center text-[11px]">
                  {years.map((y, i) => (
                    <div
                      key={y}
                      className="rounded border border-gray-100 bg-gray-50 px-1.5 py-1"
                    >
                      <div className="text-[10px] text-gray-400">{y}</div>
                      <div
                        className={cn(
                          "mt-0.5 font-semibold tabular-nums",
                          series[i] == null
                            ? "text-gray-300"
                            : (series[i] as number) < 0
                              ? "text-rose-600"
                              : "text-gray-900"
                        )}
                      >
                        {series[i] == null
                          ? "-"
                          : seriesUnit === "백만원"
                            ? fmtMil(series[i])
                            : (series[i] as number).toFixed(1)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

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
        </Modal>
      )}
    </>
  );
}
