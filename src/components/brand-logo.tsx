import Image from "next/image";
import { cn } from "@/lib/utils";

export function BrandLogo({
  dark = false,
  compact = false,
  name,
  logoUrl,
  color,
}: {
  dark?: boolean;
  compact?: boolean;
  name?: string;
  logoUrl?: string;
  color?: string;
}) {
  const label = name || "AI AutoTech";
  const src = logoUrl || (name ? "" : "/ai-autotech-logo.jpeg");
  return (
    <span className="flex items-center gap-3">
      <span
        className={cn(
          "relative grid shrink-0 place-items-center overflow-hidden rounded-md border font-display font-bold text-white",
          compact ? "h-10 w-10 text-sm" : "h-12 w-12 text-base",
          dark ? "border-white/15 bg-white/10" : "border-slate-200",
        )}
        style={{ background: src ? undefined : color || "#0B1F3A" }}
      >
        {src ? (
          <Image
            src={src}
            alt={`${label} logo`}
            fill
            sizes={compact ? "40px" : "48px"}
            className="object-cover"
            priority
          />
        ) : (
          label.slice(0, 1).toUpperCase()
        )}
      </span>
      <span>
        <span
          className={cn(
            "block font-display font-bold leading-tight",
            compact ? "text-base" : "text-lg",
            dark ? "text-white" : "text-[#0B1F3A]",
          )}
        >
          {label}
        </span>
      </span>
    </span>
  );
}
