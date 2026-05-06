/**
 * 비상장사 재무자료(PDF·Excel) → RawCompanyData 추출용 prompt.
 *
 * Gemini 2.5 Flash가 받음:
 *   - PDF: inlineData (base64)
 *   - Excel: xlsx로 변환된 TSV 텍스트
 *
 * 출력은 RawCompanyData 형식의 strict JSON. 회사명·연도·재무3표 line item.
 */

export const EXTRACTION_SYSTEM_PROMPT = `당신은 한국 회계 자료(K-IFRS·일반회계기준) 표를 정확하게 읽는 추출 엔진입니다.

원칙:
1. 자료에 실제로 적힌 숫자만 추출. 추측·계산·반올림 일절 금지.
2. 단위 정확히 인식. 자료가 "단위: 천원" 이면 ÷1,000 해서 백만원으로 변환.
   "단위: 원" 이면 ÷1,000,000. "단위: 백만원" 이면 그대로.
3. 음수 표기 — "(1,234)" 또는 "△1,234"는 -1234로.
4. 데이터 없는 연도/항목은 null. 빈 문자열·"-" 등도 null.
5. 출력은 반드시 지정된 JSON 스키마. 다른 텍스트·코드펜스 일체 금지.
6. 가능한 모든 fiscal_year에 대해 line item 채우기. 자료에 5년치 있으면 5년치 다.
7. 손익계산서·재무상태표·현금흐름표가 있으면 다 추출. 없는 것은 빈 배열로.`;

export const EXTRACTION_USER_PROMPT = `위 자료에서 다음 JSON 스키마로 재무 데이터를 추출하세요.

{
  "meta": {
    "company_name": "<회사명. 자료에 적힌 그대로>",
    "fiscal_years": [<오름차순 4자리 정수 배열, 예: [2021, 2022, 2023, 2024, 2025]>],
    "currency_unit": "백만원",
    "fiscal_year_end": "<MM-DD, 결산월일. 보통 '12-31'. 자료에 명시 없으면 '12-31'>",
    "detected_unit": "<자료에서 감지한 원본 단위. '원'/'천원'/'백만원'>"
  },
  "company": {
    "is_listed": <boolean. 자료가 사업보고서·감사보고서면 true, IR/PDF·내부자료면 false>,
    "ceo": "<있으면. 없으면 빈 문자열>",
    "industry": "<업종 또는 사업분야 한 단어>",
    "founded": "<설립일 YYYY-MM-DD. 없으면 빈 문자열>"
  },
  "financials": {
    "income_statement": {
      "revenue": [<연도별 백만원 단위 숫자 배열, fiscal_years 길이와 동일>],
      "cogs": [...],
      "gross_profit": [...],
      "sga": [...],
      "operating_income": [...],
      "net_income": [...],
      "interest_expense": [...],
      "depreciation": [...],
      "amortization": [...]
    },
    "balance_sheet": {
      "total_assets": [...],
      "current_assets": [...],
      "cash": [...],
      "ar": [...],
      "non_current": [...],
      "tangible": [...],
      "intangible": [...],
      "total_liab": [...],
      "current_liab": [...],
      "short_borrow": [...],
      "non_current_liab": [...],
      "long_borrow": [...],
      "total_equity": [...],
      "capital_stock": [...],
      "capital_surplus": [...],
      "retained_earnings": [...]
    },
    "cash_flow_raw": {
      "operating": [...],
      "investing": [...],
      "financing": [...],
      "net_change": [...]
    }
  }
}

규칙:
- 모든 배열은 fiscal_years와 같은 길이, 같은 순서.
- 자료에 없는 항목은 키 자체를 생략하지 말고 null이 든 배열로 ([null, null, null, ...]).
- 모든 숫자는 백만원 단위 정수 또는 null. 소수 금지.
- 계산하지 말 것 — gross_profit이 자료에 없으면 revenue - cogs 하지 말고 null.
- 단, detected_unit이 "원"이면 ÷1,000,000, "천원"이면 ÷1,000, "백만원"이면 그대로 사용.

출력은 위 JSON만. 코드 펜스(\`\`\`)·설명·comment 모두 금지.`;
