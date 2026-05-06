"use client";

import { useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { uploadCompanyFile } from "@/app/actions";
import { Spinner } from "@/components/AnalyzeButton";
import { cn } from "@/lib/utils";

function UploadButton({ disabled }: { disabled?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className={cn(
        "rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800 shadow-sm transition-colors enabled:hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50",
        pending && "cursor-wait"
      )}
    >
      {pending ? (
        <span className="inline-flex items-center gap-2">
          <Spinner />
          추출 중... (10~30초)
        </span>
      ) : (
        "업로드 후 분석"
      )}
    </button>
  );
}

export function UploadForm() {
  const [fileName, setFileName] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <form action={uploadCompanyFile} className="space-y-3">
      <div>
        <label className="block text-sm font-semibold text-gray-900">
          비상장사 자료 업로드
        </label>
        <p className="mt-1 text-xs text-gray-500">
          PDF(IR덱·감사보고서) 또는 Excel(.xlsx). 회사명·5개년 재무3표 자동 추출.
        </p>
        <p className="mt-0.5 text-[11px] text-gray-400">
          비용: PDF ~15원 / Excel ~10원 (Gemini 2.5 Flash). 20MB 이하.
        </p>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 shadow-sm transition-colors hover:border-gray-400 hover:bg-gray-50"
        >
          파일 선택
        </button>
        <span
          className={cn(
            "flex-1 truncate text-xs",
            fileName ? "text-gray-700" : "text-gray-400"
          )}
        >
          {fileName ?? "선택된 파일 없음"}
        </span>
        <UploadButton disabled={!fileName} />
      </div>

      <input
        ref={inputRef}
        type="file"
        name="file"
        accept=".pdf,.xlsx,.xls,application/pdf,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          setFileName(f ? f.name : null);
        }}
      />
    </form>
  );
}
