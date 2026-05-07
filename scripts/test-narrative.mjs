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

const { loadAnalysis } = await import(
  pathToFileURL(resolve(root, "src/lib/load-analysis.ts")).href
);
const { generateNarrative } = await import(
  pathToFileURL(resolve(root, "src/lib/llm/generate.ts")).href
);

const id = process.argv[2] || "00126186";
console.log(`로딩: ${id}...`);
const a = await loadAnalysis(id);
console.log(`회사: ${a.raw.meta.company_name}`);

console.log("LLM narrative 생성 시작...");
const start = Date.now();
try {
  const result = await generateNarrative(a.raw, a.computed, { verbose: true });
  console.log(`✓ 완료 (${((Date.now() - start) / 1000).toFixed(1)}초)`);
  console.log(`top_verdict: ${JSON.stringify(result.narrative.top_verdict, null, 2)}`);
  console.log(`usage: ${JSON.stringify(result.usage, null, 2)}`);
} catch (e) {
  console.log(`✗ 실패 (${((Date.now() - start) / 1000).toFixed(1)}초)`);
  console.log(`Error: ${e.message}`);
  if (e.stack) console.log(e.stack.split("\n").slice(0, 5).join("\n"));
}
