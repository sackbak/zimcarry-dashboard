/**
 * OpenDART API client — 한국 상장사 재무제표 정형 데이터.
 *
 * 공식 문서: https://opendart.fss.or.kr/guide/main.do
 * 인증키: https://opendart.fss.or.kr → "인증키 신청" (무료, 즉시)
 * 일일 호출: 10,000회
 *
 * 사용 흐름:
 *   1. 회사명 → corp_code 조회 (corpCode.xml 사전 다운로드 또는 검색 API)
 *   2. corp_code + 사업연도 → 재무제표 (단일/연결, BS/IS/CF)
 *   3. transform.ts에서 RawCompanyData로 매핑
 *
 * 환경변수: DART_API_KEY
 */

const DART_BASE = "https://opendart.fss.or.kr/api";

// ────────────────────────────────────────────────────────────────────
// API 응답 타입 (DART 공식 spec 기반)
// ────────────────────────────────────────────────────────────────────

/** 모든 DART 응답에 공통. status "000" = 정상, 그 외 에러. */
export interface DartBaseResponse {
  status: string;
  message: string;
}

/** 재무제표 line item (단일 연도). fnlttSinglAcntAll 응답 list[i] */
export interface DartFnAccount {
  rcept_no: string;             // 접수번호
  reprt_code: string;           // 보고서 코드 (11011=사업, 11012=반기, 11013=1분기, 11014=3분기)
  bsns_year: string;            // 사업연도 ("2024")
  corp_code: string;
  /** 'BS' | 'IS' | 'CIS' | 'CF' | 'SCE' */
  sj_div: "BS" | "IS" | "CIS" | "CF" | "SCE";
  sj_nm: string;                // "재무상태표" 등
  /** "ifrs-full_Assets", "ifrs-full_Revenue" 등 — 매핑 키 */
  account_id: string;
  account_nm: string;           // "자산총계" 등
  account_detail: string;       // "-"이거나 세부 분류명
  thstrm_nm: string;            // "제 N 기"
  thstrm_dt: string;            // 당기 기간 ("2024.01.01 ~ 2024.12.31" 또는 "2024.12.31 현재")
  thstrm_amount: string;        // 당기 금액 (원 단위 문자열, comma 포함 가능)
  thstrm_add_amount?: string;   // 누적 (분기보고서)
  frmtrm_nm?: string;           // 전기명
  frmtrm_dt?: string;
  frmtrm_amount?: string;
  frmtrm_q_nm?: string;         // 전기 분기 누적
  frmtrm_q_amount?: string;
  bfefrmtrm_nm?: string;        // 전전기명
  bfefrmtrm_dt?: string;
  bfefrmtrm_amount?: string;
  ord: string;                  // 정렬 순서
  currency: string;             // "KRW"
}

export interface DartFnAccountResponse extends DartBaseResponse {
  list?: DartFnAccount[];
}

/** 회사 기본 정보 (company.json) */
export interface DartCompanyInfo extends DartBaseResponse {
  corp_code: string;
  corp_name: string;
  corp_name_eng: string;
  stock_name: string;           // 종목명
  stock_code: string;           // 종목코드 6자리
  ceo_nm: string;
  corp_cls: string;             // "Y"=유가, "K"=코스닥, "N"=코넥스, "E"=기타
  jurir_no: string;             // 법인등록번호
  bizr_no: string;              // 사업자등록번호
  adres: string;                // 주소
  hm_url: string;               // 홈페이지
  ir_url: string;
  phn_no: string;
  fax_no: string;
  induty_code: string;          // 업종코드
  est_dt: string;               // 설립일 (YYYYMMDD)
  acc_mt: string;               // 결산월 (MM)
}

// ────────────────────────────────────────────────────────────────────
// 클라이언트
// ────────────────────────────────────────────────────────────────────

export class DartApiError extends Error {
  constructor(
    public status: string,
    message: string
  ) {
    super(`DART API error ${status}: ${message}`);
    this.name = "DartApiError";
  }
}

function getApiKey(): string {
  const key = process.env.DART_API_KEY;
  if (!key) {
    throw new Error(
      "DART_API_KEY 환경변수 필요. https://opendart.fss.or.kr 에서 인증키 신청 후 .env.local에 설정."
    );
  }
  return key;
}

async function dartFetch<T extends DartBaseResponse>(
  endpoint: string,
  params: Record<string, string>
): Promise<T> {
  const key = getApiKey();
  const url = new URL(`${DART_BASE}/${endpoint}`);
  url.searchParams.set("crtfc_key", key);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`DART HTTP ${res.status}: ${res.statusText}`);
  }
  const data = (await res.json()) as T;
  if (data.status !== "000") {
    throw new DartApiError(data.status, data.message);
  }
  return data;
}

/**
 * 회사 기본정보 조회.
 * status 코드:
 *   000 정상 / 010 인증키 미등록 / 011 사용한도 초과 / 013 조회된 데이터 없음
 *   014 파일 없음 / 020 인증키 만료 / 021 정상키 미등록 / 100 필드 오류 / 800 시스템 점검
 */
export async function fetchCompanyInfo(
  corpCode: string
): Promise<DartCompanyInfo> {
  return dartFetch<DartCompanyInfo>("company.json", {
    corp_code: corpCode,
  });
}

/**
 * 단일회사 전체 재무제표 (계정과목 전체) — 사업/분기/반기.
 *
 * @param corpCode 8자리 corp_code
 * @param year 사업연도 4자리 ("2024")
 * @param reportCode "11011"=사업(연간), "11012"=반기, "11013"=1Q, "11014"=3Q
 * @param fsDiv "OFS"=재무제표(단독), "CFS"=연결재무제표
 */
export async function fetchFinancialStatementsAll(
  corpCode: string,
  year: string,
  reportCode: "11011" | "11012" | "11013" | "11014" = "11011",
  fsDiv: "OFS" | "CFS" = "CFS"
): Promise<DartFnAccountResponse> {
  return dartFetch<DartFnAccountResponse>("fnlttSinglAcntAll.json", {
    corp_code: corpCode,
    bsns_year: year,
    reprt_code: reportCode,
    fs_div: fsDiv,
  });
}

/**
 * 5개년 사업보고서 일괄 조회. 2020~2024 등 연속 연도 하나씩 호출.
 * 호출 횟수 = years.length. CFS 우선, 결과 없으면 OFS 재시도.
 */
export async function fetchFiveYearStatements(
  corpCode: string,
  years: number[]
): Promise<{ year: number; data: DartFnAccount[] }[]> {
  const out: { year: number; data: DartFnAccount[] }[] = [];
  for (const year of years) {
    let resp: DartFnAccountResponse;
    try {
      resp = await fetchFinancialStatementsAll(
        corpCode,
        String(year),
        "11011",
        "CFS"
      );
    } catch (e) {
      if (e instanceof DartApiError && e.status === "013") {
        // 연결재무제표 없음 — 단독으로 재시도
        resp = await fetchFinancialStatementsAll(
          corpCode,
          String(year),
          "11011",
          "OFS"
        );
      } else {
        throw e;
      }
    }
    out.push({ year, data: resp.list ?? [] });
  }
  return out;
}
