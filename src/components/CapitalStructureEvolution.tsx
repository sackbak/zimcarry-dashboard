"use client";

/**
 * 자본구조 진화 — 5년 동안 부채 vs 자본 vs 이익잉여금이 어떻게 쌓였는가.
 *
 * Stacked area chart로 보면:
 *   - 부채 비중 추세 (레버리지 증감)
 *   - 이익잉여금 누적 (자력 자본 형성)
 *   - 자본금/잉여금 변화 (증자 시점)
 */

import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { RawCompanyData } from "@/types/CompanyAnalysis";

const COLORS = {
  liab: "#dc2626",       // 부채
  capital: "#1565c0",    // 자본금 + 자본잉여금 (외부 자본)
  retained: "#22c55e",   // 이익잉여금 (자력 적립)
};

type Row = {
  year: number;
  부채: number;
  외부자본: number;
  이익잉여금: number;
  기타자본: number;
};

function buildRows(raw: RawCompanyData): Row[] {
  const years = raw.meta.fiscal_years;
  const bs = raw.financials.balance_sheet;
  const rows: Row[] = [];
  for (let i = 0; i < years.length; i++) {
    const year = years[i];
    const liab = bs.total_liab?.[i] ?? 0;
    const equity = bs.total_equity?.[i] ?? 0;
    const capStock = bs.capital_stock?.[i] ?? 0;
    const capSurplus = bs.capital_surplus?.[i] ?? 0;
    const retained = bs.retained_earnings?.[i] ?? 0;
    const externalCap = capStock + capSurplus;
    const otherEquity = Math.max(equity - externalCap - retained, 0);
    rows.push({
      year,
      부채: liab,
      외부자본: externalCap,
      이익잉여금: retained,
      기타자본: otherEquity,
    });
  }
  return rows;
}

function formatBig(v: number): string {
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}조`;
  if (Math.abs(v) >= 100) return `${(v / 100).toFixed(0)}억`;
  return `${v.toFixed(0)}백만`;
}

export function CapitalStructureEvolution({ raw }: { raw: RawCompanyData }) {
  const rows = buildRows(raw);
  if (rows.length === 0) return null;

  const last = rows[rows.length - 1];
  const totalLast = last.부채 + last.외부자본 + last.이익잉여금 + last.기타자본;
  const debtRatio = totalLast > 0 ? (last.부채 / totalLast) * 100 : 0;
  const retainedRatio = totalLast > 0 ? (last.이익잉여금 / totalLast) * 100 : 0;

  return (
    <div className="rounded-xl border border-[var(--border)] bg-white p-5 shadow-sm md:p-6">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-gray-900">
            자본구조 진화 · 5년 추이
          </h3>
          <p className="mt-0.5 text-xs text-gray-500">
            총자산을 어떻게 조달했는가 — 부채(외부) vs 외부자본(증자) vs 이익잉여금(자력 적립).
            이익잉여금 비중이 클수록 자력 성장, 부채 비중이 늘면 레버리지 증가.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 font-medium text-rose-700">
            부채 {debtRatio.toFixed(0)}%
          </span>
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700">
            이익잉여금 {retainedRatio.toFixed(0)}%
          </span>
        </div>
      </div>

      <div className="h-[280px] w-full">
        <ResponsiveContainer>
          <AreaChart data={rows} margin={{ top: 10, right: 16, left: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
            <XAxis
              dataKey="year"
              tick={{ fontSize: 11, fill: "#6b7280" }}
              tickLine={false}
              axisLine={{ stroke: "#e5e7eb" }}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "#6b7280" }}
              tickLine={false}
              axisLine={false}
              tickFormatter={formatBig}
            />
            <Tooltip
              formatter={(value, name) => [formatBig(Number(value) || 0), String(name)]}
              labelFormatter={(year) => `${year}년`}
              contentStyle={{ fontSize: 12, borderRadius: 8 }}
            />
            <Legend
              wrapperStyle={{ fontSize: 11 }}
              iconType="circle"
              align="right"
              verticalAlign="top"
              height={28}
            />
            <Area
              type="monotone"
              dataKey="부채"
              stackId="1"
              stroke={COLORS.liab}
              fill={COLORS.liab}
              fillOpacity={0.7}
            />
            <Area
              type="monotone"
              dataKey="외부자본"
              stackId="1"
              stroke={COLORS.capital}
              fill={COLORS.capital}
              fillOpacity={0.7}
            />
            <Area
              type="monotone"
              dataKey="이익잉여금"
              stackId="1"
              stroke={COLORS.retained}
              fill={COLORS.retained}
              fillOpacity={0.7}
            />
            <Area
              type="monotone"
              dataKey="기타자본"
              stackId="1"
              stroke="#94a3b8"
              fill="#94a3b8"
              fillOpacity={0.5}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-3 text-[11px] leading-relaxed text-gray-500">
        <span className="font-semibold text-gray-700">읽는 법</span> ·
        총높이 = 총자산. 빨강(부채)이 점점 줄고 초록(이익잉여금)이 두꺼워지면 자력 성장 진행.
        반대면 외부 자금 의존도 증가.
      </div>
    </div>
  );
}
