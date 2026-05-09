/**
 * /company/[corp_code]/investment — VC·투자 관점 탭.
 *
 * 모든 카드 클릭 시 모달 열림 — 정의·계산식·해석. 결정적 계산, LLM 안 씀.
 */

import { notFound } from "next/navigation";
import { loadAnalysis, listAvailableCompanies } from "@/lib/load-analysis";
import { computeVCMetrics } from "@/lib/vc";
import { computeValuation } from "@/lib/valuation";
import { TrendChart } from "@/components/TrendChart";
import { HeadVerdict } from "@/components/HeadVerdict";
import { AIGenerateButton } from "@/components/GenerateNarrativeButton";
import {
  CapitalEfficiencyCard,
  BepCard,
  BurnCard,
  RunwayCard,
  BurnMultipleCard,
  LiquidationCard,
  AssetLightCard,
  CapitalHistoryCard,
  ValuationCard,
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
  const { raw, computed, narrative } = analysis;
  const vc = computeVCMetrics(raw, computed);
  const valuation = computeValuation(raw, computed);
  const years = raw.meta.fiscal_years;
  const lastIdx = years.length - 1;
  const lastYear = years.at(-1);
  const investmentInsight = narrative?.pages?.investment;

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
          M&A·VC 관점 — 밸류에이션 / 자본효율 / Burn / BEP / 청산가치. 카드 클릭 시
          정의·계산식·해석.
        </p>
      </header>

      {investmentInsight?.headline ? (
        <HeadVerdict
          topic="투자관점"
          status="VC/M&A 시각"
          signal={narrative?.top_verdict?.signal ?? "yellow"}
          headline={investmentInsight.headline}
          message={investmentInsight.message}
          asOfNote={`${raw.meta.report_date} 기준 / ${years[lastIdx]} 결산`}
          insight={investmentInsight.insight}
        />
      ) : (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-white px-2 py-0.5 text-[11px] font-medium text-amber-800">
                Lite mode
              </span>
              <p className="text-sm text-gray-800">
                밸류에이션·BEP·Runway·청산가치 결정적 계산은 아래에 항상 표시됩니다.
                AI 인사이트를 생성하면 VC/M&A 담당자 시각의 Bull/Bear 시나리오·딜 구조 아이디어·DD 핵심 점검 항목이 추가됩니다.
              </p>
            </div>
            <AIGenerateButton id={corp_code} tab="investment" variant="compact" />
          </div>
        </div>
      )}

      {/* 밸류에이션 — M&A 가격 협상 시작점 */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-gray-900">
          밸류에이션 추정
          <span className="ml-2 text-xs font-normal text-gray-400">
            EV/EBITDA + EV/Sales 기반
          </span>
        </h2>
        <ValuationCard valuation={valuation} />
      </section>

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
