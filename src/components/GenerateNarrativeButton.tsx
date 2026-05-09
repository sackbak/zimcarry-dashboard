"use client";

import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  generateDashboardAction,
  generateBSAction,
  generateISAction,
  generateCFAction,
  generateInvestmentAction,
} from "@/app/actions";

type Tab = "dashboard" | "balance_sheet" | "income_statement" | "cash_flow" | "investment";

const ACTION_MAP: Record<Tab, (fd: FormData) => Promise<void>> = {
  dashboard: generateDashboardAction,
  balance_sheet: generateBSAction,
  income_statement: generateISAction,
  cash_flow: generateCFAction,
  investment: generateInvestmentAction,
};

const META: Record<
  Tab,
  { idle: string; cost: string; expected: number; topic: string; phases: string[] }
> = {
  dashboard: {
    idle: "AI 종합진단 생성",
    cost: "약 3원 · 15-25초",
    expected: 22,
    topic: "종합진단",
    phases: [
      "재무 데이터 로딩",
      "5년 추이 분석",
      "5대 카테고리 신호등 산출",
      "변곡점·이례 패턴 탐지",
      "M&A 관점 시나리오 작성",
      "종합 진단 정리",
    ],
  },
  balance_sheet: {
    idle: "AI 재무상태표 인사이트 생성",
    cost: "약 2원 · 10-15초",
    expected: 13,
    topic: "재무상태표",
    phases: [
      "자본구조 분석",
      "부채 만기 구조 점검",
      "자산 환금성 평가",
      "운전자본 변화 추적",
      "청산가치 추정",
    ],
  },
  income_statement: {
    idle: "AI 손익계산서 인사이트 생성",
    cost: "약 2원 · 10-15초",
    expected: 13,
    topic: "손익계산서",
    phases: [
      "매출 성장률·CAGR 산출",
      "수익성 트렌드 분석",
      "비용 구조 분해",
      "운영 레버리지 점검",
      "BEP 위치 추정",
    ],
  },
  cash_flow: {
    idle: "AI 현금흐름 인사이트 생성",
    cost: "약 2원 · 10-15초",
    expected: 13,
    topic: "현금흐름",
    phases: [
      "OCF/FCF 자력생존 점검",
      "운전자본 효과 분리",
      "CAPEX 성격 분석",
      "런웨이 산출",
      "외부자금 의존도 평가",
    ],
  },
  investment: {
    idle: "AI 투자관점 인사이트 생성",
    cost: "약 3원 · 12-18초",
    expected: 15,
    topic: "투자관점",
    phases: [
      "자본효율·BEP 점검",
      "Bull/Bear 시나리오 도출",
      "VC 체크리스트 점검",
      "딜 구조 아이디어 작성",
      "DD 핵심 항목 정리",
    ],
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
  const action = ACTION_MAP[tab];
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <ButtonInner tab={tab} variant={variant} />
    </form>
  );
}

function ButtonInner({ tab, variant }: { tab: Tab; variant: "amber" | "compact" }) {
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
    }, 1000);
    return () => clearInterval(id);
  }, [pending]);

  const meta = META[tab];

  return (
    <>
      {variant === "compact" ? (
        <CompactButton pending={pending} elapsed={elapsed} meta={meta} />
      ) : (
        <PrimaryButton pending={pending} elapsed={elapsed} meta={meta} />
      )}
      {pending && <ScanningOverlay elapsed={elapsed} meta={meta} />}
    </>
  );
}

function PrimaryButton({
  pending,
  elapsed,
  meta,
}: {
  pending: boolean;
  elapsed: number;
  meta: (typeof META)[Tab];
}) {
  return (
    <div className="flex flex-col items-end gap-1.5">
      <button
        type="submit"
        disabled={pending}
        className="group relative inline-flex items-center gap-2 overflow-hidden rounded-lg border border-indigo-300 bg-gradient-to-r from-indigo-500 to-blue-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-indigo-200 transition-all enabled:hover:shadow-md enabled:hover:shadow-indigo-300 enabled:hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {!pending && (
          <span className="relative inline-flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
          </span>
        )}
        <span>{pending ? `${elapsed}초 / 약 ${meta.expected}초` : meta.idle}</span>
      </button>
      <div className="text-[11px] text-gray-500">{meta.cost}</div>
    </div>
  );
}

function CompactButton({
  pending,
  elapsed,
  meta,
}: {
  pending: boolean;
  elapsed: number;
  meta: (typeof META)[Tab];
}) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center gap-2 rounded-md border border-indigo-200 bg-gradient-to-r from-indigo-50 to-blue-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 shadow-sm transition-all enabled:hover:border-indigo-400 enabled:hover:from-indigo-100 enabled:hover:to-blue-100 enabled:hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-70"
    >
      {!pending && (
        <span className="relative inline-flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-500 opacity-60" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-indigo-500" />
        </span>
      )}
      <span>{pending ? `분석 중 ${elapsed}s / ${meta.expected}s` : meta.idle}</span>
      {!pending && <span className="text-[10px] font-normal text-indigo-500">{meta.cost}</span>}
    </button>
  );
}

function ScanningOverlay({
  elapsed,
  meta,
}: {
  elapsed: number;
  meta: (typeof META)[Tab];
}) {
  const phaseInterval = meta.expected / meta.phases.length;
  const phaseIdx = Math.min(meta.phases.length - 1, Math.floor(elapsed / phaseInterval));
  const pct = Math.min(95, (elapsed / meta.expected) * 100);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/70 backdrop-blur-sm">
      <div className="scan-line absolute inset-0" />

      <div className="ai-reveal relative mx-4 w-full max-w-md rounded-2xl border border-indigo-200 bg-white p-7 shadow-2xl shadow-indigo-200/50">
        <div className="absolute inset-x-0 top-0 h-1 overflow-hidden rounded-t-2xl">
          <div
            className="h-full bg-gradient-to-r from-indigo-500 via-blue-500 to-indigo-500 transition-[width] duration-700 ease-linear"
            style={{ width: `${pct}%` }}
          />
        </div>

        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-500 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-indigo-500" />
              </span>
              <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-700">
                AI 분석 활성
              </span>
            </div>
            <span className="font-mono text-[11px] tabular-nums text-gray-400">
              {String(elapsed).padStart(2, "0")} / {meta.expected}s
            </span>
          </div>

          <div>
            <div className="text-[10px] font-medium uppercase tracking-wider text-gray-400">
              {meta.topic}
            </div>
            <h3 className="mt-1 text-lg font-bold text-gray-900">
              5개년 재무 데이터 정밀 분석 중
            </h3>
          </div>

          <ul className="space-y-1.5">
            {meta.phases.map((phase, i) => {
              const status = i < phaseIdx ? "done" : i === phaseIdx ? "active" : "pending";
              return (
                <li key={phase} className="flex items-center gap-2.5 text-[13px]">
                  <span
                    className={
                      status === "done"
                        ? "inline-flex h-4 w-4 items-center justify-center rounded-full bg-indigo-100 text-[9px] font-bold text-indigo-700"
                        : status === "active"
                          ? "relative inline-flex h-4 w-4"
                          : "inline-flex h-4 w-4 items-center justify-center rounded-full border border-gray-200 text-[9px] font-bold text-gray-300"
                    }
                  >
                    {status === "done" ? (
                      "✓"
                    ) : status === "active" ? (
                      <>
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-400 opacity-50" />
                        <span className="relative h-4 w-4 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
                      </>
                    ) : (
                      i + 1
                    )}
                  </span>
                  <span
                    className={
                      status === "done"
                        ? "text-gray-500 line-through"
                        : status === "active"
                          ? "font-semibold text-indigo-700"
                          : "text-gray-400"
                    }
                  >
                    {phase}
                  </span>
                </li>
              );
            })}
          </ul>

          <p className="border-t border-gray-100 pt-3 text-[11px] text-gray-400">
            Gemini 2.5 Flash · K-IFRS 회계 기준 · M&A 임원 시각
          </p>
        </div>
      </div>
    </div>
  );
}

/** 기존 import 호환 */
export function GenerateNarrativeButton({ id }: { id: string }) {
  return <AIGenerateButton id={id} tab="dashboard" />;
}
