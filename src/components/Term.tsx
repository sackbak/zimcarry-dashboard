"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { lookup } from "@/lib/glossary";
import { Modal } from "@/components/Modal";
import { cn } from "@/lib/utils";

export function Term({
  children,
  name,
  className,
}: {
  children: React.ReactNode;
  name: string;
  className?: string;
}) {
  const entry = lookup(name);
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number }>({
    left: 0,
    top: 0,
  });
  const [mounted, setMounted] = useState(false);
  const anchorRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!entry) return <>{children}</>;

  const showTooltip = () => {
    if (!anchorRef.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    setPos({
      left: rect.left + rect.width / 2,
      top: rect.top,
    });
    setHover(true);
  };

  return (
    <>
      <span
        ref={anchorRef}
        role="button"
        tabIndex={0}
        onMouseEnter={showTooltip}
        onMouseLeave={() => setHover(false)}
        onFocus={showTooltip}
        onBlur={() => setHover(false)}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setHover(false);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            e.stopPropagation();
            setOpen(true);
          }
        }}
        className={cn(
          "relative inline cursor-help border-b border-dotted border-blue-400 text-blue-700 decoration-from-font hover:text-blue-900",
          className
        )}
      >
        {children}
      </span>

      {/* Tooltip portaled to body to escape parent overflow:hidden */}
      {hover && mounted &&
        createPortal(
          <div
            className="pointer-events-none fixed z-[70] w-72 -translate-x-1/2 -translate-y-full rounded-lg border border-gray-200 bg-white p-3 text-left text-[11px] leading-relaxed text-gray-700 shadow-xl"
            style={{
              left: pos.left,
              top: pos.top - 8,
            }}
          >
            <span className="block text-[11px] font-bold text-gray-900">
              {entry.term}
            </span>
            <span className="mt-1 block font-normal text-gray-600">
              {entry.short}
            </span>
            <span className="mt-1.5 block text-[10px] font-medium uppercase tracking-wider text-blue-500">
              클릭 → 상세 보기
            </span>
          </div>,
          document.body
        )}

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
