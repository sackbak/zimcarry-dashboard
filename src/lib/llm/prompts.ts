/**
 * LLM prompts for narrative generation.
 *
 * 캐싱 전략 — 6번 호출에서 system + 입력 데이터는 동일, instruction만 변함.
 * Cache breakpoint 2개:
 *   1. system 프롬프트 끝 (frozen)
 *   2. user message의 데이터 블록 (per-company, frozen across 6 calls)
 *
 * 첫 호출이 cache write (~1.25×), 나머지 5번이 cache read (~0.1×).
 */

import type {
  RawCompanyData,
  ComputedMetrics,
} from "@/types/CompanyAnalysis";

// ────────────────────────────────────────────────────────────────────
// System prompt (frozen — first cache breakpoint here)
// ────────────────────────────────────────────────────────────────────

export const SYSTEM_PROMPT = `당신은 한국 회계사 + 사모펀드/M&A 임원 시각으로 회사 재무를 분석하는 전문가입니다.

원칙:
1. 데이터 근거 없는 추측 금지. evidence는 반드시 입력 데이터에서 파생된 사실.
2. 비전공자도 이해할 수 있는 표현 + 회계 용어 정확성 둘 다 만족.
3. 마크업 — 위험 신호 강조에만 == 양쪽으로 감싸기:
   올바른 형식: 텍스트를 ==강조할 부분== 식으로 양쪽 ==로 감싼다.
   올바른 예: "매출이 ==감소세 진입==하여 ==자본잠식 위험==이 커짐"
   잘못된 예 (절대 금지):
     - "==red==매출 감소==red==" (HTML/Markdown 스타일 태그 X)
     - "==red==현금 감소" (opening만 있고 closing 없음 X)
     - "==text===red==" (== 중첩 X)
   그 외 일체의 마크다운(**bold**, *italic*, # heading, - list 등) 절대 사용 금지. 평문으로만 작성.
4. K-IFRS 한국 회계 기준. 한국 상법/세법 맥락.
5. 길이 제약 엄수 (각 prompt별 지정).
6. 출력은 반드시 지정된 JSON만. 다른 설명 텍스트 일절 금지. JSON 전후로 코드 fence(\`\`\`)도 붙이지 않음.

중요:
- 모든 숫자 표현은 단위 명시 (조/억/백만원/% 등).
- formatted_financials의 값은 이미 한국식으로 변환된 문자열 (예: "258.94조", "65,669.76억").
  narrative에 금액 인용 시 이 문자열을 그대로 사용. 직접 단위 변환 금지.
- 증감률/비율(%)이나 ratio 계산은 computed.ratios 사용 OK (이건 단위 변환 아님).
- "X억 백만원" 같은 단위 중복 절대 금지.
- evidence는 3~5개, 각 항목은 한 줄 안에 데이터 + 짧은 의미.
- reasoning은 2~3문장 narrative.
- accounting/mna/monitoring 각 2~4개.
- 회사 invariant한 분석 — 회사 이름이나 산업에 종속되지 않은 일반 프레임 적용.`;

// ────────────────────────────────────────────────────────────────────
// User message — 데이터 블록 (per-company frozen, second cache breakpoint)
// ────────────────────────────────────────────────────────────────────

/**
 * 백만원 단위 값을 한국식 표기로 변환.
 *   1조 이상 → "X.XX조"
 *   1억 이상 ~ 1조 미만 → "X.XX억"
 *   1억 미만 → "X백만원"
 *   null/undefined → "—"
 *
 * LLM은 단위 변환에 일관성이 떨어져서 (큰 숫자는 맞고 중간 숫자는 틀림),
 * pre-format해서 같이 넘긴다. LLM은 이 문자열을 그대로 인용만 하면 됨.
 */
function formatBaekman(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  const abs = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  if (abs >= 1_000_000) {
    return `${sign}${(abs / 1_000_000).toFixed(2)}조`;
  }
  if (abs >= 100) {
    return `${sign}${(abs / 100).toFixed(2)}억`;
  }
  return `${sign}${abs.toFixed(0)}백만원`;
}

/**
 * 재무 라인아이템 배열 → 연도별 formatted string lookup.
 *   { revenue: ["236.81조", "279.60조", ...], ... }
 */
function formatFinancialBlock(
  block: Record<string, unknown>
): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [key, val] of Object.entries(block)) {
    if (Array.isArray(val) && val.every((x) => x == null || typeof x === "number")) {
      out[key] = (val as (number | null)[]).map(formatBaekman);
    }
  }
  return out;
}

/**
 * Section별로 LLM에 보낼 데이터 슬라이스. 무관한 부분은 제거해 입력 토큰을 약 50% 절감.
 *   - formatted_financials: 어떤 statement만 보낼지
 *   - per_item: income/balance 중 하나만 (또는 둘 다 안 보냄)
 *   - ratios/derived_cf/top_kpis: 필요한 호출에만
 */
type ContextScope = {
  fin: ("income_statement" | "balance_sheet" | "cash_flow_raw")[];
  ratios: boolean;
  derived_cf: boolean;
  top_kpis: boolean;
  per_item: "income" | "balance" | null;
};

const SCOPES: Record<string, ContextScope> = {
  top_verdict_and_categories: {
    fin: ["income_statement", "balance_sheet", "cash_flow_raw"],
    ratios: true,
    derived_cf: true,
    top_kpis: true,
    per_item: null,
  },
  dashboard_insight: {
    fin: ["income_statement", "balance_sheet", "cash_flow_raw"],
    ratios: true,
    derived_cf: true,
    top_kpis: true,
    per_item: null,
  },
  bs_insight: {
    fin: ["income_statement", "balance_sheet"],
    ratios: true,
    derived_cf: true,
    top_kpis: false,
    per_item: "balance",
  },
  is_insight: {
    fin: ["income_statement"],
    ratios: true,
    derived_cf: true,
    top_kpis: false,
    per_item: "income",
  },
  cf_insight: {
    fin: ["income_statement", "cash_flow_raw"],
    ratios: true,
    derived_cf: true,
    top_kpis: false,
    per_item: null,
  },
  item_notes_income: {
    fin: ["income_statement"],
    ratios: false,
    derived_cf: false,
    top_kpis: false,
    per_item: "income",
  },
  item_notes_balance: {
    fin: ["balance_sheet"],
    ratios: false,
    derived_cf: false,
    top_kpis: false,
    per_item: "balance",
  },
};

export function buildDataContext(
  raw: RawCompanyData,
  computed: ComputedMetrics,
  section: string = "top_verdict_and_categories"
): string {
  const scope = SCOPES[section] ?? SCOPES.top_verdict_and_categories;

  const fin: Record<string, Record<string, string[]>> = {};
  for (const k of scope.fin) {
    const block = raw.financials[k];
    if (block) {
      fin[k] = formatFinancialBlock(block as unknown as Record<string, unknown>);
    }
  }

  const computedSlice: Record<string, unknown> = {};
  if (scope.ratios) computedSlice.ratios = computed.ratios;
  if (scope.derived_cf) computedSlice.derived_cf = computed.derived_cf;
  if (scope.top_kpis) computedSlice.top_kpis = computed.top_kpis;
  if (scope.per_item) {
    computedSlice.per_item = { [scope.per_item]: computed.per_item[scope.per_item] };
  }

  return `<company>
${JSON.stringify({ meta: raw.meta, profile: raw.company }, null, 2)}
</company>

<formatted_financials>
※ 각 line item을 한국식 단위로 변환된 문자열 lookup. narrative에 금액 인용 시 그대로 사용.
※ 연도 인덱스는 meta.fiscal_years와 동일 (0=첫 해, 마지막=최신).
${JSON.stringify(fin, null, 2)}
</formatted_financials>

<computed_metrics>
${JSON.stringify(computedSlice, null, 2)}
</computed_metrics>`;
}

// ────────────────────────────────────────────────────────────────────
// Per-section instruction prompts (variable — placed AFTER cache breakpoint)
// ────────────────────────────────────────────────────────────────────

export const PROMPT_TOP_VERDICT_AND_CATEGORIES = `위 데이터를 보고 다음 JSON을 출력하세요.

{
  "top_verdict": {
    "signal": "green" | "yellow" | "red",
    "label": "🟢 양호" | "🟡 전환기" | "🔴 위험" 등 한 단어 라벨,
    "summary": "<1문장 종합 진단>",
    "key_question": "<투자/M&A 관점 핵심 질문 1개>",
    "scenarios": {
      "bullish": "<1문장>",
      "base": "<1문장>",
      "bearish": "<1문장>"
    }
  },
  "categories": [
    {
      "name": "성장성",
      "signal": "green" | "yellow" | "red",
      "summary": "🟢 우수" 류 한 단어 라벨,
      "comment": "<1~2문장 RichText>",
      "kpi_refs": ["computed.ratios의 키 또는 top_kpis의 label"]
    },
    { "name": "수익성", ... },
    { "name": "안정성", ... },
    { "name": "활동성", ... },
    { "name": "현금흐름", ... }
  ]
}

판단 기준:
- top_verdict.signal: 5개 카테고리 신호 종합. 자본잠식 한번이라도 있으면 최소 yellow.
- categories[].signal: 단순 평균 X. 자본잠식·이자보상 음수 같은 critical은 yellow/red 강제.
- key_question은 "투자 베팅 포인트가 무엇인가?" 류 1줄 질문.`;

export const PROMPT_DASHBOARD_INSIGHT = `위 데이터를 보고 dashboard 페이지의 종합 insight를 다음 JSON으로 출력.

{
  "headline": "<1줄, 가장 두드러진 테마. 위험 부분만 ==강조text== 식으로 감싸기. ==red== 같은 태그 형식 금지. bold/italic/heading 등 일체 금지. 80자 이내>",
  "message": "<1~2문장 보조 설명>",
  "insight": {
    "conclusion": "<1~2문장 페이지 종합 결론>",
    "evidence": ["<3~5개 항목, 각 항목 한 줄. 데이터 인용 + 짧은 의미>"],
    "reasoning": "<2~3문장 narrative — '한 줄로 정의하면 ...' 식의 주장 + 근거>",
    "accounting": ["<2~4개 K-IFRS 회계 watchpoint>"],
    "mna": ["<2~4개 M&A 관점 — EV/Sales, EV/EBITDA, 청산가치, 우선주, 협상력 등>"],
    "monitoring": ["<2~4개 추적 지표 — 분기/연 단위>"]
  }
}

대시보드 페이지의 강조점: 5개 카테고리 종합 + 가장 큰 한두 가지 이슈 + 투자 시점 베팅 포인트.`;

/** PageNarrative JSON 스키마 — BS/IS/CF prompt에서 재사용 */
const PAGE_NARRATIVE_SCHEMA = `{
  "headline": "<1줄, 가장 두드러진 테마. 위험 부분만 ==강조text== 식으로 감싸기. ==red== 같은 태그 형식 금지. bold/italic/heading 등 일체 금지. 80자 이내>",
  "message": "<1~2문장 보조 설명>",
  "insight": {
    "conclusion": "<1~2문장 페이지 종합 결론>",
    "evidence": ["<3~5개 항목, 각 항목 한 줄. 데이터 인용 + 짧은 의미>"],
    "reasoning": "<2~3문장 narrative>",
    "accounting": ["<2~4개 K-IFRS 회계 watchpoint>"],
    "mna": ["<2~4개 M&A 관점>"],
    "monitoring": ["<2~4개 추적 지표>"]
  }
}`;

export const PROMPT_BS_INSIGHT = `위 데이터를 보고 재무상태표(BS) 페이지의 insight를 다음 JSON으로 출력하세요. 절대 다른 필드명(title, summary 등) 사용 금지 — 정확히 이 구조 그대로:

${PAGE_NARRATIVE_SCHEMA}

BS 페이지 강조점:
- 자본구조 (자본잠식 이력, 자기자본비율)
- 부채 만기 (단기/장기 비중, 차입 의존도)
- 자산 질 (현금성 vs 무형 vs 보증금, 환금성)
- 운전자본 (매출채권·미지급비용 변화)
- 청산가치 vs 장부가 디스카운트`;

export const PROMPT_IS_INSIGHT = `위 데이터를 보고 손익계산서(IS) 페이지의 insight를 다음 JSON으로 출력하세요. 절대 다른 필드명(title, summary 등) 사용 금지 — 정확히 이 구조 그대로:

${PAGE_NARRATIVE_SCHEMA}

IS 페이지 강조점:
- 매출 성장 (CAGR, 5y multiple, YoY 둔화 여부, S-curve 진입)
- 수익성 트렌드 (영업이익률, EBITDA 마진, BEP 도달 시점)
- 비용 구조 (인건비/매출, 임차료/매출, SGA/매출)
- 운영 레버리지 작동 여부
- PMF 신호 (광고비 비중)`;

export const PROMPT_CF_INSIGHT = `위 데이터를 보고 현금흐름(CF) 페이지의 insight를 다음 JSON으로 출력하세요. 절대 다른 필드명(title, summary 등) 사용 금지 — 정확히 이 구조 그대로:

${PAGE_NARRATIVE_SCHEMA}

CF 페이지 강조점:
- OCF/FCF 자력 생존 여부
- 진성 OCF (운전자본 효과 분리 후)
- CAPEX 성격 (유형 vs 무형, 자본화 의심 영역)
- Runway, 이자보상배율
- 외부 자금 의존도 (누적 FCF vs 누적 투자유치)`;

export const PROMPT_ITEM_NOTES_INCOME = `formatted_financials.income_statement에 있는 모든 line item에 대해 다음 JSON을 출력.

{
  "<line item key>": {
    "trend": "<5년 추이 한 단어 — '11.5배 증가', '4년 음수' 등>",
    "learn_note": "<비전공자용 1문장 — 이 항목이 무엇이고 왜 보는지>",
    "investment_note": "<투자/M&A 관점 1문장 — 5년치 추이 의미>"
  },
  ...
}

반드시 formatted_financials.income_statement의 모든 키에 대해 항목 생성. 키 이름 그대로 사용.
note는 각 1문장으로 짧게.`;

export const PROMPT_ITEM_NOTES_BALANCE = `formatted_financials.balance_sheet에 있는 모든 line item에 대해 동일한 JSON 형식으로 출력.

{
  "<line item key>": {
    "trend": "<5년 추이 한 단어>",
    "learn_note": "<비전공자용 1문장>",
    "investment_note": "<투자/M&A 관점 1문장>"
  },
  ...
}

반드시 formatted_financials.balance_sheet의 모든 키 포함. note는 각 1문장으로 짧게.`;

export const SECTION_PROMPTS = {
  top_verdict_and_categories: PROMPT_TOP_VERDICT_AND_CATEGORIES,
  dashboard_insight: PROMPT_DASHBOARD_INSIGHT,
  bs_insight: PROMPT_BS_INSIGHT,
  is_insight: PROMPT_IS_INSIGHT,
  cf_insight: PROMPT_CF_INSIGHT,
  item_notes_income: PROMPT_ITEM_NOTES_INCOME,
  item_notes_balance: PROMPT_ITEM_NOTES_BALANCE,
} as const;

export type SectionKey = keyof typeof SECTION_PROMPTS;
