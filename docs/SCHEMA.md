# CompanyAnalysis Schema — 분리축 + 출처 + LLM Prompt

이 문서는 [`src/types/CompanyAnalysis.ts`](../src/types/CompanyAnalysis.ts)의 schema를 보완.
**무엇을 어디서 채우는지 + LLM이 어떤 prompt로 생성하는지** 정의.

## 0. 파이프라인 전체 그림

```
회사명 입력
    ↓
[1] 회사 식별
    └─ 상장사 → DART corp_code 매핑 → DART API 호출
    └─ 비상장사 → "PDF 업로드" UI → Vision LLM (Claude/Gemini)
    ↓
[2] RawCompanyData 생성
    (income_statement / balance_sheet 5년치 + 회사 메타)
    ↓
[3] ComputedMetrics 자동 계산  (코드, 결정적, 비용 0)
    ratios + derived_cf + per_item + top_kpis(signal 룰 기반)
    ↓
[4] CompanyNarrative 생성       (LLM, raw+computed → 텍스트)
    top_verdict / pages / categories / item_notes
    ↓
[5] Supabase 캐싱 (companies, analyses, files)
    ↓
[6] Next.js dashboard 렌더 (현재 zimcarry-dashboard UI 그대로)
```

## 1. Layer별 출처 매핑

### Layer 1: RAW

| 필드 | 상장사 (DART) | 비상장사 (PDF) |
|------|--------------|----------------|
| meta.* | DART 회사정보 API | Vision LLM 추출 + 사용자 입력 보완 |
| company.* | DART 회사정보 + 공시 메타 | Vision LLM 추출 (없으면 빈 필드, UI hide) |
| financials.income_statement | DART 재무제표 API (XBRL) | Vision LLM이 PDF 표 추출 |
| financials.balance_sheet | 동일 | 동일 |
| financials.cash_flow_raw | DART 정형 (있는 경우) | 보통 없음 → derived_cf로 대체 |

**키 명명 규칙**: 영문 snake_case, DART 표준 명칭 매핑. 비상장 PDF에서도 같은 키로 정규화.

### Layer 2: COMPUTED — 자동 계산식

```typescript
// 핵심 식 정리 (모든 계산은 raw에서 직접 derive)

ratios.growth.revenue_yoy[i]         = revenue[i] / revenue[i-1] - 1
ratios.growth.cagr_3y                = (revenue[-1] / revenue[-4]) ^ (1/3) - 1
ratios.growth.revenue_5y_multiple    = revenue[-1] / revenue[0]

ratios.profitability.operating_margin[i] = operating_income[i] / revenue[i]
ratios.profitability.net_margin[i]       = net_income[i] / revenue[i]
ratios.profitability.sga_ratio[i]        = sga[i] / revenue[i]

ratios.stability.current_ratio[i]    = current_assets[i] / current_liab[i]
ratios.stability.debt_ratio[i]       = total_liab[i] / total_equity[i]
ratios.stability.equity_ratio[i]     = total_equity[i] / total_assets[i]
ratios.stability.capital_erosion[i]  = total_equity[i] < 0

ratios.activity.asset_turnover[i]    = revenue[i] / total_assets[i]
ratios.activity.ar_turnover[i]       = revenue[i] / ar[i]
ratios.activity.ar_days[i]           = 365 / ar_turnover[i]

derived_cf.ebitda[i]                 = operating_income[i] + depreciation[i] + amortization[i]
derived_cf.ocf_estimate[i]           = net_income[i] + D&A[i] - ΔNWC[i]    // NWC = current_assets - current_liab
derived_cf.fcf[i]                    = ocf - capex
derived_cf.runway_months[i]          = cash[i] / (월간 -fcf)
derived_cf.interest_coverage[i]      = operating_income[i] / interest_expense[i]
```

### Layer 2: COMPUTED — Signal 자동 분류 임계치

`top_kpis[].signal`은 룰 기반. 표준 임계치 (vendor-neutral):

| 지표 | green | yellow | red |
|------|-------|--------|-----|
| 매출 YoY | ≥ 20% | 0~20% | < 0% |
| 영업이익률 | ≥ 5% | 0~5% | < 0% |
| EBITDA 마진 | ≥ 10% | 0~10% | < 0% |
| 부채비율 | < 200% | 200~400% | ≥ 400% |
| 유동비율 | ≥ 150% | 100~150% | < 100% |
| 자기자본비율 | ≥ 30% | 15~30% | < 15% |
| Runway | ≥ 18개월 | 6~18개월 | < 6개월 |
| 이자보상배율 | ≥ 5x | 1~5x | < 1x |
| 매출채권 회수기간 | ≤ 30일 | 30~60일 | > 60일 |
| capital_erosion (any year) | false | — | true |

이 임계치는 [`src/lib/thresholds.ts`](../src/lib/thresholds.ts)로 분리 (TODO: 구현 시 작성).

### Layer 3: NARRATIVE — LLM이 생성

LLM 입력: `{ raw, computed }`. 출력: `CompanyNarrative` JSON.

호출 구조 — 한 번에 다 받지 말고 **section별 분할 호출** (토큰 절약 + 재시도 안정성):

1. `top_verdict + categories` (전체 종합 — 가장 짧음, 한 번에)
2. `pages.dashboard.insight` (종합 insight)
3. `pages.balance_sheet.insight` (BS 전용)
4. `pages.income_statement.insight` (IS 전용)
5. `pages.cash_flow.insight` (CF 전용)
6. `item_notes.income` + `item_notes.balance` (배치, 한 번에)

총 6 LLM 호출 / 회사. 각 호출은 input ~3K + output ~1K 토큰. Sonnet 4.6 기준 회사당 \$0.05~0.15.

## 2. LLM Prompt 표준 — System

모든 호출 공통 system prompt:

```
당신은 한국 회계사 + 사모펀드/M&A 임원의 시각으로 회사 재무를 분석하는 전문가입니다.

원칙:
1. 데이터 근거 없는 추측 금지. evidence는 반드시 입력 데이터에서 파생.
2. 비전공자도 이해할 수 있는 표현 + 회계 용어 정확성 둘 다 만족.
3. RichText 마크업 사용:
   - **bold**: 핵심 숫자/결론 강조
   - ==red==: 위험 신호 / 경고 / 부정적 신호
4. K-IFRS 한국 회계 기준. 한국 상법/세법 맥락.
5. 길이 제약 엄수 (각 prompt 별 지정).

출력은 반드시 지정된 JSON 스키마. 다른 텍스트 금지.
```

## 3. LLM Prompt 별 user prompt — 핵심만

> 전체 prompt는 구현 시 `src/lib/llm/prompts/*.ts`로 분리. 아래는 핵심 골자.

### 3.1 `top_verdict + categories`

```
입력 데이터: {raw}, {computed}

출력 (JSON):
{
  top_verdict: {
    signal: green|yellow|red,
    label: "🟢 양호" | "🟡 전환기" | "🔴 위험" 등,
    summary: <1문장>,
    key_question: <투자/M&A 관점 핵심 질문 1개>,
    scenarios: { bullish: <1문장>, base: <1문장>, bearish: <1문장> }
  },
  categories: [
    { name: "성장성", signal, summary: "🟢 우수"|"🟡 전환"|"🔴 위험" 등,
      comment: <1~2문장, RichText>, kpi_refs: [<computed의 키>] },
    { name: "수익성", ... },
    { name: "안정성", ... },
    { name: "활동성", ... },
    { name: "현금흐름", ... },
  ]
}

판단 기준: computed.top_kpis의 signal 분포 + ratios 트렌드 종합.
category signal은 단순 평균이 아닌 종합 판단 (e.g., 자본잠식 한 번이라도 있으면 안정성은 최소 yellow).
```

### 3.2 `pages.<page>.insight`

```
입력: {raw}, {computed}
대상 페이지: <dashboard | balance_sheet | income_statement | cash_flow>

출력 (JSON):
{
  headline: <1줄, RichText. 가장 두드러진 테마 1개. 예: "단기차입 91% 의존 + 자본잠식 2회 — Bridge 증자로 회복">,
  message: <1~2문장, headline 보조 설명>,
  insight: {
    conclusion: <1~2문장, 페이지 종합 결론>,
    evidence: [<5~10개 항목>],   // 각 항목은 데이터 인용 + 짧은 해석. RichText.
    reasoning: <3~5문장, narrative 흐름>,
    accounting: [<3~7개 K-IFRS watchpoint>],   // 회계처리 위험·논점
    mna: [<3~7개 M&A 관점>],                    // 가치산정·거래구조·청산가치 등
    monitoring: [<3~7개 추적 지표>]             // 분기/연 단위로 봐야 할 지표
  }
}

페이지별 강조점:
- dashboard: 5개 카테고리 종합 + 가장 큰 한두 가지 이슈
- balance_sheet: 자본구조, 부채 만기, 자산 질, 자본잠식 이력
- income_statement: 매출 성장 vs 수익성, BEP, 비용 구조, 운영 레버리지
- cash_flow: OCF/FCF 자력 생존 여부, runway, CAPEX 성격, 회계 vs 진성 현금
```

### 3.3 `item_notes` (line item별 짧은 해설)

```
입력: {raw.financials.<is or bs>}, {computed.per_item.<is or bs>}

출력 (JSON):
{
  "<line item name 1>": {
    trend: <"11.5배 증가" 같은 한 줄>,
    learn_note: <비전공자용 1~2문장 설명>,
    investment_note: <투자/M&A 관점 1~2문장>
  },
  "<line item name 2>": { ... },
  ...
}

생성 규칙:
- 한 번 호출에 IS 또는 BS 전체 line item을 한꺼번에 (배치).
- learn_note는 회계 입문자도 이해 가능한 평이한 표현.
- investment_note는 5년치 추이 본 후 도출한 의미.
- trend는 첫 해 대비 마지막 해의 핵심 변화 한 단어.
```

## 4. 짐캐리 데이터 → 새 schema 매핑

현재 `src/data/zimcarry_data.json` → `CompanyAnalysis` 매핑:

| 현재 위치 | 새 위치 |
|----------|---------|
| `meta.*` | `raw.meta.*` |
| `company.{ceo,founded,...}` | `raw.company.*` |
| `company.investment` | `context.investment_history` |
| `company.milestones_post_ir2024` | `context.milestones` |
| `company.subsidiary` | `context.subsidiary` |
| `company.{stores_total,...}` | `context.business_structure` |
| `financials.years` | `raw.meta.fiscal_years` |
| `financials.income_statement` | `raw.financials.income_statement` |
| `financials.balance_sheet` | `raw.financials.balance_sheet` |
| `financials.cash_flow` | `computed.derived_cf` (현재 데이터는 derive된 것 — DART 받으면 raw로 분리) |
| `financials.investment_analysis` | `context.investment_history`로 흡수 |
| `ratios.*` | `computed.ratios.*` |
| `income_items[].items[]` | `computed.per_item.income[]` (수치) + `narrative.item_notes.income` (텍스트) |
| `balance_items[].items[]` | `computed.per_item.balance[]` + `narrative.item_notes.balance` |
| `business_structure.*` | `context.business_structure` |
| `dashboard.top_kpis` | `computed.top_kpis` (신호는 자동 분류로 재계산) |
| `dashboard.categories[].{signal,summary,comment}` | `narrative.categories[]` |
| `dashboard.categories[].kpis[]` | `computed.top_kpis` 중 해당 카테고리 KPI 참조 (`kpi_refs`) |
| `dashboard.overall_assessment` | `narrative.top_verdict` |
| `INSIGHTS.{dashboard_overall,bs_overall,is_overall,cf_overall}` | `narrative.pages.<page>.insight` |
| 페이지별 `headline`, `message` (insights.ts 옆 페이지파일 하드코딩) | `narrative.pages.<page>.{headline,message}` |
| `glossary[].zimcarry` 필드 | **삭제** — 회사별 적용 텍스트는 narrative 안에 흡수. glossary는 회사 invariant로 정리. |

## 5. 결정사항 (확정)

- ✅ **CF 처리**: `raw.cash_flow_raw` (DART 있을 때만) + `computed.derived_cf` (항상). UI는 raw 우선, 없으면 derived.
- ✅ **Signal 자동화**: 개별 ratio/top_kpi signal은 룰(섹션 1.2 임계치), 카테고리 종합 signal은 LLM.
- ✅ **Insight 깊이**: MVP는 회사 무관 동일 깊이 (evidence 5~10, reasoning 3~5문장, accounting/mna/monitoring 각 3~7).

## 6. 다음 단계 후보

- [ ] `src/lib/thresholds.ts` — signal 임계치 룰 코드화
- [ ] `src/lib/computed.ts` — raw → computed 자동 계산 로직
- [ ] `src/lib/llm/prompts/*.ts` — 각 LLM 호출 prompt 함수화
- [ ] `src/lib/llm/client.ts` — Anthropic SDK 래퍼
- [ ] `src/lib/dart/client.ts` — OpenDART API 클라이언트
- [ ] `src/lib/vision/extract.ts` — PDF → RawCompanyData (Vision LLM)
- [ ] Supabase schema (companies, analyses, files)
- [ ] 짐캐리 기존 데이터 마이그레이션 스크립트 (`zimcarry_data.json` → `CompanyAnalysis`)
- [ ] dashboard 컴포넌트들 `CompanyAnalysis` 받도록 prop 리팩터
