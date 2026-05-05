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
  LabelList,
} from "recharts";

const NF = new Intl.NumberFormat("ko-KR");

export type Stage =
  | { name: string; type: "start"; value: number }
  | { name: string; type: "subtotal" }
  | { name: string; type: "delta"; value: number };

type Bar = {
  name: string;
  base: number;
  bar: number;
  cumulative: number;
  delta: number;
  isMarker: boolean;
  sign: 1 | -1;
};

function buildBars(stages: Stage[]): Bar[] {
  let running = 0;
  const result: Bar[] = [];
  for (const s of stages) {
    if (s.type === "start") {
      running = s.value;
      result.push({
        name: s.name,
        base: s.value >= 0 ? 0 : s.value,
        bar: Math.abs(s.value),
        cumulative: s.value,
        delta: s.value,
        isMarker: true,
        sign: s.value >= 0 ? 1 : -1,
      });
    } else if (s.type === "subtotal") {
      result.push({
        name: s.name,
        base: running >= 0 ? 0 : running,
        bar: Math.abs(running),
        cumulative: running,
        delta: running,
        isMarker: true,
        sign: running >= 0 ? 1 : -1,
      });
    } else {
      const start = running;
      const end = running + s.value;
      running = end;
      result.push({
        name: s.name,
        base: Math.min(start, end),
        bar: Math.abs(s.value),
        cumulative: end,
        delta: s.value,
        isMarker: false,
        sign: s.value >= 0 ? 1 : -1,
      });
    }
  }
  return result;
}

export function WaterfallChart({
  title,
  caption,
  stages,
  height = 320,
  unit = "백만원",
}: {
  title: string;
  caption?: string;
  stages: Stage[];
  height?: number;
  unit?: string;
}) {
  const bars = buildBars(stages);

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
          <BarChart
            data={bars}
            margin={{ top: 24, right: 12, left: 0, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11, fill: "#374151" }}
              axisLine={{ stroke: "#e5e7eb" }}
              tickLine={false}
              interval={0}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "#6b7280" }}
              axisLine={false}
              tickLine={false}
              width={64}
              tickFormatter={(v) => NF.format(v)}
            />
            <ReferenceLine y={0} stroke="#9ca3af" />
            <Tooltip
              contentStyle={{
                fontSize: 12,
                borderRadius: 8,
                border: "1px solid #e5e7eb",
              }}
              formatter={(_v, _n, item) => {
                const p = item?.payload as Bar | undefined;
                if (!p) return "";
                if (p.isMarker) return [NF.format(p.cumulative), "누적"];
                return [
                  `${p.delta >= 0 ? "+" : ""}${NF.format(p.delta)}`,
                  "변동",
                ];
              }}
            />
            <Bar dataKey="base" stackId="w" fill="transparent" />
            <Bar dataKey="bar" stackId="w" radius={[4, 4, 0, 0]}>
              {bars.map((b, i) => (
                <Cell
                  key={i}
                  fill={
                    b.isMarker
                      ? b.sign > 0
                        ? "#1e293b"
                        : "#7f1d1d"
                      : b.sign > 0
                        ? "#16a34a"
                        : "#dc2626"
                  }
                />
              ))}
              <LabelList
                position="top"
                content={(props: {
                  x?: number | string;
                  y?: number | string;
                  width?: number | string;
                  index?: number;
                }) => {
                  const idx = props.index ?? 0;
                  const b = bars[idx];
                  if (!b) return null;
                  const x = Number(props.x ?? 0);
                  const y = Number(props.y ?? 0);
                  const w = Number(props.width ?? 0);
                  const label = b.isMarker
                    ? NF.format(b.cumulative)
                    : `${b.delta >= 0 ? "+" : ""}${NF.format(b.delta)}`;
                  return (
                    <text
                      x={x + w / 2}
                      y={y - 6}
                      textAnchor="middle"
                      fontSize={11}
                      fontWeight={600}
                      fill={b.isMarker ? "#0f172a" : b.sign > 0 ? "#15803d" : "#b91c1c"}
                    >
                      {label}
                    </text>
                  );
                }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
