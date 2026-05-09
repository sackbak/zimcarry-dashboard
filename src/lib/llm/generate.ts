/**
 * Per-tab narrative 생성 — 4개 독립 함수.
 *
 *   generateDashboardFull → top_verdict + categories + dashboard insight (~15-20s, ~3원)
 *   generateBSInsight → 재무상태표 PageNarrative (~10-15s, ~2원)
 *   generateISInsight → 손익계산서 PageNarrative (~10-15s, ~2원)
 *   generateCFInsight → 현금흐름 PageNarrative (~10-15s, ~2원)
 *
 * 각 호출은 독립적으로 60초 안에 끝남 — 절대 타임아웃 없음.
 */

import { generateSection } from "@/lib/llm/client";
import type {
  RawCompanyData,
  ComputedMetrics,
  TopVerdict,
  CategoryNarrative,
  PageNarrative,
  ItemNote,
} from "@/types/CompanyAnalysis";

export type DashboardFullResult = {
  top_verdict: TopVerdict;
  categories: CategoryNarrative[];
  dashboard: PageNarrative;
};

/** BS/IS 인사이트 생성 결과 — PageNarrative + 라인아이템별 노트 */
export type TabInsightResult = PageNarrative & {
  item_notes?: Record<string, ItemNote>;
};

export async function generateDashboardFull(
  raw: RawCompanyData,
  computed: ComputedMetrics,
  verbose = false
): Promise<DashboardFullResult> {
  const r = await generateSection<DashboardFullResult>("dashboard_full", raw, computed, { verbose });
  return r.data;
}

export async function generateBSInsight(
  raw: RawCompanyData,
  computed: ComputedMetrics,
  verbose = false
): Promise<TabInsightResult> {
  const r = await generateSection<TabInsightResult>("bs_insight", raw, computed, { verbose });
  return r.data;
}

export async function generateISInsight(
  raw: RawCompanyData,
  computed: ComputedMetrics,
  verbose = false
): Promise<TabInsightResult> {
  const r = await generateSection<TabInsightResult>("is_insight", raw, computed, { verbose });
  return r.data;
}

export async function generateCFInsight(
  raw: RawCompanyData,
  computed: ComputedMetrics,
  verbose = false
): Promise<PageNarrative> {
  const r = await generateSection<PageNarrative>("cf_insight", raw, computed, { verbose });
  return r.data;
}
