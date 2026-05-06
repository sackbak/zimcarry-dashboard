/**
 * test-llm-zimcarry.mjs
 *
 * LLM narrative pipeline 검증 — 짐캐리 raw + computed 데이터로 7개 section 생성.
 *
 * 실행:
 *   ANTHROPIC_API_KEY=sk-... node --experimental-strip-types scripts/test-llm-zimcarry.mjs
 *
 * 출력:
 *   - 진행 로그 (각 section 시작 시점)
 *   - usage 누적 + cache hit 통계
 *   - 추정 비용 USD
 *   - src/data/zimcarry_narrative_llm.json (LLM 생성 결과)
 */

import { writeFileSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

if (!process.env.ANTHROPIC_API_KEY) {
  console.error("ERROR: ANTHROPIC_API_KEY 환경변수 필요.");
  console.error("  set ANTHROPIC_API_KEY=sk-... && node ... (Windows cmd)");
  console.error("  $env:ANTHROPIC_API_KEY=\"sk-...\"; node ... (PowerShell)");
  console.error("  ANTHROPIC_API_KEY=sk-... node ... (bash)");
  process.exit(1);
}

const analysis = JSON.parse(
  readFileSync(resolve(root, "src/data/zimcarry_analysis.json"), "utf8")
);

console.log("LLM narrative pipeline test — 짐캐리");
console.log(`  fiscal_years: ${analysis.raw.meta.fiscal_years.join(", ")}`);
console.log(`  IS line items: ${Object.keys(analysis.raw.financials.income_statement).length}`);
console.log(`  BS line items: ${Object.keys(analysis.raw.financials.balance_sheet).length}`);
console.log("");

// Dynamic import — 모듈이 .ts라 strip-types 필요
const { generateNarrative } = await import(
  resolve(root, "src/lib/llm/generate.ts")
);

const t0 = Date.now();
const { narrative, usage } = await generateNarrative(
  analysis.raw,
  analysis.computed,
  {
    verbose: true,
    onProgress: (section, idx, total) => {
      console.log(`[${idx + 1}/${total}] ${section}...`);
    },
  }
);
const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

console.log("");
console.log(`✓ 생성 완료 (${elapsed}s)`);
console.log("");
console.log("Usage:");
console.log(`  input_tokens          ${usage.total_input_tokens.toLocaleString()}`);
console.log(`  output_tokens         ${usage.total_output_tokens.toLocaleString()}`);
console.log(`  cache_creation        ${usage.total_cache_creation.toLocaleString()}`);
console.log(`  cache_read            ${usage.total_cache_read.toLocaleString()}`);
console.log(`  estimated_cost_usd    $${usage.estimated_cost_usd.toFixed(4)} (~${(usage.estimated_cost_usd * 1300).toFixed(0)}원)`);
console.log("");
console.log("Cache hit ratio:");
const totalInput = usage.total_input_tokens + usage.total_cache_creation + usage.total_cache_read;
const cacheRatio = totalInput > 0 ? (usage.total_cache_read / totalInput) * 100 : 0;
console.log(`  ${cacheRatio.toFixed(1)}% of input tokens served from cache`);

const outPath = resolve(root, "src/data/zimcarry_narrative_llm.json");
writeFileSync(outPath, JSON.stringify(narrative, null, 2), "utf8");
console.log("");
console.log(`✓ Narrative saved → ${outPath}`);
