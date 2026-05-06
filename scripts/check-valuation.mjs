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
const { computeValuation } = await import(
  pathToFileURL(resolve(root, "src/lib/valuation.ts")).href
);

const codes = ["00126380", "00164742", "00266961"];
for (const c of codes) {
  const a = await fetchLiveAnalysis(c);
  const v = computeValuation(a.raw, a.computed);
  console.log(`\n=== ${a.raw.meta.company_name} (${c}) ===`);
  console.log(`산업: ${v.industry.label} (${v.industry.key})`);
  console.log(`EBITDA: ${v.inputs.ebitda_mil} 백만`);
  console.log(`매출: ${v.inputs.revenue_mil} 백만`);
  console.log(`Net Debt: ${v.inputs.net_debt_mil} 백만`);
  if (v.ev_from_ebitda) {
    const lo = (v.ev_from_ebitda.low / 1_000_000).toFixed(1);
    const mid = (v.ev_from_ebitda.mid / 1_000_000).toFixed(1);
    const hi = (v.ev_from_ebitda.high / 1_000_000).toFixed(1);
    console.log(`EV/EBITDA range:  ${lo} ~ ${mid} ~ ${hi} 조`);
  } else {
    console.log(`EV/EBITDA: 적용 안 됨 (EBITDA 음수: ${v.ebitda_negative})`);
  }
  if (v.ev_from_sales) {
    const lo = (v.ev_from_sales.low / 1_000_000).toFixed(1);
    const mid = (v.ev_from_sales.mid / 1_000_000).toFixed(1);
    const hi = (v.ev_from_sales.high / 1_000_000).toFixed(1);
    console.log(`EV/Sales range:   ${lo} ~ ${mid} ~ ${hi} 조`);
  }
  if (v.blended_ev_mid_mil) {
    console.log(`Blended EV mid:   ${(v.blended_ev_mid_mil / 1_000_000).toFixed(1)} 조`);
    console.log(`Blended Equity:   ${(v.blended_equity_mid_mil / 1_000_000).toFixed(1)} 조`);
  }
}
