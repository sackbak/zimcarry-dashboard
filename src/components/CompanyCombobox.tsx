"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import corpIndex from "@/data/corp-index.json";
import { analyzeCompany } from "@/app/actions";

type Entry = { code: string; name: string; stock: string };

const ALL: Entry[] = corpIndex as Entry[];

export function CompanyCombobox() {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Entry | null>(null);
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const wrapRef = useRef<HTMLFormElement>(null);

  const matches = useMemo<Entry[]>(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase().trim();
    const startsWith: Entry[] = [];
    const includes: Entry[] = [];
    for (const c of ALL) {
      const n = c.name.toLowerCase();
      if (n.startsWith(q) || c.stock.startsWith(q)) {
        startsWith.push(c);
      } else if (n.includes(q)) {
        includes.push(c);
      }
      if (startsWith.length >= 30) break;
    }
    return [...startsWith, ...includes].slice(0, 20);
  }, [query]);

  // 외부 클릭 시 닫기
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  // 새로 매칭 들어올 때 첫번째 active로
  useEffect(() => {
    setActiveIdx(0);
  }, [query]);

  function handleKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || matches.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, matches.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const pick = matches[activeIdx];
      if (pick) {
        setSelected(pick);
        setQuery(pick.name);
        setOpen(false);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <form action={analyzeCompany} className="relative" ref={wrapRef}>
      <input type="hidden" name="corp_code" value={selected?.code ?? ""} />
      <label className="block text-sm font-semibold text-gray-900">
        회사 검색
      </label>
      <p className="mt-1 text-xs text-gray-500">
        회사명 또는 종목코드 (예: 삼성전자, 005930, NAVER)
      </p>
      <div className="mt-3 flex gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            autoComplete="off"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelected(null);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={handleKey}
            placeholder="회사명 입력..."
            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-base shadow-sm outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
          />
          {open && matches.length > 0 && (
            <ul className="absolute z-10 mt-1 max-h-80 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-xl">
              {matches.map((c, i) => (
                <li
                  key={c.code}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setSelected(c);
                    setQuery(c.name);
                    setOpen(false);
                  }}
                  onMouseEnter={() => setActiveIdx(i)}
                  className={
                    "flex cursor-pointer items-center justify-between gap-3 px-3 py-2 text-sm " +
                    (i === activeIdx ? "bg-blue-50" : "hover:bg-gray-50")
                  }
                >
                  <span className="truncate font-medium text-gray-900">
                    {c.name}
                  </span>
                  <span className="font-mono text-[11px] text-gray-400">
                    {c.stock}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {open && query.trim() && matches.length === 0 && (
            <div className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-500 shadow-xl">
              검색 결과 없음 — 한국 상장사 ({ALL.length}개) 중 매칭 안 됨.
            </div>
          )}
        </div>
        <button
          type="submit"
          disabled={!selected}
          className="rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors enabled:hover:bg-gray-700 disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          분석 시작
        </button>
      </div>
      {selected && (
        <p className="mt-2 text-[11px] text-gray-500">
          선택됨: <span className="font-medium text-gray-700">{selected.name}</span>
          <span className="ml-2 font-mono">corp_code {selected.code} · 종목 {selected.stock}</span>
        </p>
      )}
    </form>
  );
}
