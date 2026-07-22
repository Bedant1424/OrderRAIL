import React from "react";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

export interface DsButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "icon";
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
          "inline-flex items-center justify-center font-bold transition-all duration-150 select-none outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 active:scale-[0.985] disabled:opacity-50 disabled:pointer-events-none",
          // Sizes
          size === "sm" && "h-8 px-3 text-xs rounded-xl gap-1.5",
          size === "md" && "h-10 px-4 text-xs sm:text-sm rounded-2xl gap-2",
          size === "lg" && "h-12 px-6 text-sm sm:text-base rounded-2xl gap-2.5",
          // Variants
          variant === "primary" && "bg-brand text-brand-foreground hover:bg-brand/90 shadow-soft",
          variant === "secondary" && "bg-secondary/80 text-foreground border border-border/40 hover:bg-secondary shadow-soft",
          variant === "ghost" && "bg-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50",
          variant === "danger" && "bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-soft",
          variant === "icon" && "h-10 w-10 p-0 rounded-xl bg-muted/40 hover:bg-muted text-foreground justify-center",
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
