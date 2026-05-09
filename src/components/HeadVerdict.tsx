"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { Signal } from "@/lib/data";
import { SIGNAL_BAR, SIGNAL_BG, SIGNAL_DOT } from "@/lib/signal";
import { InsightModal } from "@/components/InsightModal";
import type { InsightSection } from "@/lib/insights";
import { Search } from "lucide-react";
import { RichText, TermScope } from "@/components/RichText";
import { Modal } from "@/components/Modal";
import { lookup, type GlossaryEntry } from "@/lib/glossary";

export type VerdictKpi = {
  label: string;
  value: string;
  signal?: Signal;
  caption?: string;
};

export function HeadVerdict({
  topic,
  status,
  signal,
  headline,
  message,
  kpis,
  asOfNote,
  rightSlot,
  insight,
  dark = false,
}: {
  topic: string;
  status: string;
  signal: Signal;
  headline: string;
  message: string;
  kpis?: VerdictKpi[];
  asOfNote?: string;
  rightSlot?: React.ReactNode;
  insight?: InsightSection;
  dark?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [activeKpi, setActiveKpi] = useState<VerdictKpi | null>(null);
  const clickable = !!insight && insight.evidence.length > 0;

  return (
    <>
      <TermScope>
      <div className={cn(
        "overflow-hidden rounded-2xl border shadow-sm",
        dark
          ? "border-white/10 bg-white/5"
          : "border-[var(--border)] bg-white"
      )}>
        <div className={cn("h-1 w-full", SIGNAL_BAR[signal])} />

        <button
          type="button"
          onClick={() => clickable && setOpen(true)}
          disabled={!clickable}
          className={cn(
            "block w-full text-left transition-colors",
            clickable && "cursor-pointer hover:bg-gray-50/60"
          )}
        >
          <div className="grid gap-6 p-6 md:grid-cols-[1fr_auto] md:p-7">
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-medium uppercase tracking-wider text-gray-400">
                  {topic} 진단
                </span>
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
                    SIGNAL_BG[signal]
                  )}
                >
                  <span>{SIGNAL_DOT[signal]}</span>
                  {status}
                </span>
                {asOfNote && (
                  <span className="text-[11px] text-gray-400">· {asOfNote}</span>
                )}
                {clickable && (
                  <span className="ml-auto inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-[11px] font-medium text-gray-600">
                    <Search className="h-3 w-3" />
                    분석 근거 보기
                  </span>
                )}
              </div>

              <h2 className={cn(
                "text-xl font-bold leading-snug tracking-tight md:text-2xl",
                dark ? "text-white" : "text-gray-900"
              )}>
                <RichText text={headline} />
              </h2>

              <p className={cn(
                "max-w-3xl text-sm leading-relaxed",
                dark ? "text-white/70" : "text-gray-600"
              )}>
                <RichText text={message} />
              </p>
            </div>

            {rightSlot && <div className="md:self-end">{rightSlot}</div>}
          </div>
        </button>

        {kpis && kpis.length > 0 && (
          <div className="grid grid-cols-2 divide-x divide-y divide-gray-100 border-t border-gray-100 sm:grid-cols-4 sm:divide-y-0">
            {kpis.map((k, i) => {
              const entry = lookup(k.label);
              const kpiClickable = !!entry;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (kpiClickable) setActiveKpi(k);
                  }}
                  disabled={!kpiClickable}
                  className={cn(
                    "group/kt px-4 py-3 text-left transition-colors",
                    kpiClickable
                      ? "cursor-pointer hover:bg-blue-50/40"
                      : "cursor-default"
                  )}
                >
                  <div className="flex items-center gap-1">
                    <span
                      className={cn(
                        "text-[10px] font-medium uppercase tracking-wide text-gray-400",
                        kpiClickable &&
                          "group-hover/kt:text-blue-600"
                      )}
                    >
                      {k.label}
                    </span>
                    {kpiClickable && (
                      <Search className="h-2.5 w-2.5 shrink-0 text-gray-300 transition-colors group-hover/kt:text-blue-500" />
                    )}
                  </div>
                  <div className="mt-1 flex items-baseline gap-1.5">
                    <span
                      className={cn(
                        "text-base font-bold tabular-nums",
                        k.signal === "red"
                          ? "text-rose-700"
                          : k.signal === "yellow"
                            ? "text-amber-700"
                            : k.signal === "green"
                              ? "text-emerald-700"
                              : "text-gray-900"
                      )}
                    >
                      {k.value}
                    </span>
                    {k.signal && (
                      <span className="text-[10px]">{SIGNAL_DOT[k.signal]}</span>
                    )}
                  </div>
                  {k.caption && (
                    <div className="mt-0.5 text-[11px] text-gray-500">
                      {k.caption}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
      </TermScope>

      {insight && (
        <InsightModal
          open={open}
          onClose={() => setOpen(false)}
          topic={topic}
          status={status}
          signal={signal}
          insight={insight}
        />
      )}

      {activeKpi && (
        <VerdictKpiModal
          kpi={activeKpi}
          entry={lookup(activeKpi.label)!}
          onClose={() => setActiveKpi(null)}
        />
      )}
    </>
  );
}

function VerdictKpiModal({
  kpi,
  entry,
  onClose,
}: {
  kpi: VerdictKpi;
  entry: GlossaryEntry;
  onClose: () => void;
}) {
  return (
    <Modal open onClose={onClose} className="max-w-xl">
      <div className="space-y-4 p-6 pt-7">
        <header className="pr-8">
          <div className="text-[10px] font-medium uppercase tracking-wider text-blue-500">
            지표 정의
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
                    : kpi.signal === "green"
                      ? "text-emerald-700"
                      : "text-gray-900"
              )}
            >
              {kpi.value}
              {kpi.signal && (
                <span className="ml-1 text-[10px]">{SIGNAL_DOT[kpi.signal]}</span>
              )}
            </span>
          </h3>
          {kpi.caption && (
            <div className="mt-1 text-[11px] text-gray-500">{kpi.caption}</div>
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

      </div>
    </Modal>
  );
}
