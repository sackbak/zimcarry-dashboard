"use client";

import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from "recharts";

type Series = {
  key: string;
  label: string;
  color: string;
  values: (number | null)[];
};

export function TrendChart({
  years,
  series,
  unitLabel = "백만원",
}: {
  years: number[];
  series: Series[];
  unitLabel?: string;
}) {
  const data = years.map((y, i) => {
    const row: Record<string, number | string | null> = { year: String(y) };
    for (const s of series) row[s.key] = s.values[i];
    return row;
  });

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">5개년 추이</h3>
        <span className="text-[11px] text-gray-400">단위: {unitLabel}</span>
      </div>
      <div className="h-72 w-full">
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis
              dataKey="year"
              tick={{ fontSize: 11, fill: "#6b7280" }}
              axisLine={{ stroke: "#e5e7eb" }}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "#6b7280" }}
              axisLine={false}
              tickLine={false}
              width={56}
              tickFormatter={(v) => new Intl.NumberFormat("ko-KR").format(v)}
            />
            <Tooltip
              contentStyle={{
                fontSize: 12,
                borderRadius: 8,
                border: "1px solid #e5e7eb",
                boxShadow: "0 4px 14px rgb(0 0 0 / 0.06)",
              }}
              formatter={(v) =>
                typeof v === "number"
                  ? new Intl.NumberFormat("ko-KR").format(v)
                  : (v ?? "-")
              }
            />
            <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} iconType="circle" />
            {series.map((s) => (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.label}
                stroke={s.color}
                strokeWidth={2}
                dot={{ r: 3, fill: s.color }}
                activeDot={{ r: 5 }}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
