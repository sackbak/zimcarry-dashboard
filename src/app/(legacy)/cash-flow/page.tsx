import { data, years } from "@/lib/data";
import { MetricCard } from "@/components/MetricCard";
import { BarTrend } from "@/components/BarTrend";
import { TrendChart } from "@/components/TrendChart";
import { HeadVerdict } from "@/components/HeadVerdict";
import { INSIGHTS } from "@/lib/insights";
import { EstimateDisclaimer } from "@/components/EstimateDisclaimer";
import { fmtEok, fmtMil, fmtMultiple } from "@/lib/format";

export default function CashFlowPage() {
  const cf = data.financials.cash_flow;
  const is = data.financials.income_statement;
  const bs = data.financials.balance_sheet;
  const i = 4; // 2025

  const ebitda = cf.ebitda[i];
  const ocf = cf.ocf[i];
  const capex = cf.capex[i];
  const fcf = cf.fcf[i];
  const runway = cf.runway_months[i];
  const intCov = cf.interest_coverage[i];
  const totalDebt = cf.total_debt[i];
  const cash = bs.cash[i];

  const cumulativeFcf = cf.fcf.reduce<number>(
    (s, v) => s + (v ?? 0),
    0
  );

  const op = is.operating_income[i] ?? 0;
  // EBITDA = 영업이익 + 감가상각비 + 무형자산상각비
  const depItem = data.income_items
    .find((s) => s.section === "판매비와관리비")
    ?.items.find((it) => it.name === "감가상각비");
  const amortItem = data.income_items
    .find((s) => s.section === "판매비와관리비")
    ?.items.find((it) => it.name === "무형자산상각비");
  const dep2025 = depItem?.values_mil[i] ?? 0;
  const amort2025 = amortItem?.values_mil[i] ?? 0;

  const cashCat = data.dashboard.categories.find((c) => c.name === "현금흐름")!;

  return (
    <div className="space-y-8">
      <header>
        <div className="text-xs font-medium uppercase tracking-wider text-gray-400">
          Cash Flow & Investment KPIs · {data.meta.data_period}
        </div>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-gray-900 md:text-3xl">
          현금흐름 · 투자지표
        </h1>
      </header>

      <HeadVerdict
        topic="현금흐름"
        status={cashCat.summary.replace(/^[^\s]+\s/, "")}
        signal={cashCat.signal}
        headline="OCF·FCF 3년 연속 적자, 누적 -35억 — 이자도 못 내는 구조, 외부 자금 100% 의존"
        message={cashCat.comment}
        asOfNote={`${data.meta.report_date} 기준 / 2025 회계연도 (5개년 ${data.meta.data_period})`}
        insight={INSIGHTS.cf_overall}
        kpis={[
          {
            label: "OCF (영업현금)",
            value: fmtEok(ocf),
            signal: "red",
            caption: "3년 연속 (-)",
          },
          {
            label: "FCF (잉여현금)",
            value: fmtEok(fcf),
            signal: "red",
            caption: `누적 ${fmtEok(cumulativeFcf)}`,
          },
          {
            label: "이자보상배율",
            value: fmtMultiple(intCov),
            signal: "red",
            caption: "5배↑ 안전 (음수=이자도 못냄)",
          },
          {
            label: "Runway",
            value: runway != null ? `${runway.toFixed(1)}개월` : "-",
            signal: "yellow",
            caption: "Bridge 증자로 재확보",
          },
        ]}
      />

      <EstimateDisclaimer />

      {/* 4 Top KPIs */}
      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <MetricCard
          label="EBITDA (2025)"
          value={fmtEok(ebitda)}
          hint="영업이익 + 감가·무형 상각"
          trend="-12.45억 → -3.77억 개선"
          spark={{ values: cf.ebitda, color: "#475569" }}
          signal={ebitda != null && ebitda < 0 ? "yellow" : "green"}
          years={years}
        />
        <MetricCard
          label="OCF — 영업현금흐름"
          value={fmtEok(ocf)}
          hint="이익 + 비현금비용 - NWC 변동"
          trend="3년 연속 (-)"
          spark={{ values: cf.ocf, color: "#475569" }}
          signal="red"
          years={years}
        />
        <MetricCard
          label="CAPEX — 투자지출"
          value={fmtEok(capex)}
          hint="유·무형 자산 + 투자자산 증가분"
          trend="2025 4.14억 (개발비 9.7억 누적)"
          spark={{ values: cf.capex, color: "#475569" }}
          signal="yellow"
          years={years}
        />
        <MetricCard
          label="FCF — 잉여현금흐름"
          value={fmtEok(fcf)}
          hint="OCF − CAPEX"
          trend={`누적 ${fmtEok(cumulativeFcf)}`}
          spark={{ values: cf.fcf, color: "#475569" }}
          signal="red"
          years={years}
        />
      </section>

      {/* EBITDA decomposition + 5y line */}
      <section className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900">2025 EBITDA 분해</h3>
          <p className="mt-0.5 text-[11px] text-gray-500">
            손익계산서에서 EBITDA를 역산
          </p>
          <ul className="mt-4 space-y-2 text-sm">
            <li className="flex items-center justify-between border-b border-gray-100 py-2">
              <span className="text-gray-700">영업이익</span>
              <span
                className={`font-semibold tabular-nums ${
                  op < 0 ? "text-rose-600" : "text-gray-900"
                }`}
              >
                {fmtMil(op)}
              </span>
            </li>
            <li className="flex items-center justify-between border-b border-gray-100 py-2">
              <span className="text-gray-700">+ 감가상각비</span>
              <span className="font-semibold tabular-nums text-emerald-600">
                +{fmtMil(dep2025)}
              </span>
            </li>
            <li className="flex items-center justify-between border-b border-gray-100 py-2">
              <span className="text-gray-700">+ 무형자산상각비</span>
              <span className="font-semibold tabular-nums text-emerald-600">
                +{fmtMil(amort2025)}
              </span>
            </li>
            <li className="flex items-center justify-between rounded-lg bg-amber-50 px-3 py-3">
              <span className="text-sm font-bold text-amber-900">= EBITDA</span>
              <span
                className={`text-lg font-bold tabular-nums ${
                  ebitda != null && ebitda < 0
                    ? "text-rose-700"
                    : "text-emerald-700"
                }`}
              >
                {fmtMil(ebitda)}
              </span>
            </li>
          </ul>
          <p className="mt-3 text-[11px] leading-relaxed text-gray-500">
            EBITDA 마진 -4.9% — 2023년 -33% 대비 빠른 회복. BEP 임박.
          </p>
        </div>

        <BarTrend
          title="5년 EBITDA"
          caption="감가상각·무형상각 가산 후 영업현금성 이익"
          years={years}
          values={cf.ebitda}
          positiveColor="#475569"
          negativeColor="#eab308"
          height={240}
        />
      </section>

      {/* 3 bar charts */}
      <section className="grid grid-cols-1 gap-3 xl:grid-cols-3">
        <BarTrend
          title="OCF — 영업활동 현금흐름"
          years={years}
          values={cf.ocf}
          positiveColor="#475569"
          negativeColor="#dc2626"
          height={220}
        />
        <BarTrend
          title="CAPEX — 자본적 지출"
          years={years}
          values={cf.capex}
          positiveColor="#475569"
          negativeColor="#475569"
          height={220}
        />
        <BarTrend
          title="FCF — 잉여현금흐름"
          years={years}
          values={cf.fcf}
          positiveColor="#475569"
          negativeColor="#dc2626"
          height={220}
        />
      </section>

      {/* OCF/FCF margin trend (line) */}
      <section>
        <TrendChart
          years={years}
          series={[
            {
              key: "ebitda_m",
              label: "EBITDA 마진",
              color: "#0f172a",
              values: cf.ebitda_margin.map((v) =>
                v == null ? null : Math.round(v * 1000) / 10
              ),
            },
            {
              key: "fcf_m",
              label: "FCF 마진",
              color: "#dc2626",
              values: cf.fcf_margin.map((v) =>
                v == null ? null : Math.round(v * 1000) / 10
              ),
            },
          ]}
          unitLabel="% (매출 대비)"
        />
      </section>

      {/* Additional metrics */}
      <section className="overflow-hidden rounded-xl border border-[var(--border)] bg-white shadow-sm">
        <div className="border-b border-gray-100 px-5 py-4">
          <h3 className="text-base font-semibold text-gray-900">추가 지표</h3>
          <p className="mt-0.5 text-xs text-gray-500">
            현금 안정성 및 부채 부담 평가 지표
          </p>
        </div>
        <div className="grid grid-cols-1 divide-y divide-gray-100 sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">
          <MetricRow
            label="이자보상배율"
            value={fmtMultiple(intCov)}
            hint="영업이익 / 이자비용 — 5배 이상이 안전권"
            tone={intCov != null && intCov < 1 ? "red" : "yellow"}
          />
          <MetricRow
            label="Runway"
            value={runway != null ? `${runway.toFixed(1)}` : "-"}
            unit="개월"
            hint="현금 잔고 ÷ 월간 -FCF"
            tone={runway != null && runway < 12 ? "red" : "yellow"}
          />
          <MetricRow
            label="총 차입금"
            value={fmtEok(totalDebt)}
            hint={`현금 ${fmtEok(cash)} 보유`}
            tone="yellow"
          />
          <MetricRow
            label="누적 FCF (5년)"
            value={fmtEok(cumulativeFcf)}
            hint="외부 자금 100% 의존 사이클"
            tone="red"
          />
        </div>
      </section>
    </div>
  );
}

function MetricRow({
  label,
  value,
  unit,
  hint,
  tone,
}: {
  label: string;
  value: string;
  unit?: string;
  hint?: string;
  tone?: "green" | "yellow" | "red";
}) {
  const valueColor =
    tone === "green"
      ? "text-emerald-700"
      : tone === "red"
        ? "text-rose-700"
        : "text-amber-700";
  return (
    <div className="px-5 py-4">
      <div className="text-xs font-medium text-gray-500">{label}</div>
      <div className="mt-1.5 flex items-baseline gap-1">
        <span className={`text-xl font-bold tabular-nums ${valueColor}`}>
          {value}
        </span>
        {unit && <span className="text-xs text-gray-500">{unit}</span>}
      </div>
      {hint && <div className="mt-1 text-[11px] leading-relaxed text-gray-500">{hint}</div>}
    </div>
  );
}
