/**
 * Generic dashboard route — 어떤 회사든 CompanyAnalysis만 있으면 동일한 UI로 렌더.
 *
 * URL: /company/<id>
 *   - id = DART corp_code (00126380 = 삼성전자)
 *   - id = 슬러그 (zimcarry — 비상장 수동 입력)
 *
 * 데이터 출처:
 *   - src/data/<id>_analysis.json (단일 파일) 또는
 *   - src/data/<id>_{raw,computed,narrative}.json (3 파일)
 */

import { notFound } from "next/navigation";
import {
  loadAnalysis,
  listAvailableCompanies,
  recordView,
} from "@/lib/load-analysis";
import { HeadVerdict } from "@/components/HeadVerdict";
import { TrendChart } from "@/components/TrendChart";
import { RichText } from "@/components/RichText";
import { AIGenerateButton } from "@/components/GenerateNarrativeButton";
import {
  DashboardKpiCard,
  type KpiSeriesKind,
} from "@/components/DashboardKpiCard";
import { CategoryDetailCard } from "@/components/CategoryDetailCard";
import {
  SIGNAL_BAR,
  computeLiteCategories,
} from "@/lib/signal";
import { cn } from "@/lib/utils";
import type { Signal } from "@/lib/data";
import type {
  ComputedMetrics,
  TopVerdict,
} from "@/types/CompanyAnalysis";

export const dynamicParams = true;
/**
 * 매 방문마다 mtime 갱신해 "최근 본 회사" 정렬에 반영하려고 dynamic.
 * 데이터 자체는 디스크 캐시에서 즉시 로드 (DART 재호출 없음).
 */
export const dynamic = "force-dynamic";
/**
 * AI 분석 server action(generateAnalysis)이 7개 Gemini 동시 호출 중 max latency까지 기다림.
 * Vercel Hobby 기본 10초로는 부족하므로 60초까지 확장.
 */
export const maxDuration = 60;

export async function generateStaticParams() {
  const ids = await listAvailableCompanies();
  return ids.map((corp_code) => ({ corp_code }));
}

export default async function CompanyDashboard({
  params,
  searchParams,
}: {
  params: Promise<{ corp_code: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const [{ corp_code }, { error }] = await Promise.all([params, searchParams]);
  let analysis;
  try {
    analysis = await loadAnalysis(corp_code);
  } catch {
    notFound();
  }
  // 방문 기록 (mtime 갱신) — 홈의 "이미 분석된 회사" 리스트가 최근 순으로 정렬됨
  await recordView(corp_code);

  const { raw, computed, narrative } = analysis;
  const years = raw.meta.fiscal_years;
  const lastIdx = years.length - 1;
  const lastYear = years[lastIdx];
  const fcfSeries = computed.derived_cf?.fcf ?? [];

  return (
    <div>
      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <span className="font-semibold">AI 분석 실패:</span>{" "}
          {decodeURIComponent(error)}
        </div>
      )}

      {narrative?.top_verdict && narrative.categories && narrative.pages?.dashboard ? (
        <>
          {/* ── AI 분석 활성 — 라이트 프리미엄 히어로 ── */}
          <div className="-mx-4 md:-mx-8 ai-active-bg">
            <div className="mx-auto max-w-[1400px] space-y-6 px-4 py-8 md:px-8 md:py-10">

              {/* 헤더 */}
              <div className="ai-reveal flex items-start justify-between gap-4">
                <div>
                  <div className="text-[11px] font-medium uppercase tracking-wider text-indigo-600">
                    Overview · {raw.meta.data_period} ({years.length}개년)
                  </div>
                  <h1 className="mt-1 text-2xl font-bold tracking-tight text-gray-900 md:text-3xl">
                    {raw.meta.company_name} 재무 대시보드
                  </h1>
                  {raw.company.industry && (
                    <div className="mt-1 text-sm text-gray-500">
                      {raw.company.industry}
                      {raw.company.is_listed && " · 상장사"}
                    </div>
                  )}
                </div>
                <div className="shrink-0 pt-1">
                  <span className="glow-pulse inline-flex items-center gap-1.5 rounded-full border border-indigo-300 bg-gradient-to-r from-indigo-50 to-blue-50 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-indigo-700">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-500 opacity-75" />
                      <span className="relative h-1.5 w-1.5 rounded-full bg-indigo-500" />
                    </span>
                    AI 정밀 분석 활성 · 유료
                  </span>
                  <div className="mt-1 text-right text-[11px] text-gray-500">
                    {raw.meta.report_date} 기준 · Gemini 2.5 Flash
                  </div>
                </div>
              </div>

              {/* 종합 진단 */}
              <div className="ai-reveal ai-reveal-delay-1">
                <HeadVerdict
                  topic="종합"
                  status={narrative.top_verdict.label.replace(/^[^\s]+\s/, "")}
                  signal={narrative.top_verdict.signal}
                  headline={narrative.pages.dashboard.headline}
                  message={narrative.pages.dashboard.message}
                  asOfNote={`${years.length}개년 (${raw.meta.data_period ?? years[0] + "~" + lastYear})`}
                  insight={narrative.pages.dashboard.insight}
                />
              </div>

              {/* 5대 카테고리 */}
              <div className="ai-reveal ai-reveal-delay-2 grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-5">
                {narrative.categories.map((c) => (
                  <CategoryDetailCard
                    key={c.name}
                    category={{ name: c.name, signal: c.signal, summary: c.summary, comment: c.comment }}
                    computed={computed}
                    isLite={false}
                  />
                ))}
              </div>

              {/* 시나리오 + 액션 */}
              <div className="ai-reveal ai-reveal-delay-3">
                <ScenariosCard verdict={narrative.top_verdict} />
              </div>

            </div>
          </div>

          {/* ── 흰 배경 — 결정적 데이터 ── */}
          <div className="mt-8 space-y-8">
            <section className="space-y-3">
              <h2 className="text-base font-semibold text-gray-900">
                핵심 KPI · {lastYear}년
                <span className="ml-2 text-xs font-normal text-gray-400">
                  카드 클릭 → 5년 추이 + 정의
                </span>
              </h2>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
                {computed.top_kpis.map((kpi) => {
                  const meta = kpiSeriesMeta(kpi.label, computed);
                  return (
                    <DashboardKpiCard
                      key={kpi.label}
                      kpi={kpi}
                      years={years}
                      series={meta?.values}
                      seriesKind={meta?.kind}
                      color={meta?.color}
                    />
                  );
                })}
              </div>
            </section>
            <TrendChart
              years={years}
              series={[
                { key: "revenue", label: "매출", color: "#0f172a", values: raw.financials.income_statement.revenue ?? [] },
                { key: "op", label: "영업이익", color: "#94a3b8", values: raw.financials.income_statement.operating_income ?? [] },
                { key: "fcf", label: "FCF", color: "#dc2626", values: fcfSeries },
              ]}
            />
          </div>
        </>
      ) : (
        /* ── Lite 모드 ── */
        <div className="space-y-8">
          <header>
            <div className="text-xs font-medium uppercase tracking-wider text-gray-400">
              Overview · {raw.meta.data_period} ({years.length}개년)
            </div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-gray-900 md:text-3xl">
              {raw.meta.company_name} 재무 대시보드
            </h1>
            {raw.company.industry && (
              <div className="mt-1 text-sm text-gray-500">
                {raw.company.industry}
                {raw.company.is_listed && " · 상장사"}
              </div>
            )}
          </header>
          <LiteHeader corpCode={corp_code} years={years} reportDate={raw.meta.report_date} />
          <section className="space-y-3">
            <div className="flex items-baseline justify-between">
              <h2 className="text-base font-semibold text-gray-900">
                5대 재무 카테고리
                <span className="ml-2 text-[11px] font-medium text-amber-600">
                  · 신호등만 (AI 분석 시 코멘트 추가)
                </span>
              </h2>
              <span className="text-xs text-gray-400">성장성 / 수익성 / 안정성 / 활동성 / 현금흐름</span>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
              {computeLiteCategories(computed).map((c) => (
                <CategoryDetailCard
                  key={c.name}
                  category={{ name: c.name, signal: c.signal, summary: c.summary }}
                  computed={computed}
                  isLite
                />
              ))}
            </div>
          </section>
          <section className="space-y-3">
            <h2 className="text-base font-semibold text-gray-900">
              핵심 KPI · {lastYear}년
              <span className="ml-2 text-xs font-normal text-gray-400">
                카드 클릭 → 5년 추이 + 정의
              </span>
            </h2>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
              {computed.top_kpis.map((kpi) => {
                const meta = kpiSeriesMeta(kpi.label, computed);
                return (
                  <DashboardKpiCard
                    key={kpi.label}
                    kpi={kpi}
                    years={years}
                    series={meta?.values}
                    seriesKind={meta?.kind}
                    color={meta?.color}
                  />
                );
              })}
            </div>
          </section>
          <TrendChart
            years={years}
            series={[
              { key: "revenue", label: "매출", color: "#0f172a", values: raw.financials.income_statement.revenue ?? [] },
              { key: "op", label: "영업이익", color: "#94a3b8", values: raw.financials.income_statement.operating_income ?? [] },
              { key: "fcf", label: "FCF", color: "#dc2626", values: fcfSeries },
            ]}
          />
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// KPI label → 5년 추이 series 매핑. 모달에 차트 띄울 때 사용.
// ─────────────────────────────────────────────────────────────────

function kpiSeriesMeta(
  label: string,
  c: ComputedMetrics
):
  | { values: (number | null)[]; kind: KpiSeriesKind; color?: string }
  | undefined {
  const r = c.ratios;
  const cf = c.derived_cf;
  switch (label) {
    case "매출 YoY":
      return { values: r.growth?.revenue_yoy ?? [], kind: "percent", color: "#0f172a" };
    case "영업이익률":
      return { values: r.profitability?.operating_margin ?? [], kind: "percent", color: "#dc2626" };
    case "EBITDA 마진":
      return { values: cf?.ebitda_margin ?? [], kind: "percent", color: "#dc2626" };
    case "부채비율":
      return { values: r.stability?.debt_ratio ?? [], kind: "percent", color: "#c62828" };
    case "유동비율":
      return { values: r.stability?.current_ratio ?? [], kind: "percent", color: "#1565c0" };
    case "자기자본비율":
      return { values: r.stability?.equity_ratio ?? [], kind: "percent", color: "#2e7d32" };
    case "FCF 마진":
      return { values: cf?.fcf_margin ?? [], kind: "percent", color: "#dc2626" };
    case "Runway":
      return { values: cf?.runway_months ?? [], kind: "month", color: "#eab308" };
    case "이자보상배율":
      return { values: cf?.interest_coverage ?? [], kind: "ratio_x", color: "#7c3aed" };
    case "매출채권 회수기간":
      return { values: r.activity?.ar_days ?? [], kind: "day", color: "#0891b2" };
    default:
      return undefined;
  }
}

// ─────────────────────────────────────────────────────────────────
// Inline cards — 새 schema 형식에 맞춰 간단히 렌더
// ─────────────────────────────────────────────────────────────────

function LiteHeader({
  corpCode,
  years,
  reportDate,
}: {
  corpCode: string;
  years: number[];
  reportDate: string;
}) {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-5 md:p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-white px-2 py-0.5 text-[11px] font-medium text-amber-800">
            Lite mode
          </span>
          <p className="text-sm leading-relaxed text-gray-800">
            지금은 신호등·차트·KPI만 표시됩니다. AI 종합진단을 누르면
            top verdict + 5카테고리 + 대시보드 심층 분석이 한 번에 생성됩니다.
            각 탭(BS/IS/CF) 인사이트는 해당 탭에서 따로 생성할 수 있습니다.
          </p>
          <p className="text-[11px] text-gray-500">
            Gemini 2.5 Flash 유료 API · 단일 호출 · 약 15~25초 소요 ·
            대시보드 약 3원 · {years.length}개년 ({years[0]}~{years.at(-1)}) ·{" "}
            {reportDate} 기준 · <span className="font-mono">{corpCode}</span>
          </p>
        </div>
        <AIGenerateButton id={corpCode} tab="dashboard" />
      </div>
    </div>
  );
}

function ScenariosCard({ verdict }: { verdict: TopVerdict }) {
  const sig = verdict.signal as Signal;
  return (
    <div className="overflow-hidden rounded-xl border border-indigo-100 bg-white shadow-sm shadow-indigo-100/50">
      <div className={cn("h-1 w-full", SIGNAL_BAR[sig])} />
      <div className="flex flex-col gap-5 p-6">
        <div className="space-y-1">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-indigo-600">
            종합 진단
          </div>
          <p className="text-sm leading-relaxed text-gray-800">
            <RichText text={verdict.summary} />
          </p>
        </div>
        {verdict.key_question && (
          <div className="rounded-lg border-l-4 border-l-indigo-500 bg-gradient-to-r from-indigo-50 to-blue-50/50 px-4 py-3">
            <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-700">
              핵심 질문
            </div>
            <p className="mt-1 text-sm leading-relaxed text-gray-800">
              {verdict.key_question}
            </p>
          </div>
        )}
        <div className="grid gap-3 md:grid-cols-3">
          <ScenarioBlock tone="bullish" label="Bullish" text={verdict.scenarios.bullish} />
          <ScenarioBlock tone="base" label="Base" text={verdict.scenarios.base} />
          <ScenarioBlock tone="bearish" label="Bearish" text={verdict.scenarios.bearish} />
        </div>
        {verdict.actions && verdict.actions.length > 0 && (
          <div className="space-y-2 border-t border-gray-100 pt-4">
            <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">
              다음 액션 · M&A / 투자 담당자
            </div>
            <ol className="space-y-2">
              {verdict.actions.map((action, i) => (
                <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-gray-700">
                  <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-indigo-100 font-mono text-[10px] font-bold text-indigo-700">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span>{action}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </div>
  );
}

function ScenarioBlock({
  tone,
  label,
  text,
}: {
  tone: "bullish" | "base" | "bearish";
  label: string;
  text: string;
}) {
  const styles =
    tone === "bullish"
      ? { border: "border-l-emerald-500", bg: "bg-gradient-to-br from-emerald-50 to-white", dot: "bg-emerald-500", label: "text-emerald-700" }
      : tone === "bearish"
        ? { border: "border-l-rose-500", bg: "bg-gradient-to-br from-rose-50 to-white", dot: "bg-rose-500", label: "text-rose-700" }
        : { border: "border-l-slate-400", bg: "bg-gradient-to-br from-slate-50 to-white", dot: "bg-slate-500", label: "text-slate-700" };
  return (
    <div className={cn("rounded-md border border-gray-100 border-l-4 px-3 py-2.5 shadow-sm", styles.border, styles.bg)}>
      <div className="mb-1 flex items-center gap-1.5">
        <span className={cn("h-1.5 w-1.5 rounded-full", styles.dot)} />
        <div className={cn("text-[10px] font-bold uppercase tracking-wider", styles.label)}>
          {label}
        </div>
      </div>
      <p className="text-xs leading-relaxed text-gray-700">{text}</p>
    </div>
  );
}

