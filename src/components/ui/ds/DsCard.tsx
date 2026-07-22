import React from "react";
import { cn } from "@/lib/utils";

export interface DsCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "info" | "interactive" | "metric" | "selectable";
  isSelected?: boolean;
  title?: string;
  metricValue?: string;
  metricChange?: string;
}

export const DsCard = React.forwardRef<HTMLDivElement, DsCardProps>(
  (
    {
      children,
      className,
      variant = "info",
      isSelected = false,
      title,
      metricValue,
      metricChange,
      ...props
    },
    ref
  ) => {
    return (
      <div
        ref={ref}
        className={cn(
          "rounded-2xl p-4 transition-all duration-150 border select-none",
          variant === "info" && "bg-card border-border/40 shadow-soft",
          variant === "interactive" && "bg-card border-border/40 hover:border-brand/40 shadow-soft hover:shadow-float cursor-pointer hover:scale-[1.015] active:scale-[0.985]",
          variant === "metric" && "bg-muted/30 border-border/30 shadow-none flex flex-col justify-between",
          variant === "selectable" && "bg-card border-border/40 cursor-pointer",
          isSelected && "ring-2 ring-brand ring-offset-2 ring-offset-background border-brand bg-brand/10 shadow-float",
          className
        )}
        {...props}
      >
        {variant === "metric" ? (
          <div>
            {title && <span className="text-xs font-semibold text-muted-foreground uppercase">{title}</span>}
            <div className="font-display font-extrabold text-2xl text-foreground mt-1">{metricValue}</div>
            {metricChange && <span className="text-[11px] font-bold text-emerald-500 mt-0.5 inline-block">{metricChange}</span>}
          </div>
        ) : (
          children
        )}
      </div>
    );
  }
);
DsCard.displayName = "DsCard";
