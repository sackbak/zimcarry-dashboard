import { AlertTriangle } from "lucide-react";

export function EstimateDisclaimer() {
  return (
    <div className="overflow-hidden rounded-xl border border-amber-200 bg-amber-50/60 shadow-sm">
      <div className="flex items-start gap-3 border-b border-amber-100 px-5 py-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
        <div className="text-sm font-semibold text-amber-900">
          현금흐름표 미공시 — 본 페이지 수치는 손익계산서 + 재무상태표에서 역산 추정
        </div>
      </div>
      <div className="grid gap-3 px-5 py-3 text-[12px] leading-relaxed text-amber-900/90 sm:grid-cols-2">
        <p>
          짐캐리는 외부감사 대상이 아니라 공식 현금흐름표(C/F)가 공시되지 않습니다.
          본 페이지의 EBITDA·OCF·CAPEX·FCF 값은 손익계산서와 재무상태표 항목을
          가지고 역산한 <strong>추정치</strong>로, 감사받은 실제 현금흐름과는 차이가
          있을 수 있습니다. <strong>경향성과 규모 파악용</strong>으로 활용하시기 바랍니다.
        </p>
        <div className="rounded-md border border-amber-200 bg-white/70 p-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-amber-700">
            추산 방법
          </div>
          <ul className="mt-1.5 space-y-0.5 text-[11px] text-gray-700">
            <li>
              <strong>EBITDA</strong> = 영업이익 + 감가상각비 + 무형자산상각비
            </li>
            <li>
              <strong>OCF</strong> ≈ 당기순이익 + 비현금비용(D&amp;A) − 운전자본 변동
            </li>
            <li>
              <strong>CAPEX</strong> ≈ (당기 유무형 순액 − 전기) + 당기 D&amp;A
            </li>
            <li>
              <strong>FCF</strong> = OCF − CAPEX
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
