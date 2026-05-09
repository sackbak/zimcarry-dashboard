"use client";

/**
 * Cash Conversion Cycle (CCC) — 운전자본 효율의 핵심 지표.
 *
 * CCC = DSO + DIO − DPO
 *   DSO (Days Sales Outstanding) = 매출채권 / (매출/365) — 매출 회수 평균 일수
 *   DIO (Days Inventory Outstanding) = 재고 / (매출원가/365) — 재고 보유 평균 일수
 *   DPO (Days Payables Outstanding) = 매입채무 / (매출원가/365) — 대금 지급 평균 일수
 *
 * 짧을수록 좋음. 음수면 외상받기 전에 받아서 운영하는 매우 효율적 구조 (월마트·코스트코 모델).
 *
 * 우리 raw schema 한계:
 *   - 재고(inventory) 미보유 — DIO 계산 못 함 (대부분 회사가 IS만 제공)
 *   - 매입채무(accounts payable)는 accrued_exp 필드로 근사
 *   → 단순화: DSO 위주 + 매출채권 비중 시각화
 */

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  ReferenceLine,
} from "recharts";
import type { RawCompanyData, ComputedMetrics } from "@/types/CompanyAnalysis";

type Row = {
  year: number;
  AR_days: number | null;
};

function buildRows(raw: RawCompanyData, computed: ComputedMetrics): Row[] {
  const years = raw.meta.fiscal_years;
  const arDays = computed.ratios.activity?.ar_days ?? [];
  return years.map((y, i) => ({
    year: y,
    AR_days: arDays[i] ?? null,
  }));
}

export function CashConversionCycle({
  raw,
  computed,
}: {
  raw: RawCompanyData;
  computed: ComputedMetrics;
}) {
  const rows = buildRows(raw, computed);
  const hasData = rows.some((r) => r.AR_days != null);
  if (!hasData) return null;

  const lastIdx = rows.length - 1;
  const latest = rows[lastIdx]?.AR_days;
  const prev = rows[lastIdx - 1]?.AR_days;
  const delta = latest != null && prev != null ? latest - prev : null;

  return (
    <div className="rounded-xl border border-[var(--border)] bg-white p-5 shadow-sm md:p-6">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-gray-900">
            매출채권 회수일수 · 5년 추이
          </h3>
          <p className="mt-0.5 text-xs text-gray-500">
            <span className="font-semibold">DSO</span> = 매출채권 / 일평균 매출 — 매출 발생 후 현금 회수까지 평균 일수.
            짧을수록 좋음 (30일 이하 우수, 60일↑ 회수 부담).
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          {latest != null && (
            <span className="rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 font-medium text-gray-700">
              현재 {latest.toFixed(0)}일
            </span>
          )}
          {delta != null && (
            <span
              className={
                "rounded-full border px-2 py-0.5 font-medium " +
                (delta > 0
                  ? "border-rose-200 bg-rose-50 text-rose-700"
                  : delta < 0
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-gray-200 bg-gray-50 text-gray-700")
              }
            >
              YoY {delta > 0 ? "+" : ""}
              {delta.toFixed(0)}일
            </span>
          )}
        </div>
      </div>

      <div className="h-[240px] w-full">
        <ResponsiveContainer>
          <BarChart data={rows} margin={{ top: 10, right: 16, left: 8, bottom: 8 }}>
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
              tickFormatter={(v) => `${v}일`}
            />
            <Tooltip
              formatter={(value) => [`${(Number(value) || 0).toFixed(0)}일`, "DSO"]}
              labelFormatter={(year) => `${year}년`}
              contentStyle={{ fontSize: 12, borderRadius: 8 }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" />
            <ReferenceLine y={30} stroke="#22c55e" strokeDasharray="4 4" label={{ value: "우수 30일", fontSize: 10, fill: "#22c55e", position: "right" }} />
            <ReferenceLine y={60} stroke="#dc2626" strokeDasharray="4 4" label={{ value: "위험 60일", fontSize: 10, fill: "#dc2626", position: "right" }} />
            <Bar dataKey="AR_days" name="회수일수" fill="#0891b2" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-3 text-[11px] leading-relaxed text-gray-500">
        <span className="font-semibold text-gray-700">읽는 법</span> ·
        막대가 짧아지는 추세 = 회수 빨라짐 (운전자본 효율 ↑). 길어지면 매출 늘어도 현금 압박 가중.
        제조업·B2B 평균 ~45일, B2C는 ~10일.
      </div>
    </div>
  );
}
