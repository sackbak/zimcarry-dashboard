"use client";

import { useState } from "react";
import { Modal } from "@/components/Modal";
import { Sparkline } from "@/components/Sparkline";
import { TrendChart } from "@/components/TrendChart";
import { RichText, TermScope } from "@/components/RichText";
import { tagStyle } from "@/lib/tags";
import { fmtMil, fmtPct } from "@/lib/format";
import { cn } from "@/lib/utils";

export type TableItem = {
  name: string;
  tag: string;
  values_mil: (number | null)[];
  yoy_2025: number | null;
  trend: string;
  share?: number;
  shareLabel?: string;
  learn_note: string;
  investment_note: string;
};

export function ItemTableSection({
  title,
  subtitle,
  items,
  years,
  accentColor,
}: {
  title: string;
  subtitle?: string;
  items: TableItem[];
  years: number[];
  accentColor?: string;
}) {
  const [selected, setSelected] = useState<TableItem | null>(null);

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
        <div>
          <h3 className="text-base font-semibold text-gray-900">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p>}
        </div>
        <span className="text-[11px] text-gray-400">단위: 백만원 · 행 클릭 → 상세</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-[11px] uppercase tracking-wider text-gray-500">
            <tr>
              <th className="sticky left-0 z-10 bg-gray-50 px-4 py-2 text-left font-medium">
                항목
              </th>
              {years.map((y) => (
                <th key={y} className="px-3 py-2 text-right font-medium tabular-nums">
                  {y}
                </th>
              ))}
              <th className="px-3 py-2 text-right font-medium">YoY</th>
              <th className="px-3 py-2 text-right font-medium">비중</th>
              <th className="px-3 py-2 text-right font-medium">5년 추이</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.map((item) => {
              const ts = tagStyle(item.tag);
              const last = item.values_mil[item.values_mil.length - 1];
              const isNegative = last != null && last < 0;
              return (
                <tr
                  key={item.name}
                  onClick={() => setSelected(item)}
                  className="group/row relative cursor-pointer transition-colors hover:bg-blue-50/40"
                >
                  <td className="sticky left-0 z-10 max-w-[220px] bg-white px-4 py-3 transition-colors group-hover/row:bg-blue-50/40">
                    <div className="absolute inset-y-0 left-0 w-0.5 origin-top scale-y-0 bg-blue-500 transition-transform duration-200 group-hover/row:scale-y-100" />
                    <div className="flex flex-col gap-1">
                      <div className="font-medium text-gray-900 transition-colors group-hover/row:text-blue-900">
                        {item.name}
                      </div>
                      <span
                        className={cn(
                          "inline-flex w-fit items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ring-1",
                          ts.bg,
                          ts.text,
                          ts.ring
                        )}
                      >
                        {ts.label}
                      </span>
                    </div>
                  </td>
                  {item.values_mil.map((v, i) => (
                    <td
                      key={i}
                      className={cn(
                        "px-3 py-3 text-right tabular-nums",
                        v != null && v < 0
                          ? "text-rose-600"
                          : i === item.values_mil.length - 1
                            ? "font-semibold text-gray-900"
                            : "text-gray-700"
                      )}
                    >
                      {fmtMil(v)}
                    </td>
                  ))}
                  <td
                    className={cn(
                      "px-3 py-3 text-right text-xs font-medium tabular-nums",
                      item.yoy_2025 == null
                        ? "text-gray-400"
                        : item.yoy_2025 > 0
                          ? "text-emerald-600"
                          : "text-rose-600"
                    )}
                  >
                    {fmtPct(item.yoy_2025, { sign: true })}
                  </td>
                  <td className="px-3 py-3 text-right text-xs tabular-nums text-gray-700">
                    {item.share != null ? fmtPct(item.share) : "-"}
                  </td>
                  <td className="px-3 py-3 text-right">
                    <span className="inline-block origin-right transition-transform duration-200 ease-out group-hover/row:scale-125">
                      <Sparkline
                        values={item.values_mil}
                        color={isNegative ? "#dc2626" : (accentColor ?? "#475569")}
                        showZero
                      />
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Modal open={selected != null} onClose={() => setSelected(null)}>
        {selected && (
          <ItemDetail item={selected} years={years} accentColor={accentColor} />
        )}
      </Modal>
    </div>
  );
}

function ItemDetail({
  item,
  years,
  accentColor,
}: {
  item: TableItem;
  years: number[];
  accentColor?: string;
}) {
  const ts = tagStyle(item.tag);
  const last = item.values_mil[item.values_mil.length - 1];
  const color = accentColor ?? (last != null && last < 0 ? "#dc2626" : "#475569");
  return (
    <TermScope>
    <div className="flex flex-col gap-5 p-6 pt-7">
      <div className="flex items-start justify-between gap-4 pr-8">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-gray-900">{item.name}</h2>
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1",
                ts.bg,
                ts.text,
                ts.ring
              )}
            >
              {ts.label}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-3 text-xs text-gray-500">
            <span>{item.trend}</span>
            <span>·</span>
            <span>
              YoY{" "}
              <span
                className={cn(
                  "font-semibold",
                  item.yoy_2025 == null
                    ? ""
                    : item.yoy_2025 > 0
                      ? "text-emerald-600"
                      : "text-rose-600"
                )}
              >
                {fmtPct(item.yoy_2025, { sign: true })}
              </span>
            </span>
            {item.share != null && (
              <>
                <span>·</span>
                <span>
                  {item.shareLabel ?? "비중"} {fmtPct(item.share)}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      <TrendChart
        years={years}
        series={[
          {
            key: "v",
            label: item.name,
            color,
            values: item.values_mil,
          },
        ]}
      />

      <div className="grid gap-3 md:grid-cols-2">
        <NoteBox tone="blue" title="📘 학습 노트" body={item.learn_note} />
        <NoteBox tone="amber" title="🔍 투자 관점" body={item.investment_note} />
      </div>

      <div>
        <div className="mb-1 text-[11px] font-medium uppercase tracking-wider text-gray-400">
          연도별 값 (백만원)
        </div>
        <div className="grid grid-cols-5 gap-1 rounded-lg border border-gray-100 bg-gray-50 p-2 text-center text-xs">
          {years.map((y, i) => (
            <div key={y} className="rounded bg-white px-2 py-1.5">
              <div className="text-[10px] text-gray-400">{y}</div>
              <div
                className={cn(
                  "mt-0.5 font-semibold tabular-nums",
                  item.values_mil[i] == null
                    ? "text-gray-300"
                    : item.values_mil[i]! < 0
                      ? "text-rose-600"
                      : "text-gray-900"
                )}
              >
                {fmtMil(item.values_mil[i])}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
    </TermScope>
  );
}

function NoteBox({
  tone,
  title,
  body,
}: {
  tone: "blue" | "amber";
  title: string;
  body: string;
}) {
  const cls =
    tone === "blue"
      ? "border-blue-100 bg-blue-50/50"
      : "border-amber-100 bg-amber-50/50";
  return (
    <div className={cn("rounded-lg border p-4", cls)}>
      <div className="text-xs font-semibold text-gray-700">{title}</div>
      <p className="mt-1.5 whitespace-pre-line text-xs leading-relaxed text-gray-700">
        <RichText text={body} />
      </p>
    </div>
  );
}
