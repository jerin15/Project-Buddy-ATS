import { dirhamSrc } from "@/lib/format";
import { cn } from "@/lib/utils";

export function Dirham({ className }: { className?: string }) {
  return (
    <img
      src={dirhamSrc}
      alt="AED"
      aria-hidden="true"
      className={cn("inline-block h-[0.85em] w-auto opacity-80 dark:invert", className)}
      draggable={false}
    />
  );
}

export function Aed({ value, className }: { value: number; className?: string }) {
  const aedFmt = new Intl.NumberFormat("en-AE", { maximumFractionDigits: 0 });
  return (
    <span className={cn("inline-flex items-baseline gap-1 tabular-nums", className)}>
      <Dirham />
      {aedFmt.format(Math.round(Number(value) || 0))}
    </span>
  );
}
