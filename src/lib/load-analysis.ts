/**
 * 회사 ID(corp_code 또는 슬러그) → CompanyAnalysis 로드.
 *
 * 우선순위:
 *   1) src/data/<id>_analysis.json (단일 파일)
 *   2) src/data/<id>_{raw,computed,narrative}.json (3 파일, narrative 옵션)
 *   3) DART API live fetch (id가 8자리 숫자 corp_code일 때만)
 *
 * 서버 사이드 전용 — fs/path/외부 fetch 사용. RSC에서만 호출.
 */

import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import type {
  CompanyAnalysis,
  RawCompanyData,
  ComputedMetrics,
  CompanyNarrative,
} from "@/types/CompanyAnalysis";
import {
  fetchCompanyInfo,
  fetchFiveYearStatements,
} from "@/lib/dart/client";
import { buildRawFromDart } from "@/lib/dart/transform";
import { computeMetrics } from "@/lib/computed";

/**
 * 현재 시점 기준으로 5개년 산출.
 * K-IFRS 사업보고서 신고 마감 = 다음 해 3월 31일. 4월 이후엔 직전 회계연도 잡힌다고 가정.
 *   2026-04 이후 → [2021..2025]
 *   2026-01~03 → [2020..2024]
 */
function getDefaultYears(): number[] {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const latest = month >= 4 ? year - 1 : year - 2;
  return [latest - 4, latest - 3, latest - 2, latest - 1, latest];
}

const DATA_DIR = path.join(process.cwd(), "src", "data");

export async function loadAnalysis(id: string): Promise<CompanyAnalysis> {
  const single = path.join(DATA_DIR, `${id}_analysis.json`);
  if (existsSync(single)) {
    const text = await readFile(single, "utf8");
    return JSON.parse(text) as CompanyAnalysis;
  }
  const rawPath = path.join(DATA_DIR, `${id}_raw.json`);
  const compPath = path.join(DATA_DIR, `${id}_computed.json`);
  const narrPath = path.join(DATA_DIR, `${id}_narrative.json`);
  if (existsSync(rawPath) && existsSync(compPath)) {
    const [raw, computed] = await Promise.all([
      readFile(rawPath, "utf8").then((t) => JSON.parse(t) as RawCompanyData),
      readFile(compPath, "utf8").then((t) => JSON.parse(t) as ComputedMetrics),
    ]);
    let narrative: CompanyNarrative | undefined;
    if (existsSync(narrPath)) {
      narrative = JSON.parse(
        await readFile(narrPath, "utf8")
      ) as CompanyNarrative;
    }
    return { raw, computed, narrative };
  }
  // Disk에 없으면 — corp_code(8자리)면 DART live fetch
  if (/^\d{8}$/.test(id)) {
    return fetchLiveAnalysis(id);
  }
  throw new Error(
    `[loadAnalysis] '${id}' 데이터 없음. corp_code 8자리 숫자가 아닌 ID는 ` +
      `src/data/${id}_*.json이 미리 준비돼 있어야 합니다.`
  );
}

/**
 * DART API에서 직접 fetch → raw → computed.
 * narrative는 생성 안 함 (lite mode).
 *
 * Next.js fetch 캐싱 — DART client가 fetch() 사용한다면 자동으로 적용됨.
 * 페이지 단의 revalidate 설정으로 추가 제어 가능.
 */
export async function fetchLiveAnalysis(
  corpCode: string
): Promise<CompanyAnalysis> {
  const years = getDefaultYears();
  const info = await fetchCompanyInfo(corpCode);
  const yearly = await fetchFiveYearStatements(corpCode, years);
  // 데이터 있는 연도만 살림 — 최신 연도가 아직 신고 안 된 회사 graceful 처리.
  const filled = yearly.filter((y) => y.data.length > 0);
  if (filled.length === 0) {
    throw new Error(
      `${info.corp_name}: DART에 K-IFRS 데이터 없음 (금융사·신규 상장사 등 미지원)`
    );
  }
  const reportDate = new Date().toISOString().slice(0, 10);
  const raw = buildRawFromDart(info, filled, reportDate);
  const computed = computeMetrics(raw);
  return { raw, computed };
}

/** 정적 라우트 생성용 — disk에 raw+computed 또는 analysis/narrative가 있으면 잡음. */
export async function listAvailableCompanies(): Promise<string[]> {
  const { readdir } = await import("node:fs/promises");
  const files = await readdir(DATA_DIR);
  const ids = new Set<string>();
  for (const f of files) {
    const m = f.match(/^(.+?)_(analysis|narrative|raw|computed)\.json$/);
    if (m) ids.add(m[1]);
  }
  return Array.from(ids).sort();
}
