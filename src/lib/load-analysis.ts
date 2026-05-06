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

const LIVE_YEARS = [2020, 2021, 2022, 2023, 2024];

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
  const info = await fetchCompanyInfo(corpCode);
  const yearly = await fetchFiveYearStatements(corpCode, LIVE_YEARS);
  const filledYears = yearly.filter((y) => y.data.length > 0).length;
  if (filledYears === 0) {
    throw new Error(
      `${info.corp_name}: DART에 5개년 K-IFRS 데이터 없음 (금융사·신규 상장사 등 미지원)`
    );
  }
  const reportDate = new Date().toISOString().slice(0, 10);
  const raw = buildRawFromDart(info, yearly, reportDate);
  const computed = computeMetrics(raw);
  return { raw, computed };
}

/** 정적 라우트 생성용 — 데이터 디렉토리에서 사용 가능한 ID 목록 추출. */
export async function listAvailableCompanies(): Promise<string[]> {
  const { readdir } = await import("node:fs/promises");
  const files = await readdir(DATA_DIR);
  const ids = new Set<string>();
  for (const f of files) {
    const m = f.match(/^(.+?)_(analysis|narrative)\.json$/);
    if (m) ids.add(m[1]);
  }
  return Array.from(ids).sort();
}
