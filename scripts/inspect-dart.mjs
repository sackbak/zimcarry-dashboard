/**
 * DART 원본 응답 dump — 누락된 항목들의 account_id·account_nm 후보 조사.
 *
 * 출력: 회사별 IS/BS/CF의 모든 (account_id, account_nm, sj_div, thstrm_amount) 표시.
 * 우리 매핑 누락 의심되는 키워드("감가", "상각", "주식발행", "차입", "잉여")만 필터.
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

const { fetchFinancialStatementsAll } = await import(
  pathToFileURL(resolve(root, "src/lib/dart/client.ts")).href
);

const codes = [
  { code: "00126380", name: "삼성전자" },
  { code: "00164742", name: "현대차" },
  { code: "00266961", name: "NAVER" },
];

const KEYWORDS =
  /감가|상각|주식발행|자본잉여|자본준비|차입|순이익|손실|매출원가|영업비용|판관비|판매비/;

for (const { code, name } of codes) {
  const resp = await fetchFinancialStatementsAll(code, "2024", "11011", "CFS");
  console.log(`\n=== ${name} (${code}) — 2024 사업보고서 ===`);
  const list = resp.list ?? [];
  const seen = new Set();
  for (const acc of list) {
    if (!KEYWORDS.test(acc.account_nm)) continue;
    const key = `${acc.sj_div}|${acc.account_id}|${acc.account_nm}`;
    if (seen.has(key)) continue;
    seen.add(key);
    console.log(
      `  [${acc.sj_div}] id="${acc.account_id}"  nm="${acc.account_nm}"  amt=${acc.thstrm_amount}`
    );
  }
}
