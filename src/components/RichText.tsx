"use client";

import React, { createContext, useContext } from "react";
import { Term } from "@/components/Term";

// 긴 약어/용어 먼저 매칭 — alternation 순서 중요
const TERM_KEYS = [
  // 영문 약어
  "EV/EBITDA",
  "EV/Sales",
  "K-IFRS",
  "Series A",
  "Pre-A",
  "M&A",
  "SG&A",
  "EBITDA",
  "CAPEX",
  "Bridge",
  "PMF",
  "BEP",
  "OCF",
  "FCF",
  "YoY",
  "ROE",
  "ROA",
  "CAGR",
  "DSO",
  "NWC",
  "KPI",
  "Seed",
  "IR",
  // 한국어 핵심 지표 — 긴 단어 먼저
  "매출채권회수기간",
  "매출채권 회수기간",
  "매출채권회전율",
  "매출채권 회전율",
  "총자산회전율",
  "자기자본비율",
  "이자보상배율",
  "단기차입금",
  "EBITDA마진",
  "EBITDA 마진",
  "매출총이익률",
  "매출성장률",
  "영업이익률",
  "자본잠식",
  "부채비율",
  "유동비율",
];

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const TERM_PATTERN = new RegExp(
  `(${TERM_KEYS.map(escapeRegex).join("|")})`,
  "g"
);

/**
 * TermScope — 현재는 pass-through.
 *
 * 원래 "한 모달 안에서 같은 약어 첫 등장만 Term, 나머지 plain"으로 만들려 했으나
 * client mount 후 scope.seen mutation이 React Concurrent와 함께 깨져 약어 자체가
 * 표시되지 않는 버그가 생김. 사용자 의도(점선 + 호버 + 클릭) 우선이므로 일단
 * 모든 등장에 Term 적용.
 *
 * 추후 첫-등장-only 로직은 SSR-safe한 방식(텍스트 모아 미리 인덱스 계산)으로 재시도.
 */
type Scope = { seen: Set<string> };
const ScopeContext = createContext<Scope | null>(null);

export function TermScope({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function applyTerms(
  text: string,
  scope: Scope | null,
  keyPrefix: string
): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let lastIndex = 0;
  let i = 0;
  for (const m of text.matchAll(TERM_PATTERN)) {
    const idx = m.index ?? 0;
    const matched = m[0];
    if (idx > lastIndex) out.push(text.slice(lastIndex, idx));

    if (scope === null) {
      // SSR / pre-mount — 모든 등장 Term (mismatch 회피)
      out.push(
        <Term key={`${keyPrefix}-t${i++}`} name={matched}>
          {matched}
        </Term>
      );
    } else if (scope.seen.has(matched)) {
      out.push(matched);
    } else {
      scope.seen.add(matched);
      out.push(
        <Term key={`${keyPrefix}-t${i++}`} name={matched}>
          {matched}
        </Term>
      );
    }
    lastIndex = idx + matched.length;
  }
  if (lastIndex < text.length) out.push(text.slice(lastIndex));
  return out.length > 0 ? out : [text];
}

/**
 * 마크다운 inline 처리:
 *   - **bold** 마커는 strip (텍스트만 남김 — 굵게 처리 X)
 *   - ==highlight== 는 빨강 강조 유지 (위험 신호)
 *   - 약어/한국어 핵심 지표 자동 감지 (scope 안에서 첫 등장만 Term)
 */
export function RichText({ text }: { text: string }) {
  const scope = useContext(ScopeContext);

  const segments: React.ReactNode[] = [];
  const re = /\*\*([^*]+?)\*\*|==([^=]+?)==/g;
  let lastIndex = 0;
  let i = 0;

  for (const m of text.matchAll(re)) {
    const idx = m.index ?? 0;
    if (idx > lastIndex) {
      segments.push(...applyTerms(text.slice(lastIndex, idx), scope, `s${i++}`));
    }
    if (m[1] != null) {
      // bold 마커 — 굵게 X, plain text로
      segments.push(...applyTerms(m[1], scope, `b${i++}`));
    } else if (m[2] != null) {
      // highlight — 빨강 강조 유지
      segments.push(
        <mark
          key={`h${i++}`}
          className="rounded bg-rose-50 px-0.5 font-medium text-rose-700"
          style={{ background: "transparent" }}
        >
          {applyTerms(m[2], scope, `h${i}`)}
        </mark>
      );
    }
    lastIndex = idx + m[0].length;
  }
  if (lastIndex < text.length) {
    segments.push(...applyTerms(text.slice(lastIndex), scope, `s${i++}`));
  }

  if (segments.length === 0) return <>{text}</>;
  return <>{segments}</>;
}
