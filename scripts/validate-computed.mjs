/**
 * validate-computed.mjs
 *
 * 짐캐리 raw 데이터(`src/data/zimcarry_data.json`의 financials.income_statement
 * + balance_sheet)를 새 computed 파이프라인에 통과시켜, 결과를 기존 ratios/cash_flow
 * 값과 비교해 어긋나는 부분을 출력.
 *
 * 빠른 sanity check 목적 — TS 모듈 직접 import 못 쓰니 실제 계산식을 인라인 복제.
 * (computed.ts와 동기화 — 식 바뀌면 여기도 수정 필요)
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(
  readFileSync(resolve(__dirname, "../src/data/zimcarry_data.json"), "utf8")
);

const is = data.financials.income_statement;
const bs = data.financials.balance_sheet;
const cf = data.financials.cash_flow;
const r = data.ratios;
const years = data.financials.years;

// 짐캐리 D&A는 income_items에서 추출
const sgaSection = data.income_items.find((s) => s.section === "판매비와관리비");
const dep = sgaSection.items.find((it) => it.name === "감가상각비").values_mil;
const amort = sgaSection.items.find((it) => it.name === "무형자산상각비").values_mil;

// ── helpers (computed.ts와 동기화) ─────────────────────────────────
const safeDiv = (a, b) => {
  if (a == null || b == null || b === 0) return null;
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return a / b;
};
const ratioYoY = (arr) =>
  arr.map((v, i) => {
    if (i === 0) return null;
    const p = arr[i - 1];
    if (v == null || p == null || p === 0) return null;
    if (Math.sign(p) !== Math.sign(v)) return null;
    return v / p - 1;
  });

// ── compute (computed.ts와 동일 로직 일부) ────────────────────────────
const N = is.revenue.length;
const idx = [...Array(N).keys()];

const my = {
  growth: {
    revenue_yoy: ratioYoY(is.revenue),
  },
  profitability: {
    operating_margin: idx.map((i) => safeDiv(is.operating_income[i], is.revenue[i])),
    net_margin: idx.map((i) => safeDiv(is.net_income[i], is.revenue[i])),
    sga_ratio: idx.map((i) => safeDiv(is.sga[i], is.revenue[i])),
    personnel_ratio: idx.map((i) => safeDiv(is.salary_total?.[i], is.revenue[i])),
    rent_ratio: idx.map((i) => safeDiv(is.rent?.[i], is.revenue[i])),
  },
  stability: {
    current_ratio: idx.map((i) => safeDiv(bs.current_assets[i], bs.current_liab[i])),
    debt_ratio: idx.map((i) => safeDiv(bs.total_liab[i], bs.total_equity[i])),
    equity_ratio: idx.map((i) => safeDiv(bs.total_equity[i], bs.total_assets[i])),
    short_debt_ratio: idx.map((i) => safeDiv(bs.short_borrow?.[i], bs.total_liab[i])),
    intangible_ratio: idx.map((i) => safeDiv(bs.intangible?.[i], bs.total_assets[i])),
    capital_erosion: idx.map((i) => {
      const eq = bs.total_equity[i];
      const cap = bs.capital_stock?.[i];
      if (eq == null) return false;
      if (eq < 0) return true;
      if (cap != null && eq < cap) return true;
      return false;
    }),
  },
  activity: {
    asset_turnover: idx.map((i) => safeDiv(is.revenue[i], bs.total_assets[i])),
    ar_turnover: idx.map((i) => safeDiv(is.revenue[i], bs.ar?.[i])),
  },
};
my.activity.ar_days = my.activity.ar_turnover.map((t) => (t == null || t === 0 ? null : 365 / t));

// EBITDA & margin
const ebitda = idx.map((i) => {
  if (is.operating_income[i] == null) return null;
  return is.operating_income[i] + (dep[i] ?? 0) + (amort[i] ?? 0);
});
const ebitdaMargin = idx.map((i) => safeDiv(ebitda[i], is.revenue[i]));

// CAPEX = Δ(tangible + intangible) + D&A
const capex = idx.map((i) => {
  if (i === 0) return null;
  const dTan = (bs.tangible?.[i] ?? 0) - (bs.tangible?.[i - 1] ?? 0);
  const dInt = (bs.intangible?.[i] ?? 0) - (bs.intangible?.[i - 1] ?? 0);
  const c = dTan + dInt + (dep[i] ?? 0) + (amort[i] ?? 0);
  return c < 0 ? 0 : c;
});

// OCF estimate
const ocfEst = idx.map((i) => {
  if (i === 0) return null;
  const ni = is.net_income[i];
  if (ni == null) return null;
  const ca = bs.current_assets[i],
    caP = bs.current_assets[i - 1];
  const ch = bs.cash?.[i] ?? 0,
    chP = bs.cash?.[i - 1] ?? 0;
  const cl = bs.current_liab[i],
    clP = bs.current_liab[i - 1];
  if (ca == null || caP == null || cl == null || clP == null) return null;
  const opWC = ca - ch - (caP - chP);
  const dCL = cl - clP;
  const dNWC = opWC - dCL;
  return ni + (dep[i] ?? 0) + (amort[i] ?? 0) - dNWC;
});

const fcf = idx.map((i) => (ocfEst[i] == null || capex[i] == null ? null : ocfEst[i] - capex[i]));

// total_debt
const totalDebt = idx.map((i) => (bs.short_borrow?.[i] ?? 0) + (bs.long_borrow?.[i] ?? 0));

// interest_coverage
const intCov = idx.map((i) => safeDiv(is.operating_income[i], is.interest_expense?.[i]));

// runway
const runway = idx.map((i) => {
  const c = bs.cash?.[i];
  const f = fcf[i];
  if (c == null || f == null || f >= 0) return null;
  const monthly = -f / 12;
  if (monthly <= 0) return null;
  return c / monthly;
});

// ── compare ────────────────────────────────────────────────────────────
const round = (v, d = 2) => (v == null ? "—" : Number(v.toFixed(d)));
const fmt = (a, d = 2) =>
  Array.isArray(a) ? a.map((v) => round(v, d)).join(" | ") : round(a, d);

let mismatchCount = 0;
const compare = (label, mine, theirs, tol = 0.005) => {
  const len = Math.max(mine.length, theirs.length);
  const diffs = [];
  for (let i = 0; i < len; i++) {
    const a = mine[i],
      b = theirs[i];
    if (a == null && b == null) continue;
    if (a == null || b == null) {
      diffs.push(`y${years[i]}: mine=${a} theirs=${b}`);
      continue;
    }
    if (Math.abs(a - b) > tol * Math.max(Math.abs(b), 1)) {
      diffs.push(`y${years[i]}: mine=${round(a, 4)} theirs=${round(b, 4)} Δ${round(a - b, 4)}`);
    }
  }
  const ok = diffs.length === 0;
  if (!ok) mismatchCount++;
  console.log(
    `${ok ? "✓" : "✗"} ${label.padEnd(28)}  ${ok ? "match" : diffs.join("; ")}`
  );
  if (!ok) {
    console.log(`    mine:   ${fmt(mine, 3)}`);
    console.log(`    theirs: ${fmt(theirs, 3)}`);
  }
};

console.log("=== Growth ===");
compare("revenue_yoy", my.growth.revenue_yoy, r.growth.revenue_yoy);

console.log("\n=== Profitability ===");
compare("operating_margin", my.profitability.operating_margin, r.profitability.operating_margin);
compare("net_margin", my.profitability.net_margin, r.profitability.net_margin);
compare("sga_ratio", my.profitability.sga_ratio, r.profitability.sga_ratio);
compare("personnel_ratio", my.profitability.personnel_ratio, r.profitability.personnel_ratio);
compare("rent_ratio", my.profitability.rent_ratio, r.profitability.rent_ratio);
compare("ebitda_margin (mine)", ebitdaMargin, r.profitability.ebitda_margin);

console.log("\n=== Stability ===");
compare("current_ratio", my.stability.current_ratio, r.stability.current_ratio);
compare("debt_ratio", my.stability.debt_ratio, r.stability.debt_ratio);
compare("equity_ratio", my.stability.equity_ratio, r.stability.equity_ratio);
compare("short_debt_ratio", my.stability.short_debt_ratio, r.stability.short_debt_ratio);
compare("intangible_ratio", my.stability.intangible_ratio, r.stability.intangible_ratio);
const capEroMatch = JSON.stringify(my.stability.capital_erosion) === JSON.stringify(r.stability.capital_erosion);
console.log(`${capEroMatch ? "✓" : "✗"} capital_erosion              ${capEroMatch ? "match" : "mine=" + JSON.stringify(my.stability.capital_erosion) + " theirs=" + JSON.stringify(r.stability.capital_erosion)}`);
if (!capEroMatch) mismatchCount++;

console.log("\n=== Activity ===");
compare("asset_turnover", my.activity.asset_turnover, r.activity.asset_turnover);
compare("ar_turnover", my.activity.ar_turnover, r.activity.ar_turnover);
compare("ar_days", my.activity.ar_days, r.activity.ar_days, 0.05);

console.log("\n=== Derived Cash Flow (vs zimcarry's pre-calc) ===");
compare("ebitda", ebitda, cf.ebitda, 0.02);
compare("ebitda_margin", ebitdaMargin, cf.ebitda_margin, 0.005);
compare("ocf_estimate", ocfEst, cf.ocf, 0.05);
compare("capex", capex, cf.capex, 0.05);
compare("fcf", fcf, cf.fcf, 0.05);
compare("runway_months", runway.slice(-1), [cf.runway_months[N - 1]], 0.05);
compare("interest_coverage", intCov, cf.interest_coverage, 0.05);
compare("total_debt", totalDebt, cf.total_debt);

console.log(`\n총 mismatch: ${mismatchCount}`);
process.exit(mismatchCount > 0 ? 1 : 0);
