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
          "rounded-2xl p-4 transition-all duration-200 border select-none backdrop-blur-md",
          // Material Depth & Lighting (V2.0 Warm Material Language)
          variant === "info" && "bg-card/70 border-white/5 shadow-soft hover:border-white/10",
          variant === "interactive" && "bg-card/80 border-white/10 hover:border-brand/40 shadow-soft hover:shadow-float cursor-pointer hover:scale-[1.015] active:scale-[0.985]",
          variant === "metric" && "bg-muted/20 border-white/5 shadow-none flex flex-col justify-between",
          variant === "selectable" && "bg-card/80 border-white/10 cursor-pointer",
          isSelected && "ring-2 ring-brand ring-offset-2 ring-offset-background border-brand bg-brand/10 shadow-float",
          className
        )}
        {...props}
      >
        {variant === "metric" ? (
          <div>
            {title && <span className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">{title}</span>}
            <div className="font-display font-extrabold text-2xl text-foreground mt-1 tracking-tight">{metricValue}</div>
            {metricChange && <span className="text-[11px] font-bold text-emerald-400 mt-0.5 inline-block">{metricChange}</span>}
          </div>
        ) : (
          children
        )}
      </div>
    );
  }
);
DsCard.displayName = "DsCard";
