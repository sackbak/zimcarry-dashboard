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
} from "@/lib/load-analysis";
import { HeadVerdict } from "@/components/HeadVerdict";
import { TrendChart } from "@/components/TrendChart";
import { RichText } from "@/components/RichText";
import { SIGNAL_BAR, SIGNAL_BG, SIGNAL_DOT } from "@/lib/signal";
import { fmtPct } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Signal } from "@/lib/data";
import type {
  ComputedTopKpi,
  CategoryNarrative,
  TopVerdict,
} from "@/types/CompanyAnalysis";

export const dynamicParams = true;
/** 라이브 DART 호출 결과를 24시간 캐시 (재무제표는 분기/연 단위 갱신이라 충분). */
export const revalidate = 86400;

export async function generateStaticParams() {
  const ids = await listAvailableCompanies();
  return ids.map((corp_code) => ({ corp_code }));
}

export default async function CompanyDashboard({
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
  const lastYear = years[lastIdx];
  const fcfSeries = computed.derived_cf?.fcf ?? [];

  return (
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

      {narrative ? (
        <HeadVerdict
          topic="종합"
          status={narrative.top_verdict.label.replace(/^[^\s]+\s/, "")}
          signal={narrative.top_verdict.signal}
          headline={narrative.pages.dashboard.headline}
          message={narrative.pages.dashboard.message}
          asOfNote={`${raw.meta.report_date} 기준 / ${years.length}개년 (${raw.meta.data_period ?? years[0] + "~" + lastYear}) · ${lastYear} 결산`}
          insight={narrative.pages.dashboard.insight}
        />
      ) : (
        <LiteHeader corpCode={corp_code} years={years} reportDate={raw.meta.report_date} />
      )}

      {/* 5 categories — narrative 있을 때만 (LLM 의존) */}
      {narrative && (
        <section className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-base font-semibold text-gray-900">
              5대 재무 카테고리
            </h2>
            <span className="text-xs text-gray-400">
              성장성 / 수익성 / 안정성 / 활동성 / 현금흐름
            </span>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
            {narrative.categories.map((c) => (
              <CategoryCard key={c.name} category={c} />
            ))}
          </div>
        </section>
      )}

      {/* Top KPIs — 결정적, 항상 표시 */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-gray-900">
          핵심 KPI · {lastYear}년
        </h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {computed.top_kpis.map((kpi) => (
            <KpiCard key={kpi.label} kpi={kpi} />
          ))}
        </div>
      </section>

      {/* Scenarios (LLM) + Trend (결정적) */}
      <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {narrative && (
          <div className="xl:col-span-2">
            <ScenariosCard verdict={narrative.top_verdict} />
          </div>
        )}
        <div className={narrative ? "xl:col-span-1" : "xl:col-span-3"}>
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
                key: "op",
                label: "영업이익",
                color: "#94a3b8",
                values: raw.financials.income_statement.operating_income ?? [],
              },
              {
                key: "fcf",
                label: "FCF",
                color: "#dc2626",
                values: fcfSeries,
              },
            ]}
          />
        </div>
      </section>
    </div>
  );
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
            ⚡ Lite mode
          </span>
          <p className="text-sm leading-relaxed text-gray-800">
            결정적 지표(차트·KPI·비율·신호등)만 표시되고 있습니다. AI
            서술형 분석(종합 진단·시나리오·5대 카테고리 코멘트)이 필요하면
            아래 버튼을 누르세요.
          </p>
          <p className="text-[11px] text-gray-500">
            ⚠ 1회 호출당 약 70원 (Gemini 2.5 Flash) · {years.length}개년 (
            {years[0]}~{years.at(-1)}) · {reportDate} 기준 ·{" "}
            <span className="font-mono">{corpCode}</span>
          </p>
        </div>
        <button
          type="button"
          disabled
          title="아직 미구현 — 다음 커밋에서 활성화"
          className="cursor-not-allowed rounded-lg border border-amber-300 bg-amber-100/60 px-4 py-2 text-sm font-semibold text-amber-900 opacity-60"
        >
          AI 분석 생성 (예정)
        </button>
      </div>
    </div>
  );
}

function CategoryCard({ category }: { category: CategoryNarrative }) {
  const sig = category.signal as Signal;
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-white shadow-sm">
      <div className={cn("h-1 w-full", SIGNAL_BAR[sig])} />
      <div className="flex flex-col gap-3 p-5">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-gray-900">
            {category.name}
          </h3>
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
              SIGNAL_BG[sig]
            )}
          >
            <span>{SIGNAL_DOT[sig]}</span>
            {category.summary.replace(/^[^\s]+\s/, "")}
          </span>
        </div>
        <p className="text-sm leading-relaxed text-gray-600">
          <RichText text={category.comment} />
        </p>
      </div>
    </div>
  );
}

function KpiCard({ kpi }: { kpi: ComputedTopKpi }) {
  const sig = (kpi.signal ?? "yellow") as Signal;
  const isPercent = kpi.unit === "%" || kpi.unit === "ratio";
  const display = isPercent
    ? fmtPct(kpi.value_latest, { digits: 2 })
    : kpi.unit === "x"
      ? `${kpi.value_latest?.toFixed(2)}x`
      : kpi.unit === "month"
        ? `${kpi.value_latest?.toFixed(1)}개월`
        : kpi.unit === "day"
          ? `${kpi.value_latest?.toFixed(0)}일`
          : kpi.value_latest?.toLocaleString() ?? "-";
  const yoyDisplay =
    kpi.yoy != null ? fmtPct(kpi.yoy, { sign: true, digits: 1 }) : null;

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-white p-5 shadow-sm">
      <div className={cn("absolute inset-x-0 top-0 h-0.5", SIGNAL_BAR[sig])} />
      <div className="text-[10px] font-medium uppercase tracking-wide text-gray-400">
        {kpi.label}
      </div>
      <div className="mt-1.5 flex items-baseline gap-1.5">
        <span
          className={cn(
            "text-xl font-bold tabular-nums",
            sig === "red"
              ? "text-rose-700"
              : sig === "yellow"
                ? "text-amber-700"
                : "text-emerald-700"
          )}
        >
          {display}
        </span>
        <span className="text-[10px]">{SIGNAL_DOT[sig]}</span>
      </div>
      {yoyDisplay && (
        <div className="mt-1 text-[11px] text-gray-500">YoY {yoyDisplay}</div>
      )}
    </div>
  );
}

function ScenariosCard({ verdict }: { verdict: TopVerdict }) {
  const sig = verdict.signal as Signal;
  return (
    <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-white shadow-sm">
      <div className={cn("h-1 w-full", SIGNAL_BAR[sig])} />
      <div className="flex flex-col gap-5 p-6">
        <div className="space-y-1">
          <div className="text-[10px] font-medium uppercase tracking-wider text-gray-400">
            종합 진단
          </div>
          <p className="text-sm leading-relaxed text-gray-700">
            <RichText text={verdict.summary} />
          </p>
        </div>
        {verdict.key_question && (
          <div className="rounded-lg border-l-4 border-l-blue-400 bg-blue-50/40 px-4 py-3">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-blue-700">
              핵심 질문
            </div>
            <p className="mt-1 text-sm leading-relaxed text-gray-800">
              {verdict.key_question}
            </p>
          </div>
        )}
        <div className="grid gap-3 md:grid-cols-3">
          <ScenarioBlock
            tone="bullish"
            label="🟢 Bullish"
            text={verdict.scenarios.bullish}
          />
          <ScenarioBlock
            tone="base"
            label="⚪ Base"
            text={verdict.scenarios.base}
          />
          <ScenarioBlock
            tone="bearish"
            label="🔴 Bearish"
            text={verdict.scenarios.bearish}
          />
        </div>
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
  const accent =
    tone === "bullish"
      ? "border-l-emerald-400 bg-emerald-50/30"
      : tone === "bearish"
        ? "border-l-rose-400 bg-rose-50/30"
        : "border-l-slate-300 bg-slate-50/30";
  return (
    <div className={cn("rounded-md border-l-4 px-3 py-2", accent)}>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-600">
        {label}
      </div>
      <p className="mt-1 text-xs leading-relaxed text-gray-700">{text}</p>
    </div>
  );
}

