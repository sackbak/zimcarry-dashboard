"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function NavTabs({
  items,
}: {
  items: { href: string; label: string }[];
}) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap gap-0.5 border-b border-gray-200 pb-0">
      {items.map((n) => {
        const isActive = pathname === n.href;
        return (
          <Link
            key={n.href}
            href={n.href}
            className={cn(
              "relative -mb-px rounded-t-lg border px-4 py-2 text-sm font-medium transition-colors",
              isActive
                ? "border-gray-200 border-b-white bg-white text-gray-900 shadow-sm"
                : "border-transparent text-gray-500 hover:border-gray-200 hover:bg-white/60 hover:text-gray-800"
            )}
          >
            {n.label}
          </Link>
        );
      })}
    </nav>
  );
}
