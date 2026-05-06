/**
 * 회계식 정합성 + 추출 누락 검증.
 *
 * 검증 항목:
 *   1. 자산총계 = 부채총계 + 자본총계 (회계 항등식)
 *   2. 매출 - 매출원가 ≈ 매출총이익 (둘 다 있을 때)
 *   3. 핵심 line item 누락 여부 (revenue, total_assets, total_liab, total_equity)
 *   4. 5년치 데이터 채워짐 비율
 *   5. 음수 처리 정상 여부 (마이너스 부호)
 *   6. EBITDA 산정 가능 여부 (D&A 데이터 있나)
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const env = readFileSync(resolve(root, ".env.local"), "utf8");
for (const line of env.split("\n")) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const eq = t.indexOf("=");
  if (eq < 0) continue;
  process.env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
}

const { fetchLiveAnalysis } = await import(
  pathToFileURL(resolve(root, "src/lib/load-analysis.ts")).href
);

const codes = ["00126380", "00164742", "00266961", "00126186", "00164779"];
// 삼성전자, 현대차, NAVER, 삼성SDS, SK하이닉스

function pct(part, total) {
  if (total == null || total === 0) return "-";
  return `${((part / total) * 100).toFixed(1)}%`;
}

function lastNonNull(arr) {
  if (!arr) return null;
  for (let i = arr.length - 1; i >= 0; i--) if (arr[i] != null) return arr[i];
  return null;
}

function fillRate(arr, n) {
  if (!arr) return 0;
  return arr.filter((x) => x != null).length / n;
}

for (const code of codes) {
  const a = await fetchLiveAnalysis(code);
  const r = a.raw;
  const N = r.meta.fiscal_years.length;
  const is = r.financials.income_statement;
  const bs = r.financials.balance_sheet;
  const cf = r.financials.cash_flow_raw ?? {};

  console.log(`\n=== ${r.meta.company_name} (${code}) — ${r.meta.fiscal_years[0]}~${r.meta.fiscal_years[N - 1]} ===`);

  // 1. 회계 항등식 — 자산 = 부채 + 자본
  for (let i = 0; i < N; i++) {
    const assets = bs.total_assets[i];
    const liab = bs.total_liab[i];
    const equity = bs.total_equity[i];
    if (assets == null || liab == null || equity == null) continue;
    const sum = liab + equity;
    const diff = Math.abs(assets - sum) / Math.abs(assets);
    if (diff > 0.01) {
      console.log(
        `  [WARN ${r.meta.fiscal_years[i]}] 자산(${assets.toLocaleString()}) ≠ 부채(${liab.toLocaleString()}) + 자본(${equity.toLocaleString()}) — diff ${(diff * 100).toFixed(2)}%`
      );
    }
  }

  // 2. 매출 - 매출원가 ≈ 매출총이익
  for (let i = 0; i < N; i++) {
    const rev = is.revenue[i];
    const cogs = is.cogs?.[i];
    const gp = is.gross_profit?.[i];
    if (rev == null || cogs == null || gp == null) continue;
    const expected = rev - cogs;
    const diff = Math.abs(expected - gp) / Math.abs(rev);
    if (diff > 0.01) {
      console.log(
        `  [WARN ${r.meta.fiscal_years[i]}] 매출-매출원가(${expected.toLocaleString()}) ≠ 매출총이익(${gp.toLocaleString()})`
      );
    }
  }

  // 3. 핵심 라인아이템 누락
  const critical = {
    revenue: is.revenue,
    operating_income: is.operating_income,
    net_income: is.net_income,
    total_assets: bs.total_assets,
    total_liab: bs.total_liab,
    total_equity: bs.total_equity,
    cash: bs.cash,
  };
  const missingCritical = [];
  for (const [k, arr] of Object.entries(critical)) {
    const rate = fillRate(arr, N);
    if (rate < 1) missingCritical.push(`${k}: ${(rate * 100).toFixed(0)}%`);
  }
  if (missingCritical.length === 0) {
    console.log(`  ✓ 핵심 7개 line item 5년 모두 채움`);
  } else {
    console.log(`  ⚠ 누락: ${missingCritical.join(", ")}`);
  }

  // 4. 보조 라인 채움률
  const extra = {
    cogs: is.cogs,
    sga: is.sga,
    gross_profit: is.gross_profit,
    interest_expense: is.interest_expense,
    depreciation: is.depreciation,
    amortization: is.amortization,
    ar: bs.ar,
    tangible: bs.tangible,
    intangible: bs.intangible,
    short_borrow: bs.short_borrow,
    long_borrow: bs.long_borrow,
    capital_stock: bs.capital_stock,
    capital_surplus: bs.capital_surplus,
    cf_operating: cf.operating,
    cf_investing: cf.investing,
    cf_financing: cf.financing,
  };
  const extraStatus = Object.entries(extra)
    .map(([k, arr]) => `${k}:${(fillRate(arr, N) * 100).toFixed(0)}%`)
    .filter((s) => !s.endsWith(":100%"));
  if (extraStatus.length > 0) {
    console.log(`  보조항목 누락:`);
    for (const s of extraStatus) console.log(`    ${s}`);
  }

  // 5. 매출 sanity (시총과 직접 비교는 못 하지만 합리적 자릿수)
  const lastRev = lastNonNull(is.revenue);
  if (lastRev != null) {
    console.log(
      `  최근 매출: ${(lastRev / 1_000_000).toFixed(1)}조원 (${lastRev.toLocaleString()} 백만)`
    );
  }

  // 6. EBITDA 가능 여부
  const opi = lastNonNull(is.operating_income);
  const dep = lastNonNull(is.depreciation);
  const amo = lastNonNull(is.amortization);
  if (opi != null) {
    if (dep != null || amo != null) {
      console.log(`  ✓ EBITDA 산정 가능 (영업이익 + D&A)`);
    } else {
      console.log(
        `  ⚠ EBITDA = 영업이익 (D&A 데이터 없음 — DART는 별도 공시 안 하는 회사 많음)`
      );
    }
  }

  // 7. 음수 정상 처리 확인 — 영업이익이 음수인 해 있으면 표기
  const negativeYears = [];
  for (let i = 0; i < N; i++) {
    const v = is.operating_income[i];
    if (v != null && v < 0) negativeYears.push(r.meta.fiscal_years[i]);
  }
  if (negativeYears.length > 0) {
    console.log(`  음수 영업이익 정상 인식: [${negativeYears.join(", ")}]`);
  }
}

console.log("\n=== 완료 ===");
