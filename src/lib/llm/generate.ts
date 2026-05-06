/**
 * 회사 narrative 전체 생성 — 6번 호출을 sequential로 실행.
 *
 * 캐싱 효과:
 *   - 호출 1 (top_verdict + categories): cache write
 *   - 호출 2~6: cache read (system + 데이터, ~95% 비용 절감)
 *
 * 호출은 순차 (parallel하면 cache write가 동시 발생해서 모두 full price).
 * 첫 응답이 시작되어야 cache가 다른 호출에서 readable.
 */

import { generateSection, type GenerateResult } from "@/lib/llm/client";
import type {
  RawCompanyData,
  ComputedMetrics,
  CompanyNarrative,
  TopVerdict,
  CategoryNarrative,
  PageNarrative,
  ItemNote,
} from "@/types/CompanyAnalysis";

export type GenerateNarrativeOptions = {
  verbose?: boolean;
  /** 호출 사이 progress 콜백 (UI streaming용 추후 확장) */
  onProgress?: (section: string, idx: number, total: number) => void;
};

export type NarrativeUsage = {
  total_input_tokens: number;
  total_output_tokens: number;
  total_cache_creation: number;
  total_cache_read: number;
  /** 추정 비용 USD (Opus 4.7 기준: $5/$25 + cache write 1.25× / cache read 0.1×) */
  estimated_cost_usd: number;
};

const SECTIONS = [
  "top_verdict_and_categories",
  "dashboard_insight",
  "bs_insight",
  "is_insight",
  "cf_insight",
  "item_notes_income",
  "item_notes_balance",
] as const;

export async function generateNarrative(
  raw: RawCompanyData,
  computed: ComputedMetrics,
  opts: GenerateNarrativeOptions = {}
): Promise<{ narrative: CompanyNarrative; usage: NarrativeUsage }> {
  const total = SECTIONS.length;
  const results: Record<string, GenerateResult> = {};

  for (let i = 0; i < SECTIONS.length; i++) {
    const section = SECTIONS[i];
    opts.onProgress?.(section, i, total);
    if (opts.verbose) console.log(`[${i + 1}/${total}] ${section}...`);
    results[section] = await generateSection(section, raw, computed, {
      verbose: opts.verbose,
    });
  }

  // 결과 조합
  const tvc = results.top_verdict_and_categories.data as {
    top_verdict: TopVerdict;
    categories: CategoryNarrative[];
  };
  const dashInsight = results.dashboard_insight.data as PageNarrative;
  const bsInsight = results.bs_insight.data as PageNarrative;
  const isInsight = results.is_insight.data as PageNarrative;
  const cfInsight = results.cf_insight.data as PageNarrative;
  const incomeNotes = results.item_notes_income.data as Record<string, ItemNote>;
  const balanceNotes = results.item_notes_balance.data as Record<string, ItemNote>;

  const narrative: CompanyNarrative = {
    top_verdict: tvc.top_verdict,
    pages: {
      dashboard: dashInsight,
      balance_sheet: bsInsight,
      income_statement: isInsight,
      cash_flow: cfInsight,
    },
    categories: tvc.categories,
    item_notes: {
      income: incomeNotes,
      balance: balanceNotes,
    },
  };

  // Usage 합산
  const totals = SECTIONS.reduce(
    (acc, s) => {
      const u = results[s].usage;
      acc.total_input_tokens += u.input_tokens;
      acc.total_output_tokens += u.output_tokens;
      acc.total_cache_creation += u.cache_creation_input_tokens;
      acc.total_cache_read += u.cache_read_input_tokens;
      return acc;
    },
    {
      total_input_tokens: 0,
      total_output_tokens: 0,
      total_cache_creation: 0,
      total_cache_read: 0,
    }
  );

  // Opus 4.7 pricing: $5/M input, $25/M output. Cache write 1.25× input, cache read 0.1× input.
  const cost =
    (totals.total_input_tokens * 5) / 1_000_000 +
    (totals.total_output_tokens * 25) / 1_000_000 +
    (totals.total_cache_creation * 5 * 1.25) / 1_000_000 +
    (totals.total_cache_read * 5 * 0.1) / 1_000_000;

  return {
    narrative,
    usage: { ...totals, estimated_cost_usd: cost },
  };
}
