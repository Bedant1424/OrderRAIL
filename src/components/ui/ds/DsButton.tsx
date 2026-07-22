import React from "react";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

export interface DsButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "icon" | "warm";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const DsButton = React.forwardRef<HTMLButtonElement, DsButtonProps>(
  (
    {
      children,
      className,
      variant = "primary",
      size = "md",
      isLoading = false,
      leftIcon,
      rightIcon,
      disabled,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(
          "inline-flex items-center justify-center font-extrabold transition-all duration-200 select-none outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none shadow-soft hover:shadow-float",
          // Sizes
          size === "sm" && "h-8 px-3 text-xs rounded-xl gap-1.5",
          size === "md" && "h-10 px-4 text-xs sm:text-sm rounded-2xl gap-2",
          size === "lg" && "h-12 px-6 text-sm sm:text-base rounded-2xl gap-2.5",
          // Variants (V2.0 Warm Material Language)
          variant === "primary" && "bg-brand text-brand-foreground hover:bg-brand/90 border border-amber-500/30 hover:border-amber-400/50 shadow-soft hover:shadow-brand/20",
          variant === "warm" && "bg-amber-600/90 text-white hover:bg-amber-500 border border-amber-400/40 shadow-soft",
          variant === "secondary" && "bg-card/80 backdrop-blur-md text-foreground border border-white/10 hover:bg-card hover:border-white/20 shadow-soft",
          variant === "ghost" && "bg-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40 shadow-none border-none",
          variant === "danger" && "bg-red-600/90 text-white hover:bg-red-500 border border-red-400/30 shadow-soft",
          variant === "icon" && "h-10 w-10 p-0 rounded-xl bg-card/60 hover:bg-card border border-white/10 text-foreground justify-center",
          className
        )}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <>
            {leftIcon && <span className="shrink-0">{leftIcon}</span>}
            {children}
            {rightIcon && <span className="shrink-0">{rightIcon}</span>}
          </>
        )}
      </button>
    );
  }
);
DsButton.displayName = "DsButton";
