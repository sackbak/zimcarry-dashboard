"use client";

import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { generateAnalysis } from "@/app/actions";

const EXPECTED_SECONDS = 40;
const STAGES: { until: number; label: string }[] = [
  { until: 5, label: "재무 데이터 로딩 중..." },
  { until: 20, label: "1단계 — 종합 진단 · 5대 카테고리 생성 중..." },
  { until: 35, label: "2단계 — 탭별 심층 인사이트 작성 중..." },
  { until: Infinity, label: "마무리 정리 중..." },
];

function SubmitButton() {
  const { pending } = useFormStatus();
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!pending) {
      setElapsed(0);
      return;
    }
    const start = Date.now();
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000));
    }, 250);
    return () => clearInterval(id);
  }, [pending]);

  const stage = STAGES.find((s) => elapsed < s.until)?.label ?? "";
  const pct = Math.min(95, (elapsed / EXPECTED_SECONDS) * 100);

  return (
    <div className="flex flex-col items-end gap-1.5">
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg border border-amber-300 bg-amber-100 px-4 py-2 text-sm font-semibold text-amber-900 shadow-sm transition-colors enabled:hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? (
          <span className="inline-flex items-center gap-2">
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-amber-700 border-t-transparent" />
            {elapsed}초 / 약 {EXPECTED_SECONDS}초
          </span>
        ) : (
          "AI 분석 생성하기"
        )}
      </button>
      {pending && (
        <div className="w-56 space-y-1">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-amber-100">
            <div
              className="h-full bg-amber-500 transition-[width] duration-500 ease-linear"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="text-right text-[11px] text-amber-700">{stage}</div>
        </div>
      )}
    </div>
  );
}

export function GenerateNarrativeButton({ id }: { id: string }) {
  return (
    <form action={generateAnalysis}>
      <input type="hidden" name="id" value={id} />
      <SubmitButton />
    </form>
  );
}
