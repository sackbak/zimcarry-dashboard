/**
 * Google Gemini API client wrapper for narrative generation.
 *
 * 모델 전략: gemini-2.5-flash 우선, 503 연속 시 gemini-2.0-flash 자동 폴백.
 *   2.5-flash: 최신, 품질 좋음, 서버 불안정 잦음
 *   2.0-flash: 구버전, 안정적, 품질 근접
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  SYSTEM_PROMPT,
  buildDataContext,
  SECTION_PROMPTS,
  type SectionKey,
} from "@/lib/llm/prompts";
import type {
  RawCompanyData,
  ComputedMetrics,
} from "@/types/CompanyAnalysis";

const PRIMARY_MODEL = "gemini-2.5-flash";
const FALLBACK_MODEL = "gemini-2.0-flash";

let _client: GoogleGenerativeAI | null = null;
function getClient(): GoogleGenerativeAI {
  if (_client) return _client;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY 환경변수 필요. .env.local 또는 Vercel env에 설정.\n" +
        "발급: https://aistudio.google.com/app/apikey"
    );
  }
  _client = new GoogleGenerativeAI(apiKey);
  return _client;
}

export type GenerateOptions = {
  /** debug 로그 출력 */
  verbose?: boolean;
  /** temperature (기본 0.3 — narrative 품질 + 약간의 변형 허용) */
  temperature?: number;
};

export type GenerateResult<T = unknown> = {
  data: T;
  usage: {
    input_tokens: number;
    output_tokens: number;
    /** Gemini는 prompt cache 미사용 — 0 고정 */
    cache_read_input_tokens: number;
  };
  /** raw text response (parsing 실패 디버깅용) */
  raw_text: string;
};

/**
 * 한 section을 LLM으로 생성. JSON 응답을 parse해서 반환.
 *
 * Gemini는 매 호출마다 systemInstruction + 데이터 다시 보내야 함 (캐싱 X).
 * Free tier 안에선 비용 무관, paid에서도 회사당 ~$0.04로 부담 없음.
 */
export async function generateSection<T = unknown>(
  section: SectionKey,
  raw: RawCompanyData,
  computed: ComputedMetrics,
  opts: GenerateOptions = {}
): Promise<GenerateResult<T>> {
  const client = getClient();
  const dataContext = buildDataContext(raw, computed, section);
  const instruction = SECTION_PROMPTS[section];

  const makeModel = (modelName: string) =>
    client.getGenerativeModel({
      model: modelName,
      systemInstruction: SYSTEM_PROMPT,
      generationConfig: {
        responseMimeType: "application/json",
        temperature: opts.temperature ?? 0.3,
      },
    });

  // 전략: primary(2.5) 2회 시도 → 503/500/502 계속이면 fallback(2.0)으로 전환.
  // 429(rate limit)는 잠깐 기다렸다 재시도.
  let result;
  let lastError: unknown;
  for (const modelName of [PRIMARY_MODEL, FALLBACK_MODEL]) {
    const model = makeModel(modelName);
    const maxAttempts = 2;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        result = await model.generateContent([
          { text: dataContext },
          { text: instruction },
        ]);
        if (opts.verbose && modelName !== PRIMARY_MODEL) {
          console.log(`  [${section}] fallback → ${modelName} succeeded`);
        }
        break;
      } catch (e: unknown) {
        lastError = e;
        const err = e as { status?: number; message?: string };
        const status = err.status;
        if (status === 429) {
          // rate limit — 잠깐 기다렸다 재시도
          await new Promise((r) => setTimeout(r, 3000));
          continue;
        }
        if (status === 503 || status === 500 || status === 502) {
          if (opts.verbose) {
            console.log(`  [${section}] ${modelName} ${status}, attempt ${attempt + 1}/${maxAttempts}`);
          }
          // 첫 번째 시도면 1초 대기 후 재시도, 두 번째면 다음 모델로
          if (attempt === 0) {
            await new Promise((r) => setTimeout(r, 1000));
            continue;
          }
          break; // 다음 모델(fallback)로 넘어감
        }
        throw e; // 그 외 에러는 즉시 throw
      }
    }
    if (result) break;
  }
  if (!result) throw lastError ?? new Error(`[${section}] all models failed`);

  const response = result.response;
  const rawText = response.text();
  const usage = response.usageMetadata;

  if (opts.verbose) {
    console.log(`[${section}] usage:`, {
      prompt: usage?.promptTokenCount,
      output: usage?.candidatesTokenCount,
      total: usage?.totalTokenCount,
    });
    console.log(`[${section}] raw text preview:`, rawText.slice(0, 200));
  }

  const data = parseJsonResponse<T>(rawText, section);

  return {
    data,
    usage: {
      input_tokens: usage?.promptTokenCount ?? 0,
      output_tokens: usage?.candidatesTokenCount ?? 0,
      cache_read_input_tokens: 0,
    },
    raw_text: rawText,
  };
}

/**
 * narrative 텍스트에서 잘못된 마크업 정리.
 *  - "==red==text==red==" → "==text=="
 *  - "==red==text" (closing 없음) → "==text=="  (가능한 경우)
 *  - "**bold**" → "bold"
 *  - "*italic*" → "italic"
 */
function sanitizeMarkup<T>(value: T): T {
  if (typeof value === "string") {
    let s: string = value;
    // ==red==text==red== 류 HTML 태그 흉내 제거
    s = s.replace(/==red==/gi, "==");
    s = s.replace(/==danger==/gi, "==");
    s = s.replace(/==warning==/gi, "==");
    // == 가 4번 연속이면 빈 강조 → 제거
    s = s.replace(/====/g, "");
    // ** *  마크다운 마커 제거 (텍스트는 유지)
    s = s.replace(/\*\*([^*]+)\*\*/g, "$1");
    s = s.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, "$1");
    return s as unknown as T;
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeMarkup) as unknown as T;
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = sanitizeMarkup(v);
    }
    return out as T;
  }
  return value;
}

/**
 * LLM 응답에서 JSON 추출 + parse + 마크업 정리.
 */
function parseJsonResponse<T>(text: string, section: string): T {
  let cleaned = text.trim();
  const fenceMatch = cleaned.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  if (fenceMatch) cleaned = fenceMatch[1].trim();
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace > 0 || lastBrace < cleaned.length - 1) {
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      cleaned = cleaned.slice(firstBrace, lastBrace + 1);
    }
  }
  try {
    const parsed = JSON.parse(cleaned) as T;
    return sanitizeMarkup(parsed);
  } catch (e) {
    throw new Error(
      `[${section}] JSON parse 실패: ${(e as Error).message}\n--- raw ---\n${text.slice(0, 500)}`
    );
  }
}
