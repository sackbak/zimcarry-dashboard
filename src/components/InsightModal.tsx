"use client";

import { Modal } from "@/components/Modal";
import type { InsightSection } from "@/lib/insights";
import { cn } from "@/lib/utils";
import type { Signal } from "@/lib/data";
import { SIGNAL_BAR, SIGNAL_BG, SIGNAL_DOT } from "@/lib/signal";
import { RichText, TermScope } from "@/components/RichText";

export function InsightModal({
  open,
  onClose,
  topic,
  status,
  signal,
  insight,
}: {
  open: boolean;
  onClose: () => void;
  topic: string;
  status: string;
  signal: Signal;
  insight: InsightSection;
}) {
  return (
    <Modal open={open} onClose={onClose} className="max-w-3xl">
      <TermScope>
      <div className={cn("h-1 w-full", SIGNAL_BAR[signal])} />
      <div className="space-y-6 p-6 pt-7 md:p-8 md:pt-9">
        <header className="flex flex-wrap items-center gap-2 pr-8">
          <span className="text-[11px] font-medium uppercase tracking-wider text-gray-400">
            {topic} 진단 · 분석 근거
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
        </header>

        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
            결론
          </div>
          <p className="mt-1.5 text-base font-semibold leading-relaxed text-gray-900">
            <RichText text={insight.conclusion} />
          </p>
        </div>

        {insight.evidence.length > 0 && (
          <Section title="데이터 근거" tone="blue">
            <ul className="space-y-1.5 text-sm leading-relaxed text-gray-700">
              {insight.evidence.map((e, i) => (
                <li key={i} className="flex gap-2">
                  <span className="mt-1.5 inline-block h-1 w-1 shrink-0 rounded-full bg-blue-500" />
                  <span>
                    <RichText text={e} />
                  </span>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {insight.reasoning && (
          <Section title="어떻게 읽었나" tone="slate">
            <p className="whitespace-pre-line text-sm leading-relaxed text-gray-700">
              <RichText text={insight.reasoning} />
            </p>
          </Section>
        )}

        {insight.accounting && insight.accounting.length > 0 && (
          <Section title="회계·감사 관전 포인트" tone="amber">
            <ul className="space-y-1.5 text-sm leading-relaxed text-gray-700">
              {insight.accounting.map((e, i) => (
                <li key={i} className="flex gap-2">
                  <span className="mt-1.5 inline-block h-1 w-1 shrink-0 rounded-full bg-amber-500" />
                  <span>
                    <RichText text={e} />
                  </span>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {insight.mna && insight.mna.length > 0 && (
          <Section title="M&A · 협상 함의" tone="purple">
            <ul className="space-y-1.5 text-sm leading-relaxed text-gray-700">
              {insight.mna.map((e, i) => (
                <li key={i} className="flex gap-2">
                  <span className="mt-1.5 inline-block h-1 w-1 shrink-0 rounded-full bg-purple-500" />
                  <span>
                    <RichText text={e} />
                  </span>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {insight.monitoring && insight.monitoring.length > 0 && (
          <Section title="분기별 모니터링 포인트" tone="emerald">
            <ul className="space-y-1.5 text-sm leading-relaxed text-gray-700">
              {insight.monitoring.map((e, i) => (
                <li key={i} className="flex gap-2">
                  <span className="mt-1.5 inline-block h-1 w-1 shrink-0 rounded-full bg-emerald-500" />
                  <span>
                    <RichText text={e} />
                  </span>
                </li>
              ))}
            </ul>
          </Section>
        )}
      </div>
      </TermScope>
    </Modal>
  );
}

function Section({
  title,
  tone,
  children,
}: {
  title: string;
  tone: "blue" | "amber" | "purple" | "emerald" | "slate";
  children: React.ReactNode;
}) {
  const accent =
    tone === "blue"
      ? "border-l-blue-400"
      : tone === "amber"
        ? "border-l-amber-400"
        : tone === "purple"
          ? "border-l-purple-400"
          : tone === "emerald"
            ? "border-l-emerald-400"
            : "border-l-slate-400";
  return (
    <div className={cn("border-l-4 pl-4", accent)}>
      <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
        {title}
      </h4>
      <div className="mt-2">{children}</div>
    </div>
  );
}
