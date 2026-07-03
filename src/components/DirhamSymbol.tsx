import { cn } from "@/lib/utils";

/**
 * New UAE Dirham symbol — stylized "D" mark with two horizontal bars,
 * inspired by the 2024 Central Bank of the UAE dirham identity.
 */
export function DirhamSymbol({ className, ...props }: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={cn("inline-block", className)}
      {...props}
    >
      {/* Two horizontal bars */}
      <path d="M3 9h14" />
      <path d="M3 15h14" />
      {/* Curved D stem crossing both bars */}
      <path d="M10 4c5 0 9 3.2 9 8s-4 8-9 8" />
    </svg>
  );
}
