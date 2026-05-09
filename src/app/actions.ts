"use server";

/**
 * Server Actions
 *
 * 1. analyzeCompany — corp_code 검증 후 /company/<id>로 redirect.
 *    실제 DART 호출 + 변환은 /company/[corp_code]/page.tsx가 진입 시 수행.
 * 2. generateAnalysis — LLM narrative 생성 (Gemini 7회 호출, 약 2~3분).
 *    raw + computed → narrative → src/data/<id>_narrative.json 저장.
 *
 * 주의: Vercel serverless filesystem이 휘발이므로 prod에선 narrative 저장이
 *   다음 콜드 스타트에서 사라짐. 로컬 dev에선 영구 저장. prod는 Vercel KV
 *   같은 외부 storage 추후 도입 예정.
 */

import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { loadAnalysis } from "@/lib/load-analysis";
import { generateMainOnly, generateInsightsOnly } from "@/lib/llm/generate";
import type { CompanyNarrative, PageNarrative } from "@/types/CompanyAnalysis";
import { extractFromFile, slugify } from "@/lib/extract/extract";
import { computeMetrics } from "@/lib/computed";

const DATA_DIR = path.join(process.cwd(), "src", "data");
// Vercel Lambda: bundle dir is read-only; use /tmp for runtime writes
const WRITE_DIR = process.env.VERCEL ? "/tmp/zimcarry-data" : DATA_DIR;

/**
 * 비상장사 PDF/Excel 업로드 → LLM 추출 → raw + computed 저장 → /company/<slug> 리다이렉트.
 *
 * 비용: PDF ~15원, Excel은 텍스트 변환 후 LLM 호출이라 ~10원 (Gemini 2.5 Flash).
 * narrative는 따로 — /company/<slug>에서 "AI 분석 생성" 버튼으로.
 */
export async function uploadCompanyFile(formData: FormData): Promise<void> {
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) {
    redirect(`/?error=${encodeURIComponent("파일을 선택해주세요")}`);
  }
  if (file.size > 20 * 1024 * 1024) {
    redirect(`/?error=${encodeURIComponent("파일은 20MB 이하만 가능")}`);
  }

  const name = file.name.toLowerCase();
  const isPdf = name.endsWith(".pdf") || file.type === "application/pdf";
  const isExcel =
    name.endsWith(".xlsx") ||
    name.endsWith(".xls") ||
    file.type.includes("sheet") ||
    file.type.includes("excel");
  if (!isPdf && !isExcel) {
    redirect(
      `/?error=${encodeURIComponent("PDF(.pdf) 또는 Excel(.xlsx, .xls)만 가능")}`
    );
  }

  const buffer = await file.arrayBuffer();

  let extracted;
  try {
    extracted = await extractFromFile({
      kind: isPdf ? "pdf" : "excel",
      buffer,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    redirect(
      `/?error=${encodeURIComponent(`추출 실패: ${msg.slice(0, 200)}`)}`
    );
  }

  const { raw } = extracted;
  if (!raw.meta.company_name || raw.meta.fiscal_years.length === 0) {
    redirect(
      `/?error=${encodeURIComponent("회사명·연도 추출 실패. 명확한 재무 자료인지 확인 필요.")}`
    );
  }

  const computed = computeMetrics(raw);
  const id = slugify(raw.meta.company_name);

  await mkdir(WRITE_DIR, { recursive: true });
  await Promise.all([
    writeFile(
      path.join(WRITE_DIR, `${id}_raw.json`),
      JSON.stringify(raw, null, 2),
      "utf8"
    ),
    writeFile(
      path.join(WRITE_DIR, `${id}_computed.json`),
      JSON.stringify(computed, null, 2),
      "utf8"
    ),
  ]);
  revalidatePath(`/company/${id}`);
  redirect(`/company/${id}`);
}

export async function analyzeCompany(formData: FormData): Promise<void> {
  const corpCode = String(formData.get("corp_code") ?? "").trim();

  if (!/^\d{8}$/.test(corpCode)) {
    redirect(
      `/?error=${encodeURIComponent("corp_code는 8자리 숫자여야 합니다 (예: 00126380 = 삼성전자)")}`
    );
  }

  redirect(`/company/${corpCode}`);
}

const STUB_PAGE: PageNarrative = {
  headline: "",
  message: "",
  insight: { conclusion: "", evidence: [], reasoning: "" },
};

/** 1단계: top_verdict + categories 생성 후 partial 저장 */
export async function generateMain(
  id: string
): Promise<{ ok: boolean; error?: string }> {
  let analysis;
  try {
    analysis = await loadAnalysis(id);
  } catch (e) {
    return { ok: false, error: (e instanceof Error ? e.message : String(e)).slice(0, 200) };
  }
  try {
    const { result } = await generateMainOnly(analysis.raw, analysis.computed);
    const partial: CompanyNarrative = {
      top_verdict: result.top_verdict,
      categories: result.categories,
      pages: { dashboard: STUB_PAGE, balance_sheet: STUB_PAGE, income_statement: STUB_PAGE, cash_flow: STUB_PAGE },
      partial: true,
    };
    await mkdir(WRITE_DIR, { recursive: true });
    await writeFile(path.join(WRITE_DIR, `${id}_narrative.json`), JSON.stringify(partial, null, 2), "utf8");
    revalidatePath(`/company/${id}`, "layout");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e instanceof Error ? e.message : String(e)).slice(0, 200) };
  }
}

/** 2단계: 4개 탭 insight 생성 후 기존 narrative에 병합 저장 */
export async function generateInsights(
  id: string
): Promise<{ ok: boolean; error?: string }> {
  let analysis;
  try {
    analysis = await loadAnalysis(id);
  } catch (e) {
    return { ok: false, error: (e instanceof Error ? e.message : String(e)).slice(0, 200) };
  }
  if (!analysis.narrative) return { ok: false, error: "1단계 먼저 실행 필요" };
  try {
    const { result } = await generateInsightsOnly(analysis.raw, analysis.computed);
    const full: CompanyNarrative = {
      ...analysis.narrative,
      pages: result,
      partial: false,
    };
    await mkdir(WRITE_DIR, { recursive: true });
    await writeFile(path.join(WRITE_DIR, `${id}_narrative.json`), JSON.stringify(full, null, 2), "utf8");
    revalidatePath(`/company/${id}`, "layout");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e instanceof Error ? e.message : String(e)).slice(0, 200) };
  }
}
