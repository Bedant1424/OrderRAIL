import React from "react";
import { cn } from "@/lib/utils";

export interface DsPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "workspace" | "secondary" | "floating" | "drawer";
}

export const DsPanel = React.forwardRef<HTMLDivElement, DsPanelProps>(
  ({ children, className, variant = "workspace", ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "rounded-3xl p-4 flex flex-col justify-between overflow-hidden select-none transition-all duration-200 backdrop-blur-md",
          variant === "workspace" && "bg-card/70 border border-white/5 shadow-soft hover:border-white/10",
          variant === "secondary" && "bg-muted/20 border border-white/5 shadow-none",
          variant === "floating" && "bg-card/90 border border-white/15 shadow-float",
          variant === "drawer" && "bg-card/95 backdrop-blur-xl border-l border-white/15 shadow-2xl h-full",
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);
DsPanel.displayName = "DsPanel";
