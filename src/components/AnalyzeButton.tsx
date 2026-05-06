"use client";

import { useFormStatus } from "react-dom";
import { cn } from "@/lib/utils";

export function AnalyzeButton({
  className,
  disabled,
  idle,
  pending: pendingNode,
}: {
  className?: string;
  disabled?: boolean;
  idle: React.ReactNode;
  pending: React.ReactNode;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      aria-busy={pending}
      className={cn(className, pending && "cursor-wait")}
    >
      {pending ? pendingNode : idle}
    </button>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="분석 중"
      className={cn(
        "inline-block size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent align-[-2px]",
        className
      )}
    />
  );
}
