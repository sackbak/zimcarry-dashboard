/**
 * build-corp-index.mjs
 *
 * DART corpCode.xml 다운로드 → 한국 상장사만 필터 → src/data/corp-index.json.
 *
 * 실행:
 *   node scripts/build-corp-index.mjs
 *
 * 출력 포맷:
 *   [
 *     { "name": "삼성전자", "code": "00126380", "stock": "005930" },
 *     ...
 *   ]
 *
 * 갱신 주기: 분기 1회 정도면 충분 (신규 상장/상폐 반영).
 */

import { writeFileSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import AdmZip from "adm-zip";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

// .env.local 로드
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

const KEY = process.env.DART_API_KEY;
if (!KEY) {
  console.error("DART_API_KEY 환경변수 필요");
  process.exit(1);
}

const URL = `https://opendart.fss.or.kr/api/corpCode.xml?crtfc_key=${KEY}`;
console.log("DART corpcode.zip 다운로드...");
const t0 = Date.now();
const res = await fetch(URL);
if (!res.ok) {
  console.error(`HTTP ${res.status}: ${res.statusText}`);
  process.exit(1);
}
const buf = Buffer.from(await res.arrayBuffer());
console.log(`  ✓ ${(buf.length / 1024).toFixed(0)}KB (${((Date.now() - t0) / 1000).toFixed(1)}s)`);

console.log("Unzip + parse...");
const zip = new AdmZip(buf);
const entry = zip.getEntries().find((e) => e.entryName.endsWith(".xml"));
if (!entry) {
  console.error("zip 안에 xml 없음");
  process.exit(1);
}
const xml = zip.readAsText(entry);

// XML 정규식 파싱 — 구조 단순함:
// <list><corp_code>...</corp_code><corp_name>...</corp_name><stock_code>...</stock_code><modify_date>...</modify_date></list>
const blocks = xml.match(/<list>[\s\S]*?<\/list>/g) ?? [];
const all = blocks.map((b) => {
  const code = b.match(/<corp_code>([^<]*)<\/corp_code>/)?.[1] ?? "";
  const name = b.match(/<corp_name>([^<]*)<\/corp_name>/)?.[1] ?? "";
  const stock = b.match(/<stock_code>([^<]*)<\/stock_code>/)?.[1].trim() ?? "";
  return { code, name: name.trim(), stock };
});
console.log(`  ✓ ${all.length}개 회사 파싱`);

// 상장사만 (stock_code 있어야 함)
const listed = all.filter((c) => c.stock && c.stock.length > 0);
console.log(`  ✓ ${listed.length}개 상장사 필터`);

// 이름 기준 정렬 (검색 시 자연 순서)
listed.sort((a, b) => a.name.localeCompare(b.name, "ko"));

const outPath = resolve(root, "src/data/corp-index.json");
writeFileSync(outPath, JSON.stringify(listed, null, 0), "utf8");
const kb = (Buffer.byteLength(JSON.stringify(listed)) / 1024).toFixed(0);
console.log(`\n✓ src/data/corp-index.json (${kb}KB, ${listed.length} entries)`);

// 샘플 출력
console.log("\n샘플 (처음 5개):");
for (const c of listed.slice(0, 5)) {
  console.log(`  ${c.code}  ${c.stock.padEnd(6)}  ${c.name}`);
}
console.log("샘플 (잘 알려진):");
for (const target of ["삼성전자", "네이버", "카카오", "현대자동차", "셀트리온"]) {
  const found = listed.find((c) => c.name === target);
  console.log(`  ${found?.code ?? "?"}  ${found?.stock?.padEnd(6) ?? "?"}  ${target} ${found ? "✓" : "(없음)"}`);
}
