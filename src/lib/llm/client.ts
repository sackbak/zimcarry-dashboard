/**
 * LLM client — narrative generation.
 *
 * 폴백 체인 (앞에서 실패하면 다음으로):
 *   1. gemini-2.5-flash  (GEMINI_API_KEY 필수)
 *   2. gemini-2.0-flash  (같은 키, 더 안정적)
 *   3. gpt-4o-mini       (OPENAI_API_KEY 있을 때만 활성화)
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";
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

const GEMINI_PRIMARY = "gemini-2.5-flash";
const GEMINI_FALLBACK = "gemini-2.5-flash-lite";
const GPT_MODEL = "gpt-4o-mini";

let _gemini: GoogleGenerativeAI | null = null;
function getGeminiClient(): GoogleGenerativeAI {
  if (_gemini) return _gemini;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY 환경변수 필요. .env.local 또는 Vercel env에 설정.\n" +
        "발급: https://aistudio.google.com/app/apikey"
    );
  }
  _gemini = new GoogleGenerativeAI(apiKey);
  return _gemini;
}

let _openai: OpenAI | null = null;
function getOpenAIClient(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null; // 키 없으면 폴백 비활성화
  if (!_openai) _openai = new OpenAI({ apiKey });
  return _openai;
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
  const dataContext = buildDataContext(raw, computed, section);
  const instruction = SECTION_PROMPTS[section];

  let rawText = "";
  let inputTokens = 0;
  let outputTokens = 0;
  let lastError: unknown;
  let succeeded = false;

  // ── Gemini 우선 (2.5-flash → 2.5-flash-lite) ──────────────────────
  const gemini = getGeminiClient();
  const makeGeminiModel = (modelName: string) =>
    gemini.getGenerativeModel({
      model: modelName,
      systemInstruction: SYSTEM_PROMPT,
      generationConfig: {
        responseMimeType: "application/json",
        temperature: opts.temperature ?? 0.3,
      },
    });

  const geminiModels = [GEMINI_PRIMARY, GEMINI_FALLBACK];
  for (let mi = 0; mi < geminiModels.length; mi++) {
    const modelName = geminiModels[mi];
    const isLast = mi === geminiModels.length - 1;
    const model = makeGeminiModel(modelName);
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const result = await model.generateContent([
          { text: dataContext },
          { text: instruction },
        ]);
        if (opts.verbose && mi > 0) console.log(`  [${section}] fallback → ${modelName} succeeded`);
        rawText = result.response.text();
        inputTokens = result.response.usageMetadata?.promptTokenCount ?? 0;
        outputTokens = result.response.usageMetadata?.candidatesTokenCount ?? 0;
        succeeded = true;
        break;
      } catch (e: unknown) {
        lastError = e;
        const status = (e as { status?: number }).status;
        if (opts.verbose) console.log(`  [${section}] ${modelName} ${status ?? "err"} attempt ${attempt + 1}`);
        if (status === 429) { await new Promise((r) => setTimeout(r, 3000)); continue; }
        if (status === 503 || status === 500 || status === 502) {
          if (attempt === 0) { await new Promise((r) => setTimeout(r, 1000)); continue; }
          break;
        }
        if (isLast) throw e;
        break;
      }
    }
    if (succeeded) break;
  }

  // ── GPT-4o-mini 최후 폴백 (OPENAI_API_KEY 있을 때) ────────────────
  if (!succeeded) {
    const openai = getOpenAIClient();
    if (openai) {
      if (opts.verbose) console.log(`  [${section}] Gemini 전부 실패 → gpt-4o-mini 시도`);
      const completion = await openai.chat.completions.create({
        model: GPT_MODEL,
        temperature: opts.temperature ?? 0.3,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `${dataContext}\n\n${instruction}` },
        ],
      });
      rawText = completion.choices[0].message.content ?? "{}";
      inputTokens = completion.usage?.prompt_tokens ?? 0;
      outputTokens = completion.usage?.completion_tokens ?? 0;
      succeeded = true;
    }
  }

  if (!succeeded) throw lastError ?? new Error(`[${section}] 모든 모델 실패`);

  if (opts.verbose) {
    console.log(`[${section}] usage: input=${inputTokens} output=${outputTokens}`);
    console.log(`[${section}] raw text preview:`, rawText.slice(0, 200));
  }

  const data = parseJsonResponse<T>(rawText, section);

  return {
    data,
    usage: {
      input_tokens: inputTokens,
      output_tokens: outputTokens,
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
    // == 태그 흉내 제거
    s = s.replace(/==red==/gi, "==");
    s = s.replace(/==danger==/gi, "==");
    s = s.replace(/==warning==/gi, "==");
    s = s.replace(/====/g, "");
    // ++ 태그 흉내 제거
    s = s.replace(/\+\+(green|positive|blue|good)\+\+/gi, "++");
    s = s.replace(/\+\+\+\+/g, "");
    // ** * 마크다운 마커 제거 (++/== 마커는 RichText가 처리하므로 보존)
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
