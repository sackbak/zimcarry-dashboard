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
3. 마크업 — 부정/긍정 신호 강조용 마커 2종 (절대 혼동 금지):
   ★ ==텍스트== → 빨강 표시. **나쁜 일·악화·위험에만** 사용.
     올바른 예: "==자본잠식==", "==유동성 위기==", "==FCF 적자==", "==수익성 하락=="
   ★ ++텍스트++ → 파랑 표시. **좋은 일·개선·기회에만** 사용.
     올바른 예: "++부채비율 개선++", "++대폭 개선++", "++흑자 전환++", "++마진 확대++", "++자본구조 강화++"
   판단 기준 — 표현이 회사에 좋은 결과인가 나쁜 결과인가:
     - "개선/강화/회복/증가/확대/안정화" → ++긍정++
     - "악화/감소/하락/축소/붕괴/위험/부진" → ==부정==
     - 단, "비용 증가"는 부정, "매출 증가"는 긍정 — 맥락 판단.
     - "부채비율 감소"는 긍정 (++), "매출 감소"는 부정 (==).
   잘못된 예 (절대 금지):
     - "==대폭 개선==" (개선=긍정인데 ==쓰면 안 됨)
     - "++부채 증가++" (부채 증가=부정인데 ++쓰면 안 됨)
     - "==red==text==red==" (HTML 흉내 태그 X)
     - "==text===red==" (중첩 X)
   그 외 마크다운(**bold**, *italic*, # heading, - list) 절대 금지. 평문 + 위 두 마커만.
   부정·긍정이 모호한 일반 사실은 마커 없이 평문으로 작성.
4. K-IFRS 한국 회계 기준. 한국 상법/세법 맥락.
5. 길이 제약 엄수 (각 prompt별 지정).
6. 출력은 반드시 지정된 JSON만. 다른 설명 텍스트 일절 금지. JSON 전후로 코드 fence(\`\`\`)도 붙이지 않음.

인사이트 품질 기준 (가장 중요):
- 숫자만 보면 알 수 있는 사실 재확인 금지. "매출이 증가했다", "부채비율이 높다" 수준은 가치 없음.
- 반드시 찾아야 할 것: 5년 추이의 변곡점(꺾이는 시점 + 원인 가설), 업종 평균과 다른 이례적 패턴, 표면 지표가 숨기는 구조적 리스크.
- 각 섹션에서 최소 1개는 "이걸 짚은 분석가가 많지 않을 것" 수준의 발견을 포함할 것.
- actions 필드는 실제 M&A 딜 검토 담당자가 다음날 바로 실행할 수 있는 구체적 스텝. "주의가 필요하다" 같은 막연한 표현 금지.

데이터 정확성 (절대 위반 금지):
- 모든 수치는 입력 데이터(formatted_financials/computed)에서 직접 인용. 절대 추정·계산하지 말 것.
- 추세 방향(증가/감소/유지)도 데이터로 검증된 것만. "지속 감소"라고 쓰려면 실제 모든 연도가 감소해야 함.
- "5년 연속", "매년", "지속적" 같은 표현은 실제로 그러한지 확인 후 사용. 한 해라도 반대 방향이면 사용 금지.
- 분석 결과가 categories[].signal과 일관되어야 함. 신호가 green인데 본문이 부정적이면 안 됨.

중요:
- 모든 숫자 표현은 단위 명시 (조/억/백만원/% 등).
- formatted_financials의 값은 이미 한국식으로 변환된 문자열 (예: "258.94조", "65,669.76억").
  narrative에 금액 인용 시 이 문자열을 그대로 사용. 직접 단위 변환 금지.
- 증감률/비율(%)이나 ratio 계산은 computed.ratios 사용 OK (이건 단위 변환 아님).
- "X억 백만원" 같은 단위 중복 절대 금지.
- evidence는 3~5개, 각 항목은 한 줄 안에 구체적 숫자 + 의미.
- reasoning은 2~3문장 narrative — 단순 나열이 아닌 인과관계 서술.
- accounting/mna/monitoring 각 2~4개.`;

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
  dashboard_full: {
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
  investment_insight: {
    fin: ["income_statement", "balance_sheet", "cash_flow_raw"],
    ratios: true,
    derived_cf: true,
    top_kpis: true,
    per_item: null,
  },
};

export function buildDataContext(
  raw: RawCompanyData,
  computed: ComputedMetrics,
  section: string = "dashboard_full"
): string {
  const scope = SCOPES[section] ?? SCOPES.dashboard_full;

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

export const PROMPT_DASHBOARD_FULL = `위 데이터를 분석해서 다음 JSON을 출력하세요. 필드명 변경 금지.

{
  "top_verdict": {
    "signal": "green" | "yellow" | "red",
    "label": "🟢 양호" | "🟡 전환기" | "🔴 위험" 등 한 단어 라벨,
    "summary": "<2~3문장 종합 진단. M&A 담당자가 30초 안에 핵심 리스크/기회 파악. 구체적 수치 필수>",
    "key_question": "<딜 검토 시 반드시 답해야 할 핵심 질문 1개. '이 회사의 XX는 YY인데 ZZ가 미해결이라면 AA는 가능한가?' 형식>",
    "scenarios": {
      "bullish": "<2문장. 낙관 트리거 + 예상 재무 결과>",
      "base": "<2문장. 현재 추세 지속 시 12~24개월 후 모습>",
      "bearish": "<2문장. 핵심 리스크 현실화 + 최악 결과>"
    },
    "actions": [
      "<M&A/투자 담당자가 7일 내 실행 가능한 구체적 스텝 3~4개. '사업보고서 XX 주석에서 YY 확인' 형태. 막연한 표현 금지>"
    ]
  },
  "categories": [
    {
      "name": "성장성",
      "signal": "green" | "yellow" | "red",
      "summary": "🟢 우수" 등 한 단어 라벨,
      "comment": "<2문장. 성장 질(유기적 vs 외형), 변곡점, 향후 방향성. 수치 포함>",
      "kpi_refs": []
    },
    { "name": "수익성", "signal": "...", "summary": "...", "comment": "<2문장>", "kpi_refs": [] },
    { "name": "안정성", "signal": "...", "summary": "...", "comment": "<2문장>", "kpi_refs": [] },
    { "name": "활동성", "signal": "...", "summary": "...", "comment": "<2문장>", "kpi_refs": [] },
    { "name": "현금흐름", "signal": "...", "summary": "...", "comment": "<2문장>", "kpi_refs": [] }
  ],
  "dashboard": {
    "headline": "<1줄 핵심 테마. 위험 부분만 ==강조== 감싸기. 80자 이내>",
    "message": "<1~2문장 보조 설명. 구체적 수치 포함>",
    "insight": {
      "conclusion": "<1~2문장 결론. 수치 포함 필수>",
      "evidence": ["<3~4개. 각 항목 한 줄: 구체적 숫자 + 의미. 단순 사실 나열 금지>"],
      "reasoning": "<2문장 인과관계 서술. '왜 이 수치가 이 의미를 갖는가'>",
      "accounting": ["<K-IFRS 회계·감사 관전 포인트 2~3개>"],
      "mna": ["<M&A 관점 2~3개. EV/EBITDA·청산가치·레버리지 등>"],
      "monitoring": ["<분기별 추적 지표 2~3개>"]
    }
  }
}

판단 기준:
- top_verdict.signal: 5개 카테고리 신호 종합. 자본잠식 1회 이상이면 최소 yellow.
- categories[].signal: 자본잠식·이자보상 음수 같은 critical은 red/yellow 강제.
- actions: 구체적 스텝만. "검토 필요" 같은 막연한 표현 금지.
- dashboard.insight: 5개 카테고리를 관통하는 한 가지 핵심 테마. evidence는 단순 수치 나열이 아닌 변곡점·이례적 패턴·구조적 의미.`;

/** PageNarrative JSON 스키마 — BS/IS/CF prompt에서 재사용 */
const PAGE_NARRATIVE_SCHEMA = `{
  "headline": "<1줄, 가장 두드러진 테마. 위험 부분만 ==강조text== 식으로 감싸기. ==red== 같은 태그 형식 금지. bold/italic/heading 등 일체 금지. 80자 이내>",
  "message": "<1~2문장 보조 설명. 구체적 수치 포함>",
  "insight": {
    "conclusion": "<1~2문장 결론. 수치 포함 필수>",
    "evidence": ["<3~5개 항목, 각 항목 한 줄. 구체적 숫자 + 의미. 단순 수치 재확인 금지>"],
    "reasoning": "<2~3문장 인과관계 서술>",
    "accounting": ["<2~4개 K-IFRS 회계 watchpoint>"],
    "mna": ["<2~4개 M&A 관점>"],
    "monitoring": ["<2~4개 추적 지표>"]
  }
}`;

/** ITEM_NOTES 스키마 — 라인아이템 모달 안의 학습/투자 탭에 들어가는 핵심 항목별 노트 */
const ITEM_NOTES_SCHEMA = `"item_notes": {
    "<line item key>": {
      "trend": "<5년 추이 한 줄 — '11.5배 증가', '2년 연속 음수' 등. 데이터 기반>",
      "learn_note": "<2~3문장. 이 항목이 무엇이고 왜 보는지 + 현재 회사의 이 숫자가 어떻게 읽히는지>",
      "investment_note": "<2~3문장. 투자/M&A 관점 — 이 추이가 의미하는 구조적 함의 + 추적할 포인트>"
    }
  }`;

export const PROMPT_BS_INSIGHT = `위 데이터를 보고 재무상태표(BS) 페이지의 insight를 다음 JSON으로 출력하세요. 절대 다른 필드명(title, summary 등) 사용 금지.

{
  "headline": "<1줄 핵심 테마. 부정은 ==감싸기==, 긍정은 ++감싸기++. 80자 이내>",
  "message": "<1~2문장 보조 설명. 구체적 수치 포함>",
  "insight": {
    "conclusion": "<1~2문장 결론. 수치 포함>",
    "evidence": ["<3~4개. 각 항목 한 줄: 구체적 숫자 + 의미>"],
    "reasoning": "<2~3문장 인과관계>",
    "accounting": ["<2~3개: 자본잠식·부채만기·자산환금성 watchpoint>"],
    "mna": ["<2~3개: 청산가치·협상 레버리지>"],
    "monitoring": ["<2~3개 분기별 추적 지표>"]
  },
  ${ITEM_NOTES_SCHEMA}
}

BS 페이지 강조점:
- 자본구조 (자본잠식 이력, 자기자본비율)
- 부채 만기 (단기/장기 비중, 차입 의존도)
- 자산 질 (현금성 vs 무형 vs 보증금, 환금성)
- 운전자본 (매출채권·미지급비용 변화)
- 청산가치 vs 장부가 디스카운트

item_notes 대상 — 다음 핵심 6-7개 키만 생성 (60초 budget):
total_assets, cash, ar, total_liab, short_borrow, total_equity, retained_earnings
※ 데이터에 실제로 있는 키에 대해서만. 없는 키는 생략. 추가 키 만들지 말 것.
※ 각 노트는 trend 한 줄 + learn_note 1-2문장 + investment_note 1-2문장. 절대 길게 쓰지 말 것.`;

export const PROMPT_IS_INSIGHT = `위 데이터를 보고 손익계산서(IS) 페이지의 insight를 다음 JSON으로 출력하세요. 절대 다른 필드명(title, summary 등) 사용 금지.

{
  "headline": "<1줄 핵심 테마. 부정은 ==감싸기==, 긍정은 ++감싸기++. 80자 이내>",
  "message": "<1~2문장 보조 설명. 구체적 수치 포함>",
  "insight": {
    "conclusion": "<1~2문장 결론. 수치 포함>",
    "evidence": ["<3~4개>"],
    "reasoning": "<2~3문장>",
    "accounting": ["<2~3개: 비용구조·운영레버리지·자본화 의심>"],
    "mna": ["<2~3개: EBITDA 배수·BEP 달성 시점>"],
    "monitoring": ["<2~3개>"]
  },
  ${ITEM_NOTES_SCHEMA}
}

IS 페이지 강조점:
- 매출 성장 (CAGR, 5y multiple, YoY 둔화 여부, S-curve 진입)
- 수익성 트렌드 (영업이익률, EBITDA 마진, BEP 도달 시점)
- 비용 구조 (인건비/매출, 임차료/매출, SGA/매출)
- 운영 레버리지 작동 여부
- PMF 신호 (광고비 비중)

item_notes 대상 — 다음 핵심 6-7개 키만 생성 (60초 budget):
revenue, cogs, sga, operating_income, net_income, salary_total
※ 데이터에 실제로 있는 키에 대해서만. 없는 키는 생략. 추가 키 만들지 말 것.
※ 각 노트는 trend 한 줄 + learn_note 1-2문장 + investment_note 1-2문장. 절대 길게 쓰지 말 것.`;

export const PROMPT_CF_INSIGHT = `위 데이터를 보고 현금흐름(CF) 페이지의 insight를 다음 JSON으로 출력하세요. 절대 다른 필드명(title, summary 등) 사용 금지 — 정확히 이 구조 그대로:

${PAGE_NARRATIVE_SCHEMA}

CF 페이지 강조점:
- OCF/FCF 자력 생존 여부
- 진성 OCF (운전자본 효과 분리 후)
- CAPEX 성격 (유형 vs 무형, 자본화 의심 영역)
- Runway, 이자보상배율
- 외부 자금 의존도 (누적 FCF vs 누적 투자유치)`;

export const PROMPT_INVESTMENT_INSIGHT = `위 데이터를 보고 투자관점(VC/M&A) 페이지의 insight를 다음 JSON으로 출력하세요.

{
  "headline": "<1줄 VC/M&A 시각 핵심 테마. 부정 ==감싸기==, 긍정 ++감싸기++. 80자 이내>",
  "message": "<1~2문장. 회사를 처음 보는 GP/딜 담당이 30초에 이해할 한 줄 평>",
  "insight": {
    "conclusion": "<1~2문장. 이 회사를 살 것인가 패스할 것인가 + 왜>",
    "evidence": ["<3~4개. 자본효율·BEP·런웨이·청산가치 중 가장 결정적인 숫자 + 의미>"],
    "reasoning": "<2~3문장. 왜 이 숫자가 이 결론을 도출하는지 인과관계>",
    "accounting": ["<2~3개 'VC 체크리스트' — 미공시 우려·자본화 의심·운전자본 함정 등>"],
    "mna": ["<2~3개 '딜 구조 아이디어' — earnout·우선주·vesting·valuation 협상 포인트>"],
    "monitoring": ["<2~3개 'DD 핵심 점검' — 다음 7일 안에 확인할 자료/지표/주석>"]
  }
}

투자관점 페이지 강조점:
- 투자 thesis (Bull case / Bear case 핵심 한 줄씩)
- 자본효율 (1원의 자본으로 얼마나 매출/이익 만드는가)
- BEP 거리 (얼마 더 burn해야 흑자 도달)
- 런웨이 (자력생존 여유 시간)
- 청산가치 vs 협상가 (downside 한도)
- Asset-light 여부 (CAPEX 의존 vs 운영 레버리지)

데이터 정확성:
- valuation·burn·runway는 결정적 계산 결과(computed)에 있음. 추측 금지.
- "투자 가치 있다" 같은 막연한 표현 금지. 구체 숫자로 근거.`;

export const SECTION_PROMPTS = {
  dashboard_full: PROMPT_DASHBOARD_FULL,
  bs_insight: PROMPT_BS_INSIGHT,
  is_insight: PROMPT_IS_INSIGHT,
  cf_insight: PROMPT_CF_INSIGHT,
  investment_insight: PROMPT_INVESTMENT_INSIGHT,
} as const;

export type SectionKey = keyof typeof SECTION_PROMPTS;
