/**
 * 백만원 단위(JSON 원본)를 사람이 읽기 쉬운 형식으로 포맷.
 * 음수는 부호를 살리고 0/null 처리도 함.
 */

const NF = new Intl.NumberFormat("ko-KR");

export function fmtMil(value: number | null | undefined, opts?: { sign?: boolean }): string {
  if (value == null) return "-";
  const abs = Math.abs(value);
  const formatted = NF.format(Math.round(value));
  if (opts?.sign && value > 0) return `+${formatted}`;
  return formatted;
}

/** 백만원 → 억(소수1자리). 1억 미만이면 백만원 그대로. */
export function fmtEok(value: number | null | undefined, opts?: { sign?: boolean; digits?: number }): string {
  if (value == null) return "-";
  const digits = opts?.digits ?? 1;
  const eok = value / 100;
  const abs = Math.abs(eok);
  if (abs < 1 && value !== 0) {
    return `${NF.format(Math.round(value))}백만`;
  }
  const sign = opts?.sign && eok > 0 ? "+" : "";
  return `${sign}${eok.toFixed(digits)}억`;
}

/** 0.286 → "+28.6%" / null → "-" */
export function fmtPct(value: number | null | undefined, opts?: { sign?: boolean; digits?: number }): string {
  if (value == null) return "-";
  const digits = opts?.digits ?? 1;
  const pct = value * 100;
  const sign = opts?.sign && pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(digits)}%`;
}

/** 11.54 → "11.5x" — 배수 표기 */
export function fmtMultiple(value: number | null | undefined, digits = 1): string {
  if (value == null) return "-";
  return `${value.toFixed(digits)}x`;
}

/** 단위가 동적으로 들어오는 KPI(억/개월/% 등) 출력. */
export function fmtKpi(value: number | string, unit: string): string {
  if (typeof value === "string") return unit ? `${value} ${unit}` : value;
  switch (unit) {
    case "%":
      return `${(value * 100).toFixed(1)}%`;
    case "배":
    case "회":
    case "x":
      return `${value.toFixed(1)}${unit}`;
    case "일":
      return `${value.toFixed(0)}${unit}`;
    case "개월":
      return `${value.toFixed(1)}${unit}`;
    case "억":
      return `${value.toFixed(2)}${unit}`;
    default:
      return unit ? `${NF.format(Math.round(value))} ${unit}` : NF.format(Math.round(value));
  }
}
