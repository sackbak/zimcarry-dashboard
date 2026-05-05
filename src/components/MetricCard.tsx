"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Sparkline } from "@/components/Sparkline";
import { Modal } from "@/components/Modal";
import { TrendChart } from "@/components/TrendChart";
import { lookup } from "@/lib/glossary";
import { fmtMil } from "@/lib/format";

export function MetricCard({
  label,
  value,
  unit,
  hint,
  trend,
  spark,
  signal,
  years,
  unitLabel = "백만원",
}: {
  label: string;
  value: string;
  unit?: string;
  hint?: string;
  trend?: string;
  spark?: { values: (number | null)[]; color?: string };
  signal?: "green" | "yellow" | "red" | "neutral";
  years?: number[];
  unitLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const entry = lookup(label);
  const hasDetail = !!entry && !!spark && !!years;

  const sigColor =
    signal === "green"
      ? "bg-emerald-500"
      : signal === "yellow"
        ? "bg-amber-500"
        : signal === "red"
          ? "bg-rose-500"
          : "bg-gray-300";

  return (
    <>
      <button
        type="button"
        onClick={() => hasDetail && setOpen(true)}
        disabled={!hasDetail}
        className={cn(
          "group/metric relative w-full overflow-hidden rounded-xl border border-[var(--border)] bg-white p-5 text-left shadow-sm transition-all",
          hasDetail &&
            "cursor-pointer hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md"
        )}
      >
        <div className={cn("absolute inset-x-0 top-0 h-1", sigColor)} />
        <div className="flex items-center justify-between">
          <div className="text-xs font-medium text-gray-500">{label}</div>
          {hasDetail && (
            <Search className="h-3 w-3 text-gray-300 transition-colors group-hover/metric:text-blue-500" />
          )}
        </div>
        <div className="mt-2 flex items-baseline gap-1">
          <span className="text-2xl font-bold tracking-tight text-gray-900 tabular-nums">
            {value}
          </span>
          {unit && <span className="text-sm font-medium text-gray-500">{unit}</span>}
        </div>
        {hint && <div className="mt-1 text-[11px] text-gray-500">{hint}</div>}
        <div className="mt-3 flex items-center justify-between text-[11px] text-gray-500">
          <span>{trend ?? ""}</span>
          {spark && (
            <Sparkline
              values={spark.values}
              color={spark.color ?? "#1565c0"}
              showZero
              width={70}
              height={22}
            />
          )}
        </div>
      </button>

      {hasDetail && entry && spark && years && (
        <Modal open={open} onClose={() => setOpen(false)} className="max-w-2xl">
          <div className="space-y-5 p-6 pt-7">
            <header className="pr-8">
              <div className="text-[10px] font-medium uppercase tracking-wider text-blue-500">
                지표 상세 · 5개년 추이
              </div>
              <h3 className="mt-1 flex flex-wrap items-baseline gap-2 text-xl font-bold text-gray-900">
                {entry.term}
                <span className="text-base font-semibold text-gray-700 tabular-nums">
                  {value}
                  {unit && <span className="ml-0.5 text-sm font-medium text-gray-500">{unit}</span>}
                </span>
              </h3>
              {trend && (
                <div className="mt-1 text-[11px] text-gray-500">{trend}</div>
              )}
            </header>

            <p className="rounded-lg bg-blue-50/60 p-3 text-sm leading-relaxed text-gray-800">
              {entry.short}
            </p>

            {entry.formula && (
              <div className="rounded-md border-l-4 border-l-slate-400 bg-slate-50/50 px-3 py-2">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                  공식
                </div>
                <code className="mt-0.5 block break-words font-mono text-[12px] text-gray-800">
                  {entry.formula}
                </code>
              </div>
            )}

            <div>
              <div className="mb-2 text-xs font-medium text-gray-500">
                5개년 추이 ({years[0]}~{years[years.length - 1]})
              </div>
              <TrendChart
                years={years}
                series={[
                  {
                    key: "v",
                    label: entry.term,
                    color: spark.color ?? "#475569",
                    values: spark.values,
                  },
                ]}
                unitLabel={unitLabel}
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
                        spark.values[i] == null
                          ? "text-gray-300"
                          : (spark.values[i] as number) < 0
                            ? "text-rose-600"
                            : "text-gray-900"
                      )}
                    >
                      {spark.values[i] == null
                        ? "-"
                        : unitLabel === "백만원"
                          ? fmtMil(spark.values[i])
                          : (spark.values[i] as number).toFixed(1)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {(entry.good || entry.bad) && (
              <div className="grid gap-2 sm:grid-cols-2">
                {entry.good && (
                  <div className="rounded-md border-l-4 border-l-emerald-400 bg-emerald-50/30 px-3 py-2">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700">
                      건강 기준
                    </div>
                    <div className="mt-0.5 text-sm text-gray-700">{entry.good}</div>
                  </div>
                )}
                {entry.bad && (
                  <div className="rounded-md border-l-4 border-l-rose-400 bg-rose-50/30 px-3 py-2">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-rose-700">
                      위험 신호
                    </div>
                    <div className="mt-0.5 text-sm text-gray-700">{entry.bad}</div>
                  </div>
                )}
              </div>
            )}

            {entry.zimcarry && (
              <div className="rounded-md border-l-4 border-l-amber-400 bg-amber-50/30 px-3 py-2">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-amber-700">
                  짐캐리 적용
                </div>
                <div className="mt-0.5 text-sm leading-relaxed text-gray-700">
                  {entry.zimcarry}
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
