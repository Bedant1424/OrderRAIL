import { useState } from "react";
import { cn } from "@/lib/utils";

interface MenuImageProps {
  src: string | null | undefined;
  alt: string;
  className?: string;
  size?: "sm" | "lg";
}

export function MenuImage({ src, alt, className, size = "lg" }: MenuImageProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const isInvalid = !src || src === "null" || src === "undefined" || src.trim() === "";

  if (isInvalid || error) {
    const isSmall = size === "sm";
    return (
      <div
        className={cn(
          "shrink-0 rounded-2xl bg-gradient-warm flex flex-col items-center justify-center font-semibold ring-1 ring-border/60",
          isSmall ? "h-14 w-14 text-xs" : "h-24 w-24 text-sm text-muted-foreground",
          className
        )}
      >
        <span className={isSmall ? "text-lg" : "text-2xl"}>☕</span>
        {!isSmall && <span className="text-[9px] mt-1 text-muted-foreground/80 font-medium">No Image</span>}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden rounded-2xl bg-secondary/35 ring-1 ring-border/60",
        size === "sm" ? "h-14 w-14" : "h-24 w-24",
        className
      )}
    >
      {loading && (
        <div className="absolute inset-0 animate-pulse bg-secondary/70 flex items-center justify-center">
          <span className="text-[10px] text-muted-foreground/50">Loading…</span>
        </div>
      )}
      <img
        src={src!}
        alt={alt}
        loading="lazy"
        onLoad={() => setLoading(false)}
        onError={() => {
          setLoading(false);
          setError(true);
        }}
        className={cn(
          "h-full w-full object-cover transition-opacity duration-300",
          loading ? "opacity-0" : "opacity-100"
        )}
      />
    </div>
  );
}
