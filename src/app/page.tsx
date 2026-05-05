import { data, years } from "@/lib/data";
import { KPICard } from "@/components/KPICard";
import { CategoryPanel } from "@/components/CategoryPanel";
import { AssessmentBox } from "@/components/AssessmentBox";
import { TrendChart } from "@/components/TrendChart";
import { HeadVerdict } from "@/components/HeadVerdict";
import { INSIGHTS } from "@/lib/insights";

export default function DashboardPage() {
  const { top_kpis, categories, overall_assessment } = data.dashboard;
  const is = data.financials.income_statement;
  const cf = data.financials.cash_flow;
  const ratios = data.ratios;

  // Pull category signals to surface in head verdict KPI strip
  const growth = categories.find((c) => c.name === "성장성");
  const profit = categories.find((c) => c.name === "수익성");
  const stab = categories.find((c) => c.name === "안정성");
  const cash = categories.find((c) => c.name === "현금흐름");

  return (
    <div className="space-y-8">
      <header>
        <div className="text-xs font-medium uppercase tracking-wider text-gray-400">
          Overview · {data.meta.data_period} (5개년)
        </div>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-gray-900 md:text-3xl">
          짐캐리 재무 대시보드
        </h1>
      </header>

      {/* HEAD VERDICT */}
      <HeadVerdict
        topic="종합"
        status={overall_assessment.label.replace(/^[^\s]+\s/, "")}
        signal={overall_assessment.signal}
        headline="PMF 검증·손익 개선 중 — 단 자본·현금 구조는 외부 자금 100% 의존"
        message={overall_assessment.summary}
        asOfNote={`${data.meta.report_date} 기준 / 5개년 합산(${data.meta.data_period}) · 2025 결산`}
        insight={INSIGHTS.dashboard_overall}
        kpis={[
          {
            label: "매출 5년 성장",
            value: `${ratios.growth.revenue_5y_multiple}x`,
            signal: growth?.signal,
            caption: "PMF 검증 (광고비 0.16%)",
          },
          {
            label: "영업이익률 (2025)",
            value: "-8.1%",
            signal: profit?.signal,
            caption: "-33% → -8% 빠른 개선",
          },
          {
            label: "재무 안정성",
            value: stab?.summary.replace(/^[^\s]+\s/, "") ?? "-",
            signal: stab?.signal,
            caption: "단기차입 91% · 자본잠식 2회",
          },
          {
            label: "Runway",
            value: `${cf.runway_months[4]?.toFixed(1)} 개월`,
            signal: cash?.signal,
            caption: "Bridge 증자로 재확보",
          },
        ]}
      />

      {/* 5 categories */}
      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-base font-semibold text-gray-900">5대 재무 카테고리</h2>
          <span className="text-xs text-gray-400">
            성장성 / 수익성 / 안정성 / 활동성 / 현금흐름
          </span>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
          {categories.map((c) => (
            <CategoryPanel key={c.name} category={c} />
          ))}
        </div>
      </section>

      {/* Top KPIs — 클릭 시 5년 추이 + 정의 모달 */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-gray-900">
          핵심 KPI · 2025년
          <span className="ml-2 text-xs font-normal text-gray-400">
            카드 클릭 → 5년 추이 + 용어 정의
          </span>
        </h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {top_kpis.map((kpi) => {
            const seriesMap: Record<
              string,
              { values: (number | null)[]; unit: string; color: string }
            > = {
              매출액: { values: is.revenue, unit: "백만원", color: "#0f172a" },
              영업이익: {
                values: is.operating_income,
                unit: "백만원",
                color: "#dc2626",
              },
              당기순이익: {
                values: is.net_income,
                unit: "백만원",
                color: "#dc2626",
              },
              자본총계: {
                values: data.financials.balance_sheet.total_equity,
                unit: "백만원",
                color: "#2e7d32",
              },
              현금성자산: {
                values: data.financials.balance_sheet.cash,
                unit: "백만원",
                color: "#1565c0",
              },
              Runway: {
                values: cf.runway_months,
                unit: "개월",
                color: "#eab308",
              },
            };
            const meta = seriesMap[kpi.label];
            return (
              <KPICard
                key={kpi.label}
                kpi={kpi}
                years={years}
                series={meta?.values}
                seriesUnit={meta?.unit}
                color={meta?.color}
              />
            );
          })}
        </div>
      </section>

      {/* Scenarios + Trend */}
      <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <AssessmentBox assessment={overall_assessment} />
        </div>
        <div className="xl:col-span-1">
          <TrendChart
            years={years}
            series={[
              {
                key: "revenue",
                label: "매출",
                color: "#0f172a",
                values: is.revenue,
              },
              {
                key: "op",
                label: "영업이익",
                color: "#94a3b8",
                values: is.operating_income,
              },
              {
                key: "fcf",
                label: "FCF",
                color: "#dc2626",
                values: cf.fcf,
              },
            ]}
          />
        </div>
      </section>
    </div>
  );
}
