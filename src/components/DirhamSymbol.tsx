import { cn } from "@/lib/utils";
import dirham from "@/assets/dirham.png.asset.json";

/** Official UAE Dirham symbol (2024 mark). */
export function DirhamSymbol({ className, ...props }: React.ImgHTMLAttributes<HTMLImageElement>) {
  return (
    <img
      src={dirham.url}
      alt="AED"
      className={cn("inline-block object-contain dark:invert", className)}
      style={{ height: "1em", width: "1em", ...props.style }}
      {...props}
    />
  );
}
