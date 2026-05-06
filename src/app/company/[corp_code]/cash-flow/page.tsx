/**
 * /company/[corp_code]/cash-flow — generic CF deep dive.
 *
 * 짐캐리 /cash-flow 단순 버전:
 *   - HeadVerdict (현금흐름 카테고리)
 *   - OCF/Investing/Financing 추세 차트 (raw.cash_flow_raw 또는 derived)
 *   - FCF · Runway · 이자보상배율 KPI
 *   - 라인아이템 테이블
 */

import { notFound } from "next/navigation";
import { loadAnalysis, listAvailableCompanies } from "@/lib/load-analysis";
import { cashflowSections } from "@/lib/financial-sections";
import { ItemTableSection } from "@/components/ItemTableSection";
import { TrendChart } from "@/components/TrendChart";
import { HeadVerdict } from "@/components/HeadVerdict";
import { fmtEok, fmtPct } from "@/lib/format";

export const dynamicParams = true;
export const revalidate = 86400;

export async function generateStaticParams() {
  const ids = await listAvailableCompanies();
  return ids.map((corp_code) => ({ corp_code }));
}

export default async function CashFlowPage({
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
  const years = raw.meta.fiscal_years;
  const lastIdx = years.length - 1;
  const sections = cashflowSections(raw, computed);

  const cf = raw.financials.cash_flow_raw;
  const dcf = computed.derived_cf;
  const ocf = cf?.operating ?? [];
  const investing = cf?.investing ?? [];
  const financing = cf?.financing ?? [];
  const fcfSeries = dcf?.fcf ?? [];

  const cashCat = narrative?.categories.find((c) => c.name === "현금흐름");
  const fcf = fcfSeries[lastIdx];
  const runway = dcf?.runway_months?.[lastIdx];
  const interestCov = dcf?.interest_coverage?.[lastIdx];

  return (
    <div className="space-y-8">
      <header>
        <div className="text-xs font-medium uppercase tracking-wider text-gray-400">
          Cash Flow · {raw.meta.data_period}
        </div>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-gray-900 md:text-3xl">
          {raw.meta.company_name} · 현금흐름표
        </h1>
      </header>

      {narrative && cashCat ? (
        <HeadVerdict
          topic="현금흐름"
          status={cashCat.summary.replace(/^[^\s]+\s/, "")}
          signal={cashCat.signal}
          headline={narrative.pages.cash_flow.headline}
          message={narrative.pages.cash_flow.message}
          asOfNote={`${raw.meta.report_date} 기준 / ${years[lastIdx]} 결산`}
          insight={narrative.pages.cash_flow.insight}
          kpis={[
            {
              label: "FCF",
              value: fmtEok(fcf, { sign: true }),
              caption: "OCF − CAPEX",
            },
            {
              label: "Runway",
              value: runway != null ? `${runway.toFixed(1)}개월` : "-",
              caption: "현금/월간 OCF 적자",
            },
            {
              label: "이자보상배율",
              value:
                interestCov != null
                  ? `${interestCov.toFixed(2)}x`
                  : "-",
              caption: "영업이익/이자비용 (1.0↑ 안전)",
            },
          ]}
        />
      ) : (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-5">
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-white px-2 py-0.5 text-[11px] font-medium text-amber-800">
            ⚡ Lite mode
          </span>
          <p className="mt-2 text-sm text-gray-800">
            FCF <b>{fmtEok(fcf, { sign: true })}</b> · Runway{" "}
            <b>{runway != null ? `${runway.toFixed(1)}개월` : "-"}</b> ·
            이자보상 <b>{interestCov != null ? `${interestCov.toFixed(2)}x` : "-"}</b>{" "}
            <span className="text-gray-500">({years[lastIdx]} 결산)</span>
          </p>
        </div>
      )}

      <section>
        <div className="rounded-xl border border-[var(--border)] bg-white p-5 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-gray-900">
            현금흐름 3축 (영업/투자/재무)
          </h3>
          <TrendChart
            years={years}
            series={[
              {
                key: "ocf",
                label: "영업활동",
                color: "#0f172a",
                values: ocf,
              },
              {
                key: "inv",
                label: "투자활동",
                color: "#dc2626",
                values: investing,
              },
              {
                key: "fin",
                label: "재무활동",
                color: "#2563eb",
                values: financing,
              },
              {
                key: "fcf",
                label: "FCF",
                color: "#94a3b8",
                values: fcfSeries,
              },
            ]}
          />
        </div>
      </section>

      <section className="space-y-6">
        {sections.map((s) =>
          s.items.length === 0 ? null : (
            <ItemTableSection
              key={s.section}
              title={s.section}
              subtitle={`${s.items.length}개 항목`}
              items={s.items}
              years={years}
              accentColor="#0f172a"
            />
          )
        )}
      </section>
    </div>
  );
}
