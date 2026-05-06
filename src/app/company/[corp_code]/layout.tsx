/**
 * /company/[corp_code] 서브트리 전용 layout.
 *
 * Root layout은 html/body만 담당하고, 회사 대시보드용 외곽 구조
 * (네비, MetaBar, max-width 컨테이너)는 여기서 만든다.
 */

import { loadAnalysis } from "@/lib/load-analysis";
import { MetaBar } from "@/components/MetaBar";
import { DataGapsBadge } from "@/components/DataGapsBadge";
import { detectDataGaps } from "@/lib/data-gaps";
import Link from "next/link";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ corp_code: string }>;
}) {
  const { corp_code } = await params;
  try {
    const a = await loadAnalysis(corp_code);
    return {
      title: `${a.raw.meta.company_name} 재무 대시보드`,
      description:
        a.narrative?.top_verdict.summary.slice(0, 160) ??
        `${a.raw.meta.company_name} 5개년 재무 분석 — DART 기반.`,
    };
  } catch {
    return { title: "회사 재무 대시보드" };
  }
}

export default async function CompanyLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ corp_code: string }>;
}) {
  const { corp_code } = await params;
  let analysis;
  try {
    analysis = await loadAnalysis(corp_code);
  } catch {
    return <main className="p-8">{children}</main>;
  }
  const { raw } = analysis;
  const gaps = detectDataGaps(raw);

  const navItems = [
    { href: `/company/${corp_code}`, label: "대시보드" },
    { href: `/company/${corp_code}/investment`, label: "투자관점" },
    { href: `/company/${corp_code}/balance-sheet`, label: "재무상태표" },
    { href: `/company/${corp_code}/income-statement`, label: "손익계산서" },
    { href: `/company/${corp_code}/cash-flow`, label: "현금흐름표" },
  ];

  return (
    <main>
      <div className="mx-auto max-w-[1400px] space-y-6 px-4 py-6 md:px-8 md:py-8">
        <nav className="flex items-center justify-between border-b border-gray-100 pb-3 text-xs">
          <Link href="/" className="text-gray-500 hover:text-gray-900">
            ← 다른 회사 분석
          </Link>
          <div className="flex items-center gap-3">
            <DataGapsBadge gaps={gaps} />
            <span className="text-gray-400">
              {raw.meta.company_name} · {corp_code}
            </span>
          </div>
        </nav>
        <MetaBar
          reportDate={raw.meta.report_date}
          period={
            raw.meta.data_period ??
            `${raw.meta.fiscal_years[0]}~${raw.meta.fiscal_years.at(-1)}`
          }
          unit={raw.meta.currency_unit}
          source={raw.meta.source}
        />
        <nav className="flex flex-wrap gap-1 border-b border-gray-100 pb-2">
          {navItems.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="rounded-md px-3 py-1.5 text-sm text-gray-700 transition-colors hover:bg-gray-100"
            >
              {n.label}
            </Link>
          ))}
        </nav>
        {children}
      </div>
    </main>
  );
}
