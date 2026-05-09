"use client";

/**
 * FCF Bridge (Quality of Earnings) — M&A DD 핵심.
 *
 * 흐름: 영업이익 → +D&A → EBITDA → ±NWC/세금/이자 → OCF → -CAPEX → FCF
 *
 * 차트로 보면 어디서 이익이 새는지 한눈에 보임.
 *   - 영업이익이 EBITDA로 거의 같은 크기로 가면 → 자본집약도 낮음 (asset-light)
 *   - EBITDA → OCF gap이 크면 → 운전자본 흡수·세금·이자 부담
 *   - OCF → FCF gap이 크면 → CAPEX 부담 큼 (자본집약 산업)
 */

import { WaterfallChart, type Stage } from "@/components/WaterfallChart";
import type { RawCompanyData, ComputedMetrics } from "@/types/CompanyAnalysis";
import { fmtEok } from "@/lib/format";

export function FCFBridge({
  raw,
  computed,
}: {
  raw: RawCompanyData;
  computed: ComputedMetrics;
}) {
  const years = raw.meta.fiscal_years;
  const lastIdx = years.length - 1;
  const lastYear = years[lastIdx];

  const is = raw.financials.income_statement;
  const cf = raw.financials.cash_flow_raw;
  const dcf = computed.derived_cf;

  const op = is.operating_income?.[lastIdx] ?? 0;
  const dep = is.depreciation?.[lastIdx] ?? 0;
  const amort = is.amortization?.[lastIdx] ?? 0;
  const ebitda = dcf?.ebitda?.[lastIdx] ?? op + dep + amort;
  const ocf = cf?.operating?.[lastIdx] ?? dcf?.ocf_estimate?.[lastIdx] ?? null;
  const capex = dcf?.capex?.[lastIdx] ?? null;
  const fcf = dcf?.fcf?.[lastIdx] ?? null;

  // 데이터가 충분하지 않으면 렌더 안 함
  if (op === 0 || ebitda === 0) return null;

  const stages: Stage[] = [{ name: "영업이익", type: "start", value: op }];
  const dna = dep + amort;
  if (dna > 0) {
    stages.push({ name: "+ 감가·상각", type: "delta", value: dna });
  }
  stages.push({ name: "EBITDA", type: "subtotal" });

  // EBITDA → OCF gap (있으면)
  if (ocf != null && Number.isFinite(ocf)) {
    const ebitdaToOcf = ocf - ebitda;
    if (Math.abs(ebitdaToOcf) > ebitda * 0.01) {
      stages.push({
        name: "± 운전자본·세금·이자",
        type: "delta",
        value: ebitdaToOcf,
      });
    }
    stages.push({ name: "OCF", type: "subtotal" });
  }

  // OCF/EBITDA → FCF
  if (capex != null && Number.isFinite(capex) && capex !== 0) {
    stages.push({ name: "- CAPEX", type: "delta", value: -Math.abs(capex) });
  }
  if (fcf != null && Number.isFinite(fcf)) {
    stages.push({ name: "FCF", type: "subtotal" });
  }

  // 핵심 지표 (모달 헤더용)
  const ocfRatio = ebitda !== 0 && ocf != null ? (ocf / ebitda) * 100 : null;
  const fcfMargin = dcf?.fcf_margin?.[lastIdx];

  return (
    <div className="rounded-xl border border-[var(--border)] bg-white p-5 shadow-sm md:p-6">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-gray-900">
            FCF Bridge · 이익 품질 분해
            <span className="ml-2 text-xs font-normal text-gray-400">{lastYear} 결산</span>
          </h3>
          <p className="mt-0.5 text-xs text-gray-500">
            장부이익(영업이익)이 진짜 현금(FCF)으로 얼마나 바뀌는지 — M&A DD의 핵심.
            EBITDA→OCF gap은 운전자본·세금·이자, OCF→FCF gap은 CAPEX 부담.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-[11px]">
          {ocfRatio != null && (
            <span className="rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 font-medium text-gray-700">
              OCF/EBITDA {ocfRatio.toFixed(0)}%
            </span>
          )}
          {fcfMargin != null && (
            <span className="rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 font-medium text-gray-700">
              FCF 마진 {(fcfMargin * 100).toFixed(1)}%
            </span>
          )}
        </div>
      </div>

      <WaterfallChart
        title=""
        stages={stages}
        unit={`${lastYear} · 단위 백만원`}
        height={300}
      />

      <div className="mt-4 grid gap-2 text-[12px] text-gray-600 md:grid-cols-3">
        <div className="rounded-md bg-gray-50 px-3 py-2">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
            영업이익
          </div>
          <div className="mt-0.5 font-semibold tabular-nums text-gray-900">
            {fmtEok(op)}
          </div>
        </div>
        <div className="rounded-md bg-gray-50 px-3 py-2">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
            EBITDA
          </div>
          <div className="mt-0.5 font-semibold tabular-nums text-gray-900">
            {fmtEok(ebitda)}
          </div>
        </div>
        <div className="rounded-md bg-gray-50 px-3 py-2">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
            FCF
          </div>
          <div className={`mt-0.5 font-semibold tabular-nums ${fcf != null && fcf < 0 ? "text-rose-700" : "text-gray-900"}`}>
            {fcf != null ? fmtEok(fcf, { sign: true }) : "-"}
          </div>
        </div>
      </div>
    </div>
  );
}
