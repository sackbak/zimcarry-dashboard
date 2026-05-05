"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { CategoryKPI, DashboardCategory } from "@/lib/data";
import { SIGNAL_BAR, SIGNAL_BG, SIGNAL_DOT, SIGNAL_LABEL } from "@/lib/signal";
import { fmtKpi } from "@/lib/format";
import { RichText, TermScope } from "@/components/RichText";
import { Modal } from "@/components/Modal";
import { lookup, type GlossaryEntry } from "@/lib/glossary";
import { Search } from "lucide-react";

export function CategoryPanel({ category }: { category: DashboardCategory }) {
  const [active, setActive] = useState<CategoryKPI | null>(null);

  return (
    <>
      <TermScope>
        <div className="flex h-full flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
          <div className={cn("h-1 w-full", SIGNAL_BAR[category.signal])} />
          <div className="flex flex-col gap-3 p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-900">
                {category.name}
              </h3>
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
                  SIGNAL_BG[category.signal]
                )}
              >
                <span>{SIGNAL_DOT[category.signal]}</span>
                {SIGNAL_LABEL[category.signal]}
              </span>
            </div>
            <p className="text-xs leading-relaxed text-gray-600">
              <RichText text={category.comment} />
            </p>

            <ul className="mt-1 space-y-1 border-t border-gray-100 pt-3">
              {category.kpis.map((k) => {
                const entry = lookup(k.name);
                const clickable = !!entry;
                return (
                  <li key={k.name}>
                    <button
                      type="button"
                      onClick={() => clickable && setActive(k)}
                      disabled={!clickable}
                      className={cn(
                        "group/kpi flex w-full items-center justify-between gap-2 rounded-md px-1.5 py-1 text-left text-xs transition-colors",
                        clickable
                          ? "cursor-pointer hover:bg-blue-50/60"
                          : "cursor-default"
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1">
                          <span
                            className={cn(
                              "truncate text-gray-700",
                              clickable &&
                                "group-hover/kpi:text-blue-700 group-hover/kpi:underline group-hover/kpi:decoration-dotted"
                            )}
                          >
                            {k.name}
                          </span>
                          {clickable && (
                            <Search className="h-2.5 w-2.5 shrink-0 text-gray-300 group-hover/kpi:text-blue-500" />
                          )}
                        </div>
                        <div className="text-[10px] text-gray-400">
                          {k.benchmark}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold tabular-nums text-gray-900">
                          {fmtKpi(k.value, k.unit)}
                        </span>
                        <span className="text-[10px]">
                          {SIGNAL_DOT[k.signal]}
                        </span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </TermScope>

      {active && (
        <KpiGlossaryModal
          open
          onClose={() => setActive(null)}
          kpi={active}
          entry={lookup(active.name)!}
        />
      )}
    </>
  );
}

function KpiGlossaryModal({
  open,
  onClose,
  kpi,
  entry,
}: {
  open: boolean;
  onClose: () => void;
  kpi: CategoryKPI;
  entry: GlossaryEntry;
}) {
  return (
    <Modal open={open} onClose={onClose} className="max-w-xl">
      <div className="space-y-4 p-6 pt-7">
        <header className="pr-8">
          <div className="text-[10px] font-medium uppercase tracking-wider text-blue-500">
            지표 정의 · 2025 짐캐리 값
          </div>
          <h3 className="mt-1 flex items-baseline gap-2 text-xl font-bold text-gray-900">
            {entry.term}
            <span
              className={cn(
                "text-base font-semibold",
                kpi.signal === "red"
                  ? "text-rose-700"
                  : kpi.signal === "yellow"
                    ? "text-amber-700"
                    : "text-emerald-700"
              )}
            >
              {fmtKpi(kpi.value, kpi.unit)} {SIGNAL_DOT[kpi.signal]}
            </span>
          </h3>
          <div className="mt-1 text-[11px] text-gray-500">
            기준: {kpi.benchmark}
          </div>
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
  );
}
