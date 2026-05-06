/**
 * Supabase client wrappers — 분리된 두 권한.
 *
 * 1. supabaseServer(): SUPABASE_SERVICE_ROLE_KEY 사용. RLS 우회 — 서버 라우트 전용.
 * 2. supabaseBrowser(): NEXT_PUBLIC_SUPABASE_ANON_KEY 사용. RLS 적용 — 클라이언트 호출 가능.
 *
 * 환경변수 (.env.local):
 *   NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJh...
 *   SUPABASE_SERVICE_ROLE_KEY=eyJh...        # 서버 전용 — client 노출 금지
 *
 * @anthropic-ai/sdk처럼 lazy init — env 없을 때 import만으로 throw 안 하게.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _server: SupabaseClient | null = null;
let _browser: SupabaseClient | null = null;

export function supabaseServer(): SupabaseClient {
  if (_server) return _server;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase server env 누락: NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY 필요."
    );
  }
  _server = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _server;
}

export function supabaseBrowser(): SupabaseClient {
  if (_browser) return _browser;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase browser env 누락: NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY 필요."
    );
  }
  _browser = createClient(url, key);
  return _browser;
}
