"use client";

/**
 * Investment 탭 카드들 — 클릭 시 모달로 정의·계산식·해석 표시.
 *
 * 모든 카드는 button + Modal 패턴. 카드 본문은 짧게, 모달에 디테일.
 */

import { useState, type ReactNode } from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Modal } from "@/components/Modal";
import { fmtPct, fmtScaled, pickMoneyScale } from "@/lib/format";
import { SIGNAL_BAR } from "@/lib/signal";
import type { Signal } from "@/lib/data";
import type { VCMetrics } from "@/lib/vc";
import type { ValuationResult, MultipleRange } from "@/lib/valuation";

// ─── Generic wrapper ──────────────────────────────────────────────

function MetricButton({
  signal,
  variant = "card",
  onClick,
  children,
}: {
  signal?: Signal;
  variant?: "card" | "compact";
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group/inv relative flex w-full flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-white text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md",
        variant === "compact" && "p-0"
      )}
    >
      {signal && <div className={cn("h-1 w-full", SIGNAL_BAR[signal])} />}
      {children}
    </button>
  );
}

function ModalShell({
  open,
  onClose,
  title,
  signal,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  signal?: Signal;
  children: ReactNode;
}) {
  return (
    <Modal open={open} onClose={onClose} className="max-w-2xl">
      <div className="space-y-4 p-6 pt-7">
        <header className="pr-8">
          <div className="text-[10px] font-medium uppercase tracking-wider text-blue-500">
            VC 관점 지표
          </div>
          <h3 className="mt-1 flex items-center gap-2 text-xl font-bold text-gray-900">
            {title}
            {signal && (
              <span className={cn("inline-block h-2 w-2 rounded-full", SIGNAL_BAR[signal])} />
            )}
          </h3>
        </header>
        {children}
      </div>
    </Modal>
  );
}

function DefinitionBox({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg bg-blue-50/60 p-4">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-blue-700">
        정의 / 계산식
      </div>
      <div className="mt-1 text-sm leading-relaxed text-gray-800">{children}</div>
    </div>
  );
}

function HealthBox({ tone, label, children }: { tone: "good" | "bad"; label: string; children: ReactNode }) {
  const cls =
    tone === "good"
      ? "border-l-emerald-400 bg-emerald-50/30 text-emerald-700"
      : "border-l-rose-400 bg-rose-50/30 text-rose-700";
  return (
    <div className={cn("rounded-md border-l-4 px-3 py-2", cls)}>
      <div className="text-[10px] font-semibold uppercase tracking-wider">{label}</div>
      <div className="mt-0.5 text-sm leading-relaxed text-gray-700">{children}</div>
    </div>
  );
}

function Search3() {
  return <Search className="h-3 w-3 shrink-0 text-gray-300 transition-colors group-hover/inv:text-blue-500" />;
}

// ─── Hero cards ──────────────────────────────────────────────────

export function CapitalEfficiencyCard({ vc }: { vc: VCMetrics }) {
  const [open, setOpen] = useState(false);
  const ce = vc.capital_efficiency;
  const scale = pickMoneyScale(
    Math.max(
      Math.abs(ce.cumulative_revenue_mil ?? 0),
      Math.abs(ce.invested_capital_mil ?? 0)
    )
  );
  const sig: Signal =
    ce.ratio == null ? "yellow" : ce.ratio >= 5 ? "green" : ce.ratio >= 2 ? "yellow" : "red";

  return (
    <>
      <MetricButton signal={sig} onClick={() => setOpen(true)}>
        <div className="flex flex-col gap-3 p-6">
          <div className="flex items-start justify-between">
            <div className="text-[10px] font-medium uppercase tracking-wider text-gray-400">
              자본 효율성
            </div>
            <Search3 />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-bold tracking-tight tabular-nums text-gray-900">
              {ce.ratio != null ? `${ce.ratio.toFixed(1)}x` : "-"}
            </span>
            <span className="text-xs text-gray-500">매출 / 조달 자본</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-md bg-gray-50 p-2">
              <div className="text-[10px] text-gray-500">5년 누적 매출</div>
              <div className="font-semibold text-gray-900">
                {fmtScaled(ce.cumulative_revenue_mil, scale)}{" "}
                <span className="text-[10px] text-gray-400">{scale.label}</span>
              </div>
            </div>
            <div className="rounded-md bg-gray-50 p-2">
              <div className="text-[10px] text-gray-500">조달 자본 (자본금+잉여)</div>
              <div className="font-semibold text-gray-900">
                {fmtScaled(ce.invested_capital_mil, scale)}{" "}
                <span className="text-[10px] text-gray-400">{scale.label}</span>
              </div>
            </div>
          </div>
        </div>
      </MetricButton>

      <ModalShell open={open} onClose={() => setOpen(false)} title="자본 효율성" signal={sig}>
        <DefinitionBox>
          누적 매출 ÷ (자본금 + 자본잉여금). 외부에서 조달한 자본 1원당 누적 매출이 몇 원인지로
          자본 효율성을 측정. VC가 가장 먼저 보는 지표 중 하나.
          <div className="mt-2 text-[12px]">
            <code className="rounded bg-white px-1.5 py-0.5 font-mono">
              cumulative_revenue ÷ (capital_stock + capital_surplus)
            </code>
          </div>
        </DefinitionBox>
        <div className="grid gap-2 sm:grid-cols-2">
          <HealthBox tone="good" label="우수 5x↑">
            조달 자본의 5배 넘는 매출을 만든 회사. 자본 효율성 매우 좋음.
          </HealthBox>
          <HealthBox tone="bad" label="비효율 2x 미만">
            자본을 받았는데 매출이 그만큼 안 나옴. Cash burn으로 사라지고 있는 신호.
          </HealthBox>
        </div>
        <p className="text-[11px] text-gray-500">
          ※ 자본금+자본잉여금이 누적 외부 조달의 정확한 추정은 아님 (자기주식·전환·이익잉여금
          전입 등 영향). 단 1차 근사로 실용적.
        </p>
      </ModalShell>
    </>
  );
}

export function BepCard({ vc, lastYear }: { vc: VCMetrics; lastYear: number | null }) {
  const [open, setOpen] = useState(false);
  const b = vc.bep_estimate;
  const isPositive = b.last_op_margin != null && b.last_op_margin >= 0;
  const sig: Signal = isPositive
    ? "green"
    : b.years_to_bep != null && b.years_to_bep <= 2
      ? "yellow"
      : "red";

  let bigText: string;
  if (isPositive) bigText = `이미 흑자 (${lastYear})`;
  else if (b.bep_year != null) bigText = `${b.bep_year}년 예상`;
  else if (b.last_op_margin == null) bigText = "데이터 부족";
  else bigText = "흑자 둔화";

  return (
    <>
      <MetricButton signal={sig} onClick={() => setOpen(true)}>
        <div className="flex flex-col gap-3 p-6">
          <div className="flex items-start justify-between">
            <div className="text-[10px] font-medium uppercase tracking-wider text-gray-400">
              BEP 도달
            </div>
            <Search3 />
          </div>
          <div className="text-4xl font-bold tracking-tight tabular-nums text-gray-900">
            {bigText}
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-md bg-gray-50 p-2">
              <div className="text-[10px] text-gray-500">최근 영업이익률</div>
              <div className="font-semibold text-gray-900">
                {fmtPct(b.last_op_margin, { sign: true, digits: 1 })}
              </div>
            </div>
            <div className="rounded-md bg-gray-50 p-2">
              <div className="text-[10px] text-gray-500">YoY 마진 변화</div>
              <div
                className={cn(
                  "font-semibold",
                  b.op_margin_yoy_delta == null
                    ? "text-gray-400"
                    : b.op_margin_yoy_delta > 0
                      ? "text-emerald-700"
                      : "text-rose-700"
                )}
              >
                {fmtPct(b.op_margin_yoy_delta, { sign: true, digits: 1 })}
              </div>
            </div>
          </div>
        </div>
      </MetricButton>

      <ModalShell open={open} onClose={() => setOpen(false)} title="BEP 도달 예측" signal={sig}>
        <DefinitionBox>
          영업이익률이 0%가 되는 시점 추정. 직전 2년 마진 변화량(YoY delta)이 일정하다고 가정한 선형 외삽.
          <div className="mt-2 text-[12px]">
            <code className="rounded bg-white px-1.5 py-0.5 font-mono">
              years_to_bep = ⌈ -last_op_margin ÷ yoy_delta ⌉  (yoy_delta &gt; 0일 때만)
            </code>
          </div>
        </DefinitionBox>
        <div className="grid gap-2 sm:grid-cols-2">
          <HealthBox tone="good" label="우수 — 이미 흑자 또는 2년 내 도달">
            본업이 자력으로 굴러갈 가시권. M&A·후속 라운드 시 주된 자산.
          </HealthBox>
          <HealthBox tone="bad" label="위험 — 마진 둔화·악화 중">
            손익 개선이 멈췄거나 역행 중. 비용 구조 점검 또는 사업 모델 재검토 필요.
          </HealthBox>
        </div>
        <p className="text-[11px] text-gray-500">
          ※ 선형 외삽은 단순화 가정. 매출 mix 변화·시즌성·고정비 도약 등 실제 경로는 비선형. 큰 그림용 지표.
        </p>
      </ModalShell>
    </>
  );
}

// ─── Burn 3-set ──────────────────────────────────────────────────

export function BurnCard({ vc }: { vc: VCMetrics }) {
  const [open, setOpen] = useState(false);
  const b = vc.burn;
  const scale = pickMoneyScale(Math.abs(b.monthly_burn_mil ?? 0) * 12);
  const isProfitable = b.annual_fcf_mil != null && b.annual_fcf_mil >= 0;

  return (
    <>
      <MetricButton onClick={() => setOpen(true)}>
        <div className="p-5">
          <div className="flex items-start justify-between">
            <div className="text-[10px] font-medium uppercase tracking-wider text-gray-400">
              월간 Burn
            </div>
            <Search3 />
          </div>
          <div className="mt-2 text-2xl font-bold tabular-nums text-gray-900">
            {isProfitable
              ? "FCF (+)"
              : b.monthly_burn_mil != null
                ? `${fmtScaled(b.monthly_burn_mil, scale)} ${scale.label}`
                : "-"}
          </div>
          <div className="mt-1 text-[11px] text-gray-500">
            연간 FCF{" "}
            {b.annual_fcf_mil != null ? fmtScaled(b.annual_fcf_mil, scale) : "-"}{" "}
            {scale.label}
          </div>
        </div>
      </MetricButton>

      <ModalShell open={open} onClose={() => setOpen(false)} title="월간 Burn rate">
        <DefinitionBox>
          최근 연도 FCF가 음수이면 12개월로 나눈 월간 cash burn. FCF가 양수이면 자력 생존(burn 없음).
          <div className="mt-2 text-[12px]">
            <code className="rounded bg-white px-1.5 py-0.5 font-mono">
              monthly_burn = max(0, -annual_fcf) ÷ 12
            </code>
          </div>
        </DefinitionBox>
        <p className="text-sm leading-relaxed text-gray-700">
          ARR 증가분 대비 burn 효율은 <strong>Burn Multiple</strong> 카드 참조. 단순 burn 절댓값만으로는
          판단 어려움 — 매출 규모와 함께 봐야 의미 있음.
        </p>
      </ModalShell>
    </>
  );
}

export function RunwayCard({ vc }: { vc: VCMetrics }) {
  const [open, setOpen] = useState(false);
  const r = vc.burn.runway_months;
  const sig: Signal = r == null ? "yellow" : r >= 18 ? "green" : r >= 6 ? "yellow" : "red";

  return (
    <>
      <MetricButton signal={sig} onClick={() => setOpen(true)}>
        <div className="p-5">
          <div className="flex items-start justify-between">
            <div className="text-[10px] font-medium uppercase tracking-wider text-gray-400">
              Runway
            </div>
            <Search3 />
          </div>
          <div className="mt-2 text-2xl font-bold tabular-nums text-gray-900">
            {r != null ? `${r.toFixed(1)}개월` : "-"}
          </div>
          <div className="mt-1 text-[11px] text-gray-500">
            18개월↑ 안전 / 6개월 미만 긴급
          </div>
        </div>
      </MetricButton>

      <ModalShell open={open} onClose={() => setOpen(false)} title="Runway" signal={sig}>
        <DefinitionBox>
          현재 현금 ÷ 월간 burn. 이 속도로 까먹으면 몇 개월 만에 현금 바닥나는지.
          <div className="mt-2 text-[12px]">
            <code className="rounded bg-white px-1.5 py-0.5 font-mono">
              runway_months = cash ÷ monthly_burn
            </code>
          </div>
        </DefinitionBox>
        <div className="grid gap-2 sm:grid-cols-2">
          <HealthBox tone="good" label="안전 18개월↑">
            다음 라운드 준비할 시간 충분. 매출 성장에 집중 가능.
          </HealthBox>
          <HealthBox tone="bad" label="긴급 6개월 미만">
            지금 라운드 안 닫으면 폐업 시그널. Bridge·구조조정 즉시.
          </HealthBox>
        </div>
      </ModalShell>
    </>
  );
}

export function BurnMultipleCard({ vc }: { vc: VCMetrics }) {
  const [open, setOpen] = useState(false);
  const bm = vc.burn_multiple;
  const GRADE_COLOR: Record<NonNullable<VCMetrics["burn_multiple"]["grade"]>, Signal> = {
    amazing: "green",
    great: "green",
    ok: "yellow",
    poor: "red",
    bad: "red",
  };
  const GRADE_LABEL: Record<NonNullable<VCMetrics["burn_multiple"]["grade"]>, string> = {
    amazing: "🏆 amazing",
    great: "✨ great",
    ok: "🟡 ok",
    poor: "⚠️ poor",
    bad: "🔴 bad",
  };
  const sig: Signal = bm.grade ? GRADE_COLOR[bm.grade] : "yellow";

  return (
    <>
      <MetricButton signal={sig} onClick={() => setOpen(true)}>
        <div className="p-5">
          <div className="flex items-start justify-between">
            <div className="text-[10px] font-medium uppercase tracking-wider text-gray-400">
              Burn Multiple
            </div>
            <Search3 />
          </div>
          <div className="mt-2 text-2xl font-bold tabular-nums text-gray-900">
            {bm.multiple != null ? `${bm.multiple.toFixed(2)}x` : "-"}
          </div>
          <div className="mt-1 text-[11px] text-gray-500">
            {bm.grade ? GRADE_LABEL[bm.grade] : "데이터 부족"} · burn / ARR 증가분
          </div>
        </div>
      </MetricButton>

      <ModalShell open={open} onClose={() => setOpen(false)} title="Burn Multiple" signal={sig}>
        <DefinitionBox>
          연간 cash burn ÷ 연간 매출 증가분. 매출을 1원 늘리려고 burn을 몇 원 썼나. SaaS·VC 표준 지표
          (Bessemer, SaaStr).
          <div className="mt-2 text-[12px]">
            <code className="rounded bg-white px-1.5 py-0.5 font-mono">
              burn_multiple = annual_burn ÷ (revenue_t − revenue_t-1)
            </code>
          </div>
        </DefinitionBox>
        <div className="space-y-1 rounded-lg border border-gray-200 p-3 text-sm">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
            Bessemer 등급
          </div>
          <div className="flex justify-between">
            <span>🏆 amazing</span>
            <span className="font-mono text-gray-700">&lt; 1x</span>
          </div>
          <div className="flex justify-between">
            <span>✨ great</span>
            <span className="font-mono text-gray-700">1 ~ 1.5x</span>
          </div>
          <div className="flex justify-between">
            <span>🟡 ok</span>
            <span className="font-mono text-gray-700">1.5 ~ 2x</span>
          </div>
          <div className="flex justify-between">
            <span>⚠️ poor</span>
            <span className="font-mono text-gray-700">2 ~ 3x</span>
          </div>
          <div className="flex justify-between">
            <span>🔴 bad</span>
            <span className="font-mono text-gray-700">≥ 3x</span>
          </div>
        </div>
        <p className="text-[11px] text-gray-500">
          ※ 매출이 줄어든 해(역성장)는 의미 없음 — null로 처리. SaaS·구독형 사업에 가장 잘 맞고, 일회성
          수주가 큰 사업은 변동성 큼.
        </p>
      </ModalShell>
    </>
  );
}

// ─── Liquidation table ───────────────────────────────────────────

export function LiquidationCard({ vc }: { vc: VCMetrics }) {
  const [open, setOpen] = useState(false);
  const l = vc.liquidation;
  const scale = pickMoneyScale(
    Math.max(
      Math.abs(l.total_recoverable_mil ?? 0),
      Math.abs(l.total_liab_mil ?? 0),
      Math.abs(l.book_equity_mil ?? 0)
    )
  );
  const sig: Signal =
    l.coverage_ratio == null
      ? "yellow"
      : l.coverage_ratio >= 1
        ? "green"
        : l.coverage_ratio >= 0.5
          ? "yellow"
          : "red";
  const rows: { label: string; value: number | null; note?: string }[] = [
    { label: "현금 및 현금성 자산 (100%)", value: l.cash_mil },
    { label: "매출채권 회수 (×0.7)", value: l.ar_recoverable_mil },
    { label: "유형자산 회수 (×0.3)", value: l.tangible_recoverable_mil },
    {
      label: "무형자산 (0%)",
      value: l.intangible_recoverable_mil,
      note: "청산 시 영업권·개발비는 회수 어려움",
    },
  ];

  return (
    <>
      <MetricButton signal={sig} onClick={() => setOpen(true)}>
        <div className="p-6">
          <div className="flex items-start justify-between">
            <div className="text-[10px] font-medium uppercase tracking-wider text-gray-400">
              청산가치
            </div>
            <Search3 />
          </div>
          <table className="mt-3 w-full text-sm">
            <tbody className="divide-y divide-gray-100">
              {rows.map((r) => (
                <tr key={r.label}>
                  <td className="py-2 text-gray-700">{r.label}</td>
                  <td className="py-2 text-right tabular-nums text-gray-900">
                    {fmtScaled(r.value, scale)}{" "}
                    <span className="text-[10px] text-gray-400">{scale.label}</span>
                  </td>
                </tr>
              ))}
              <tr className="border-t-2 border-gray-200">
                <td className="py-2 font-semibold text-gray-900">총 회수 가능</td>
                <td className="py-2 text-right font-semibold tabular-nums text-gray-900">
                  {fmtScaled(l.total_recoverable_mil, scale)}{" "}
                  <span className="text-[10px] text-gray-400">{scale.label}</span>
                </td>
              </tr>
              <tr>
                <td className="py-2 text-gray-700">(−) 부채 총계</td>
                <td className="py-2 text-right tabular-nums text-rose-700">
                  {l.total_liab_mil != null
                    ? `−${fmtScaled(l.total_liab_mil, scale)}`
                    : "-"}{" "}
                  <span className="text-[10px] text-gray-400">{scale.label}</span>
                </td>
              </tr>
              <tr className="border-t-2 border-gray-300">
                <td className="py-2 font-bold text-gray-900">청산 시 순가치</td>
                <td
                  className={cn(
                    "py-2 text-right text-lg font-bold tabular-nums",
                    l.net_liquidation_mil != null && l.net_liquidation_mil < 0
                      ? "text-rose-700"
                      : "text-gray-900"
                  )}
                >
                  {fmtScaled(l.net_liquidation_mil, scale)}{" "}
                  <span className="text-[10px] text-gray-400">{scale.label}</span>
                </td>
              </tr>
              <tr>
                <td className="py-2 text-gray-500">장부 자본 대비</td>
                <td className="py-2 text-right tabular-nums text-gray-700">
                  {l.coverage_ratio != null
                    ? `${(l.coverage_ratio * 100).toFixed(0)}%`
                    : "-"}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </MetricButton>

      <ModalShell open={open} onClose={() => setOpen(false)} title="청산가치" signal={sig}>
        <DefinitionBox>
          회사가 지금 폐업해 자산을 처분한다고 가정할 때 회수 가능한 순가치. M&A 시 다운사이드 가격
          floor의 1차 근사. 회수율은 자산 종류별 보수적 보편치를 적용.
          <div className="mt-2 text-[12px]">
            <code className="rounded bg-white px-1.5 py-0.5 font-mono">
              cash×100% + AR×70% + 유형×30% + 무형×0% − 부채총계
            </code>
          </div>
        </DefinitionBox>
        <div className="grid gap-2 sm:grid-cols-2">
          <HealthBox tone="good" label="우수 100%↑">
            청산해도 장부 자본 보호. 청산가치 floor 자체로 매수 매력.
          </HealthBox>
          <HealthBox tone="bad" label="위험 50% 미만">
            청산 시 부채 다 못 갚음. M&A 가격이 0에 수렴할 수 있음.
          </HealthBox>
        </div>
        <p className="text-[11px] text-gray-500">
          ※ 회수율(현금 100, AR 70, 유형 30, 무형 0)은 보수적 보편치. 실제는 산업·자산 질에 따라 차이.
          연결재무 vs 단독, 질권·담보 설정 여부도 별도 검토 필요.
        </p>
      </ModalShell>
    </>
  );
}

// ─── Valuation ───────────────────────────────────────────────────

function fmtRange(
  range: MultipleRange | null,
  scale: { divisor: number; label: string }
): string {
  if (!range) return "-";
  return `${fmtScaled(range.low, scale)} ~ ${fmtScaled(range.high, scale)}`;
}

export function ValuationCard({ valuation }: { valuation: ValuationResult }) {
  const [open, setOpen] = useState(false);
  const v = valuation;
  const scale = pickMoneyScale(
    Math.max(
      Math.abs(v.ev_from_ebitda?.high ?? 0),
      Math.abs(v.ev_from_sales?.high ?? 0),
      Math.abs(v.blended_ev_mid_mil ?? 0)
    )
  );

  const blendedDisplay =
    v.blended_ev_mid_mil != null
      ? `${fmtScaled(v.blended_ev_mid_mil, scale)} ${scale.label}`
      : "-";
  const equityDisplay =
    v.blended_equity_mid_mil != null
      ? `${fmtScaled(v.blended_equity_mid_mil, scale)} ${scale.label}`
      : "-";

  return (
    <>
      <MetricButton onClick={() => setOpen(true)}>
        <div className="p-6">
          <div className="flex items-start justify-between">
            <div className="text-[10px] font-medium uppercase tracking-wider text-gray-400">
              밸류에이션 추정 ({v.industry.label})
            </div>
            <Search3 />
          </div>
          <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div>
              <div className="text-[10px] text-gray-500">EV (기업가치) 중간값</div>
              <div className="mt-1 text-2xl font-bold tabular-nums text-gray-900">
                {blendedDisplay}
              </div>
              <div className="mt-1 text-[11px] text-gray-500">
                EV/EBITDA mid + EV/Sales mid 평균
              </div>
            </div>
            <div>
              <div className="text-[10px] text-gray-500">Equity (지분가치) 중간값</div>
              <div className="mt-1 text-2xl font-bold tabular-nums text-gray-900">
                {equityDisplay}
              </div>
              <div className="mt-1 text-[11px] text-gray-500">
                EV − net debt
              </div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-md bg-gray-50 p-2">
              <div className="text-[10px] text-gray-500">EV/EBITDA 범위</div>
              <div className="font-semibold text-gray-900">
                {v.ebitda_negative
                  ? "EBITDA 음수 — 미적용"
                  : fmtRange(v.ev_from_ebitda, scale)}{" "}
                <span className="text-[10px] text-gray-400">{scale.label}</span>
              </div>
            </div>
            <div className="rounded-md bg-gray-50 p-2">
              <div className="text-[10px] text-gray-500">EV/Sales 범위</div>
              <div className="font-semibold text-gray-900">
                {fmtRange(v.ev_from_sales, scale)}{" "}
                <span className="text-[10px] text-gray-400">{scale.label}</span>
              </div>
            </div>
          </div>
        </div>
      </MetricButton>

      <ModalShell
        open={open}
        onClose={() => setOpen(false)}
        title="밸류에이션 추정"
      >
        <DefinitionBox>
          M&A·투자 가격 협상의 1차 시작점. 산업 표준 multiple을 회사의 EBITDA·매출에 곱해
          <strong> EV(기업가치) 범위 → Equity(지분가치) 범위</strong>를 산출.
          <div className="mt-2 text-[12px]">
            <code className="block rounded bg-white px-1.5 py-1 font-mono">
              EV = EBITDA × multiple_EBITDA  (또는 매출 × multiple_Sales)
            </code>
            <code className="mt-1 block rounded bg-white px-1.5 py-1 font-mono">
              Equity = EV − Net Debt  (Net Debt = 차입금 − 현금)
            </code>
          </div>
        </DefinitionBox>

        <div className="rounded-lg border border-gray-200 p-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
            적용 산업 · {v.industry.label}
          </div>
          <table className="mt-2 w-full text-sm">
            <thead className="text-[10px] uppercase tracking-wider text-gray-400">
              <tr>
                <th className="text-left">기준</th>
                <th className="text-right">Low</th>
                <th className="text-right">Mid</th>
                <th className="text-right">High</th>
              </tr>
            </thead>
            <tbody className="text-gray-700">
              <tr className="border-t border-gray-100">
                <td className="py-1.5 font-medium">EV / EBITDA</td>
                <td className="py-1.5 text-right tabular-nums">
                  {v.industry.ev_ebitda.low}x
                </td>
                <td className="py-1.5 text-right tabular-nums">
                  {v.industry.ev_ebitda.mid}x
                </td>
                <td className="py-1.5 text-right tabular-nums">
                  {v.industry.ev_ebitda.high}x
                </td>
              </tr>
              <tr className="border-t border-gray-100">
                <td className="py-1.5 font-medium">EV / Sales</td>
                <td className="py-1.5 text-right tabular-nums">
                  {v.industry.ev_sales.low}x
                </td>
                <td className="py-1.5 text-right tabular-nums">
                  {v.industry.ev_sales.mid}x
                </td>
                <td className="py-1.5 text-right tabular-nums">
                  {v.industry.ev_sales.high}x
                </td>
              </tr>
            </tbody>
          </table>
          <p className="mt-2 text-[11px] leading-relaxed text-gray-500">
            {v.industry.notes}
          </p>
        </div>

        <ValuationBreakdown valuation={v} />

        <div className="grid gap-2 sm:grid-cols-2">
          <HealthBox tone="good" label="활용법">
            High 값은 가격 협상의 ceiling, Low는 floor. Mid는 통상 1차 제안. peer comp +
            DCF로 검증.
          </HealthBox>
          <HealthBox tone="bad" label="주의">
            EBITDA 음수면 EV/EBITDA 무효. 적자 기업은 EV/Sales + DCF로만. control premium·
            non-recurring 항목 별도 조정.
          </HealthBox>
        </div>

        <p className="text-[11px] text-gray-500">
          ※ 산업별 multiple은 Korea market median 표준치 (2024~2025 기준 보수적 합의 범위).
          실제 거래는 회사 특수성·딜 구조·시장 환경에 따라 ±50% 변동. 본 dashboard는
          range 시작점만 제공.
        </p>
      </ModalShell>
    </>
  );
}

function ValuationBreakdown({ valuation }: { valuation: ValuationResult }) {
  const v = valuation;
  const scale = pickMoneyScale(
    Math.max(
      Math.abs(v.ev_from_ebitda?.high ?? 0),
      Math.abs(v.ev_from_sales?.high ?? 0),
      Math.abs(v.inputs.revenue_mil ?? 0)
    )
  );
  return (
    <div className="rounded-lg border border-gray-200">
      <div className="border-b border-gray-200 bg-gray-50 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-gray-600">
        계산 내역 (단위: {scale.label}원)
      </div>
      <table className="w-full text-sm">
        <tbody className="divide-y divide-gray-100">
          <tr>
            <td className="px-3 py-2 text-gray-600">최근 EBITDA</td>
            <td className="px-3 py-2 text-right tabular-nums text-gray-900">
              {v.ebitda_negative ? "음수 — multiple 미적용" : fmtScaled(v.inputs.ebitda_mil, scale)}
            </td>
          </tr>
          <tr>
            <td className="px-3 py-2 text-gray-600">최근 매출</td>
            <td className="px-3 py-2 text-right tabular-nums text-gray-900">
              {fmtScaled(v.inputs.revenue_mil, scale)}
            </td>
          </tr>
          <tr>
            <td className="px-3 py-2 text-gray-600">총 차입금 (단기 + 장기)</td>
            <td className="px-3 py-2 text-right tabular-nums text-gray-900">
              {fmtScaled(v.inputs.total_debt_mil, scale)}
            </td>
          </tr>
          <tr>
            <td className="px-3 py-2 text-gray-600">(−) 현금</td>
            <td className="px-3 py-2 text-right tabular-nums text-gray-900">
              {fmtScaled(v.inputs.cash_mil, scale)}
            </td>
          </tr>
          <tr className="bg-gray-50">
            <td className="px-3 py-2 font-semibold text-gray-900">Net Debt</td>
            <td className="px-3 py-2 text-right font-semibold tabular-nums text-gray-900">
              {fmtScaled(v.inputs.net_debt_mil, scale)}
            </td>
          </tr>
          <tr className="border-t-2 border-gray-200">
            <td className="px-3 py-2 font-semibold text-gray-900">EV (EBITDA Mid)</td>
            <td className="px-3 py-2 text-right font-semibold tabular-nums text-gray-900">
              {v.ebitda_negative ? "—" : fmtScaled(v.ev_from_ebitda?.mid ?? null, scale)}
            </td>
          </tr>
          <tr>
            <td className="px-3 py-2 font-semibold text-gray-900">EV (Sales Mid)</td>
            <td className="px-3 py-2 text-right font-semibold tabular-nums text-gray-900">
              {fmtScaled(v.ev_from_sales?.mid ?? null, scale)}
            </td>
          </tr>
          <tr className="border-t-2 border-gray-300 bg-blue-50/40">
            <td className="px-3 py-2 font-bold text-gray-900">Blended EV Mid</td>
            <td className="px-3 py-2 text-right text-lg font-bold tabular-nums text-gray-900">
              {fmtScaled(v.blended_ev_mid_mil, scale)}
            </td>
          </tr>
          <tr className="bg-blue-50/40">
            <td className="px-3 py-2 font-bold text-gray-900">Blended Equity Mid</td>
            <td className="px-3 py-2 text-right text-lg font-bold tabular-nums text-blue-700">
              {fmtScaled(v.blended_equity_mid_mil, scale)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ─── Asset-light + Capital history ───────────────────────────────

export function AssetLightCard({ vc }: { vc: VCMetrics }) {
  const [open, setOpen] = useState(false);
  const a = vc.asset_light;
  return (
    <>
      <MetricButton onClick={() => setOpen(true)}>
        <div className="p-6">
          <div className="flex items-start justify-between">
            <div className="text-[10px] font-medium uppercase tracking-wider text-gray-400">
              Asset-light Score
            </div>
            <Search3 />
          </div>
          <div className="mt-2 text-3xl font-bold tabular-nums text-gray-900">
            {fmtPct(a.intangible_ratio, { digits: 1 })}
          </div>
          <div className="mt-1 text-[11px] text-gray-500">무형자산 / 총자산</div>
          <p className="mt-3 text-xs leading-relaxed text-gray-600">
            SaaS·플랫폼 보통 5~20%. 30% 이상이면 영업권/개발비 자산화 watchpoint.
          </p>
        </div>
      </MetricButton>

      <ModalShell open={open} onClose={() => setOpen(false)} title="Asset-light Score">
        <DefinitionBox>
          무형자산 ÷ 총자산. 사업이 물리적 자산에 얼마나 묶여있는지의 역지표. 0에 가까울수록
          자산-경량(asset-light) 비즈니스.
          <div className="mt-2 text-[12px]">
            <code className="rounded bg-white px-1.5 py-0.5 font-mono">
              intangible ÷ total_assets
            </code>
          </div>
        </DefinitionBox>
        <div className="grid gap-2 sm:grid-cols-2">
          <HealthBox tone="good" label="SaaS·플랫폼 5~20%">
            서버·코드·브랜드 같은 무형자산이 적당한 비중. 정상.
          </HealthBox>
          <HealthBox tone="bad" label="30%↑ watchpoint">
            영업권·개발비 자산화 비중 큼. 회계 vs 진성 자산 갭 확인 — 손상 위험·자본화 정책 점검.
          </HealthBox>
        </div>
      </ModalShell>
    </>
  );
}

export function CapitalHistoryCard({ vc, years }: { vc: VCMetrics; years: number[] }) {
  const [open, setOpen] = useState(false);
  const ch = vc.capital_history;
  const scale = pickMoneyScale(
    Math.max(Math.abs(ch.estimated_raised_5y_mil ?? 0), Math.abs(ch.surplus_last_mil ?? 0))
  );
  const yearSpan = years.length > 0 ? `${years[0]}~${years.at(-1)}` : "-";

  return (
    <>
      <MetricButton onClick={() => setOpen(true)}>
        <div className="p-6">
          <div className="flex items-start justify-between">
            <div className="text-[10px] font-medium uppercase tracking-wider text-gray-400">
              외부 자금 조달 ({yearSpan})
            </div>
            <Search3 />
          </div>
          <div className="mt-2 text-3xl font-bold tabular-nums text-gray-900">
            {fmtScaled(ch.estimated_raised_5y_mil, scale)}{" "}
            <span className="text-base font-medium text-gray-500">{scale.label}</span>
          </div>
          <div className="mt-1 text-[11px] text-gray-500">자본금 + 자본잉여금 5년 증가량</div>
          <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-md bg-gray-50 p-2">
              <div className="text-[10px] text-gray-500">{years[0]} 자본금</div>
              <div className="font-semibold text-gray-900">
                {fmtScaled(ch.capital_stock_first_mil, scale)} {scale.label}
              </div>
            </div>
            <div className="rounded-md bg-gray-50 p-2">
              <div className="text-[10px] text-gray-500">{years.at(-1)} 자본금</div>
              <div className="font-semibold text-gray-900">
                {fmtScaled(ch.capital_stock_last_mil, scale)} {scale.label}
              </div>
            </div>
            <div className="rounded-md bg-gray-50 p-2">
              <div className="text-[10px] text-gray-500">{years[0]} 자본잉여</div>
              <div className="font-semibold text-gray-900">
                {fmtScaled(ch.surplus_first_mil, scale)} {scale.label}
              </div>
            </div>
            <div className="rounded-md bg-gray-50 p-2">
              <div className="text-[10px] text-gray-500">{years.at(-1)} 자본잉여</div>
              <div className="font-semibold text-gray-900">
                {fmtScaled(ch.surplus_last_mil, scale)} {scale.label}
              </div>
            </div>
          </div>
        </div>
      </MetricButton>

      <ModalShell open={open} onClose={() => setOpen(false)} title="외부 자금 조달 추정">
        <DefinitionBox>
          5년간 (자본금 + 자본잉여금) 증가량으로 외부 조달 누적 추정. 정확한 라운드 정보는 사업보고서나
          별도 IR 자료 참조 필요. 단 1차 근사로 실용적.
          <div className="mt-2 text-[12px]">
            <code className="rounded bg-white px-1.5 py-0.5 font-mono">
              raised ≈ Δ(capital_stock) + Δ(capital_surplus)
            </code>
          </div>
        </DefinitionBox>
        <p className="text-sm leading-relaxed text-gray-700">
          자본 효율성 지표와 짝으로 봄: 받은 돈 대비 매출이 얼마나 나오는지로 자본 회수 매력 판단.
        </p>
        <p className="text-[11px] text-gray-500">
          ※ 자기주식 취득·소각·전환사채 행사 등이 있으면 이 추정은 부정확. 정확한 누적 조달은 라운드별 IR
          자료 필요.
        </p>
      </ModalShell>
    </>
  );
}
