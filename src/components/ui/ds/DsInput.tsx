import React from "react";
import { cn } from "@/lib/utils";
import { Search } from "lucide-react";

export interface DsInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  isSearch?: boolean;
  leftElement?: React.ReactNode;
}

export const DsInput = React.forwardRef<HTMLInputElement, DsInputProps>(
  ({ className, label, error, isSearch, leftElement, type = "text", ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1 w-full text-left">
        {label && (
          <label className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-widest">
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {isSearch && (
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          )}
          {leftElement && (
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">
              {leftElement}
            </div>
          )}
          <input
            ref={ref}
            type={type}
            className={cn(
              "w-full rounded-2xl border border-white/10 bg-card/60 backdrop-blur-md py-2.5 px-4 text-xs sm:text-sm font-medium text-foreground outline-none transition-all placeholder:text-muted-foreground/60 focus:border-brand focus:ring-2 focus:ring-brand/30 shadow-inner-soft",
              (isSearch || leftElement) && "pl-10",
              error && "border-destructive focus:ring-destructive/30",
              className
            )}
            {...props}
          />
        </div>
        {error && <span className="text-[11px] font-bold text-destructive">{error}</span>}
      </div>
    );
  }
);
DsInput.displayName = "DsInput";
