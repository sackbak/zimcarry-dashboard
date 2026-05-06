"use client";

/**
 * 페이지 상단에 표시되는 데이터 무결성 배지.
 * 클릭 시 모달로 누락 항목·영향 설명. 사용자가 숫자 신뢰도 판단 가능.
 */

import { useState } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Modal } from "@/components/Modal";
import type { DataGap } from "@/lib/data-gaps";

export function DataGapsBadge({ gaps }: { gaps: DataGap[] }) {
  const [open, setOpen] = useState(false);
  const warns = gaps.filter((g) => g.severity === "warn").length;
  const infos = gaps.length - warns;

  if (gaps.length === 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
        <CheckCircle2 className="h-3 w-3" />
        데이터 무결
      </span>
    );
  }

  const tone =
    warns > 0
      ? "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100"
      : "border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors",
          tone
        )}
      >
        <AlertTriangle className="h-3 w-3" />
        {warns > 0 ? `데이터 ${warns}건 주의` : `데이터 참고 ${infos}건`}
      </button>

      <Modal open={open} onClose={() => setOpen(false)} className="max-w-2xl">
        <div className="space-y-4 p-6 pt-7">
          <header className="pr-8">
            <div className="text-[10px] font-medium uppercase tracking-wider text-blue-500">
              데이터 무결성
            </div>
            <h3 className="mt-1 text-xl font-bold text-gray-900">
              이 회사 데이터에서 빠진 부분
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-gray-700">
              DART의 사업보고서 단일계정 API 한계 또는 회사 공시 특성으로 일부 항목이
              본문에서 매핑되지 못했습니다. 의사결정 전에 영향도 확인하세요.
            </p>
          </header>

          <div className="space-y-2">
            {gaps.map((g) => (
              <div
                key={g.field}
                className={cn(
                  "rounded-md border-l-4 px-3 py-2",
                  g.severity === "warn"
                    ? "border-l-amber-400 bg-amber-50/30"
                    : "border-l-slate-300 bg-slate-50/30"
                )}
              >
                <div
                  className={cn(
                    "text-[11px] font-semibold uppercase tracking-wider",
                    g.severity === "warn" ? "text-amber-700" : "text-slate-600"
                  )}
                >
                  {g.severity === "warn" ? "⚠ 주의" : "ℹ 참고"} · {g.label}
                </div>
                <p className="mt-1 text-sm leading-relaxed text-gray-700">
                  {g.impact}
                </p>
              </div>
            ))}
          </div>

          <p className="text-[11px] leading-relaxed text-gray-500">
            ※ 회계 항등식(자산 = 부채 + 자본)·매출·영업이익·당기순이익 같은 큰 그림 항목은
            모든 회사에서 정상 매핑됨. 누락된 건 EBITDA 정확도·차입금 분류 같은 보조 지표.
            큰 의사결정 전에는 사업보고서 PDF로 cross-check 권장.
          </p>
        </div>
      </Modal>
    </>
  );
}
