/**
 * /company/[corp_code]/balance-sheet — generic BS deep dive.
 *
 * 짐캐리 /balance-sheet의 layout을 CompanyAnalysis schema 기준으로 재구성.
 *   - 자산/부채/자본 SectionCard 3개 (총계 + 5년 sparkline)
 *   - 자산/부채/자본 ItemTableSection 3개 (라인아이템 펼침)
 *   - HeadVerdict — narrative 있으면 narrative.pages.balance_sheet, 없으면 lite
 */

import { notFound } from "next/navigation";
import { loadAnalysis, listAvailableCompanies } from "@/lib/load-analysis";
import { balanceSections } from "@/lib/financial-sections";
import { SectionCard } from "@/components/SectionCard";
import { ItemTableSection } from "@/components/ItemTableSection";
import { HeadVerdict } from "@/components/HeadVerdict";
import { fmtPct } from "@/lib/format";

export const dynamicParams = true;
export const revalidate = 86400;

export async function generateStaticParams() {
  const ids = await listAvailableCompanies();
  return ids.map((corp_code) => ({ corp_code }));
}

const SECTION_COLORS: Record<string, string> = {
  자산: "#1565c0",
  부채: "#c62828",
  자본: "#2e7d32",
};

export default async function BalanceSheetPage({
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
  const sections = balanceSections(raw, computed, narrative);

  // 안정성 카테고리 — narrative 있으면 사용
  const stab = narrative?.categories.find((c) => c.name === "안정성");
  const stability = computed.ratios.stability;
  const debtRatio = stability.debt_ratio?.[lastIdx];
  const currentRatio = stability.current_ratio?.[lastIdx];
  const equityRatio = stability.equity_ratio?.[lastIdx];

  return (
    <div className="space-y-8">
      <header>
        <div className="text-xs font-medium uppercase tracking-wider text-gray-400">
          Balance Sheet · {raw.meta.data_period}
        </div>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-gray-900 md:text-3xl">
          {raw.meta.company_name} · 재무상태표
        </h1>
      </header>

      {narrative && stab ? (
        <HeadVerdict
          topic="재무 안정성"
          status={stab.summary.replace(/^[^\s]+\s/, "")}
          signal={stab.signal}
          headline={narrative.pages.balance_sheet.headline}
          message={narrative.pages.balance_sheet.message}
          asOfNote={`${raw.meta.report_date} 기준 / ${years[lastIdx]} 결산`}
          insight={narrative.pages.balance_sheet.insight}
          kpis={[
            {
              label: "부채비율",
              value: fmtPct(debtRatio, { digits: 1 }),
              caption: "200%↑ 위험권 (적정 200% 이하)",
            },
            {
              label: "유동비율",
              value: fmtPct(currentRatio, { digits: 1 }),
              caption: "1년 내 지급능력 (적정 150%↑)",
            },
            {
              label: "자기자본비율",
              value: fmtPct(equityRatio, { digits: 1 }),
              caption: "자본/자산 (적정 30%↑)",
            },
          ]}
        />
      ) : (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-5">
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-white px-2 py-0.5 text-[11px] font-medium text-amber-800">
            ⚡ Lite mode
          </span>
          <p className="mt-2 text-sm text-gray-800">
            부채비율 <b>{fmtPct(debtRatio, { digits: 1 })}</b> · 유동비율{" "}
            <b>{fmtPct(currentRatio, { digits: 1 })}</b> · 자기자본비율{" "}
            <b>{fmtPct(equityRatio, { digits: 1 })}</b>{" "}
            <span className="text-gray-500">({years[lastIdx]} 결산)</span>
          </p>
          <p className="mt-1 text-[11px] text-gray-500">
            AI 서술형 분석은 dashboard 페이지에서 생성.
          </p>
        </div>
      )}

      {/* 3 Section Cards */}
      <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {sections.map((s) => {
          const total = s.total ?? { values: [], yoy: null };
          return (
            <SectionCard
              key={s.section}
              label={s.section}
              color={SECTION_COLORS[s.section] ?? "#475569"}
              total={total.values[lastIdx] ?? null}
              yoy={total.yoy}
              values={total.values}
              years={years}
            />
          );
        })}
      </section>

      {/* Tables per section */}
      <section className="space-y-6">
        {sections.map((s) => (
          <ItemTableSection
            key={s.section}
            title={s.section}
            subtitle={`${s.items.length}개 항목`}
            items={s.items}
            years={years}
            accentColor={SECTION_COLORS[s.section]}
          />
        ))}
      </section>
    </div>
  );
}
