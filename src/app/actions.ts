"use server";

/**
 * Server Actions — corp_code 폼 검증 후 /company/<id>로 redirect.
 *
 * 실제 DART 호출 + 변환은 /company/[corp_code]/page.tsx가 진입 시 수행.
 * (Vercel serverless filesystem이 휘발이라 server action에서 파일 저장은 의미 없음)
 */

import { redirect } from "next/navigation";

export async function analyzeCompany(formData: FormData): Promise<void> {
  const corpCode = String(formData.get("corp_code") ?? "").trim();

  if (!/^\d{8}$/.test(corpCode)) {
    redirect(
      `/?error=${encodeURIComponent("corp_code는 8자리 숫자여야 합니다 (예: 00126380 = 삼성전자)")}`
    );
  }

  redirect(`/company/${corpCode}`);
}
