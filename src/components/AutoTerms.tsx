"use client";

import React from "react";
import { Term } from "@/components/Term";

// 긴 약어 먼저 매칭되도록 정렬 — alternation 순서 중요
const TERM_KEYS = [
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
];

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const PATTERN = new RegExp(`(${TERM_KEYS.map(escapeRegex).join("|")})`, "g");

export function AutoTerms({ text }: { text: string }) {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;

  for (const m of text.matchAll(PATTERN)) {
    const idx = m.index ?? 0;
    const matched = m[0];

    if (idx > lastIndex) {
      parts.push(text.slice(lastIndex, idx));
    }
    parts.push(
      <Term key={`t${key++}`} name={matched}>
        {matched}
      </Term>
    );
    lastIndex = idx + matched.length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  if (parts.length === 0) return <>{text}</>;
  return <>{parts}</>;
}
