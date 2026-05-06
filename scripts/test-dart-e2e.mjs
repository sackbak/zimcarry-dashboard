/**
 * test-dart-e2e.mjs
 *
 * DART → RawCompanyData → ComputedMetrics → Gemini → CompanyNarrative
 * 전체 파이프라인 e2e 검증.
 *
 * 실행:
 *   .env.local에 GEMINI_API_KEY + DART_API_KEY 채우기
 *   node --experimental-strip-types scripts/test-dart-e2e.mjs <corp_code>
 *   기본값: 00126380 (삼성전자)
 *
 * 출력:
 *   - src/data/<corp_code>_raw.json (DART에서 가져온 raw)
 *   - src/data/<corp_code>_computed.json (자동 계산)
 *   - src/data/<corp_code>_narrative.json (Gemini 생성)
 *   - 콘솔에 진행 상황 + token/비용 통계
 *
 * 잘 알려진 corp_code (테스트용):
 *   00126380 — 삼성전자
 *   00401731 — LG전자
 *   00266961 — NAVER
 *   00918527 — 카카오
 *   00164742 — 셀트리온
 *   01234567 — (placeholder)
 */

import { writeFileSync, readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

// .env.local 자동 로드
try {
  const envText = readFileSync(resolve(root, ".env.local"), "utf8");
  for (const line of envText.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    if (val && !process.env[key]) process.env[key] = val;
  }
} catch {}

if (!process.env.DART_API_KEY) {
  console.error("ERROR: DART_API_KEY 환경변수 필요. .env.local 확인.");
  process.exit(1);
}
if (!process.env.GEMINI_API_KEY) {
  console.error("ERROR: GEMINI_API_KEY 환경변수 필요. .env.local 확인.");
  process.exit(1);
}

const CORP_CODE = process.argv[2] ?? "00126380"; // 삼성전자 default
const YEARS = [2020, 2021, 2022, 2023, 2024];

console.log(`DART e2e 테스트 — corp_code=${CORP_CODE}`);
console.log(`years: ${YEARS.join(", ")}`);
console.log("");

// ── 1. DART API 호출 ─────────────────────────────────────────
const dart = await import(
  pathToFileURL(resolve(root, "src/lib/dart/client.ts")).href
);

console.log("[1/4] DART 회사정보 조회...");
const info = await dart.fetchCompanyInfo(CORP_CODE);
console.log(`  ✓ ${info.corp_name} (${info.corp_name_eng || "—"})`);
console.log(`    ceo: ${info.ceo_nm}`);
console.log(`    industry: ${info.induty_code}`);
console.log(`    listed: ${info.corp_cls === "Y" ? "유가증권" : info.corp_cls === "K" ? "코스닥" : "기타"}`);
console.log("");

console.log("[2/4] DART 5개년 재무제표 조회...");
const t0 = Date.now();
const yearlyData = await dart.fetchFiveYearStatements(CORP_CODE, YEARS);
console.log(`  ✓ ${YEARS.length}개 연도 (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
for (const y of yearlyData) {
  console.log(`    ${y.year}: ${y.data.length} line items`);
}
console.log("");

// ── 2. RawCompanyData 변환 ───────────────────────────────────
const transform = await import(
  pathToFileURL(resolve(root, "src/lib/dart/transform.ts")).href
);

console.log("[3/4] DART → RawCompanyData 변환...");
const reportDate = new Date().toISOString().slice(0, 10);
const raw = transform.buildRawFromDart(info, yearlyData, reportDate);
console.log(`  ✓ raw built`);
console.log(`    company: ${raw.meta.company_name}`);
console.log(`    fiscal_years: ${raw.meta.fiscal_years.join(", ")}`);
console.log(`    IS keys (non-null): ${Object.entries(raw.financials.income_statement)
  .filter(([_, v]) => Array.isArray(v) && v.some((x) => x != null))
  .map(([k]) => k).join(", ")}`);
console.log(`    BS keys (non-null): ${Object.entries(raw.financials.balance_sheet)
  .filter(([_, v]) => Array.isArray(v) && v.some((x) => x != null))
  .map(([k]) => k).join(", ")}`);
console.log("");

writeFileSync(
  resolve(root, `src/data/${CORP_CODE}_raw.json`),
  JSON.stringify(raw, null, 2)
);

// ── 3. ComputedMetrics 자동 계산 ─────────────────────────────
const computeMod = await import(
  pathToFileURL(resolve(root, "src/lib/computed.ts")).href
);

console.log("[3.5/4] computeMetrics() 실행...");
const computed = computeMod.computeMetrics(raw);
console.log(`  ✓ computed`);
console.log(`    top_kpis: ${computed.top_kpis.length}`);
console.log(`    per_item.income: ${computed.per_item.income.length}`);
console.log(`    per_item.balance: ${computed.per_item.balance.length}`);
console.log(`    capital_erosion: ${JSON.stringify(computed.ratios.stability.capital_erosion)}`);
const lastIdx = raw.meta.fiscal_years.length - 1;
console.log(`    부채비율 ${YEARS[lastIdx]}: ${
  ((computed.ratios.stability.debt_ratio[lastIdx] ?? 0) * 100).toFixed(1)
}%`);
console.log(`    유동비율 ${YEARS[lastIdx]}: ${
  ((computed.ratios.stability.current_ratio[lastIdx] ?? 0) * 100).toFixed(1)
}%`);
console.log(`    영업이익률 ${YEARS[lastIdx]}: ${
  ((computed.ratios.profitability.operating_margin[lastIdx] ?? 0) * 100).toFixed(1)
}%`);
console.log("");

writeFileSync(
  resolve(root, `src/data/${CORP_CODE}_computed.json`),
  JSON.stringify(computed, null, 2)
);

// ── 4. Gemini narrative 생성 ─────────────────────────────────
const llm = await import(
  pathToFileURL(resolve(root, "src/lib/llm/generate.ts")).href
);

console.log("[4/4] Gemini narrative 생성 (7번 호출)...");
const t1 = Date.now();
const { narrative, usage } = await llm.generateNarrative(raw, computed, {
  verbose: false,
  onProgress: (section, idx, total) => {
    process.stdout.write(`  [${idx + 1}/${total}] ${section}...\n`);
  },
});
const elapsed = ((Date.now() - t1) / 1000).toFixed(1);

console.log(`  ✓ narrative complete (${elapsed}s)`);
console.log("");
console.log("Gemini Usage:");
console.log(`  input_tokens          ${usage.total_input_tokens.toLocaleString()}`);
console.log(`  output_tokens         ${usage.total_output_tokens.toLocaleString()}`);
console.log(`  estimated_cost_usd    $${usage.estimated_cost_usd.toFixed(4)} (~${(usage.estimated_cost_usd * 1300).toFixed(0)}원)`);
console.log("");

writeFileSync(
  resolve(root, `src/data/${CORP_CODE}_narrative.json`),
  JSON.stringify(narrative, null, 2)
);

// ── Summary ─────────────────────────────────────────────────
console.log("=== 결과 ===");
console.log(`회사: ${raw.meta.company_name}`);
console.log(`종합 신호: ${narrative.top_verdict.signal} ${narrative.top_verdict.label}`);
console.log(`종합 요약: ${narrative.top_verdict.summary}`);
console.log("");
console.log("페이지별 headline:");
console.log(`  dashboard:    ${narrative.pages.dashboard.headline}`);
console.log(`  balance_sheet: ${narrative.pages.balance_sheet.headline}`);
console.log(`  income_state.: ${narrative.pages.income_statement.headline}`);
console.log(`  cash_flow:    ${narrative.pages.cash_flow.headline}`);
console.log("");
console.log("저장:");
console.log(`  src/data/${CORP_CODE}_raw.json`);
console.log(`  src/data/${CORP_CODE}_computed.json`);
console.log(`  src/data/${CORP_CODE}_narrative.json`);
