/**
 * /company/[corp_code]/income-statement — generic IS deep dive.
 *
 * 짐캐리 /income-statement 구조 그대로:
 *   - HeadVerdict (수익성 카테고리)
 *   - Waterfall (매출 → 매출원가 → 판관비 → 영업이익 → 세후 → 순이익)
 *   - Donut (SGA 분해 — DART 안 나오는 회사 많음, 데이터 있을 때만 표시)
 *   - 비용비율 추세 차트 (sga/revenue, salary/revenue 등)
 *   - 라인아이템 테이블 (매출/원가/판관비/영업·순이익)
 */

import { notFound } from "next/navigation";
import { loadAnalysis, listAvailableCompanies } from "@/lib/load-analysis";
import { incomeSections } from "@/lib/financial-sections";
import { ItemTableSection } from "@/components/ItemTableSection";
import { WaterfallChart, type Stage } from "@/components/WaterfallChart";
import { DonutChart, type DonutSlice } from "@/components/DonutChart";
import { TrendChart } from "@/components/TrendChart";
import { HeadVerdict } from "@/components/HeadVerdict";
import { fmtPct } from "@/lib/format";

export const dynamicParams = true;
export const revalidate = 86400;

export async function generateStaticParams() {
  const ids = await listAvailableCompanies();
  return ids.map((corp_code) => ({ corp_code }));
}

export default async function IncomeStatementPage({
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
  const sections = incomeSections(raw, computed, narrative);

  const is = raw.financials.income_statement;
  const revenue = is.revenue?.[lastIdx] ?? 0;
  const sga = is.sga?.[lastIdx] ?? 0;
  const op = is.operating_income?.[lastIdx] ?? 0;
  const net = is.net_income?.[lastIdx] ?? 0;
  const cogs = is.cogs?.[lastIdx] ?? 0;

  // Waterfall stages
  const stages: Stage[] = [
    { name: "매출", type: "start", value: revenue },
    ...(cogs > 0
      ? [{ name: "매출원가", type: "delta" as const, value: -cogs }]
      : []),
    { name: "판관비", type: "delta", value: -sga },
    { name: "영업이익", type: "subtotal" },
    { name: "영업외·세금", type: "delta", value: net - op },
    { name: "순이익", type: "subtotal" },
  ];

  // SGA donut — 분해 데이터 있을 때만
  const personnel = is.salary_total?.[lastIdx] ?? 0;
  const rent = is.rent?.[lastIdx] ?? 0;
  const fees = is.fees_total?.[lastIdx] ?? 0;
  const transport = is.transport?.[lastIdx] ?? 0;
  const sgaBreakdown = personnel + rent + fees + transport;
  const showDonut = sga > 0 && sgaBreakdown > 0;
  const otherSga = Math.max(sga - sgaBreakdown, 0);
  const slices: DonutSlice[] = showDonut
    ? [
        { name: "인건비", value: personnel, color: "#1e293b" },
        { name: "임차료", value: rent, color: "#475569" },
        { name: "지급수수료", value: fees, color: "#64748b" },
        { name: "운반비", value: transport, color: "#94a3b8" },
        { name: "기타", value: otherSga, color: "#cbd5e1" },
      ].filter((s) => s.value > 0)
    : [];

  // 비용비율 추이
  const sgaRatio = (is.sga ?? []).map((v, idx) => {
    const r = is.revenue?.[idx];
    if (v == null || r == null || r === 0) return null;
    return Math.round((v / r) * 100);
  });

  const profit = narrative?.categories.find((c) => c.name === "수익성");
  const opMargin = computed.ratios.profitability.operating_margin?.[lastIdx];
  const netMargin = computed.ratios.profitability.net_margin?.[lastIdx];
  const ebitdaMargin = computed.ratios.profitability.ebitda_margin?.[lastIdx];
  const revYoy = computed.ratios.growth.revenue_yoy?.[lastIdx];

  return (
    <div className="space-y-8">
      <header>
        <div className="text-xs font-medium uppercase tracking-wider text-gray-400">
          Income Statement · {raw.meta.data_period}
        </div>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-gray-900 md:text-3xl">
          {raw.meta.company_name} · 손익계산서
        </h1>
      </header>

      {narrative && profit ? (
        <HeadVerdict
          topic="수익성"
          status={profit.summary.replace(/^[^\s]+\s/, "")}
          signal={profit.signal}
          headline={narrative.pages.income_statement.headline}
          message={narrative.pages.income_statement.message}
          asOfNote={`${raw.meta.report_date} 기준 / ${years[lastIdx]} 회계연도`}
          insight={narrative.pages.income_statement.insight}
          kpis={[
            { label: "매출 YoY", value: fmtPct(revYoy, { sign: true, digits: 1 }) },
            { label: "영업이익률", value: fmtPct(opMargin, { digits: 1 }) },
            { label: "EBITDA 마진", value: fmtPct(ebitdaMargin, { digits: 1 }) },
            { label: "순이익률", value: fmtPct(netMargin, { digits: 1 }) },
          ]}
        />
      ) : (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-5">
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-white px-2 py-0.5 text-[11px] font-medium text-amber-800">
            ⚡ Lite mode
          </span>
          <p className="mt-2 text-sm text-gray-800">
            매출 YoY <b>{fmtPct(revYoy, { sign: true, digits: 1 })}</b> ·
            영업이익률 <b>{fmtPct(opMargin, { digits: 1 })}</b> · EBITDA 마진{" "}
            <b>{fmtPct(ebitdaMargin, { digits: 1 })}</b> · 순이익률{" "}
            <b>{fmtPct(netMargin, { digits: 1 })}</b>{" "}
            <span className="text-gray-500">({years[lastIdx]} 결산)</span>
          </p>
        </div>
      )}

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <WaterfallChart
          title={`${years[lastIdx]} 손익 흐름`}
          caption="매출에서 시작 → 비용 차감 → 영업이익 → 영업외 → 순이익"
          stages={stages}
        />
        {showDonut ? (
          <DonutChart
            title={`판관비 구성 (${years[lastIdx]})`}
            caption={`총 판관비 ${(sga / 100).toLocaleString()}억`}
            slices={slices}
          />
        ) : (
          <div className="flex items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center text-xs text-gray-500">
            판관비 세부 항목(인건비·임차료·수수료·운반비)이 DART 정형
            데이터에 노출되지 않아 분해 차트는 생략됩니다.
          </div>
        )}
      </section>

      <section>
        <div className="rounded-xl border border-[var(--border)] bg-white p-5 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-gray-900">
            판관비/매출 비율 추이
          </h3>
          <TrendChart
            years={years}
            series={[
              {
                key: "sga_ratio",
                label: "판관비/매출 (%)",
                color: "#475569",
                values: sgaRatio,
              },
            ]}
          />
        </div>
      </section>

      <section className="space-y-6">
        {sections.map((s) => (
          <ItemTableSection
            key={s.section}
            title={s.section}
            subtitle={`${s.items.length}개 항목`}
            items={s.items}
            years={years}
            accentColor="#475569"
          />
        ))}
      </section>
    </div>
  );
}
