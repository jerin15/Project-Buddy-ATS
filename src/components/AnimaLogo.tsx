import logoAsset from "@/assets/anima-logo.png.asset.json";

export function AnimaLogo({ className = "", alt = "ANIMA Tech Studio" }: { className?: string; alt?: string }) {
  return <img src={logoAsset.url} alt={alt} className={className} />;
}
