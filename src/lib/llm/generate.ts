/**
 * 회사 narrative 생성 — 클라이언트 2단계 호출용.
 *
 * generateMainOnly  → 1단계: top_verdict + categories (~15-25s)
 * generateInsightsOnly → 2단계: 4개 탭 insight (~20-30s)
 *
 * 각각 독립적인 Vercel 60초 타임아웃 안에서 실행.
 */

import { generateSection } from "@/lib/llm/client";
import type {
  RawCompanyData,
  ComputedMetrics,
  TopVerdict,
  CategoryNarrative,
  PageNarrative,
} from "@/types/CompanyAnalysis";

export type NarrativeUsage = {
  total_input_tokens: number;
  total_output_tokens: number;
  estimated_cost_usd: number;
};

type MainResult = { top_verdict: TopVerdict; categories: CategoryNarrative[] };
type PagesResult = {
  dashboard: PageNarrative;
  balance_sheet: PageNarrative;
  income_statement: PageNarrative;
  cash_flow: PageNarrative;
};

export async function generateMainOnly(
  raw: RawCompanyData,
  computed: ComputedMetrics,
  verbose = false
): Promise<{ result: MainResult; usage: NarrativeUsage }> {
  const r = await generateSection<MainResult>("main_verdict", raw, computed, { verbose });
  const cost = (r.usage.input_tokens * 0.3 + r.usage.output_tokens * 2.5) / 1_000_000;
  return {
    result: r.data,
    usage: { total_input_tokens: r.usage.input_tokens, total_output_tokens: r.usage.output_tokens, estimated_cost_usd: cost },
  };
}

export async function generateInsightsOnly(
  raw: RawCompanyData,
  computed: ComputedMetrics,
  verbose = false
): Promise<{ result: PagesResult; usage: NarrativeUsage }> {
  const r = await generateSection<PagesResult>("page_insights", raw, computed, { verbose });
  const cost = (r.usage.input_tokens * 0.3 + r.usage.output_tokens * 2.5) / 1_000_000;
  return {
    result: r.data,
    usage: { total_input_tokens: r.usage.input_tokens, total_output_tokens: r.usage.output_tokens, estimated_cost_usd: cost },
  };
}
