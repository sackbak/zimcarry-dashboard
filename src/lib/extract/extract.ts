/**
 * PDF·Excel → RawCompanyData 추출.
 *
 * Excel: xlsx로 sheet들을 TSV 텍스트로 변환 후 LLM에 전달.
 * PDF: 바이너리를 base64로 변환 후 Gemini inlineData로 전달.
 *
 * 두 경로 모두 같은 EXTRACTION_USER_PROMPT 사용 → 같은 RawCompanyData JSON 반환.
 */

import * as XLSX from "xlsx";
import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  EXTRACTION_SYSTEM_PROMPT,
  EXTRACTION_USER_PROMPT,
} from "@/lib/extract/prompt";
import type { RawCompanyData } from "@/types/CompanyAnalysis";

const MODEL = "gemini-2.5-flash";

let _client: GoogleGenerativeAI | null = null;
function getClient(): GoogleGenerativeAI {
  if (_client) return _client;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY 환경변수 필요. .env.local 또는 Vercel env에 설정."
    );
  }
  _client = new GoogleGenerativeAI(apiKey);
  return _client;
}

/** Excel(xlsx/xls) 바이너리 → 모든 sheet의 TSV 표현 */
export function excelToText(buffer: ArrayBuffer): string {
  const wb = XLSX.read(buffer, { type: "array" });
  const blocks: string[] = [];
  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    const tsv = XLSX.utils.sheet_to_csv(ws, { FS: "\t", blankrows: false });
    blocks.push(`### Sheet: ${sheetName}\n${tsv}`);
  }
  return blocks.join("\n\n");
}

export type ExtractResult = {
  raw: RawCompanyData;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
  /** 디버깅용 */
  raw_text: string;
};

/**
 * 파일 내용을 LLM에 보내 RawCompanyData JSON 추출.
 *
 * @param input
 *   - { kind: 'excel', buffer: ArrayBuffer } — xlsx 파일 바이너리
 *   - { kind: 'pdf', buffer: ArrayBuffer } — PDF 바이너리
 */
export async function extractFromFile(
  input:
    | { kind: "excel"; buffer: ArrayBuffer }
    | { kind: "pdf"; buffer: ArrayBuffer }
): Promise<ExtractResult> {
  const client = getClient();
  const model = client.getGenerativeModel({
    model: MODEL,
    systemInstruction: EXTRACTION_SYSTEM_PROMPT,
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.1,
    },
  });

  const parts: Parameters<typeof model.generateContent>[0] =
    input.kind === "excel"
      ? [{ text: excelToText(input.buffer) }, { text: EXTRACTION_USER_PROMPT }]
      : [
          {
            inlineData: {
              mimeType: "application/pdf",
              data: Buffer.from(input.buffer).toString("base64"),
            },
          },
          { text: EXTRACTION_USER_PROMPT },
        ];

  const result = await model.generateContent(parts);
  const response = result.response;
  const text = response.text();
  const usage = response.usageMetadata;

  // JSON 추출 (가끔 코드 펜스 같이 옴)
  let cleaned = text.trim();
  const fenceMatch = cleaned.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  if (fenceMatch) cleaned = fenceMatch[1].trim();
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1);
  }

  const parsed = JSON.parse(cleaned) as RawCompanyData & {
    meta: RawCompanyData["meta"] & { detected_unit?: string };
  };

  // meta 정규화 — 우리 schema에 맞게
  const raw: RawCompanyData = {
    meta: {
      company_name: parsed.meta.company_name,
      fiscal_years: parsed.meta.fiscal_years,
      currency_unit: "백만원",
      report_date: new Date().toISOString().slice(0, 10),
      source: input.kind === "pdf" ? "PDF" : "Manual",
      data_period:
        parsed.meta.fiscal_years.length > 0
          ? `${parsed.meta.fiscal_years[0]}-${parsed.meta.fiscal_years[parsed.meta.fiscal_years.length - 1]}`
          : undefined,
      fiscal_year_end: parsed.meta.fiscal_year_end ?? "12-31",
    },
    company: {
      is_listed: parsed.company?.is_listed ?? false,
      ceo: parsed.company?.ceo || undefined,
      industry: parsed.company?.industry || undefined,
      founded: parsed.company?.founded || undefined,
    },
    financials: parsed.financials,
  };

  return {
    raw,
    usage: {
      input_tokens: usage?.promptTokenCount ?? 0,
      output_tokens: usage?.candidatesTokenCount ?? 0,
    },
    raw_text: text,
  };
}

/** 회사명을 URL slug으로 변환 — Korean·English·숫자만 살리고 -로 잇기. */
export function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[\s/\\]+/g, "-")
    .replace(/[^a-z0-9가-힣\-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  if (base) return base;
  // fallback — 한글 자모 분해 등 처리 어려우면 timestamp
  return `company-${Date.now().toString(36)}`;
}
