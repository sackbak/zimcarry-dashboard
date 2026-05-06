-- ──────────────────────────────────────────────────────────────────
-- Supabase schema — 회사 재무분석 캐시 + 사용자 업로드 PDF
--
-- 적용:
--   1. Supabase 프로젝트 생성 (https://supabase.com)
--   2. SQL Editor에서 이 파일 실행
--   3. Storage > Create bucket "uploads" (private)
--   4. Settings > API에서 NEXT_PUBLIC_SUPABASE_URL,
--      NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY 복사
--      → .env.local 또는 Vercel env에 설정
--
-- 대상 use case:
--   - 회사명 또는 corp_code 검색 시 캐시된 analyses 반환 (LLM 비용 절약)
--   - 같은 회사 5분/1시간/1일 단위 재요청 시 hit
--   - 업로드된 PDF는 storage에 저장, files 테이블에 메타
-- ──────────────────────────────────────────────────────────────────

-- companies: 분석 대상 회사 (DART corp_code 또는 비상장 manual)
CREATE TABLE IF NOT EXISTS companies (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- DART 상장사면 corp_code, 비상장은 NULL
  corp_code     text UNIQUE,
  -- 표시 이름 (DART corp_name 또는 사용자 입력)
  name          text NOT NULL,
  name_en       text,
  is_listed     boolean NOT NULL DEFAULT false,
  industry      text,
  -- DART 응답에서 가져온 보조 메타 (ceo, founded, biz_no 등) — JSON 그대로 저장
  meta          jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS companies_name_idx ON companies USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS companies_corp_code_idx ON companies (corp_code) WHERE corp_code IS NOT NULL;

-- analyses: 한 회사에 대한 한 시점의 CompanyAnalysis (raw + computed + narrative)
-- 하나의 회사에 여러 analyses 가능 (다른 fiscal_years, 다른 source, 시점별 갱신)
CREATE TABLE IF NOT EXISTS analyses (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  -- 'DART' | 'PDF' | 'Manual'
  source          text NOT NULL,
  -- 분석 대상 연도 범위 (e.g., [2021, 2022, 2023, 2024, 2025])
  fiscal_years    int[] NOT NULL,
  report_date     date NOT NULL,
  -- 전체 CompanyAnalysis JSON (raw + computed + narrative + context)
  analysis        jsonb NOT NULL,
  -- LLM 사용량 (input_tokens, output_tokens, cache_creation, cache_read, cost_usd)
  llm_usage       jsonb,
  -- 캐시 만료 — NULL이면 영구
  expires_at      timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS analyses_company_idx ON analyses (company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS analyses_expires_idx ON analyses (expires_at) WHERE expires_at IS NOT NULL;

-- files: 사용자 업로드 PDF (비상장사 경로)
-- 파일 자체는 storage.objects (Supabase Storage)에 저장.
-- 이 테이블은 메타 + 매핑.
CREATE TABLE IF NOT EXISTS files (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Storage 경로 (e.g., "uploads/<uuid>.pdf")
  storage_path    text NOT NULL UNIQUE,
  filename        text NOT NULL,
  mime_type       text NOT NULL,
  size_bytes      bigint NOT NULL,
  -- 업로드 후 어떤 analysis로 사용됐는지 (선택)
  analysis_id     uuid REFERENCES analyses(id) ON DELETE SET NULL,
  -- Vision LLM 추출 결과 (RawCompanyData) — 추출 후 저장. NULL이면 미처리.
  extracted_raw   jsonb,
  uploaded_by     text, -- 인증 도입 시 user_id
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS files_analysis_idx ON files (analysis_id) WHERE analysis_id IS NOT NULL;

-- ──────────────────────────────────────────────────────────────────
-- 트리거: companies.updated_at 자동 갱신
-- ──────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS companies_updated_at ON companies;
CREATE TRIGGER companies_updated_at
  BEFORE UPDATE ON companies
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ──────────────────────────────────────────────────────────────────
-- pg_trgm 확장 (회사명 fuzzy search용)
-- ──────────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ──────────────────────────────────────────────────────────────────
-- RLS 정책 — MVP는 service_role 키로만 접근 (서버 라우트 통해서만)
-- 추후 사용자 인증 도입 시 anon/authenticated 정책 추가
-- ──────────────────────────────────────────────────────────────────

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE analyses  ENABLE ROW LEVEL SECURITY;
ALTER TABLE files     ENABLE ROW LEVEL SECURITY;

-- service_role은 RLS 우회. anon/authenticated는 정책 없으면 접근 불가 = 안전한 기본값.
-- (서버 라우트에서 SUPABASE_SERVICE_ROLE_KEY로 client 만들어 접근)
