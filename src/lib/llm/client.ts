/**
 * Anthropic Claude API client wrapper for narrative generation.
 *
 * 서버 사이드 전용 — API key는 환경변수 ANTHROPIC_API_KEY에서 읽음.
 * Next.js API route, server action, scripts에서만 import.
 *
 * 모델: Claude Opus 4.7 (claude-opus-4-7)
 * Thinking: adaptive (Opus 4.7는 budget_tokens 제거됨)
 * Effort: high (재무 분석은 intelligence-sensitive)
 *
 * 캐싱:
 *   - cache_control: ephemeral, 5분 TTL
 *   - 2 breakpoints: system 끝 + user 데이터 블록 끝
 *   - 회사당 첫 호출 cache write, 나머지 5번 cache read
 */

import Anthropic from "@anthropic-ai/sdk";
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

const MODEL = "claude-opus-4-7";

let _client: Anthropic | null = null;
function getClient(): Anthropic {
  if (_client) return _client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY 환경변수 필요. .env.local 또는 Vercel env에 설정."
    );
  }
  _client = new Anthropic({ apiKey });
  return _client;
}

export type GenerateOptions = {
  /** debug 로그 출력 */
  verbose?: boolean;
  /** max_tokens (기본 16000, 큰 응답 예상 시 streaming + 64000) */
  maxTokens?: number;
};

export type GenerateResult<T = unknown> = {
  data: T;
  usage: {
    input_tokens: number;
    output_tokens: number;
    cache_creation_input_tokens: number;
    cache_read_input_tokens: number;
  };
  /** raw text response (parsing 실패 디버깅용) */
  raw_text: string;
};

/**
 * 한 section을 LLM으로 생성. JSON 응답을 parse해서 반환.
 *
 * 캐싱 패턴:
 *   - system: SYSTEM_PROMPT (cache breakpoint #1)
 *   - user: [데이터 블록 (cache breakpoint #2), instruction (no cache)]
 *
 * 같은 raw + computed로 다른 section 호출 시 데이터까지 cache hit.
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

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: opts.maxTokens ?? 16000,
    thinking: { type: "adaptive" },
    output_config: { effort: "high" },
    system: [
      {
        type: "text",
        text: SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: dataContext,
            cache_control: { type: "ephemeral" },
          },
          {
            type: "text",
            text: instruction,
          },
        ],
      },
    ],
  });

  // Opus 4.7는 content가 thinking + text 블록 혼합 — text만 추출
  const textBlocks = response.content.filter(
    (b): b is Anthropic.TextBlock => b.type === "text"
  );
  const rawText = textBlocks.map((b) => b.text).join("\n");

  if (opts.verbose) {
    console.log(`[${section}] usage:`, response.usage);
    console.log(`[${section}] raw text preview:`, rawText.slice(0, 200));
  }

  const data = parseJsonResponse<T>(rawText, section);

  return {
    data,
    usage: {
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
      cache_creation_input_tokens:
        response.usage.cache_creation_input_tokens ?? 0,
      cache_read_input_tokens: response.usage.cache_read_input_tokens ?? 0,
    },
    raw_text: rawText,
  };
}

/**
 * LLM 응답에서 JSON 추출 + parse.
 * Claude가 system 지시("코드 fence 없이 JSON만") 어기는 경우도 방어.
 */
function parseJsonResponse<T>(text: string, section: string): T {
  let cleaned = text.trim();
  // ```json ... ``` 또는 ``` ... ``` 제거
  const fenceMatch = cleaned.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  if (fenceMatch) cleaned = fenceMatch[1].trim();
  // 앞뒤 prose 제거 — 첫 { 부터 마지막 } 까지 추출
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
