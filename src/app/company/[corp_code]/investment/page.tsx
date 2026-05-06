/**
 * /company/[corp_code]/investment — VC·투자 관점 탭.
 *
 * 모든 카드 클릭 시 모달 열림 — 정의·계산식·해석. 결정적 계산, LLM 안 씀.
 */

import { notFound } from "next/navigation";
import { loadAnalysis, listAvailableCompanies } from "@/lib/load-analysis";
import { computeVCMetrics } from "@/lib/vc";
import { TrendChart } from "@/components/TrendChart";
import {
  CapitalEfficiencyCard,
  BepCard,
  BurnCard,
  RunwayCard,
  BurnMultipleCard,
  LiquidationCard,
  AssetLightCard,
  CapitalHistoryCard,
} from "@/components/InvestmentCards";

export const dynamicParams = true;
export const revalidate = 86400;

export async function generateStaticParams() {
  const ids = await listAvailableCompanies();
  return ids.map((corp_code) => ({ corp_code }));
}

export default async function InvestmentPage({
  params,
}: {
  params: Promise<{ corp_code: string }>;
}) {
  const { corp_code } = await params;
  let analysis;
  try {
    analysis = await loadAnalysis(corp_code);
  } catch {
    notFound();
  }
  const { raw, computed } = analysis;
  const vc = computeVCMetrics(raw, computed);
  const years = raw.meta.fiscal_years;
  const lastYear = years.at(-1);

  return (
    <div className="space-y-8">
      <header>
        <div className="text-xs font-medium uppercase tracking-wider text-gray-400">
          Investment · {raw.meta.data_period}
        </div>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-gray-900 md:text-3xl">
          {raw.meta.company_name} · 투자 관점
        </h1>
        <p className="mt-1 text-xs text-gray-500">
          VC가 보는 지표 — 자본효율 / Burn / BEP / 청산가치 / Asset-light. 카드 클릭 시
          정의·계산식·해석. 모두 결정적 계산, AI 분석 안 들어감.
        </p>
      </header>

      {/* Hero — 자본 효율성 + BEP 도달 */}
      <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <CapitalEfficiencyCard vc={vc} />
        <BepCard vc={vc} lastYear={lastYear ?? null} />
      </section>

      {/* Burn 3-set */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-gray-900">Burn 분석</h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <BurnCard vc={vc} />
          <RunwayCard vc={vc} />
          <BurnMultipleCard vc={vc} />
        </div>
      </section>

      {/* 청산가치 */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-gray-900">청산가치</h2>
        <LiquidationCard vc={vc} />
      </section>

      {/* Asset-light + Capital history */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <AssetLightCard vc={vc} />
        <CapitalHistoryCard vc={vc} years={years} />
      </section>

      <section>
        <h2 className="text-base font-semibold text-gray-900">매출 vs OpEx vs FCF</h2>
        <p className="mb-3 text-xs text-gray-500">
          영업 레버리지 — 매출 증가율이 비용 증가율을 앞서면 BEP 가시화. FCF가 음수에서
          0에 수렴하면 자력 생존 단계 진입.
        </p>
        <TrendChart
          years={years}
          series={[
            {
              key: "revenue",
              label: "매출",
              color: "#0f172a",
              values: raw.financials.income_statement.revenue ?? [],
            },
            {
              key: "opex",
              label: "OpEx (매출원가 + 판관비)",
              color: "#94a3b8",
              values: raw.financials.income_statement.revenue.map((rev, i) => {
                const cogs = raw.financials.income_statement.cogs?.[i] ?? 0;
                const sga = raw.financials.income_statement.sga[i] ?? 0;
                return rev != null ? cogs + sga : null;
              }),
            },
            {
              key: "fcf",
              label: "FCF",
              color: "#dc2626",
              values: computed.derived_cf.fcf ?? [],
            },
          ]}
        />
      </section>
    </div>
  );
}
