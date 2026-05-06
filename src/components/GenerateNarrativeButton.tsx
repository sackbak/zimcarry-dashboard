"use client";

import { useFormStatus } from "react-dom";
import { generateAnalysis } from "@/app/actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg border border-amber-300 bg-amber-100 px-4 py-2 text-sm font-semibold text-amber-900 shadow-sm transition-colors enabled:hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? (
        <span className="inline-flex items-center gap-2">
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-amber-700 border-t-transparent" />
          생성 중... (약 2~3분)
        </span>
      ) : (
        "AI 분석 생성하기"
      )}
    </button>
  );
}

export function GenerateNarrativeButton({ id }: { id: string }) {
  return (
    <form action={generateAnalysis}>
      <input type="hidden" name="id" value={id} />
      <SubmitButton />
    </form>
  );
}
