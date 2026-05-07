/**
 * 회사 narrative 전체 생성 — 5개 병렬 호출 대신 단일 호출로 전체 생성.
 *
 * 5개 Promise.all 방식: 최대 latency 호출이 60s 타임아웃 유발.
 * 단일 호출 방식: 15~25s 목표 (Gemini 2.5 Flash 1회 출력 시간).
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
  onProgress?: (section: string, idx: number, total: number) => void;
};

export type NarrativeUsage = {
  total_input_tokens: number;
  total_output_tokens: number;
  estimated_cost_usd: number;
  request_count: number;
};

type AllInOneResult = {
  top_verdict: TopVerdict;
  categories: CategoryNarrative[];
  pages: {
    dashboard: PageNarrative;
    balance_sheet: PageNarrative;
    income_statement: PageNarrative;
    cash_flow: PageNarrative;
  };
};

export async function generateNarrative(
  raw: RawCompanyData,
  computed: ComputedMetrics,
  opts: GenerateNarrativeOptions = {}
): Promise<{ narrative: CompanyNarrative; usage: NarrativeUsage }> {
  if (opts.verbose) console.log("[all_in_one] 단일 호출 시작...");
  opts.onProgress?.("all_in_one", 0, 1);

  const result: GenerateResult<AllInOneResult> = await generateSection(
    "all_in_one",
    raw,
    computed,
    { verbose: opts.verbose }
  );

  if (opts.verbose) console.log("[all_in_one] 완료");

  const d = result.data;
  const narrative: CompanyNarrative = {
    top_verdict: d.top_verdict,
    categories: d.categories,
    pages: {
      dashboard: d.pages.dashboard,
      balance_sheet: d.pages.balance_sheet,
      income_statement: d.pages.income_statement,
      cash_flow: d.pages.cash_flow,
    },
  };

  const u = result.usage;
  const cost = (u.input_tokens * 0.3) / 1_000_000 + (u.output_tokens * 2.5) / 1_000_000;

  return {
    narrative,
    usage: {
      total_input_tokens: u.input_tokens,
      total_output_tokens: u.output_tokens,
      estimated_cost_usd: cost,
      request_count: 1,
    },
  };
}
