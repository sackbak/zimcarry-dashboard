import type { Signal } from "@/lib/data";

export const SIGNAL_LABEL: Record<Signal, string> = {
  green: "우수",
  yellow: "주의",
  red: "위험",
};

export const SIGNAL_DOT: Record<Signal, string> = {
  green: "🟢",
  yellow: "🟡",
  red: "🔴",
};

export const SIGNAL_BG: Record<Signal, string> = {
  green: "bg-emerald-50 text-emerald-700 border-emerald-200",
  yellow: "bg-amber-50 text-amber-700 border-amber-200",
  red: "bg-rose-50 text-rose-700 border-rose-200",
};

export const SIGNAL_BAR: Record<Signal, string> = {
  green: "bg-emerald-500",
  yellow: "bg-amber-500",
  red: "bg-rose-500",
};

export const SIGNAL_TEXT: Record<Signal, string> = {
  green: "text-emerald-600",
  yellow: "text-amber-600",
  red: "text-rose-600",
};
