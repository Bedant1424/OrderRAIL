import React from "react";
import { cn } from "@/lib/utils";

export interface DsBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "success" | "warning" | "danger" | "info" | "neutral" | "brand";
  size?: "sm" | "md";
}

export const DsBadge: React.FC<DsBadgeProps> = ({
  children,
  className,
  variant = "neutral",
  size = "md",
  ...props
}) => {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 font-extrabold uppercase tracking-wider rounded-full border transition-all select-none",
        size === "sm" && "px-2 py-0.5 text-[9px]",
        size === "md" && "px-2.5 py-1 text-[10px]",
        variant === "success" && "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
        variant === "warning" && "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/20",
        variant === "danger" && "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/20",
        variant === "info" && "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/20",
        variant === "brand" && "bg-brand/15 text-brand border-brand/30",
        variant === "neutral" && "bg-muted/80 text-muted-foreground border-border/40",
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
};
