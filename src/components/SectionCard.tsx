"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Sparkline } from "@/components/Sparkline";
import { Modal } from "@/components/Modal";
import { TrendChart } from "@/components/TrendChart";
import { fmtScaled, fmtPct, pickMoneyScale } from "@/lib/format";

type SectionDetail = {
  short: string;
  composition: string;
  watchpoint: string;
};

const SECTION_INFO: Record<string, SectionDetail> = {
  자산: {
    short:
      "기업이 가진 모든 경제적 자원의 합계 — 현금·매출채권·재고·유형자산·무형자산 등.",
    composition:
      "유동자산(1년 내 현금화) 39.6% + 비유동자산(장기 운용) 60.4%. 무형자산 10.1억(개발비 자산화)이 비유동의 핵심.",
    watchpoint:
      "5년간 자산 5.7배 성장 — 다만 무형자산 비중 ↑ 시 PPE 대비 회수 가시성이 떨어질 수 있음. 개발비 자산화 정책 확인 필요.",
  },
  부채: {
    short:
      "기업이 외부에 갚아야 할 의무 — 차입금·매입채무·미지급금 등 모든 외부 빚.",
    composition:
      "유동부채 91% + 비유동부채 9% — 단기 만기 집중 구조. 단기차입금 14.2억(부채의 56%)이 매년 롤오버 필요.",
    watchpoint:
      "부채비율 322% (적정 200% 이하). 차입금 의존도 높음 — Bridge 증자 후에도 매년 차입금 만기 도래 시 금리 상승·신용한도 축소 위험.",
  },
  자본: {
    short:
      "주주 몫 (자산 - 부채). 자본금(주식 액면) + 잉여금(누적 손익·증자 프리미엄)으로 구성.",
    composition:
      "자본금 5.7억 + 자본잉여금 약 40.4억(누적 증자 프리미엄). 결손금이 잉여금을 까먹는 구조.",
    watchpoint:
      "5년간 자본잠식 2회(2021, 2024) — 매번 증자로 회복. 외부 자금 없이는 자체 자본 형성 불가. Series A Bridge로 2025 자본 8.0억 회복.",
  },
};

export function SectionCard({
  label,
  total,
  yoy,
  values,
  color,
  badge,
  caption,
  years,
}: {
  label: string;
  total: number | null;
  yoy: number | null;
  values: (number | null)[];
  color: string;
  badge?: string;
  caption?: string;
  years?: number[];
}) {
  const [open, setOpen] = useState(false);
  const info = SECTION_INFO[label];
  const hasDetail = !!info && !!years;

  let maxAbs = total != null ? Math.abs(total) : 0;
  for (const v of values) {
    if (v != null && Math.abs(v) > maxAbs) maxAbs = Math.abs(v);
  }
  const scale = pickMoneyScale(maxAbs);
  const totalDisplay = fmtScaled(total, scale);

  return (
    <>
      <button
        type="button"
        onClick={() => hasDetail && setOpen(true)}
        disabled={!hasDetail}
        className={cn(
          "group/section relative flex w-full flex-col gap-3 overflow-hidden rounded-xl border border-[var(--border)] bg-white p-5 text-left shadow-sm transition-all",
          hasDetail &&
            "cursor-pointer hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md"
        )}
      >
        <div
          className="absolute inset-x-0 top-0 h-1"
          style={{ backgroundColor: color }}
        />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: color }}
            />
            <h3 className="text-base font-semibold text-gray-900">{label}</h3>
            {hasDetail && (
              <Search className="h-3 w-3 text-gray-300 transition-colors group-hover/section:text-blue-500" />
            )}
          </div>
          {badge && (
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600">
              {badge}
            </span>
          )}
        </div>

        <div>
          <div className="flex items-baseline gap-2">
            <span
              className={cn(
                "text-3xl font-bold tracking-tight tabular-nums",
                total != null && total < 0 ? "text-rose-600" : "text-gray-900"
              )}
            >
              {totalDisplay}
              <span className="ml-1 text-[11px] font-medium text-gray-400">
                {scale.label}
              </span>
            </span>
            {yoy != null && (
              <span
                className={cn(
                  "text-xs font-semibold",
                  yoy > 0 ? "text-emerald-600" : "text-rose-600"
                )}
              >
                YoY {fmtPct(yoy, { sign: true })}
              </span>
            )}
          </div>
          {caption && (
            <div className="mt-1 text-[11px] text-gray-500">{caption}</div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-gray-100 pt-2">
          <span className="text-[10px] text-gray-400">5년 추이</span>
          <Sparkline values={values} color={color} width={120} height={28} showZero />
        </div>
      </button>

      {hasDetail && info && years && (
        <Modal open={open} onClose={() => setOpen(false)} className="max-w-2xl">
          <div className="space-y-5 p-6 pt-7">
            <header className="pr-8">
              <div
                className="text-[10px] font-medium uppercase tracking-wider"
                style={{ color }}
              >
                재무상태표 구성 요소
              </div>
              <div className="mt-1 flex flex-wrap items-baseline gap-2">
                <h3 className="text-xl font-bold text-gray-900">{label}</h3>
                <span
                  className={cn(
                    "text-2xl font-bold tabular-nums",
                    total != null && total < 0 ? "text-rose-600" : "text-gray-900"
                  )}
                >
                  {totalDisplay}
                  <span className="ml-1 text-[11px] font-medium text-gray-400">
                    {scale.label}
                  </span>
                </span>
                {yoy != null && (
                  <span
                    className={cn(
                      "text-xs font-semibold",
                      yoy > 0 ? "text-emerald-600" : "text-rose-600"
                    )}
                  >
                    YoY {fmtPct(yoy, { sign: true })}
                  </span>
                )}
              </div>
            </header>

            <div
              className="rounded-lg p-4"
              style={{ backgroundColor: `${color}10` }}
            >
              <div
                className="text-[10px] font-semibold uppercase tracking-wider"
                style={{ color }}
              >
                {label} 정의
              </div>
              <p className="mt-1 text-sm leading-relaxed text-gray-800">
                {info.short}
              </p>
            </div>

            <div>
              <div className="mb-2 text-xs font-medium text-gray-500">
                5개년 추이 ({years[0]}~{years[years.length - 1]})
              </div>
              <TrendChart
                years={years}
                series={[
                  {
                    key: "v",
                    label,
                    color,
                    values,
                  },
                ]}
              />
              <div className="mt-2 grid grid-cols-5 gap-1 text-center text-[11px]">
                {years.map((y, i) => (
                  <div
                    key={y}
                    className="rounded border border-gray-100 bg-gray-50 px-1.5 py-1"
                  >
                    <div className="text-[10px] text-gray-400">{y}</div>
                    <div
                      className={cn(
                        "mt-0.5 font-semibold tabular-nums",
                        values[i] == null
                          ? "text-gray-300"
                          : (values[i] as number) < 0
                            ? "text-rose-600"
                            : "text-gray-900"
                      )}
                    >
                      {fmtScaled(values[i], scale)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-md border-l-4 border-l-slate-400 bg-slate-50/40 px-3 py-2">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-600">
                구성
              </div>
              <div className="mt-1 text-sm leading-relaxed text-gray-700">
                {info.composition}
              </div>
            </div>

            <div className="rounded-md border-l-4 border-l-amber-400 bg-amber-50/30 px-3 py-2">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-amber-700">
                짐캐리 관전 포인트
              </div>
              <div className="mt-1 text-sm leading-relaxed text-gray-700">
                {info.watchpoint}
              </div>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
