"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { generateMain, generateInsights } from "@/app/actions";

type Stage = "idle" | "stage1" | "stage2" | "done" | "error";

const STAGE_LABEL: Record<Stage, string> = {
  idle: "AI 분석 생성하기",
  stage1: "1단계 — 종합 진단 · 카테고리 생성 중...",
  stage2: "2단계 — 탭별 심층 인사이트 작성 중...",
  done: "완료",
  error: "다시 시도",
};

export function GenerateNarrativeButton({ id }: { id: string }) {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");

  const busy = stage === "stage1" || stage === "stage2";

  async function handleClick() {
    if (busy) return;
    setErrorMsg("");
    setElapsed(0);

    const timer = setInterval(() => setElapsed((s) => s + 1), 1000);

    try {
      setStage("stage1");
      const r1 = await generateMain(id);
      if (!r1.ok) { setErrorMsg(r1.error ?? "1단계 실패"); setStage("error"); return; }

      router.refresh();

      setStage("stage2");
      const r2 = await generateInsights(id);
      if (!r2.ok) { setErrorMsg(r2.error ?? "2단계 실패"); setStage("error"); return; }

      router.refresh();
      setStage("done");
    } finally {
      clearInterval(timer);
    }
  }

  const pct = stage === "stage1"
    ? Math.min(45, (elapsed / 25) * 45)
    : stage === "stage2"
      ? 45 + Math.min(50, (elapsed / 30) * 50)
      : stage === "done" ? 100 : 0;

  return (
    <div className="flex flex-col items-end gap-1.5">
      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        className="rounded-lg border border-amber-300 bg-amber-100 px-4 py-2 text-sm font-semibold text-amber-900 shadow-sm transition-colors enabled:hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? (
          <span className="inline-flex items-center gap-2">
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-amber-700 border-t-transparent" />
            {elapsed}초
          </span>
        ) : STAGE_LABEL[stage]}
      </button>

      {busy && (
        <div className="w-56 space-y-1">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-amber-100">
            <div
              className="h-full bg-amber-500 transition-[width] duration-500 ease-linear"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="text-right text-[11px] text-amber-700">{STAGE_LABEL[stage]}</div>
        </div>
      )}

      {stage === "error" && errorMsg && (
        <p className="max-w-[200px] text-right text-[11px] text-red-600">{errorMsg}</p>
      )}
    </div>
  );
}
