/**
 * migrate-zimcarry.mjs
 *
 * src/data/zimcarry_data.json (legacy) → src/data/zimcarry_analysis.json (new CompanyAnalysis schema)
 *
 * 정책:
 *   - structural restructure만, 값 변환 X (식 다시 돌리지 않음).
 *   - narrative는 INSIGHTS, page headlines, dashboard.categories에서 흡수.
 *   - top_kpis는 zimcarry 기존 set 그대로 (label·value_2025→value_latest 리매핑).
 *
 * Node 22+ --experimental-strip-types 필요 (insights.ts 직접 import 위해).
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { INSIGHTS } from "../src/lib/insights.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const old = JSON.parse(readFileSync(resolve(root, "src/data/zimcarry_data.json"), "utf8"));

// 페이지 headline — 현재 *.tsx에 하드코딩된 값 옮김
const PAGE_HEADLINES = {
  dashboard: "PMF 검증·손익 개선 중 — 단 자본·현금 구조는 외부 자금 100% 의존",
  balance_sheet: "단기차입 91% 의존 + 자본잠식 2회 — Bridge 증자로 회복, 매년 롤오버 필수",
  income_statement: "PMF 검증·인건비·임차료가 매출 78% — 영업이익률 -33%→-8% 빠른 개선으로 BEP 임박",
  cash_flow: "OCF·FCF 3년 연속 적자, 누적 -35억 — 이자도 못 내는 구조, 외부 자금 100% 의존",
};

// page message — 기존엔 dashboard.categories[해당].comment 사용
const findCat = (name) => old.dashboard.categories.find((c) => c.name === name);
const PAGE_MESSAGES = {
  dashboard: old.dashboard.overall_assessment.summary,
  balance_sheet: findCat("안정성")?.comment ?? "",
  income_statement: findCat("수익성")?.comment ?? "",
  cash_flow: findCat("현금흐름")?.comment ?? "",
};

// ─── raw ───────────────────────────────────────────────────────────
const raw = {
  meta: {
    company_name: old.meta.company,
    fiscal_years: old.financials.years,
    currency_unit: old.meta.currency_unit,
    report_date: old.meta.report_date,
    source: "Manual",
    data_period: old.meta.data_period,
  },
  company: {
    ceo: old.company.ceo,
    founded: old.company.founded,
    biz_no: old.company.biz_no,
    headquarters: old.company.headquarters,
    employees: old.company.employees_2026_02,
    homepage: old.company.homepage,
    industry: old.company.industry,
    is_listed: false, // 짐캐리 비상장
  },
  financials: {
    income_statement: old.financials.income_statement,
    balance_sheet: old.financials.balance_sheet,
    // cash_flow_raw 없음 (DART 비상장)
  },
};

// ─── computed (legacy values 보존, 식 재계산 X) ─────────────────────
const cf = old.financials.cash_flow;
const computed = {
  ratios: {
    growth: old.ratios.growth,
    profitability: old.ratios.profitability,
    stability: old.ratios.stability,
    activity: old.ratios.activity,
  },
  derived_cf: {
    ebitda: cf.ebitda,
    ebitda_margin: cf.ebitda_margin,
    ocf_estimate: cf.ocf,
    capex: cf.capex,
    fcf: cf.fcf,
    fcf_margin: cf.fcf_margin,
    runway_months: Array.isArray(cf.runway_months)
      ? cf.runway_months
      : [null, null, null, null, cf.runway_months ?? null],
    interest_coverage: cf.interest_coverage,
    total_debt: cf.total_debt,
  },
  top_kpis: old.dashboard.top_kpis.map((k) => ({
    label: k.label,
    value_latest: k.value_2025,
    unit: k.unit,
    yoy: k.yoy,
    signal: k.signal,
  })),
  per_item: {
    income: old.income_items.flatMap((s) =>
      s.items.map((it) => ({
        name: it.name,
        values: it.values_mil,
        yoy_latest: it.yoy_2025 ?? null,
        share_latest: it.rev_share_2025 ?? null,
      }))
    ),
    balance: old.balance_items.flatMap((s) =>
      s.items.map((it) => ({
        name: it.name,
        values: it.values_mil,
        yoy_latest: it.yoy_2025 ?? null,
        share_latest: it.asset_share_2025 ?? null,
      }))
    ),
  },
};

// ─── narrative ─────────────────────────────────────────────────────
const narrative = {
  top_verdict: {
    signal: old.dashboard.overall_assessment.signal,
    label: old.dashboard.overall_assessment.label,
    summary: old.dashboard.overall_assessment.summary,
    key_question: old.dashboard.overall_assessment.key_question,
    scenarios: old.dashboard.overall_assessment.scenarios,
  },
  pages: {
    dashboard: {
      headline: PAGE_HEADLINES.dashboard,
      message: PAGE_MESSAGES.dashboard,
      insight: INSIGHTS.dashboard_overall,
    },
    balance_sheet: {
      headline: PAGE_HEADLINES.balance_sheet,
      message: PAGE_MESSAGES.balance_sheet,
      insight: INSIGHTS.bs_overall,
    },
    income_statement: {
      headline: PAGE_HEADLINES.income_statement,
      message: PAGE_MESSAGES.income_statement,
      insight: INSIGHTS.is_overall,
    },
    cash_flow: {
      headline: PAGE_HEADLINES.cash_flow,
      message: PAGE_MESSAGES.cash_flow,
      insight: INSIGHTS.cf_overall,
    },
  },
  categories: old.dashboard.categories.map((c) => ({
    name: c.name,
    signal: c.signal,
    summary: c.summary,
    comment: c.comment,
    kpi_refs: c.kpis.map((k) => k.name),
  })),
  item_notes: {
    income: Object.fromEntries(
      old.income_items.flatMap((s) =>
        s.items.map((it) => [
          it.name,
          {
            trend: it.trend,
            learn_note: it.learn_note,
            investment_note: it.investment_note,
          },
        ])
      )
    ),
    balance: Object.fromEntries(
      old.balance_items.flatMap((s) =>
        s.items.map((it) => [
          it.name,
          {
            trend: it.trend,
            learn_note: it.learn_note,
            investment_note: it.investment_note,
          },
        ])
      )
    ),
  },
};

// ─── context ───────────────────────────────────────────────────────
const context = {
  investment_history: old.company.investment
    ? {
        rounds: old.company.investment.rounds,
        cumulative_capital_mil: old.company.investment.cumulative_capital_mil,
        cumulative_vc_only_mil: old.company.investment.cumulative_vc_only_mil,
        note: old.company.investment.note,
      }
    : undefined,
  milestones: old.company.milestones_post_ir2024,
  subsidiary: old.company.subsidiary,
  business_structure: old.business_structure,
};

// ─── 최종 ───────────────────────────────────────────────────────────
const analysis = { raw, computed, narrative, context };

const outPath = resolve(root, "src/data/zimcarry_analysis.json");
writeFileSync(outPath, JSON.stringify(analysis, null, 2), "utf8");

const stat = (label, n) => console.log(`  ${label.padEnd(28)} ${n}`);
console.log("✓ Migration complete →", outPath);
console.log("\nSummary:");
stat("fiscal_years", raw.meta.fiscal_years.length);
stat("IS line items", Object.keys(raw.financials.income_statement).length);
stat("BS line items", Object.keys(raw.financials.balance_sheet).length);
stat("computed.top_kpis", computed.top_kpis.length);
stat("per_item.income", computed.per_item.income.length);
stat("per_item.balance", computed.per_item.balance.length);
stat("narrative.categories", narrative.categories.length);
stat("item_notes.income", Object.keys(narrative.item_notes.income).length);
stat("item_notes.balance", Object.keys(narrative.item_notes.balance).length);
stat("investment_history rounds", context.investment_history?.rounds.length ?? 0);
stat("milestones", context.milestones?.length ?? 0);
