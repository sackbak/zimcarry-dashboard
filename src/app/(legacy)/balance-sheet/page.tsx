import { data, years, type BalanceItem } from "@/lib/data";
import { SectionCard } from "@/components/SectionCard";
import { ItemTableSection, type TableItem } from "@/components/ItemTableSection";
import { InvestmentTimeline } from "@/components/InvestmentTimeline";
import { HeadVerdict } from "@/components/HeadVerdict";
import { INSIGHTS } from "@/lib/insights";

const SECTION_COLORS: Record<string, string> = {
  자산: "#1565c0",
  부채: "#c62828",
  자본: "#2e7d32",
};

function toTableItem(item: BalanceItem): TableItem {
  return {
    name: item.name,
    tag: item.tag,
    values_mil: item.values_mil,
    yoy_2025: item.yoy_2025,
    trend: item.trend,
    share: item.asset_share_2025,
    shareLabel: "자산비중",
    insight: [item.learn_note, item.investment_note].filter(Boolean).join(" "),
  };
}

export default function BalanceSheetPage() {
  const sections = data.balance_items;
  const bs = data.financials.balance_sheet;
  const stability = data.ratios.stability;

  // Section totals — first item of each section is the section total
  const totals: Record<string, BalanceItem> = {};
  for (const sec of sections) {
    const total = sec.items.find((i) =>
      ["자산총계", "부채총계", "자본총계"].includes(i.name)
    );
    if (total) totals[sec.section] = total;
  }

  const stab = data.dashboard.categories.find((c) => c.name === "안정성")!;

  return (
    <div className="space-y-8">
      <header>
        <div className="text-xs font-medium uppercase tracking-wider text-gray-400">
          Balance Sheet · {data.meta.data_period}
        </div>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-gray-900 md:text-3xl">
          재무상태표
        </h1>
      </header>

      <HeadVerdict
        topic="재무 안정성"
        status={stab.summary.replace(/^[^\s]+\s/, "")}
        signal={stab.signal}
        headline="단기차입 91% 의존 + 자본잠식 2회 — Bridge 증자로 회복, 매년 롤오버 필수"
        message={stab.comment}
        asOfNote={`${data.meta.report_date} 기준 / 2025년 말 잔액 (5개년 ${data.meta.data_period})`}
        insight={INSIGHTS.bs_overall}
        kpis={[
          {
            label: "부채비율",
            value: "322%",
            signal: "yellow",
            caption: "200%↑ 위험권 (적정 200% 이하)",
          },
          {
            label: "유동비율",
            value: "57%",
            signal: "red",
            caption: "1년 내 지급능력 (적정 150%↑)",
          },
          {
            label: "자기자본비율",
            value: "24%",
            signal: "yellow",
            caption: "자본/자산 (적정 30%↑)",
          },
          {
            label: "단기차입금",
            value: "14.2억",
            signal: "red",
            caption: "총 부채의 56% · 매년 롤오버",
          },
        ]}
      />

      {/* 3 Section Cards */}
      <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <SectionCard
          label="자산"
          color={SECTION_COLORS.자산}
          total={totals.자산?.values_mil[4] ?? null}
          yoy={totals.자산?.yoy_2025 ?? null}
          values={totals.자산?.values_mil ?? []}
          years={years}
          badge="유동 39.6% · 비유동 60.4%"
          caption="현금 10.1억 · 무형 10.1억 (개발비 자산화 ↑)"
        />
        <SectionCard
          label="부채"
          color={SECTION_COLORS.부채}
          total={totals.부채?.values_mil[4] ?? null}
          yoy={totals.부채?.yoy_2025 ?? null}
          values={totals.부채?.values_mil ?? []}
          years={years}
          badge="유동 91% · 비유동 9%"
          caption="단기차입 14.2억 (부채의 56%) — 매년 롤오버 필수"
        />
        <SectionCard
          label="자본"
          color={SECTION_COLORS.자본}
          total={totals.자본?.values_mil[4] ?? null}
          yoy={totals.자본?.yoy_2025 ?? null}
          values={totals.자본?.values_mil ?? []}
          years={years}
          badge="자본금 5.7억 · 잉여 40.4억"
          caption="자본잠식 2회 (2021, 2024) — 매번 증자로 회복"
        />
      </section>

      {/* Investment timeline */}
      <section>
        <InvestmentTimeline
          rounds={data.company.investment.rounds}
          cumulativeMil={data.company.investment.cumulative_capital_mil}
          vcOnlyMil={data.company.investment.cumulative_vc_only_mil}
          note={data.company.investment.note}
          capitalErosion={(stability.capital_erosion as boolean[]).map(Boolean)}
          yearLabels={years}
        />
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
            accentColor={SECTION_COLORS[sec.section]}
          />
        ))}
      </section>
    </div>
  );
}
