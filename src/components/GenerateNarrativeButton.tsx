"use client";

import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { generateAnalysis } from "@/app/actions";

const EXPECTED_SECONDS = 45;
/** 경과 시간에 맞춰 보여줄 단계 텍스트 — 실제 호출 단계와 정확히 매핑되진 않지만 흐름은 일치. */
const STAGES: { until: number; label: string }[] = [
  { until: 8, label: "재무 데이터 분석 중..." },
  { until: 18, label: "5대 카테고리 신호등 산출 중..." },
  { until: 30, label: "BS/IS/CF 페이지 인사이트 작성 중..." },
  { until: 42, label: "라인 아이템별 노트 생성 중..." },
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
