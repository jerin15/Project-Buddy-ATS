import logoUrl from "@/assets/local/anima-logo.png";

export function AnimaLogo({ className = "", alt = "ANIMA Tech Studio" }: { className?: string; alt?: string }) {
  return <img src={logoUrl} alt={alt} className={className} />;
}
