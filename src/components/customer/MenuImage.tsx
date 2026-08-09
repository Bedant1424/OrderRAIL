import { useState } from "react";
import { cn } from "@/lib/utils";
import { useImageUrl } from "@/lib/useImageUrl";

interface MenuImageProps {
  src: string | null | undefined;
  alt: string;
  className?: string;
  size?: "sm" | "lg";
}

export function MenuImage({ src, alt, className, size = "lg" }: MenuImageProps) {
  const imageUrl = useImageUrl(src);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const isInvalid = !imageUrl || imageUrl === "null" || imageUrl === "undefined" || imageUrl.trim() === "";

  if (isInvalid || error) {
    const isSmall = size === "sm";
    return (
      <div
        className={cn(
          "shrink-0 rounded-2xl bg-cc-surface-soft border border-cc-border flex flex-col items-center justify-center font-semibold text-cc-text-muted",
          isSmall ? "h-14 w-14 text-xs" : "h-24 w-24 text-sm",
          className
        )}
      >
        <span className={isSmall ? "text-lg" : "text-2xl"}>☕</span>
        {!isSmall && <span className="text-[9px] mt-1 font-medium text-cc-text-muted/80">No Image</span>}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden rounded-2xl bg-cc-surface-soft border border-cc-border",
        size === "sm" ? "h-14 w-14" : "h-24 w-24",
        className
      )}
    >
      {loading && (
        <div className="absolute inset-0 animate-pulse bg-cc-surface-soft flex items-center justify-center">
          <span className="text-[10px] text-cc-text-muted/70 font-medium">Loading…</span>
        </div>
      )}
      <img
        src={imageUrl!}
        alt={alt}
        loading="lazy"
        onLoad={() => setLoading(false)}
        onError={() => {
          setLoading(false);
          setError(true);
        }}
        className={cn(
          loading ? "absolute w-0 h-0 opacity-0 pointer-events-none" : "h-full w-full object-cover transition-opacity duration-300 opacity-100"
        )}
      />
    </div>
  );
}
