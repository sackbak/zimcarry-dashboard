/**
 * Google Gemini API client wrapper for narrative generation.
 *
 * 서버 사이드 전용 — API key는 환경변수 GEMINI_API_KEY에서 읽음.
 *
 * 모델: Gemini 2.5 Flash (gemini-2.5-flash)
 *   - free tier: 1,500 RPD, 15 RPM, 1M TPM
 *   - paid: $0.30/M input, $2.50/M output
 *   - 회사당 ~$0.04 (free tier 안 들어가면 ~56원)
 *
 * JSON 출력: responseMimeType: "application/json"으로 강제.
 * 시스템 프롬프트: systemInstruction 필드 (모델 인스턴스 생성 시).
 *
 * 캐싱: Gemini는 context caching API 별도 제공하지만 32K+ 최소 prefix 필요.
 *   현재 7-call 워크플로우는 prefix가 ~7K라서 캐싱 X — free tier에선 의미 없음.
 *   유료 전환 + 큰 데이터일 때 별도 검토.
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

const MODEL = "gemini-2.5-flash";

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
  const dataContext = buildDataContext(raw, computed);
  const instruction = SECTION_PROMPTS[section];

  const model = client.getGenerativeModel({
    model: MODEL,
    systemInstruction: SYSTEM_PROMPT,
    generationConfig: {
      responseMimeType: "application/json",
      temperature: opts.temperature ?? 0.3,
    },
  });

  // 503 Service Unavailable / 429 Rate Limit 자동 재시도 (exponential backoff).
  const maxRetries = 4;
  let result;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      result = await model.generateContent([
        { text: dataContext },
        { text: instruction },
      ]);
      break;
    } catch (e: unknown) {
      const err = e as { status?: number; message?: string };
      const status = err.status;
      const isRetryable =
        status === 503 || status === 429 || status === 500 || status === 502;
      if (!isRetryable || attempt === maxRetries) throw e;
      const waitMs = Math.min(2 ** attempt * 1000, 16000);
      if (opts.verbose) {
        console.log(
          `  [${section}] ${status} retry ${attempt + 1}/${maxRetries} in ${waitMs}ms...`
        );
      }
      await new Promise((r) => setTimeout(r, waitMs));
    }
  }
  if (!result) throw new Error(`[${section}] result undefined after retries`);

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
 * LLM 응답에서 JSON 추출 + parse.
 * Gemini는 responseMimeType: "application/json"이면 깨끗한 JSON 보내지만
 * 만약을 위해 fence/prose 제거 방어 로직 유지.
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
    return JSON.parse(cleaned) as T;
  } catch (e) {
    throw new Error(
      `[${section}] JSON parse 실패: ${(e as Error).message}\n--- raw ---\n${text.slice(0, 500)}`
    );
  }
}
