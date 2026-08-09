import { useState } from "react";
import { cn } from "@/lib/utils";
import { useImageUrl } from "@/lib/useImageUrl";

export interface MenuImageProps {
  src: string | null | undefined;
  alt: string;
  className?: string;
  size?: "xs" | "sm" | "md" | "lg" | "full";
}

const getSizeClasses = (size: MenuImageProps["size"]) => {
  switch (size) {
    case "xs":
      return "h-12 w-12 rounded-xl border border-cc-border";
    case "sm":
      return "h-16 w-16 rounded-xl border border-cc-border";
    case "full":
      return "h-full w-full rounded-none border-0";
    case "md":
    case "lg":
    default:
      return "h-24 w-24 rounded-2xl border border-cc-border";
  }
};

const getEmojiSizeClass = (size: MenuImageProps["size"]) => {
  switch (size) {
    case "xs":
      return "text-base";
    case "sm":
      return "text-lg";
    case "full":
      return "text-4xl";
    case "md":
    case "lg":
    default:
      return "text-2xl";
  }
};

const getLabelSizeClass = (size: MenuImageProps["size"]) => {
  switch (size) {
    case "xs":
      return "text-[8px] mt-0.5";
    case "sm":
      return "text-[9px] mt-0.5";
    case "full":
      return "text-xs mt-1.5 font-semibold";
    case "md":
    case "lg":
    default:
      return "text-[10px] mt-1";
  }
};

export function MenuImage({ src, alt, className, size = "lg" }: MenuImageProps) {
  const imageUrl = useImageUrl(src);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const isInvalid = !imageUrl || imageUrl === "null" || imageUrl === "undefined" || imageUrl.trim() === "";

  if (isInvalid || error) {
    return (
      <div
        className={cn(
          "relative shrink-0 overflow-hidden bg-cc-surface-soft flex flex-col items-center justify-center font-medium text-cc-text-muted select-none",
          getSizeClasses(size),
          className
        )}
      >
        <span className={getEmojiSizeClass(size)} aria-hidden>☕</span>
        <span className={cn("font-medium text-cc-text-muted/70 leading-none", getLabelSizeClass(size))}>
          No Image
        </span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden bg-cc-surface-soft",
        getSizeClasses(size),
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
