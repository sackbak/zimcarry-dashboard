"use client";

import { useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/Modal";
import { lookup } from "@/lib/glossary";
import { fmtEok, fmtMil } from "@/lib/format";
import { cn } from "@/lib/utils";

type Round = {
  year: number;
  round: string;
  amount_mil: number;
  investors: string[];
};

export function InvestmentTimeline({
  rounds,
  cumulativeMil,
  vcOnlyMil,
  note,
  capitalErosion,
  yearLabels,
}: {
  rounds: Round[];
  cumulativeMil: number;
  vcOnlyMil: number;
  note: string;
  capitalErosion: boolean[];
  yearLabels: number[];
}) {
  const [revealed, setRevealed] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  useEffect(() => {
    const id = requestAnimationFrame(() => setRevealed(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const totalAmount = rounds.reduce((s, r) => s + r.amount_mil, 0);

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
        <div>
          <h3 className="text-base font-semibold text-gray-900">
            투자 유치 히스토리
          </h3>
          <p className="mt-0.5 text-xs text-gray-500">
            누적 자본금 {fmtEok(cumulativeMil)} (VC {fmtEok(vcOnlyMil)} + 정책자금 + 창업자 출자) · 라운드 클릭 → 상세
          </p>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-gray-500">
          {yearLabels.map((y, i) => (
            <div
              key={y}
              className="flex flex-col items-center gap-0.5"
              title={capitalErosion[i] ? "자본잠식" : "정상"}
            >
              <span
                className={
                  capitalErosion[i]
                    ? "h-2 w-2 rounded-full bg-rose-500"
                    : "h-2 w-2 rounded-full bg-emerald-500"
                }
              />
              <span>{y}</span>
            </div>
          ))}
          <span className="ml-2 flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-rose-500" /> 자본잠식
          </span>
        </div>
      </div>

      <div className="px-5 py-5">
        <div className="relative pl-4">
          <div
            className="absolute bottom-2 left-1.5 top-2 w-px origin-top bg-gray-200 transition-transform duration-700 ease-out"
            style={{ transform: revealed ? "scaleY(1)" : "scaleY(0)" }}
          />
          <ul className="space-y-3">
            {rounds.map((r, idx) => {
              const pct = (r.amount_mil / totalAmount) * 100;
              const delay = idx * 180;
              return (
                <li
                  key={`${r.year}-${r.round}`}
                  className="relative transition-all duration-500 ease-out"
                  style={{
                    opacity: revealed ? 1 : 0,
                    transform: revealed ? "translateY(0)" : "translateY(8px)",
                    transitionDelay: `${delay}ms`,
                  }}
                >
                  <span
                    className="absolute -left-[11px] top-3 h-3 w-3 rounded-full border-2 border-fuchsia-500 bg-white transition-transform duration-300 ease-out"
                    style={{
                      transform: revealed ? "scale(1)" : "scale(0)",
                      transitionDelay: `${delay + 100}ms`,
                    }}
                    aria-hidden
                  />
                  <button
                    type="button"
                    onClick={() => setSelectedIdx(idx)}
                    className="group/round w-full rounded-lg border border-transparent px-2 py-1.5 text-left transition-colors hover:border-fuchsia-100 hover:bg-fuchsia-50/40"
                  >
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span className="text-xs font-medium text-gray-500">
                        {r.year}
                      </span>
                      <span className="text-sm font-semibold text-gray-900 transition-colors group-hover/round:text-fuchsia-800">
                        {r.round}
                      </span>
                      <span className="text-sm font-bold tabular-nums text-fuchsia-700">
                        {fmtEok(r.amount_mil)}
                      </span>
                      <span className="text-[11px] text-gray-400">
                        ({fmtMil(r.amount_mil)}백만)
                      </span>
                      <span className="ml-auto text-[10px] font-medium uppercase tracking-wider text-fuchsia-500 opacity-0 transition-opacity group-hover/round:opacity-100">
                        상세 →
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-fuchsia-50">
                      <div
                        className="h-full rounded-full bg-fuchsia-500 transition-all duration-700 ease-out"
                        style={{
                          width: revealed ? `${Math.max(pct, 4)}%` : "0%",
                          transitionDelay: `${delay + 200}ms`,
                        }}
                      />
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {r.investors.map((inv) => (
                        <span
                          key={inv}
                          className="rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-[10px] text-gray-600"
                        >
                          {inv}
                        </span>
                      ))}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50/50 p-3 text-[11px] leading-relaxed text-amber-900">
          {note}
        </div>
      </div>

      <Modal
        open={selectedIdx !== null}
        onClose={() => setSelectedIdx(null)}
        className="max-w-xl"
      >
        {selectedIdx !== null && (
          <RoundDetail
            round={rounds[selectedIdx]}
            allRounds={rounds}
            selectedIdx={selectedIdx}
            vcOnlyMil={vcOnlyMil}
            capitalErosion={capitalErosion}
            yearLabels={yearLabels}
          />
        )}
      </Modal>
    </div>
  );
}

function RoundDetail({
  round,
  allRounds,
  selectedIdx,
  vcOnlyMil,
  capitalErosion,
  yearLabels,
}: {
  round: Round;
  allRounds: Round[];
  selectedIdx: number;
  vcOnlyMil: number;
  capitalErosion: boolean[];
  yearLabels: number[];
}) {
  // Round name → glossary lookup. "Series A Bridge"는 Bridge로, 나머지는 그대로.
  const glossaryKey = useMemo(() => {
    if (round.round.includes("Bridge")) return "Bridge";
    if (round.round === "Series A") return "Series A";
    if (round.round === "Pre-A") return "Pre-A";
    if (round.round === "Seed") return "Seed";
    return round.round;
  }, [round.round]);
  const entry = lookup(glossaryKey);

  // 이 라운드까지 누적 VC + 직접 라운드 합계
  const cumulativeUpToHere = allRounds
    .slice(0, selectedIdx + 1)
    .reduce((s, r) => s + r.amount_mil, 0);
  const cumulativeBefore = allRounds
    .slice(0, selectedIdx)
    .reduce((s, r) => s + r.amount_mil, 0);

  const max = Math.max(...allRounds.map((r) => r.amount_mil));

  // 라운드 시점 자본잠식 상태 (year를 yearLabels에서 찾기)
  const yearIdx = yearLabels.indexOf(round.year);
  const erosionAtYear = yearIdx >= 0 ? capitalErosion[yearIdx] : null;

  return (
    <div className="space-y-5 p-6 pt-7">
      <header className="pr-8">
        <div className="text-[10px] font-medium uppercase tracking-wider text-fuchsia-500">
          투자 라운드 · {round.year}년
        </div>
        <div className="mt-1 flex flex-wrap items-baseline gap-2">
          <h3 className="text-xl font-bold text-gray-900">{round.round}</h3>
          <span className="text-2xl font-bold tabular-nums text-fuchsia-700">
            {fmtEok(round.amount_mil)}
          </span>
          <span className="text-xs text-gray-400">
            ({fmtMil(round.amount_mil)}백만원)
          </span>
        </div>
      </header>

      {entry && (
        <div className="rounded-lg bg-fuchsia-50/60 p-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-fuchsia-600">
            라운드 정의
          </div>
          <div className="mt-1 text-sm font-semibold text-gray-900">
            {entry.term}
          </div>
          <p className="mt-1 text-[12px] leading-relaxed text-gray-700">
            {entry.short}
          </p>
        </div>
      )}

      <div>
        <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
          참여 투자자 ({round.investors.length})
        </div>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {round.investors.map((inv) => (
            <span
              key={inv}
              className="rounded-full border border-fuchsia-200 bg-fuchsia-50 px-2.5 py-1 text-[11px] font-medium text-fuchsia-800"
            >
              {inv}
            </span>
          ))}
        </div>
      </div>

      <div>
        <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
          전체 라운드 비교
        </div>
        <div className="mt-2 space-y-1.5">
          {allRounds.map((r, i) => {
            const isSelected = i === selectedIdx;
            const pct = (r.amount_mil / max) * 100;
            return (
              <div key={`${r.year}-${r.round}`} className="flex items-center gap-2">
                <div className="w-[120px] shrink-0 text-[11px] tabular-nums text-gray-600">
                  <span className="text-gray-400">{r.year}</span>{" "}
                  <span
                    className={
                      isSelected ? "font-semibold text-fuchsia-700" : "text-gray-700"
                    }
                  >
                    {r.round}
                  </span>
                </div>
                <div className="relative h-4 flex-1 overflow-hidden rounded bg-gray-100">
                  <div
                    className={cn(
                      "h-full rounded transition-all",
                      isSelected ? "bg-fuchsia-500" : "bg-fuchsia-200"
                    )}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div
                  className={cn(
                    "w-[60px] shrink-0 text-right text-[11px] tabular-nums",
                    isSelected
                      ? "font-bold text-fuchsia-700"
                      : "text-gray-500"
                  )}
                >
                  {fmtEok(r.amount_mil)}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 rounded-lg border border-gray-100 bg-gray-50 p-3 text-center">
        <Stat
          label="이전까지 누적"
          value={fmtEok(cumulativeBefore)}
          tone="gray"
        />
        <Stat
          label="이 라운드 후"
          value={fmtEok(cumulativeUpToHere)}
          tone="fuchsia"
        />
        <Stat
          label={
            erosionAtYear == null
              ? "시점 자본"
              : erosionAtYear
                ? `${round.year}년 자본`
                : `${round.year}년 자본`
          }
          value={
            erosionAtYear == null
              ? "—"
              : erosionAtYear
                ? "잠식"
                : "정상"
          }
          tone={
            erosionAtYear == null
              ? "gray"
              : erosionAtYear
                ? "rose"
                : "emerald"
          }
        />
      </div>


      <div className="rounded-lg border border-gray-100 bg-gray-50 p-3 text-[11px] leading-relaxed text-gray-600">
        <span className="font-semibold text-gray-700">참고</span> · 본 모달은 VC 직접 투자분만 표시 (누적 VC {fmtEok(vcOnlyMil)}). 재무제표상 누적 자본금에는 정책자금 + 창업자 출자가 추가로 포함됨.
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "gray" | "fuchsia" | "rose" | "emerald";
}) {
  const valCls =
    tone === "fuchsia"
      ? "text-fuchsia-700"
      : tone === "rose"
        ? "text-rose-600"
        : tone === "emerald"
          ? "text-emerald-600"
          : "text-gray-800";
  return (
    <div>
      <div className="text-[10px] font-medium uppercase tracking-wider text-gray-500">
        {label}
      </div>
      <div className={cn("mt-0.5 text-sm font-bold tabular-nums", valCls)}>
        {value}
      </div>
    </div>
  );
}
