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

  // SGA 세부 항목
  const personnel = is.salary_total?.[lastIdx] ?? 0;
  const rent = is.rent?.[lastIdx] ?? 0;
  const fees = is.fees_total?.[lastIdx] ?? 0;
  const transport = is.transport?.[lastIdx] ?? 0;
  const sgaBreakdown = personnel + rent + fees + transport;
  const otherSga = Math.max(sga - sgaBreakdown, 0);

  // 도넛 — 회사마다 가용 데이터 우선순위로 선택
  let donutTitle = "";
  let donutCaption = "";
  let slices: DonutSlice[] = [];

  const hasSgaDetail = sga > 0 && sgaBreakdown > 0;
  const hasRevBreakdown =
    is.revenue_breakdown &&
    Object.values(is.revenue_breakdown).some((arr) => (arr[lastIdx] ?? 0) > 0);
  const hasCogs = cogs > 0;

  if (hasRevBreakdown && is.revenue_breakdown) {
    // 1순위: 매출 세그먼트 분해
    donutTitle = `매출 구성 (${years[lastIdx]})`;
    donutCaption = `총 매출 ${(revenue / 100).toLocaleString("ko")}억`;
    slices = Object.entries(is.revenue_breakdown)
      .map(([name, arr], i) => ({
        name,
        value: arr[lastIdx] ?? 0,
        color: ["#1e293b", "#334155", "#475569", "#64748b", "#94a3b8", "#cbd5e1"][i % 6],
      }))
      .filter((s) => s.value > 0);
  } else if (hasSgaDetail) {
    // 2순위: 판관비 구성 (서비스·스타트업)
    donutTitle = `판관비 구성 (${years[lastIdx]})`;
    donutCaption = `총 판관비 ${(sga / 100).toLocaleString("ko")}억`;
    slices = [
      { name: "인건비", value: personnel, color: "#1e293b" },
      { name: "임차료", value: rent, color: "#475569" },
      { name: "지급수수료", value: fees, color: "#64748b" },
      { name: "운반비", value: transport, color: "#94a3b8" },
      { name: "기타", value: otherSga, color: "#cbd5e1" },
    ].filter((s) => s.value > 0);
  } else if (hasCogs && sga > 0) {
    // 3순위: 원가구조 (제조·유통 — cogs+sga 둘 다 있음)
    donutTitle = `원가 구조 (${years[lastIdx]})`;
    donutCaption = `매출 대비 비용·이익 비중`;
    const nonOp = Math.max(revenue - cogs - sga - op, 0);
    slices = [
      { name: "매출원가", value: cogs, color: "#1e293b" },
      { name: "판관비", value: sga, color: "#64748b" },
      { name: "영업이익", value: Math.max(op, 0), color: "#22c55e" },
      ...(nonOp > 0 ? [{ name: "기타비용", value: nonOp, color: "#cbd5e1" }] : []),
    ].filter((s) => s.value > 0);
  } else if (hasCogs) {
    // 4순위: cogs만 있음 — 매출총이익 구조
    donutTitle = `매출총이익 구조 (${years[lastIdx]})`;
    donutCaption = `매출원가 vs 총이익`;
    const grossProfit = Math.max(revenue - cogs, 0);
    slices = [
      { name: "매출원가", value: cogs, color: "#1e293b" },
      { name: "매출총이익", value: grossProfit, color: "#22c55e" },
    ].filter((s) => s.value > 0);
  } else if (sga > 0 && op > 0) {
    // 5순위: SGA vs 영업이익 비중
    donutTitle = `비용·이익 구조 (${years[lastIdx]})`;
    donutCaption = `판관비 vs 영업이익 비중`;
    slices = [
      { name: "판관비", value: sga, color: "#64748b" },
      { name: "영업이익", value: Math.max(op, 0), color: "#22c55e" },
    ].filter((s) => s.value > 0);
  }
  const showDonut = slices.length > 0;

  // 비용비율 추이 — 가용 지표만 포함
  const sgaRatio = (is.sga ?? []).map((v, idx) => {
    const r = is.revenue?.[idx];
    if (v == null || r == null || r === 0) return null;
    return Math.round((v / r) * 100);
  });
  const grossMarginSeries = hasCogs
    ? (is.cogs ?? []).map((c, idx) => {
        const r = is.revenue?.[idx];
        if (c == null || r == null || r === 0) return null;
        return Math.round(((r - c) / r) * 100);
      })
    : null;

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
            title={donutTitle}
            caption={donutCaption}
            slices={slices}
          />
        ) : (
          <div className="flex items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center text-xs text-gray-500">
            비용 세부 항목 데이터가 없어 구성 차트를 표시할 수 없습니다.
          </div>
        )}
      </section>

      <section>
        <div className="rounded-xl border border-[var(--border)] bg-white p-5 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-gray-900">
            수익성 비율 추이
          </h3>
          <TrendChart
            years={years}
            series={[
              ...(grossMarginSeries
                ? [{ key: "gross_margin", label: "매출총이익률 (%)", color: "#0f172a", values: grossMarginSeries }]
                : []),
              {
                key: "op_margin",
                label: "영업이익률 (%)",
                color: "#475569",
                values: (computed.ratios.profitability.operating_margin ?? []).map(
                  (v) => (v == null ? null : Math.round(v * 100))
                ),
              },
              {
                key: "sga_ratio",
                label: "판관비/매출 (%)",
                color: "#94a3b8",
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
