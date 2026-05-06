import type { Metadata } from "next";
import { Sidebar } from "@/components/Sidebar";
import { MetaBar } from "@/components/MetaBar";
import { data } from "@/lib/data";

export const metadata: Metadata = {
  title: "짐캐리 재무 대시보드 | ZIM CARRY",
  description:
    "짐캐리(ZIM CARRY) 5개년(2021~2025) 재무 인터랙티브 분석 — PMF 검증·손익 개선 중, 단 자본·현금 구조는 외부 자금 의존. 회계·M&A 관점 분석.",
  openGraph: {
    title: "짐캐리 재무 대시보드 — PMF 검증, 자본·현금은 외부 의존",
    description:
      "5개년(2021~2025) 재무 분석. 매출 11.5x · 영업이익률 -8.1% · 투자금 83% 소진 · Runway 16개월. DART + IR 2024 + 공개정보 교차검증.",
    type: "website",
    locale: "ko_KR",
    siteName: "ZIM CARRY 재무 대시보드",
  },
  twitter: {
    card: "summary_large_image",
    title: "짐캐리 재무 대시보드",
    description:
      "PMF 검증, 손익 개선 중 — 자본·현금 구조는 외부 자금 의존. 5개년 분석.",
  },
};

export default function LegacyLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-screen">
      <Sidebar
        company={data.company.name}
        companyEn={data.company.name_en}
        reportDate={data.meta.report_date}
        period={data.meta.data_period}
      />
      <main className="flex-1 lg:pl-64">
        <div className="mx-auto max-w-[1400px] space-y-6 px-4 py-6 md:px-8 md:py-8">
          <MetaBar
            reportDate={data.meta.report_date}
            period={data.meta.data_period}
            unit={data.meta.currency_unit}
            source={data.meta.source}
          />
          {children}
        </div>
      </main>
    </div>
  );
}
