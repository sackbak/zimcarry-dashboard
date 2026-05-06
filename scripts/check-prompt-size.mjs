/**
 * LLM 호출 없이 buildDataContext 크기만 측정.
 * 다이어트 전후 비교용.
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
const { buildDataContext } = await import(
  pathToFileURL(resolve(root, "src/lib/llm/prompts.ts")).href
);

const corp = process.argv[2] || "00126380"; // 삼성전자
const a = await fetchLiveAnalysis(corp);

const SECTIONS = [
  "top_verdict_and_categories",
  "dashboard_insight",
  "bs_insight",
  "is_insight",
  "cf_insight",
  "item_notes_income",
  "item_notes_balance",
];

console.log(`회사: ${a.raw.meta.company_name} (${corp})`);
console.log(`연도: ${a.raw.meta.fiscal_years.join(", ")}`);
console.log("---");
console.log("section                       chars   ~tokens");
let totalChars = 0;
for (const s of SECTIONS) {
  const ctx = buildDataContext(a.raw, a.computed, s);
  totalChars += ctx.length;
  // 한글 + 영문 mix는 대략 2.5 chars/token
  const tokens = Math.round(ctx.length / 2.5);
  console.log(`${s.padEnd(30)} ${String(ctx.length).padStart(6)}  ~${tokens}`);
}
console.log("---");
console.log(`총 입력 chars: ${totalChars}, ~${Math.round(totalChars / 2.5)} tokens`);
