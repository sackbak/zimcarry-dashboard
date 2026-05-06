/**
 * /company/[corp_code]/investment — VC·투자 관점 탭.
 *
 * 핵심 5개 지표 + line item 표 없이 가독성 우선:
 *   1. 자본 효율성 (얼마 받아 얼마 벌었나)
 *   2. Burn rate / Runway / Burn multiple
 *   3. BEP 도달 예측
 *   4. 청산가치
 *   5. Asset-light / 자본 변화
 */

import { notFound } from "next/navigation";
import { loadAnalysis, listAvailableCompanies } from "@/lib/load-analysis";
import { computeVCMetrics, type VCMetrics } from "@/lib/vc";
import { fmtPct, fmtScaled, pickMoneyScale } from "@/lib/format";
import { TrendChart } from "@/components/TrendChart";
import { cn } from "@/lib/utils";
import { SIGNAL_BAR } from "@/lib/signal";
import type { Signal } from "@/lib/data";

export const dynamicParams = true;
export const revalidate = 86400;

export async function generateStaticParams() {
  const ids = await listAvailableCompanies();
  return ids.map((corp_code) => ({ corp_code }));
}

const GRADE_COLOR: Record<NonNullable<VCMetrics["burn_multiple"]["grade"]>, Signal> = {
  amazing: "green",
  great: "green",
  ok: "yellow",
  poor: "red",
  bad: "red",
};

const GRADE_LABEL: Record<NonNullable<VCMetrics["burn_multiple"]["grade"]>, string> = {
  amazing: "🏆 amazing",
  great: "✨ great",
  ok: "🟡 ok",
  poor: "⚠️ poor",
  bad: "🔴 bad",
};

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
          VC가 보는 지표 — 자본효율 / Burn / BEP / 청산가치 / Asset-light. 모두 결정적
          계산, AI 분석 안 들어감.
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
        <LiquidationTable vc={vc} />
      </section>

      {/* Asset-light + Capital history + Revenue vs OpEx chart */}
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

// ─── Cards ──────────────────────────────────────────────────────────

function CapitalEfficiencyCard({ vc }: { vc: VCMetrics }) {
  const ce = vc.capital_efficiency;
  const scale = pickMoneyScale(
    Math.max(
      Math.abs(ce.cumulative_revenue_mil ?? 0),
      Math.abs(ce.invested_capital_mil ?? 0)
    )
  );
  const sig: Signal =
    ce.ratio == null
      ? "yellow"
      : ce.ratio >= 5
        ? "green"
        : ce.ratio >= 2
          ? "yellow"
          : "red";

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-white shadow-sm">
      <div className={cn("h-1 w-full", SIGNAL_BAR[sig])} />
      <div className="flex flex-col gap-3 p-6">
        <div className="text-[10px] font-medium uppercase tracking-wider text-gray-400">
          자본 효율성
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-bold tracking-tight tabular-nums text-gray-900">
            {ce.ratio != null ? `${ce.ratio.toFixed(1)}x` : "-"}
          </span>
          <span className="text-xs text-gray-500">매출 / 조달 자본</span>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-md bg-gray-50 p-2">
            <div className="text-[10px] text-gray-500">5년 누적 매출</div>
            <div className="font-semibold text-gray-900">
              {fmtScaled(ce.cumulative_revenue_mil, scale)}{" "}
              <span className="text-[10px] text-gray-400">{scale.label}</span>
            </div>
          </div>
          <div className="rounded-md bg-gray-50 p-2">
            <div className="text-[10px] text-gray-500">조달 자본 (자본금+잉여)</div>
            <div className="font-semibold text-gray-900">
              {fmtScaled(ce.invested_capital_mil, scale)}{" "}
              <span className="text-[10px] text-gray-400">{scale.label}</span>
            </div>
          </div>
        </div>
        <p className="text-[11px] leading-relaxed text-gray-500">
          5x 이상 우수 / 2x 미만 비효율. 누적 매출이 조달 자본의 몇 배인지로 자본
          효율을 봄.
        </p>
      </div>
    </div>
  );
}

function BepCard({ vc, lastYear }: { vc: VCMetrics; lastYear: number | null }) {
  const b = vc.bep_estimate;
  const isPositive = b.last_op_margin != null && b.last_op_margin >= 0;
  const sig: Signal = isPositive
    ? "green"
    : b.years_to_bep != null && b.years_to_bep <= 2
      ? "yellow"
      : "red";

  let bigText: string;
  if (isPositive) {
    bigText = `이미 흑자 (${lastYear})`;
  } else if (b.bep_year != null) {
    bigText = `${b.bep_year}년 예상`;
  } else if (b.last_op_margin == null) {
    bigText = "데이터 부족";
  } else {
    bigText = "흑자 둔화";
  }

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-white shadow-sm">
      <div className={cn("h-1 w-full", SIGNAL_BAR[sig])} />
      <div className="flex flex-col gap-3 p-6">
        <div className="text-[10px] font-medium uppercase tracking-wider text-gray-400">
          BEP 도달
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-bold tracking-tight tabular-nums text-gray-900">
            {bigText}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-md bg-gray-50 p-2">
            <div className="text-[10px] text-gray-500">최근 영업이익률</div>
            <div className="font-semibold text-gray-900">
              {fmtPct(b.last_op_margin, { sign: true, digits: 1 })}
            </div>
          </div>
          <div className="rounded-md bg-gray-50 p-2">
            <div className="text-[10px] text-gray-500">YoY 마진 변화</div>
            <div
              className={cn(
                "font-semibold",
                b.op_margin_yoy_delta == null
                  ? "text-gray-400"
                  : b.op_margin_yoy_delta > 0
                    ? "text-emerald-700"
                    : "text-rose-700"
              )}
            >
              {fmtPct(b.op_margin_yoy_delta, { sign: true, digits: 1 })}
            </div>
          </div>
        </div>
        <p className="text-[11px] leading-relaxed text-gray-500">
          직전 2년 영업이익률 변화량으로 선형 외삽한 흑자 도달 시점. 마진이 둔화 중이면
          예측 불가.
        </p>
      </div>
    </div>
  );
}

function BurnCard({ vc }: { vc: VCMetrics }) {
  const b = vc.burn;
  const scale = pickMoneyScale(Math.abs(b.monthly_burn_mil ?? 0) * 12);
  const isProfitable = b.annual_fcf_mil != null && b.annual_fcf_mil >= 0;
  return (
    <div className="rounded-xl border border-[var(--border)] bg-white p-5 shadow-sm">
      <div className="text-[10px] font-medium uppercase tracking-wider text-gray-400">
        월간 Burn
      </div>
      <div className="mt-2 text-2xl font-bold tabular-nums text-gray-900">
        {isProfitable
          ? "FCF (+)"
          : b.monthly_burn_mil != null
            ? `${fmtScaled(b.monthly_burn_mil, scale)} ${scale.label}`
            : "-"}
      </div>
      <div className="mt-1 text-[11px] text-gray-500">
        연간 FCF{" "}
        {b.annual_fcf_mil != null ? fmtScaled(b.annual_fcf_mil, scale) : "-"}{" "}
        {scale.label}
      </div>
    </div>
  );
}

function RunwayCard({ vc }: { vc: VCMetrics }) {
  const r = vc.burn.runway_months;
  const sig: Signal =
    r == null ? "yellow" : r >= 18 ? "green" : r >= 6 ? "yellow" : "red";
  return (
    <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-white shadow-sm">
      <div className={cn("h-1", SIGNAL_BAR[sig])} />
      <div className="p-5">
        <div className="text-[10px] font-medium uppercase tracking-wider text-gray-400">
          Runway
        </div>
        <div className="mt-2 text-2xl font-bold tabular-nums text-gray-900">
          {r != null ? `${r.toFixed(1)}개월` : "-"}
        </div>
        <div className="mt-1 text-[11px] text-gray-500">
          18개월↑ 안전 / 6개월 미만 긴급
        </div>
      </div>
    </div>
  );
}

function BurnMultipleCard({ vc }: { vc: VCMetrics }) {
  const bm = vc.burn_multiple;
  const sig: Signal = bm.grade ? GRADE_COLOR[bm.grade] : "yellow";
  return (
    <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-white shadow-sm">
      <div className={cn("h-1", SIGNAL_BAR[sig])} />
      <div className="p-5">
        <div className="text-[10px] font-medium uppercase tracking-wider text-gray-400">
          Burn Multiple
        </div>
        <div className="mt-2 text-2xl font-bold tabular-nums text-gray-900">
          {bm.multiple != null ? `${bm.multiple.toFixed(2)}x` : "-"}
        </div>
        <div className="mt-1 text-[11px] text-gray-500">
          {bm.grade ? GRADE_LABEL[bm.grade] : "데이터 부족"} · burn / ARR 증가분
        </div>
      </div>
    </div>
  );
}

function LiquidationTable({ vc }: { vc: VCMetrics }) {
  const l = vc.liquidation;
  const scale = pickMoneyScale(
    Math.max(
      Math.abs(l.total_recoverable_mil ?? 0),
      Math.abs(l.total_liab_mil ?? 0),
      Math.abs(l.book_equity_mil ?? 0)
    )
  );
  const rows: { label: string; value: number | null; note?: string }[] = [
    { label: "현금 및 현금성 자산 (100%)", value: l.cash_mil },
    { label: "매출채권 회수 (×0.7)", value: l.ar_recoverable_mil },
    { label: "유형자산 회수 (×0.3)", value: l.tangible_recoverable_mil },
    {
      label: "무형자산 (0%)",
      value: l.intangible_recoverable_mil,
      note: "청산 시 영업권·개발비는 회수 어려움",
    },
  ];
  const sig: Signal =
    l.coverage_ratio == null
      ? "yellow"
      : l.coverage_ratio >= 1
        ? "green"
        : l.coverage_ratio >= 0.5
          ? "yellow"
          : "red";

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-white shadow-sm">
      <div className={cn("h-1 w-full", SIGNAL_BAR[sig])} />
      <div className="p-6">
        <table className="w-full text-sm">
          <tbody className="divide-y divide-gray-100">
            {rows.map((r) => (
              <tr key={r.label}>
                <td className="py-2 text-gray-700">{r.label}</td>
                <td className="py-2 text-right tabular-nums text-gray-900">
                  {fmtScaled(r.value, scale)}{" "}
                  <span className="text-[10px] text-gray-400">{scale.label}</span>
                </td>
              </tr>
            ))}
            <tr className="border-t-2 border-gray-200">
              <td className="py-2 font-semibold text-gray-900">총 회수 가능</td>
              <td className="py-2 text-right font-semibold tabular-nums text-gray-900">
                {fmtScaled(l.total_recoverable_mil, scale)}{" "}
                <span className="text-[10px] text-gray-400">{scale.label}</span>
              </td>
            </tr>
            <tr>
              <td className="py-2 text-gray-700">(−) 부채 총계</td>
              <td className="py-2 text-right tabular-nums text-rose-700">
                {l.total_liab_mil != null
                  ? `−${fmtScaled(l.total_liab_mil, scale)}`
                  : "-"}{" "}
                <span className="text-[10px] text-gray-400">{scale.label}</span>
              </td>
            </tr>
            <tr className="border-t-2 border-gray-300">
              <td className="py-2 font-bold text-gray-900">청산 시 순가치</td>
              <td
                className={cn(
                  "py-2 text-right text-lg font-bold tabular-nums",
                  l.net_liquidation_mil != null && l.net_liquidation_mil < 0
                    ? "text-rose-700"
                    : "text-gray-900"
                )}
              >
                {fmtScaled(l.net_liquidation_mil, scale)}{" "}
                <span className="text-[10px] text-gray-400">{scale.label}</span>
              </td>
            </tr>
            <tr>
              <td className="py-2 text-gray-500">장부 자본 대비</td>
              <td className="py-2 text-right tabular-nums text-gray-700">
                {l.coverage_ratio != null
                  ? `${(l.coverage_ratio * 100).toFixed(0)}%`
                  : "-"}
              </td>
            </tr>
          </tbody>
        </table>
        <p className="mt-3 text-[11px] leading-relaxed text-gray-500">
          1.0 이상이면 청산이 장부 자본을 보호 / 0.5 이하면 빚 못 갚을 시그널. 회수율
          가정 (현금 100, AR 70, 유형 30, 무형 0)은 보수적 보편치.
        </p>
      </div>
    </div>
  );
}

function AssetLightCard({ vc }: { vc: VCMetrics }) {
  const a = vc.asset_light;
  return (
    <div className="rounded-xl border border-[var(--border)] bg-white p-6 shadow-sm">
      <div className="text-[10px] font-medium uppercase tracking-wider text-gray-400">
        Asset-light Score
      </div>
      <div className="mt-2 text-3xl font-bold tabular-nums text-gray-900">
        {fmtPct(a.intangible_ratio, { digits: 1 })}
      </div>
      <div className="mt-1 text-[11px] text-gray-500">무형자산 / 총자산</div>
      <p className="mt-3 text-xs leading-relaxed text-gray-600">
        SaaS·플랫폼 비즈니스는 보통 5~20%. 30% 이상이면 영업권/개발비 자산화
        watchpoint — 회계 vs 진성 자산 갭 확인 필요.
      </p>
    </div>
  );
}

function CapitalHistoryCard({
  vc,
  years,
}: {
  vc: VCMetrics;
  years: number[];
}) {
  const ch = vc.capital_history;
  const scale = pickMoneyScale(
    Math.max(
      Math.abs(ch.estimated_raised_5y_mil ?? 0),
      Math.abs(ch.surplus_last_mil ?? 0)
    )
  );
  const yearSpan =
    years.length > 0 ? `${years[0]}~${years.at(-1)}` : "-";
  return (
    <div className="rounded-xl border border-[var(--border)] bg-white p-6 shadow-sm">
      <div className="text-[10px] font-medium uppercase tracking-wider text-gray-400">
        외부 자금 조달 ({yearSpan})
      </div>
      <div className="mt-2 text-3xl font-bold tabular-nums text-gray-900">
        {fmtScaled(ch.estimated_raised_5y_mil, scale)}{" "}
        <span className="text-base font-medium text-gray-500">{scale.label}</span>
      </div>
      <div className="mt-1 text-[11px] text-gray-500">
        자본금 + 자본잉여금 5년 증가량 (증자 추정)
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-md bg-gray-50 p-2">
          <div className="text-[10px] text-gray-500">{years[0]} 자본금</div>
          <div className="font-semibold text-gray-900">
            {fmtScaled(ch.capital_stock_first_mil, scale)} {scale.label}
          </div>
        </div>
        <div className="rounded-md bg-gray-50 p-2">
          <div className="text-[10px] text-gray-500">{years.at(-1)} 자본금</div>
          <div className="font-semibold text-gray-900">
            {fmtScaled(ch.capital_stock_last_mil, scale)} {scale.label}
          </div>
        </div>
        <div className="rounded-md bg-gray-50 p-2">
          <div className="text-[10px] text-gray-500">{years[0]} 자본잉여</div>
          <div className="font-semibold text-gray-900">
            {fmtScaled(ch.surplus_first_mil, scale)} {scale.label}
          </div>
        </div>
        <div className="rounded-md bg-gray-50 p-2">
          <div className="text-[10px] text-gray-500">{years.at(-1)} 자본잉여</div>
          <div className="font-semibold text-gray-900">
            {fmtScaled(ch.surplus_last_mil, scale)} {scale.label}
          </div>
        </div>
      </div>
    </div>
  );
}
