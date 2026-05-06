/**
 * 회사 narrative 전체 생성 — 7개 section을 모두 동시 호출 (Promise.all).
 *
 * Gemini 2.5 Flash 사용 — free tier 안에선 비용 0, paid도 회사당 ~$0.04.
 * Free tier 15 RPM 이내라 7개 동시 호출 안전. 7 section 모두 독립적
 * (raw + computed만 입력, 서로 결과 참조 안 함).
 *
 * 시간: sequential 2~3분 → parallel 30~60초 (max latency에 수렴).
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
  /** 추정 비용 USD (Gemini 2.5 Flash: $0.30/M input, $2.50/M output. Free tier 안이면 $0) */
  estimated_cost_usd: number;
  /** free tier (1500 RPD)에 카운트되는 호출 수 */
  request_count: number;
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
  if (opts.verbose) console.log(`[${total} sections] 동시 호출 시작...`);

  const settled = await Promise.all(
    SECTIONS.map(async (section, i) => {
      opts.onProgress?.(section, i, total);
      const r = await generateSection(section, raw, computed, {
        verbose: opts.verbose,
      });
      if (opts.verbose) console.log(`  [${i + 1}/${total}] ${section} done`);
      return [section, r] as const;
    })
  );
  const results: Record<string, GenerateResult> = Object.fromEntries(settled);

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
      return acc;
    },
    {
      total_input_tokens: 0,
      total_output_tokens: 0,
    }
  );

  // Gemini 2.5 Flash pricing: $0.30/M input, $2.50/M output (paid tier).
  // Free tier 안이면 실제 비용 0.
  const cost =
    (totals.total_input_tokens * 0.3) / 1_000_000 +
    (totals.total_output_tokens * 2.5) / 1_000_000;

  return {
    narrative,
    usage: {
      ...totals,
      estimated_cost_usd: cost,
      request_count: SECTIONS.length,
    },
  };
}
