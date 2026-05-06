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
import { generateNarrative } from "@/lib/llm/generate";

const DATA_DIR = path.join(process.cwd(), "src", "data");

export async function analyzeCompany(formData: FormData): Promise<void> {
  const corpCode = String(formData.get("corp_code") ?? "").trim();

  if (!/^\d{8}$/.test(corpCode)) {
    redirect(
      `/?error=${encodeURIComponent("corp_code는 8자리 숫자여야 합니다 (예: 00126380 = 삼성전자)")}`
    );
  }

  redirect(`/company/${corpCode}`);
}

export async function generateAnalysis(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "").trim();
  if (!id) redirect("/?error=missing-id");

  let analysis;
  try {
    analysis = await loadAnalysis(id);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    redirect(`/company/${id}?error=${encodeURIComponent(msg.slice(0, 200))}`);
  }

  try {
    const { narrative } = await generateNarrative(
      analysis.raw,
      analysis.computed,
      { verbose: false }
    );
    await mkdir(DATA_DIR, { recursive: true });
    await writeFile(
      path.join(DATA_DIR, `${id}_narrative.json`),
      JSON.stringify(narrative, null, 2),
      "utf8"
    );
    revalidatePath(`/company/${id}`);
  } catch (e) {
    if (e instanceof Error && e.message.startsWith("NEXT_REDIRECT")) throw e;
    const msg = e instanceof Error ? e.message : String(e);
    redirect(
      `/company/${id}?error=${encodeURIComponent(`narrative 생성 실패: ${msg.slice(0, 200)}`)}`
    );
  }

  redirect(`/company/${id}`);
}
