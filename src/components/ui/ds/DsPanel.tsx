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
          "rounded-3xl p-4 flex flex-col justify-between overflow-hidden select-none transition-all duration-150",
          variant === "workspace" && "bg-card/70 backdrop-blur-md shadow-soft border border-border/20",
          variant === "secondary" && "bg-muted/30 border border-border/30 shadow-none",
          variant === "floating" && "bg-card border border-border/60 shadow-float",
          variant === "drawer" && "bg-card/95 backdrop-blur-md border-l border-border/40 shadow-2xl h-full",
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
