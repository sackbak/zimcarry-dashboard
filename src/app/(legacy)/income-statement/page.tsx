import { data, years, type IncomeItem } from "@/lib/data";
import { ItemTableSection, type TableItem } from "@/components/ItemTableSection";
import { WaterfallChart, type Stage } from "@/components/WaterfallChart";
import { DonutChart, type DonutSlice } from "@/components/DonutChart";
import { TrendChart } from "@/components/TrendChart";
import { HeadVerdict } from "@/components/HeadVerdict";
import { INSIGHTS } from "@/lib/insights";
import { fmtPct } from "@/lib/format";

function toTableItem(item: IncomeItem): TableItem {
  return {
    name: item.name,
    tag: item.tag,
    values_mil: item.values_mil,
    yoy_2025: item.yoy_2025,
    trend: item.trend,
    share: item.rev_share_2025,
    shareLabel: "매출비중",
    insight: [item.learn_note, item.investment_note].filter(Boolean).join(" "),
  };
}

export default function IncomeStatementPage() {
  const sections = data.income_items;
  const is = data.financials.income_statement;

  // 2025 (index 4) values
  const i = 4;
  const revenue = is.revenue[i] ?? 0;
  const sga = is.sga[i] ?? 0;
  const op = is.operating_income[i] ?? 0;
  const net = is.net_income[i] ?? 0;
  const cogs = is.cogs[i] ?? 0;

  // Waterfall stages — last bar (순이익) reflects JSON net even if it differs from op + non-op delta
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

  // SGA donut: 인건비/임차료/플랫폼/운송/기타
  const personnel = is.salary_total[i] ?? 0;
  const rent = is.rent[i] ?? 0;
  const fees = is.fees_total[i] ?? 0;
  const transport = is.transport[i] ?? 0;
  const other = sga - personnel - rent - fees - transport;
  // 슬레이트 그라데이션 — 가장 큰 비중부터 진한 색
  const slices: DonutSlice[] = [
    { name: "인건비 (급여 합계)", value: personnel, color: "#1e293b" },
    { name: "임차료", value: rent, color: "#475569" },
    { name: "플랫폼·수수료", value: fees, color: "#64748b" },
    { name: "운송 (운반비)", value: transport, color: "#94a3b8" },
    { name: "기타 (감가·광고·복리 등)", value: Math.max(other, 0), color: "#cbd5e1" },
  ];

  // Cost ratios — sga / revenue 추이
  const sgaRatio = is.sga.map((v, idx) => {
    const r = is.revenue[idx];
    if (v == null || r == null || r === 0) return null;
    return Math.round((v / r) * 100); // % integer for line readability
  });

  const profit = data.dashboard.categories.find((c) => c.name === "수익성")!;
  const personnelRatio = personnel / revenue;
  const rentRatio = rent / revenue;

  return (
    <div className="space-y-8">
      <header>
        <div className="text-xs font-medium uppercase tracking-wider text-gray-400">
          Income Statement · {data.meta.data_period}
        </div>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-gray-900 md:text-3xl">
          손익계산서
        </h1>
      </header>

      <HeadVerdict
        topic="수익성"
        status={profit.summary.replace(/^[^\s]+\s/, "")}
        signal={profit.signal}
        headline="PMF 검증·인건비·임차료가 매출 78% — 영업이익률 -33%→-8% 빠른 개선으로 BEP 임박"
        message={profit.comment}
        asOfNote={`${data.meta.report_date} 기준 / 2025 회계연도 (5개년 ${data.meta.data_period})`}
        insight={INSIGHTS.is_overall}
        kpis={[
          {
            label: "매출 YoY",
            value: "+28.6%",
            signal: "green",
            caption: "76.2억 (5년 11.5x)",
          },
          {
            label: "영업이익률",
            value: "-8.1%",
            signal: "yellow",
            caption: "-33% → -8% 개선 추세",
          },
          {
            label: "인건비 / 매출",
            value: fmtPct(personnelRatio),
            signal: "yellow",
            caption: "구조적 적자 1차 원인",
          },
          {
            label: "임차료 / 매출",
            value: fmtPct(rentRatio),
            signal: "green",
            caption: "35% → 22% 개선 (레버리지)",
          },
        ]}
      />

      {/* Waterfall */}
      <section>
        <WaterfallChart
          title="2025 손익 흐름 (워터폴)"
          caption="매출 → 판관비 → 영업이익 → 영업외·세금 → 순이익"
          stages={stages}
          height={340}
        />
      </section>

      {/* Donut + 5y line */}
      <section className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        <DonutChart
          title="2025 판관비 구성"
          caption={`총 ${new Intl.NumberFormat("ko-KR").format(sga)}백만 — 매출 대비 ${fmtPct(sga / revenue)}`}
          slices={slices}
          centerLabel="SG&A 비중 (매출)"
          centerValue={fmtPct(sga / revenue)}
          height={260}
        />
        <TrendChart
          years={years}
          series={[
            {
              key: "rev",
              label: "매출",
              color: "#0f172a",
              values: is.revenue,
            },
            {
              key: "sga",
              label: "판관비",
              color: "#94a3b8",
              values: is.sga,
            },
            {
              key: "op",
              label: "영업이익",
              color: "#dc2626",
              values: is.operating_income,
            },
          ]}
        />
      </section>

      {/* 매출 대비 판관비 비율 미니 차트 */}
      <section>
        <div className="rounded-xl border border-[var(--border)] bg-white p-5 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">판관비 / 매출 비율 추이</h3>
            <span className="text-[11px] text-gray-400">100% ↓ 가 손익분기점</span>
          </div>
          <div className="grid grid-cols-5 gap-2 text-center text-xs">
            {years.map((y, idx) => {
              const r = sgaRatio[idx];
              const tone =
                r == null
                  ? "bg-gray-50 text-gray-400"
                  : r > 100
                    ? "bg-rose-50 text-rose-700"
                    : r > 90
                      ? "bg-amber-50 text-amber-700"
                      : "bg-emerald-50 text-emerald-700";
              return (
                <div key={y} className={`rounded-lg border border-gray-100 p-3 ${tone}`}>
                  <div className="text-[10px] text-gray-500">{y}</div>
                  <div className="mt-1 text-lg font-bold tabular-nums">
                    {r != null ? `${r}%` : "-"}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Tables per section */}
      <section className="space-y-6">
        {sections.map((sec) => (
          <ItemTableSection
            key={sec.section}
            title={sec.section}
            subtitle={`${sec.items.length}개 항목`}
            items={sec.items.map(toTableItem)}
            years={years}
          />
        ))}
      </section>
    </div>
  );
}
