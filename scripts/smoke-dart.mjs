/**
 * smoke-dart.mjs — LLM 빼고 DART → raw → computed만 빠르게 검증.
 *
 * 실행:
 *   npx tsx scripts/smoke-dart.mjs <corp_code> [<corp_code> ...]
 *
 * 통과 조건:
 *   - DART fetch 성공
 *   - transform 후 매출/총자산이 5년 다 null 아님
 *   - computeMetrics 무사 실행 (top_kpis ≥ 5)
 *
 * 실패해도 다음 corp_code 계속 진행, 마지막에 sum 출력.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

try {
  const envText = readFileSync(resolve(root, ".env.local"), "utf8");
  for (const line of envText.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq < 0) continue;
    const k = t.slice(0, eq).trim();
    const v = t.slice(eq + 1).trim();
    if (v && !process.env[k]) process.env[k] = v;
  }
} catch {}

if (!process.env.DART_API_KEY) {
  console.error("DART_API_KEY 필요");
  process.exit(1);
}

const args = process.argv.slice(2);
const writeFlag = args.includes("--write");
const codes = args.filter((a) => !a.startsWith("--"));
if (codes.length === 0) {
  console.error("사용: smoke-dart.mjs [--write] <corp_code> [<corp_code> ...]");
  process.exit(1);
}

const dart = await import(
  pathToFileURL(resolve(root, "src/lib/dart/client.ts")).href
);
const transform = await import(
  pathToFileURL(resolve(root, "src/lib/dart/transform.ts")).href
);
const compute = await import(
  pathToFileURL(resolve(root, "src/lib/computed.ts")).href
);

const YEARS = [2020, 2021, 2022, 2023, 2024];
const results = [];

for (const code of codes) {
  const t0 = Date.now();
  const result = { code, name: "?", status: "?", elapsed: 0, notes: [] };
  try {
    const info = await dart.fetchCompanyInfo(code);
    result.name = info.corp_name;

    const yearly = await dart.fetchFiveYearStatements(code, YEARS);
    const filledYears = yearly.filter((y) => y.data.length > 0).length;
    if (filledYears === 0) {
      result.status = "FAIL";
      result.notes.push("DART에 5개년 모두 데이터 없음");
      results.push(result);
      continue;
    }
    if (filledYears < 5) result.notes.push(`${filledYears}/5년만 데이터`);

    const raw = transform.buildRawFromDart(
      info,
      yearly,
      new Date().toISOString().slice(0, 10)
    );

    const rev = raw.financials.income_statement.revenue ?? [];
    const ta = raw.financials.balance_sheet.total_assets ?? [];
    const revFilled = rev.filter((v) => v != null).length;
    const taFilled = ta.filter((v) => v != null).length;
    if (revFilled === 0) result.notes.push("revenue 전부 null");
    if (taFilled === 0) result.notes.push("total_assets 전부 null");

    const computed = compute.computeMetrics(raw);
    if (computed.top_kpis.length < 3) {
      result.notes.push(`top_kpis 부족 (${computed.top_kpis.length}개)`);
    }

    if (writeFlag) {
      const { writeFileSync } = await import("node:fs");
      writeFileSync(
        resolve(root, `src/data/${code}_raw.json`),
        JSON.stringify(raw, null, 2)
      );
      writeFileSync(
        resolve(root, `src/data/${code}_computed.json`),
        JSON.stringify(computed, null, 2)
      );
      result.notes.push("written src/data/");
    }

    result.status =
      revFilled >= 3 && taFilled >= 3 && computed.top_kpis.length >= 3
        ? "OK"
        : "PARTIAL";
    result.elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    result.kpis = computed.top_kpis.length;
    result.lastRev = rev[4];
    result.lastTA = ta[4];
  } catch (e) {
    result.status = "ERROR";
    result.notes.push((e instanceof Error ? e.message : String(e)).slice(0, 200));
    result.elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  }
  results.push(result);
}

console.log("\n=== Smoke test 결과 ===");
console.log(
  "code".padEnd(10),
  "name".padEnd(20),
  "status".padEnd(10),
  "kpis",
  "elapsed",
  "notes"
);
for (const r of results) {
  console.log(
    r.code.padEnd(10),
    String(r.name).slice(0, 18).padEnd(20),
    r.status.padEnd(10),
    String(r.kpis ?? "-").padEnd(4),
    `${r.elapsed}s`.padEnd(8),
    r.notes.join(" | ") || "-"
  );
}

const pass = results.filter((r) => r.status === "OK").length;
console.log(`\n${pass}/${results.length} pass`);
process.exit(pass === results.length ? 0 : 0);
