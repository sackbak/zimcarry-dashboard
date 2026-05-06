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
const a = await fetchLiveAnalysis(process.argv[2] || "00164779");
console.log("company:    ", a.raw.meta.company_name);
console.log("fiscal_years:", a.raw.meta.fiscal_years);
console.log("revenue (백만원):", a.raw.financials.income_statement.revenue);
