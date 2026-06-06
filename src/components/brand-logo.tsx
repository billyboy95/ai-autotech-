import Image from "next/image";
import { cn } from "@/lib/utils";

export function BrandLogo({
  dark = false,
  compact = false,
}: {
  dark?: boolean;
  compact?: boolean;
}) {
  return (
    <span className="flex items-center gap-3">
      <span
        className={cn(
          "relative shrink-0 overflow-hidden rounded-md border",
          compact ? "h-10 w-10" : "h-12 w-12",
          dark ? "border-white/15 bg-white/10" : "border-slate-200 bg-[#0B1F3A]",
        )}
      >
        <Image
          src="/ai-autotech-logo.jpeg"
          alt="AI AutoTech logo"
          fill
          sizes={compact ? "40px" : "48px"}
          className="object-cover"
          priority
        />
      </span>
      <span>
        <span
          className={cn(
            "block font-display font-bold leading-tight",
            compact ? "text-base" : "text-lg",
            dark ? "text-white" : "text-[#0B1F3A]",
          )}
        >
          AI AutoTech
        </span>
      </span>
    </span>
  );
}
