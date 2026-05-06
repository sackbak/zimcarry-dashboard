/**
 * /company/[corp_code] 서브트리 전용 layout.
 *
 * Root layout은 html/body만 담당하고, 회사 대시보드용 외곽 구조
 * (네비, MetaBar, max-width 컨테이너)는 여기서 만든다.
 */

import { loadAnalysis } from "@/lib/load-analysis";
import { MetaBar } from "@/components/MetaBar";
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

  return (
    <main>
      <div className="mx-auto max-w-[1400px] space-y-6 px-4 py-6 md:px-8 md:py-8">
        <nav className="flex items-center justify-between border-b border-gray-100 pb-3 text-xs">
          <Link href="/" className="text-gray-500 hover:text-gray-900">
            ← 다른 회사 분석
          </Link>
          <span className="text-gray-400">corp_code: {corp_code}</span>
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
        {children}
      </div>
    </main>
  );
}
