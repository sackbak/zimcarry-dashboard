/**
 * 회사 narrative 전체 생성 — 2단계 순차 호출.
 *
 * 1단계 main_verdict: top_verdict + categories (~600-900 토큰, ~15-20s)
 * 2단계 page_insights: 4개 탭 insight (~1200-1500 토큰, ~20-25s)
 * 합계: ~35-45s — Vercel Hobby 60초 제한 안에 안정적으로 완료.
 *
 * Gemini 2.5 Flash 우선, 실패 시 2.5-flash-lite → GPT-4o-mini 폴백.
 */

import { generateSection, type GenerateResult } from "@/lib/llm/client";
import type {
  RawCompanyData,
  ComputedMetrics,
  CompanyNarrative,
  TopVerdict,
  CategoryNarrative,
  PageNarrative,
} from "@/types/CompanyAnalysis";

export type GenerateNarrativeOptions = {
  verbose?: boolean;
  onProgress?: (stage: 1 | 2) => void;
};

export type NarrativeUsage = {
  total_input_tokens: number;
  total_output_tokens: number;
  estimated_cost_usd: number;
  request_count: number;
};

type MainVerdictResult = {
  top_verdict: TopVerdict;
  categories: CategoryNarrative[];
};

type PageInsightsResult = {
  dashboard: PageNarrative;
  balance_sheet: PageNarrative;
  income_statement: PageNarrative;
  cash_flow: PageNarrative;
};

export async function generateNarrative(
  raw: RawCompanyData,
  computed: ComputedMetrics,
  opts: GenerateNarrativeOptions = {}
): Promise<{ narrative: CompanyNarrative; usage: NarrativeUsage }> {
  if (opts.verbose) console.log("[stage 1] main_verdict 시작...");
  opts.onProgress?.(1);

  const r1: GenerateResult<MainVerdictResult> = await generateSection(
    "main_verdict",
    raw,
    computed,
    { verbose: opts.verbose }
  );

  if (opts.verbose) console.log("[stage 2] page_insights 시작...");
  opts.onProgress?.(2);

  const r2: GenerateResult<PageInsightsResult> = await generateSection(
    "page_insights",
    raw,
    computed,
    { verbose: opts.verbose }
  );

  if (opts.verbose) console.log("[완료]");

  const narrative: CompanyNarrative = {
    top_verdict: r1.data.top_verdict,
    categories: r1.data.categories,
    pages: {
      dashboard: r2.data.dashboard,
      balance_sheet: r2.data.balance_sheet,
      income_statement: r2.data.income_statement,
      cash_flow: r2.data.cash_flow,
    },
  };

  const totalIn = r1.usage.input_tokens + r2.usage.input_tokens;
  const totalOut = r1.usage.output_tokens + r2.usage.output_tokens;
  // Gemini 2.5 Flash: $0.30/M input, $2.50/M output
  const cost = (totalIn * 0.3) / 1_000_000 + (totalOut * 2.5) / 1_000_000;

  return {
    narrative,
    usage: {
      total_input_tokens: totalIn,
      total_output_tokens: totalOut,
      estimated_cost_usd: cost,
      request_count: 2,
    },
  };
}
