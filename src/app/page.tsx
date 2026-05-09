/**
 * 홈페이지 — corp_code 입력 폼.
 *
 * 사용자가 DART corp_code 입력하면 server action이 자동으로:
 *   DART fetch → transform → computed → JSON 저장 → /company/<id> 리다이렉트
 *
 * LLM narrative는 생성하지 않음 (비용 + Vercel 60s 제약).
 * /company/<id>에 도착하면 거기서 "AI 분석 생성" 버튼 따로 제공.
 */

import Link from "next/link";
import { listAvailableCompanies, loadAnalysis } from "@/lib/load-analysis";
import { analyzeCompany } from "@/app/actions";
import { CompanyCombobox } from "@/components/CompanyCombobox";
import { AnalyzeButton, Spinner } from "@/components/AnalyzeButton";
import { UploadForm } from "@/components/UploadForm";

/** 업로드 추출(Gemini Vision/text)이 10~30초 걸려서 Hobby 기본 10s 부족. */
export const maxDuration = 60;

const SUGGESTIONS: { code: string; name: string; industry: string }[] = [
  { code: "00126380", name: "삼성전자", industry: "반도체·전자" },
  { code: "00266961", name: "NAVER", industry: "인터넷 서비스" },
  { code: "00164742", name: "현대자동차", industry: "자동차" },
  { code: "00126186", name: "삼성SDS", industry: "IT 서비스" },
];

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  // 이미 분석된 회사 목록
  const ids = await listAvailableCompanies();
  const analyzed = await Promise.all(
    ids.map(async (id) => {
      try {
        const a = await loadAnalysis(id);
        return {
          id,
          name: a.raw.meta.company_name,
          industry: a.raw.company.industry,
          hasNarrative: !!a.narrative,
        };
      } catch {
        return null;
      }
    })
  );
  const validAnalyzed = analyzed.filter((x): x is NonNullable<typeof x> => !!x);

  return (
    <main className="min-h-screen bg-[var(--background)]">
      <div className="mx-auto max-w-3xl px-4 py-16 md:py-24">
        <header className="space-y-3">
          <div className="text-xs font-medium uppercase tracking-widest text-gray-400">
            Generic Financial Analyzer
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 md:text-4xl">
            한국 상장사 재무 대시보드
          </h1>
          <p className="text-sm leading-relaxed text-gray-600 md:text-base">
            DART corp_code를 입력하면 5개년 재무제표 → 14개 비율 → 신호등
            평가까지 자동 생성. AI 분석은 탭별로 따로 생성 가능.
          </p>
        </header>

        <div className="mt-10 rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm md:p-8">
          <div className="text-[10px] font-medium uppercase tracking-wider text-gray-400">
            상장사 (DART)
          </div>
          <div className="mt-3">
            <CompanyCombobox />
          </div>
          {error && (
            <div className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </div>
          )}

          <div className="mt-5 border-t border-gray-100 pt-4">
            <div className="text-[11px] font-medium uppercase tracking-wider text-gray-400">
              빠르게 시도해보기
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <form key={s.code} action={analyzeCompany}>
                  <input type="hidden" name="corp_code" value={s.code} />
                  <AnalyzeButton
                    className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs text-gray-700 transition-colors enabled:hover:border-gray-400 enabled:hover:bg-white disabled:opacity-70"
                    idle={
                      <>
                        {s.name}{" "}
                        <span className="text-gray-400">· {s.industry}</span>
                      </>
                    }
                    pending={
                      <span className="inline-flex items-center gap-1.5">
                        <Spinner />
                        {s.name} 분석 중...
                      </span>
                    }
                  />
                </form>
              ))}
            </div>
          </div>

          <div className="mt-8 border-t border-gray-100 pt-6">
            <div className="text-[10px] font-medium uppercase tracking-wider text-gray-400">
              비상장사 (PDF · Excel)
            </div>
            <div className="mt-3">
              <UploadForm />
            </div>
          </div>
        </div>

        {validAnalyzed.length > 0 && (
          <section className="mt-12">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">
              이미 분석된 회사
            </h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {validAnalyzed.map((c) => (
                <Link
                  key={c.id}
                  href={`/company/${c.id}`}
                  className="group rounded-xl border border-[var(--border)] bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md"
                >
                  <div className="flex items-baseline justify-between">
                    <div className="font-semibold text-gray-900">{c.name}</div>
                    <span className="text-[10px] font-mono text-gray-400">
                      {c.id}
                    </span>
                  </div>
                  {c.industry && (
                    <div className="mt-1 text-xs text-gray-500">
                      {c.industry}
                    </div>
                  )}
                  <div className="mt-2 flex items-center gap-2">
                    <span
                      className={
                        c.hasNarrative
                          ? "rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 ring-1 ring-emerald-200"
                          : "rounded-full bg-gray-50 px-2 py-0.5 text-[10px] font-medium text-gray-600 ring-1 ring-gray-200"
                      }
                    >
                      {c.hasNarrative ? "AI 분석 ✓" : "lite"}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        <footer className="mt-16 border-t border-gray-100 pt-6 text-xs text-gray-400">
          <p>
            데이터: OpenDART (한국 상장사 K-IFRS 5개년) · 비율 14종 결정적
            계산 · 신호등 8개 vendor-neutral 임계값.
          </p>
          <p className="mt-1">
            금융지주·은행·보험사는 IS/BS 구조가 달라 미지원. 신규 상장사(5년
            미만)는 일부 지표 결측될 수 있음.
          </p>
        </footer>
      </div>
    </main>
  );
}
