import { cn } from "@/lib/utils";
import type { OverallAssessment } from "@/lib/data";
import { SIGNAL_BAR, SIGNAL_BG } from "@/lib/signal";
import { RichText } from "@/components/RichText";

export function AssessmentBox({ assessment }: { assessment: OverallAssessment }) {
  return (
    <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-white shadow-sm">
      <div className={cn("h-1 w-full", SIGNAL_BAR[assessment.signal])} />
      <div className="flex flex-col gap-5 p-6">
        <div className="flex flex-wrap items-center gap-3">
          <span
            className={cn(
              "inline-flex items-center rounded-full border px-3 py-1 text-sm font-semibold",
              SIGNAL_BG[assessment.signal]
            )}
          >
            {assessment.label}
          </span>
          <h3 className="text-lg font-semibold text-gray-900">종합 평가</h3>
        </div>

        <p className="text-sm leading-relaxed text-gray-700">
          <RichText text={assessment.summary} />
        </p>

        <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
          <div className="text-xs font-medium uppercase tracking-wide text-gray-500">
            핵심 질문
          </div>
          <div className="mt-1 text-sm font-medium text-gray-900">
            <RichText text={assessment.key_question} />
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <ScenarioBox
            label="🟢 낙관"
            tone="emerald"
            text={assessment.scenarios.bullish}
          />
          <ScenarioBox
            label="🟡 기본"
            tone="amber"
            text={assessment.scenarios.base}
          />
          <ScenarioBox
            label="🔴 비관"
            tone="rose"
            text={assessment.scenarios.bearish}
          />
        </div>
      </div>
    </div>
  );
}

function ScenarioBox({
  label,
  tone,
  text,
}: {
  label: string;
  tone: "emerald" | "amber" | "rose";
  text: string;
}) {
  const toneClass =
    tone === "emerald"
      ? "border-emerald-200 bg-emerald-50/60"
      : tone === "amber"
        ? "border-amber-200 bg-amber-50/60"
        : "border-rose-200 bg-rose-50/60";
  return (
    <div className={cn("rounded-lg border p-3", toneClass)}>
      <div className="text-xs font-semibold text-gray-700">{label}</div>
      <div className="mt-1 text-xs leading-relaxed text-gray-600">
        <RichText text={text} />
      </div>
    </div>
  );
}
