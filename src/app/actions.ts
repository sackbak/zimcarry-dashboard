"use server";

/**
 * Server Actions
 *
 * 1. uploadCompanyFile — 비상장사 PDF/Excel 업로드 → 추출 → /company/<slug>로 redirect
 * 2. analyzeCompany — corp_code 검증 후 /company/<id>로 redirect
 * 3. generateDashboard — top_verdict + categories + dashboard insight 생성
 * 4. generateBSAnalysis / generateISAnalysis / generateCFAnalysis — 각 탭 insight 생성
 *
 * 각 LLM 액션은 독립적인 60초 budget. 작은 호출이라 절대 타임아웃 없음.
 */

import { writeFile, mkdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { loadAnalysis } from "@/lib/load-analysis";
import {
  generateDashboardFull,
  generateBSInsight,
  generateISInsight,
  generateCFInsight,
  generateInvestmentInsight,
} from "@/lib/llm/generate";
import { extractFromFile, slugify } from "@/lib/extract/extract";
import { computeMetrics } from "@/lib/computed";
import type { CompanyNarrative } from "@/types/CompanyAnalysis";

const DATA_DIR = path.join(process.cwd(), "src", "data");
const WRITE_DIR = process.env.VERCEL ? "/tmp/zimcarry-data" : DATA_DIR;

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
    redirect(`/?error=${encodeURIComponent("PDF(.pdf) 또는 Excel(.xlsx, .xls)만 가능")}`);
  }

  const buffer = await file.arrayBuffer();

  let extracted;
  try {
    extracted = await extractFromFile({
      kind: isPdf ? "pdf" : "excel",
      buffer,
      filename: file.name,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    redirect(`/?error=${encodeURIComponent(`추출 실패: ${msg.slice(0, 200)}`)}`);
  }

  const { raw } = extracted;
  // 구체적 에러 — 무엇이 비어있는지 알려줌
  const missing: string[] = [];
  if (!raw.meta.company_name) missing.push("회사명");
  if (raw.meta.fiscal_years.length === 0) missing.push("연도");
  const isFin = raw.financials.income_statement.revenue?.some((v) => v != null);
  const bsFin = raw.financials.balance_sheet.total_assets?.some((v) => v != null);
  if (!isFin && !bsFin) missing.push("재무제표 (매출·자산 모두 없음)");

  if (missing.length > 0) {
    const detected = [
      raw.meta.company_name && `회사명='${raw.meta.company_name}'`,
      raw.meta.fiscal_years.length > 0 && `연도=[${raw.meta.fiscal_years.join(",")}]`,
      isFin && "손익계산서 OK",
      bsFin && "재무상태표 OK",
    ]
      .filter(Boolean)
      .join(" / ") || "없음";
    redirect(
      `/?error=${encodeURIComponent(
        `추출 실패: 누락 항목 = ${missing.join(", ")}. ` +
          `추출된 것: ${detected}. 자료에 명시 안 되어 있을 수 있음.`
      )}`
    );
  }

  const computed = computeMetrics(raw);
  const id = slugify(raw.meta.company_name);

  await mkdir(WRITE_DIR, { recursive: true });
  await Promise.all([
    writeFile(path.join(WRITE_DIR, `${id}_raw.json`), JSON.stringify(raw, null, 2), "utf8"),
    writeFile(path.join(WRITE_DIR, `${id}_computed.json`), JSON.stringify(computed, null, 2), "utf8"),
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

// ─────────────────────────────────────────────────────────────────
// AI 분석 — 탭별 독립 생성
// ─────────────────────────────────────────────────────────────────

async function loadExistingNarrative(id: string): Promise<CompanyNarrative> {
  const filenames = [`${id}_narrative.json`];
  const dirs = WRITE_DIR !== DATA_DIR ? [WRITE_DIR, DATA_DIR] : [DATA_DIR];
  for (const dir of dirs) {
    for (const f of filenames) {
      const p = path.join(dir, f);
      if (existsSync(p)) {
        try {
          return JSON.parse(await readFile(p, "utf8")) as CompanyNarrative;
        } catch {
          // ignore parse errors
        }
      }
    }
  }
  return {};
}

async function saveNarrative(id: string, narrative: CompanyNarrative): Promise<void> {
  await mkdir(WRITE_DIR, { recursive: true });
  await writeFile(
    path.join(WRITE_DIR, `${id}_narrative.json`),
    JSON.stringify(narrative, null, 2),
    "utf8"
  );
  revalidatePath(`/company/${id}`, "layout");
}

/** 대시보드: top_verdict + 5카테고리 + dashboard insight 한 번에 생성 (form action) */
export async function generateDashboardAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "").trim();
  if (!id) redirect("/?error=missing-id");

  let analysis;
  try {
    analysis = await loadAnalysis(id);
  } catch (e) {
    const msg = (e instanceof Error ? e.message : String(e)).slice(0, 200);
    redirect(`/company/${id}?error=${encodeURIComponent(msg)}`);
  }

  try {
    const result = await generateDashboardFull(analysis.raw, analysis.computed);
    const existing = await loadExistingNarrative(id);
    const merged: CompanyNarrative = {
      ...existing,
      top_verdict: result.top_verdict,
      categories: result.categories,
      pages: { ...existing.pages, dashboard: result.dashboard },
    };
    await saveNarrative(id, merged);
  } catch (e) {
    if (e instanceof Error && e.message.startsWith("NEXT_REDIRECT")) throw e;
    const msg = (e instanceof Error ? e.message : String(e)).slice(0, 200);
    redirect(`/company/${id}?error=${encodeURIComponent(`대시보드 생성 실패: ${msg}`)}`);
  }
}

async function generateTabAction(
  formData: FormData,
  tab: "balance_sheet" | "income_statement" | "cash_flow" | "investment"
): Promise<void> {
  const id = String(formData.get("id") ?? "").trim();
  if (!id) redirect("/?error=missing-id");

  let analysis;
  try {
    analysis = await loadAnalysis(id);
  } catch (e) {
    const msg = (e instanceof Error ? e.message : String(e)).slice(0, 200);
    redirect(`/company/${id}?error=${encodeURIComponent(msg)}`);
  }

  try {
    let pageNarrative;
    let itemNotes: Record<string, import("@/types/CompanyAnalysis").ItemNote> | undefined;
    if (tab === "balance_sheet") {
      const r = await generateBSInsight(analysis.raw, analysis.computed);
      itemNotes = r.item_notes;
      const { item_notes: _omit, ...rest } = r;
      pageNarrative = rest;
    } else if (tab === "income_statement") {
      const r = await generateISInsight(analysis.raw, analysis.computed);
      itemNotes = r.item_notes;
      const { item_notes: _omit, ...rest } = r;
      pageNarrative = rest;
    } else if (tab === "cash_flow") {
      pageNarrative = await generateCFInsight(analysis.raw, analysis.computed);
    } else {
      pageNarrative = await generateInvestmentInsight(analysis.raw, analysis.computed);
    }
    const existing = await loadExistingNarrative(id);
    const existingItems = existing.item_notes ?? { income: {}, balance: {} };
    const merged: CompanyNarrative = {
      ...existing,
      pages: { ...existing.pages, [tab]: pageNarrative },
      item_notes: itemNotes
        ? {
            income: tab === "income_statement" ? itemNotes : existingItems.income,
            balance: tab === "balance_sheet" ? itemNotes : existingItems.balance,
          }
        : existing.item_notes,
    };
    await saveNarrative(id, merged);
  } catch (e) {
    if (e instanceof Error && e.message.startsWith("NEXT_REDIRECT")) throw e;
    const msg = (e instanceof Error ? e.message : String(e)).slice(0, 200);
    redirect(`/company/${id}?error=${encodeURIComponent(`${tab} 생성 실패: ${msg}`)}`);
  }
}

export async function generateBSAction(formData: FormData) {
  return generateTabAction(formData, "balance_sheet");
}
export async function generateISAction(formData: FormData) {
  return generateTabAction(formData, "income_statement");
}
export async function generateCFAction(formData: FormData) {
  return generateTabAction(formData, "cash_flow");
}
export async function generateInvestmentAction(formData: FormData) {
  return generateTabAction(formData, "investment");
}
