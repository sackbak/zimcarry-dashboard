import { Calendar, Database, Ruler, FileText } from "lucide-react";

export function MetaBar({
  reportDate,
  period,
  unit,
  source,
}: {
  reportDate: string;
  period: string;
  unit: string;
  source: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border border-[var(--border)] bg-white px-4 py-2.5 text-[11px] text-gray-600 shadow-sm">
      <Item icon={<Calendar className="h-3.5 w-3.5" />} label="보고 기준일" value={reportDate} />
      <Item icon={<Database className="h-3.5 w-3.5" />} label="데이터 기간" value={`5개년 ${period} · 2025 결산`} />
      <Item icon={<Ruler className="h-3.5 w-3.5" />} label="단위" value={unit} />
      <Item
        icon={<FileText className="h-3.5 w-3.5" />}
        label="출처"
        value={source}
        className="min-w-0 flex-1"
        valueClassName="truncate"
      />
    </div>
  );
}

function Item({
  icon,
  label,
  value,
  className,
  valueClassName,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  className?: string;
  valueClassName?: string;
}) {
  return (
    <div className={`flex items-center gap-1.5 ${className ?? ""}`}>
      <span className="text-gray-400">{icon}</span>
      <span className="text-gray-400">{label}</span>
      <span className={`font-medium text-gray-700 ${valueClassName ?? ""}`}>
        {value}
      </span>
    </div>
  );
}
