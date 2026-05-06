import { GLOSSARY, type GlossaryEntry } from "@/lib/glossary";
import { GlossaryRowTrigger } from "@/components/GlossaryRowTrigger";

const CATEGORY_LABEL: Record<NonNullable<GlossaryEntry["category"]>, string> = {
  concept: "개념·약어",
  growth: "성장성",
  profit: "수익성",
  stability: "안정성",
  activity: "활동성",
  cash: "현금흐름",
  investment: "투자",
};

const CATEGORY_DESC: Record<NonNullable<GlossaryEntry["category"]>, string> = {
  concept: "사이트에서 자주 쓰이는 약어와 기본 개념",
  growth: "사업이 자라는 속도와 추세 측정",
  profit: "매출 대비 얼마나 남기는지 — 본업 효율",
  stability: "빚 비중·자본 체력 — 망하지 않을 회사인가",
  activity: "보유 자산이 매출을 얼마나 잘 만드는지",
  cash: "통장에 진짜로 들어오는 현금 흐름",
  investment: "투자 라운드·가치 평가에 쓰이는 개념",
};

const ORDER: NonNullable<GlossaryEntry["category"]>[] = [
  "concept",
  "growth",
  "profit",
  "stability",
  "activity",
  "cash",
  "investment",
];

export default function GlossaryPage() {
  const grouped: Record<string, Array<{ key: string; entry: GlossaryEntry }>> =
    {};
  for (const [key, entry] of Object.entries(GLOSSARY)) {
    const cat = entry.category ?? "concept";
    (grouped[cat] = grouped[cat] || []).push({ key, entry });
  }

  const totalCount = Object.values(grouped).reduce(
    (s, arr) => s + arr.length,
    0
  );

  return (
    <div className="space-y-6">
      <header>
        <div className="text-xs font-medium uppercase tracking-wider text-gray-400">
          Glossary · 재무회계 용어집
        </div>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-gray-900 md:text-3xl">
          재무 용어집
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          사이트에서 등장하는 핵심 약어·지표 {totalCount}개를 카테고리별로 정리.
          행을 클릭하면 풀 정의·공식·짐캐리 적용 사례까지 표시. 사이트 내 약어
          단어(점선 밑줄)에서도 같은 정의를 볼 수 있어.
        </p>
      </header>

      {/* 카테고리 인덱스 */}
      <nav className="flex flex-wrap gap-2">
        {ORDER.filter((c) => grouped[c]?.length).map((c) => (
          <a
            key={c}
            href={`#cat-${c}`}
            className="rounded-md border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-700 shadow-sm transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
          >
            {CATEGORY_LABEL[c]}{" "}
            <span className="ml-1 text-gray-400">{grouped[c]?.length}</span>
          </a>
        ))}
      </nav>

      {/* 단일 표 — 카테고리별 그룹 */}
      <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-gray-50 text-[11px] uppercase tracking-wider text-gray-500">
              <tr>
                <th className="w-[14%] px-4 py-3 text-left font-medium">
                  약어 / 용어
                </th>
                <th className="w-[22%] px-4 py-3 text-left font-medium">
                  풀네임
                </th>
                <th className="w-[34%] px-4 py-3 text-left font-medium">
                  한 줄 정의
                </th>
                <th className="px-4 py-3 text-left font-medium">짐캐리 적용</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {ORDER.filter((c) => grouped[c]?.length).map((c) => (
                <GroupRows
                  key={c}
                  cat={c}
                  label={CATEGORY_LABEL[c]}
                  desc={CATEGORY_DESC[c]}
                  entries={grouped[c]}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function GroupRows({
  cat,
  label,
  desc,
  entries,
}: {
  cat: string;
  label: string;
  desc: string;
  entries: Array<{ key: string; entry: GlossaryEntry }>;
}) {
  return (
    <>
      <tr id={`cat-${cat}`} className="scroll-mt-4 bg-slate-50/70">
        <td colSpan={4} className="px-4 py-2.5">
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-slate-400" />
            <span className="text-sm font-bold text-gray-900">{label}</span>
            <span className="text-[11px] text-gray-500">— {desc}</span>
            <span className="ml-auto text-[10px] text-gray-400">
              {entries.length}개
            </span>
          </div>
        </td>
      </tr>
      {entries.map(({ key, entry }) => (
        <GlossaryRowTrigger key={key} entry={entry} />
      ))}
    </>
  );
}
