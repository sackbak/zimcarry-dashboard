"use client";

import {
  Bar,
  BarChart,
  Cell,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const NF = new Intl.NumberFormat("ko-KR");

export function BarTrend({
  title,
  caption,
  years,
  values,
  positiveColor = "#16a34a",
  negativeColor = "#dc2626",
  unit = "백만원",
  height = 220,
}: {
  title: string;
  caption?: string;
  years: number[];
  values: (number | null)[];
  positiveColor?: string;
  negativeColor?: string;
  unit?: string;
  height?: number;
}) {
  const data = years.map((y, i) => ({
    year: String(y),
    v: values[i],
  }));

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
          {caption && (
            <p className="mt-0.5 text-[11px] text-gray-500">{caption}</p>
          )}
        </div>
        <span className="text-[11px] text-gray-400">{unit}</span>
      </div>
      <div style={{ height }} className="w-full">
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
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
              tickFormatter={(v) => NF.format(v)}
            />
            <ReferenceLine y={0} stroke="#9ca3af" strokeWidth={1} />
            <Tooltip
              contentStyle={{
                fontSize: 12,
                borderRadius: 8,
                border: "1px solid #e5e7eb",
              }}
              formatter={(v) =>
                typeof v === "number" ? NF.format(v) : (v ?? "-")
              }
              labelFormatter={(l) => `${l}년`}
            />
            <Bar dataKey="v" name="값" radius={[4, 4, 0, 0]}>
              {data.map((d, i) => (
                <Cell
                  key={i}
                  fill={
                    d.v == null
                      ? "#e5e7eb"
                      : d.v >= 0
                        ? positiveColor
                        : negativeColor
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
