"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Scale,
  TrendingUp,
  Wallet,
  BookOpen,
} from "lucide-react";

const NAV = [
  { href: "/", label: "대시보드", icon: LayoutDashboard },
  { href: "/balance-sheet", label: "재무상태표", icon: Scale },
  { href: "/income-statement", label: "손익계산서", icon: TrendingUp },
  { href: "/cash-flow", label: "현금흐름·투자지표", icon: Wallet },
  { href: "/glossary", label: "재무 용어집", icon: BookOpen },
];

export function Sidebar({
  company,
  companyEn,
  reportDate,
  period,
}: {
  company: string;
  companyEn: string;
  reportDate: string;
  period: string;
}) {
  const pathname = usePathname();
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-[var(--border)] bg-white lg:flex">
      <div className="border-b border-[var(--border)] px-5 py-5">
        <div className="text-[11px] font-medium uppercase tracking-wider text-gray-400">
          {companyEn}
        </div>
        <div className="mt-1 text-lg font-semibold text-gray-900">
          {company}
        </div>
        <div className="mt-1 text-xs text-gray-500">재무분석 대시보드</div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {NAV.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-gray-900 text-white"
                  : "text-gray-700 hover:bg-gray-100"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-[var(--border)] px-5 py-4 text-[11px] leading-relaxed text-gray-500">
        <div>분석 기간 · {period}</div>
        <div>기준일 · {reportDate}</div>
        <div className="mt-2 text-gray-400">단위: 백만원</div>
      </div>
    </aside>
  );
}
