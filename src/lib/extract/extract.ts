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

/**
 * Excel → 시트별 TSV. 토큰 절감을 위해 사전 필터링:
 *   - 빈 행 제거
 *   - 숫자가 하나도 없는 행 제거 (순수 헤더·카테고리)
 *   - 단, 회사명·단위·연도 헤더 행은 보존 (라벨에 한글 + 숫자 패턴)
 *
 * 크레탑 엑셀은 시트당 100+ 행 → 50% 이하로 줄임. 추출 속도 개선.
 */
export function excelToText(buffer: ArrayBuffer): string {
  const wb = XLSX.read(buffer, { type: "array" });
  const blocks: string[] = [];
  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false }) as unknown[][];
    const filtered = filterRows(aoa);
    const tsv = filtered.map((row) => row.map(cellToString).join("\t")).join("\n");
    blocks.push(`### Sheet: ${sheetName}\n${tsv}`);
  }
  return blocks.join("\n\n");
}

function cellToString(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  return String(v);
}

const META_KEYWORDS = [
  "회사명", "기업명", "상호", "법인명", "단위", "연도", "결산", "감사",
  "company", "name", "year", "unit", "기", "fy",
];

function isMetaRow(row: unknown[]): boolean {
  const text = row.map(cellToString).join(" ").toLowerCase();
  return META_KEYWORDS.some((k) => text.includes(k.toLowerCase()));
}

function hasNumber(row: unknown[]): boolean {
  for (const cell of row) {
    if (typeof cell === "number" && Number.isFinite(cell)) return true;
    if (typeof cell === "string") {
      // 콤마 포함 숫자, 음수 (1,234), 마이너스 -1234 등
      if (/-?[\d,]+(\.\d+)?/.test(cell.trim()) && /\d/.test(cell)) return true;
    }
  }
  return false;
}

function filterRows(rows: unknown[][]): unknown[][] {
  const result: unknown[][] = [];
  for (const row of rows) {
    if (!row || row.length === 0) continue;
    if (row.every((c) => c == null || c === "")) continue;
    // 메타 행 (회사명·단위·연도 헤더) 또는 숫자 있는 행만 유지
    if (isMetaRow(row) || hasNumber(row)) {
      result.push(row);
    }
  }
  return result;
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
/** 파일명에서 회사명 추출 — 자료 안에 회사명 없는 경우 fallback용 (크레탑 등) */
function inferCompanyNameFromFilename(filename: string): string {
  // .xlsx, .pdf 등 확장자 제거
  let name = filename.replace(/\.[^.]+$/, "");
  // 일반적인 접미사 제거
  name = name.replace(/[_\-\s]?(재무제표|재무|financials?|statements?|cretop|크레탑|export|raw|data|2021|2022|2023|2024|2025).*$/i, "");
  // 끝 공백·특수문자 제거
  name = name.replace(/[\s_\-\.()]+$/, "").trim();
  return name;
}

export async function extractFromFile(
  input:
    | { kind: "excel"; buffer: ArrayBuffer; filename?: string }
    | { kind: "pdf"; buffer: ArrayBuffer; filename?: string }
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

  const filenameHint = input.filename
    ? `\n\n[파일명 힌트] 업로드된 파일명: "${input.filename}". ` +
      `자료 안에 회사명이 없으면 파일명에서 회사명 추출 (확장자·"재무제표"·연도 등 부가어 제외). ` +
      `추정 회사명: "${inferCompanyNameFromFilename(input.filename)}"`
    : "";

  const userPrompt = EXTRACTION_USER_PROMPT + filenameHint;

  const parts: Parameters<typeof model.generateContent>[0] =
    input.kind === "excel"
      ? [{ text: excelToText(input.buffer) }, { text: userPrompt }]
      : [
          {
            inlineData: {
              mimeType: "application/pdf",
              data: Buffer.from(input.buffer).toString("base64"),
            },
          },
          { text: userPrompt },
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

/**
 * 회사명을 URL/파일시스템 안전 slug으로 변환.
 *
 * Vercel /tmp 파일시스템은 한국어 이름에서 인코딩 이슈 발생 가능 →
 * ASCII-only로 보장 (영숫자만). 한국어 회사명은 결정적 hash로 변환.
 *
 * 회사 표시명(raw.meta.company_name)은 한국어 그대로 보존 — slug은 ID 용도만.
 */
export function slugify(name: string): string {
  const asciiBase = name
    .toLowerCase()
    .trim()
    .replace(/[\s/\\]+/g, "-")
    .replace(/[^a-z0-9\-]/g, "") // 한국어·특수문자 제거
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  if (asciiBase.length >= 3) return asciiBase;

  // ASCII slug 너무 짧음 (한국어 회사명) → 결정적 hash
  // 같은 이름은 항상 같은 ID 생성 (재방문 시 같은 데이터 로드)
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash << 5) - hash + name.charCodeAt(i);
    hash |= 0;
  }
  const hashStr = Math.abs(hash).toString(36);
  // 가능하면 ASCII 부분 + 해시 (디버깅·구분 용이)
  return asciiBase ? `${asciiBase}-${hashStr}` : `co-${hashStr}`;
}
