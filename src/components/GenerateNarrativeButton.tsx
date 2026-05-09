"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  generateDashboard,
  generateBSAnalysis,
  generateISAnalysis,
  generateCFAnalysis,
} from "@/app/actions";

type Tab = "dashboard" | "balance_sheet" | "income_statement" | "cash_flow";

const ACTIONS: Record<Tab, (id: string) => Promise<{ ok: boolean; error?: string }>> = {
  dashboard: generateDashboard,
  balance_sheet: generateBSAnalysis,
  income_statement: generateISAnalysis,
  cash_flow: generateCFAnalysis,
};

const LABELS: Record<Tab, { idle: string; busy: string; cost: string; expected: number }> = {
  dashboard: {
    idle: "AI 종합진단 생성",
    busy: "종합진단 생성 중",
    cost: "약 3원 · 15-25초",
    expected: 22,
  },
  balance_sheet: {
    idle: "AI 재무상태표 인사이트 생성",
    busy: "BS 인사이트 생성 중",
    cost: "약 2원 · 10-15초",
    expected: 13,
  },
  income_statement: {
    idle: "AI 손익계산서 인사이트 생성",
    busy: "IS 인사이트 생성 중",
    cost: "약 2원 · 10-15초",
    expected: 13,
  },
  cash_flow: {
    idle: "AI 현금흐름 인사이트 생성",
    busy: "CF 인사이트 생성 중",
    cost: "약 2원 · 10-15초",
    expected: 13,
  },
};

export function AIGenerateButton({
  id,
  tab,
  variant = "amber",
}: {
  id: string;
  tab: Tab;
  variant?: "amber" | "compact";
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");

  const meta = LABELS[tab];

  async function handleClick() {
    if (busy) return;
    setErrorMsg("");
    setElapsed(0);
    setBusy(true);

    const timer = setInterval(() => setElapsed((s) => s + 1), 1000);

    try {
      const result = await ACTIONS[tab](id);
      if (!result.ok) {
        setErrorMsg(result.error ?? "생성 실패");
      } else {
        router.refresh();
      }
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : String(e));
    } finally {
      clearInterval(timer);
      setBusy(false);
    }
  }

  const pct = busy ? Math.min(95, (elapsed / meta.expected) * 100) : 0;

  if (variant === "compact") {
    return (
      <div className="flex flex-col items-end gap-1">
        <button
          type="button"
          onClick={handleClick}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-900 shadow-sm transition-colors enabled:hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? (
            <>
              <span className="h-2.5 w-2.5 animate-spin rounded-full border-2 border-amber-700 border-t-transparent" />
              <span>{elapsed}초 / 약 {meta.expected}초</span>
            </>
          ) : (
            <>
              <span>{meta.idle}</span>
              <span className="text-[10px] font-normal text-amber-700">· {meta.cost}</span>
            </>
          )}
        </button>
        {errorMsg && <p className="max-w-[280px] text-right text-[11px] text-red-600">{errorMsg}</p>}
      </div>
    );
  }

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
            {elapsed}초 / 약 {meta.expected}초
          </span>
        ) : (
          <span className="inline-flex items-center gap-2">
            {meta.idle}
            <span className="text-[10px] font-normal text-amber-700">{meta.cost}</span>
          </span>
        )}
      </button>
      {busy && (
        <div className="w-56 space-y-1">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-amber-100">
            <div
              className="h-full bg-amber-500 transition-[width] duration-500 ease-linear"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="text-right text-[11px] text-amber-700">{meta.busy}...</div>
        </div>
      )}
      {errorMsg && <p className="max-w-[280px] text-right text-[11px] text-red-600">{errorMsg}</p>}
    </div>
  );
}

/** 기존 import 호환 — 대시보드 버튼 alias */
export function GenerateNarrativeButton({ id }: { id: string }) {
  return <AIGenerateButton id={id} tab="dashboard" />;
}
