"use client";

import { useState } from "react";
import type { GlossaryEntry } from "@/lib/glossary";
import { Modal } from "@/components/Modal";
import { ChevronRight } from "lucide-react";

export function GlossaryRowTrigger({ entry }: { entry: GlossaryEntry }) {
  const [open, setOpen] = useState(false);

  // term 헤드는 보통 "PMF (Product-Market Fit)" 같은 형태 — 약어와 풀네임 분리
  const match = entry.term.match(/^(.+?)\s*\((.+)\)\s*$/);
  const head = match ? match[1].trim() : entry.term;
  const fullname = match ? match[2].trim() : "";

  return (
    <>
      <tr
        onClick={() => setOpen(true)}
        className="group/row cursor-pointer transition-colors hover:bg-blue-50/40"
      >
        <td className="px-4 py-2.5 align-top">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-blue-700 group-hover/row:text-blue-900">
              {head}
            </span>
            <ChevronRight className="h-3 w-3 text-gray-300 transition-transform group-hover/row:translate-x-0.5 group-hover/row:text-blue-500" />
          </div>
        </td>
        <td className="px-4 py-2.5 align-top text-[12px] text-gray-600">
          {fullname || "—"}
        </td>
        <td className="px-4 py-2.5 align-top text-[12px] text-gray-700">
          {entry.short}
        </td>
        <td className="px-4 py-2.5 align-top text-[12px] text-gray-600">
          {entry.zimcarry ?? "—"}
        </td>
      </tr>

      <Modal open={open} onClose={() => setOpen(false)} className="max-w-xl">
        <div className="space-y-4 p-6 pt-7">
          <header className="pr-8">
            <div className="text-[10px] font-medium uppercase tracking-wider text-blue-500">
              용어 사전
            </div>
            <h3 className="mt-1 text-xl font-bold text-gray-900">
              {entry.term}
            </h3>
          </header>

          <p className="rounded-lg bg-blue-50/60 p-3 text-sm leading-relaxed text-gray-800">
            {entry.short}
          </p>

          {entry.formula && (
            <Field label="공식 / 계산식" tone="slate">
              <code className="break-keep rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[12px] text-gray-800">
                {entry.formula}
              </code>
            </Field>
          )}

          {(entry.good || entry.bad) && (
            <div className="grid gap-2 sm:grid-cols-2">
              {entry.good && (
                <Field label="건강 기준" tone="emerald">
                  <span className="text-sm text-gray-700">{entry.good}</span>
                </Field>
              )}
              {entry.bad && (
                <Field label="위험 신호" tone="rose">
                  <span className="text-sm text-gray-700">{entry.bad}</span>
                </Field>
              )}
            </div>
          )}

          {entry.zimcarry && (
            <Field label="짐캐리 적용" tone="amber">
              <span className="block text-sm leading-relaxed text-gray-700">
                {entry.zimcarry}
              </span>
            </Field>
          )}
        </div>
      </Modal>
    </>
  );
}

function Field({
  label,
  tone,
  children,
}: {
  label: string;
  tone: "slate" | "emerald" | "rose" | "amber";
  children: React.ReactNode;
}) {
  const accent =
    tone === "emerald"
      ? "border-l-emerald-400 bg-emerald-50/30"
      : tone === "rose"
        ? "border-l-rose-400 bg-rose-50/30"
        : tone === "amber"
          ? "border-l-amber-400 bg-amber-50/30"
          : "border-l-slate-400 bg-slate-50/30";
  return (
    <div className={`rounded-md border-l-4 px-3 py-2 ${accent}`}>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
        {label}
      </div>
      <div className="mt-1">{children}</div>
    </div>
  );
}
