import React from "react";
import { cn } from "@/lib/utils";

export interface FilterOption<T extends string = string> {
  key: T;
  label: string;
  // A dot or indicator color when active
  activeDotClass: string;
  // Color configuration when active
  activeBgClass: string;
  activeTextClass: string;
  activeBorderClass: string;
}

interface ExclusiveFilterProps<T extends string = string> {
  options: FilterOption<T>[];
  value: T | null;
  onChange: (value: T | null) => void;
  className?: string;
}

export function ExclusiveFilter<T extends string = string>({
  options,
  value,
  onChange,
  className,
}: ExclusiveFilterProps<T>) {
  return (
    <div
      className={cn(
        "flex items-center gap-2.5 py-1 px-1 rounded-full bg-cc-surface-soft border border-cc-border w-fit transition-all duration-200",
        className
      )}
    >
      {options.map((opt) => {
        const isActive = value === opt.key;
        return (
          <button
            key={opt.key}
            onClick={() => onChange(isActive ? null : opt.key)}
            className={cn(
              "relative flex items-center gap-2 rounded-full px-3.5 py-1 text-xs font-semibold tracking-wide transition-all duration-200 ease-out active:scale-95 border",
              isActive
                ? `${opt.activeBgClass} ${opt.activeTextClass} ${opt.activeBorderClass} shadow-sm`
                : "bg-transparent border-transparent text-cc-text-muted hover:text-cc-text"
            )}
            style={{
              // Explicit minHeight for touch targets / premium feel but visually lightweight
              minHeight: "32px",
            }}
          >
            {/* Animated Dot Indicator */}
            <span
              className={cn(
                "h-2 w-2 rounded-full transition-all duration-250 ease-out shrink-0",
                isActive
                  ? `${opt.activeDotClass} scale-110 ring-2 ring-cc-background`
                  : "bg-cc-text-muted/40 scale-100"
              )}
            />
            <span>{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
