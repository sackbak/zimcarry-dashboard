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
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

// .env.local 자동 로드
const envPath = resolve(root, ".env.local");
try {
  const envText = readFileSync(envPath, "utf8");
  for (const line of envText.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    if (val && !process.env[key]) process.env[key] = val;
  }
} catch {
  // .env.local 없으면 무시 (env에 직접 set한 케이스)
}

if (!process.env.GEMINI_API_KEY) {
  console.error("ERROR: GEMINI_API_KEY 환경변수 필요.");
  console.error("  .env.local에 GEMINI_API_KEY=AIzaSy... 추가 후 재실행");
  console.error("  발급: https://aistudio.google.com/app/apikey");
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

// Dynamic import — 모듈이 .ts라 strip-types 필요. Windows는 file:// URL 변환 필수.
const { generateNarrative } = await import(
  pathToFileURL(resolve(root, "src/lib/llm/generate.ts")).href
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
console.log(`  request_count         ${usage.request_count} (free tier 1,500 RPD)`);
console.log(`  input_tokens          ${usage.total_input_tokens.toLocaleString()}`);
console.log(`  output_tokens         ${usage.total_output_tokens.toLocaleString()}`);
console.log(`  estimated_cost_usd    $${usage.estimated_cost_usd.toFixed(4)} (~${(usage.estimated_cost_usd * 1300).toFixed(0)}원)`);
console.log(`  (free tier 안이면 실제 0원)`);

const outPath = resolve(root, "src/data/zimcarry_narrative_llm.json");
writeFileSync(outPath, JSON.stringify(narrative, null, 2), "utf8");
console.log("");
console.log(`✓ Narrative saved → ${outPath}`);
