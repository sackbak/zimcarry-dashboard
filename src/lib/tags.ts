export type TagStyle = {
  bg: string;
  text: string;
  ring: string;
  chart: string;
  label: string;
};

// 단조로운 슬레이트 톤으로 통일 — 색상 노이즈 최소화.
// 핵심 강조는 신호등(red/yellow/green)에서만.
const SLATE: Pick<TagStyle, "bg" | "text" | "ring" | "chart"> = {
  bg: "bg-slate-50",
  text: "text-slate-700",
  ring: "ring-slate-200",
  chart: "#475569",
};

const SLATE_RED: Pick<TagStyle, "bg" | "text" | "ring" | "chart"> = {
  bg: "bg-rose-50",
  text: "text-rose-700",
  ring: "ring-rose-200",
  chart: "#dc2626",
};

export const TAG_STYLES: Record<string, TagStyle> = {
  매출: { ...SLATE, label: "매출" },
  수익: { ...SLATE, label: "수익" },
  인건비: { ...SLATE, label: "인건비" },
  임차료: { ...SLATE, label: "임차료" },
  플랫폼: { ...SLATE, label: "플랫폼" },
  운송: { ...SLATE, label: "운송" },
  시설운영: { ...SLATE, label: "시설운영" },
  마케팅: { ...SLATE, label: "마케팅" },
  금융: { ...SLATE, label: "금융" },
  현금성: { ...SLATE, label: "현금성" },
  운전자본: { ...SLATE, label: "운전자본" },
  인프라: { ...SLATE, label: "인프라" },
  무형: { ...SLATE, label: "무형" },
  담보금: { ...SLATE, label: "담보금" },
  차입: { ...SLATE_RED, label: "차입" },
  이자부채: { ...SLATE_RED, label: "이자부채" },
  투자자금: { ...SLATE, label: "투자자금" },
  결손: { ...SLATE_RED, label: "결손" },
  기타: { ...SLATE, label: "기타" },
};

export function tagStyle(tag: string): TagStyle {
  return TAG_STYLES[tag] ?? TAG_STYLES.기타;
}
