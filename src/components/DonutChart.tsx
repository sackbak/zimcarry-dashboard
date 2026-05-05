"use client";

import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

const NF = new Intl.NumberFormat("ko-KR");

export type DonutSlice = {
  name: string;
  value: number;
  color: string;
};

export function DonutChart({
  title,
  caption,
  slices,
  centerLabel,
  centerValue,
  height = 280,
}: {
  title: string;
  caption?: string;
  slices: DonutSlice[];
  centerLabel?: string;
  centerValue?: string;
  height?: number;
}) {
  const total = slices.reduce((s, x) => s + x.value, 0);

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
          {caption && (
            <p className="mt-0.5 text-[11px] text-gray-500">{caption}</p>
          )}
        </div>
        <span className="text-[11px] text-gray-400">단위: 백만원</span>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="relative" style={{ height }}>
          <ResponsiveContainer>
            <PieChart>
              <Pie
                data={slices}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius="62%"
                outerRadius="92%"
                paddingAngle={1}
                strokeWidth={1}
                stroke="#fff"
              >
                {slices.map((s, i) => (
                  <Cell key={i} fill={s.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  fontSize: 12,
                  borderRadius: 8,
                  border: "1px solid #e5e7eb",
                }}
                formatter={(v) =>
                  typeof v === "number"
                    ? `${NF.format(v)} (${((v / total) * 100).toFixed(1)}%)`
                    : (v ?? "-")
                }
              />
            </PieChart>
          </ResponsiveContainer>
          {(centerLabel || centerValue) && (
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              {centerLabel && (
                <div className="text-[10px] uppercase tracking-wider text-gray-400">
                  {centerLabel}
                </div>
              )}
              {centerValue && (
                <div className="mt-0.5 text-base font-bold text-gray-900">
                  {centerValue}
                </div>
              )}
            </div>
          )}
        </div>
        <div className="flex flex-col justify-center gap-2">
          {slices.map((s) => {
            const pct = total > 0 ? (s.value / total) * 100 : 0;
            return (
              <div key={s.name} className="flex items-center gap-2 text-xs">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: s.color }}
                />
                <span className="flex-1 truncate text-gray-700">{s.name}</span>
                <span className="font-semibold tabular-nums text-gray-900">
                  {pct.toFixed(1)}%
                </span>
                <span className="w-20 text-right text-[11px] tabular-nums text-gray-500">
                  {NF.format(s.value)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
