import React from "react";
import { TrendingUp, AlertCircle, RotateCw } from "lucide-react";
import type { DailySalesReport } from "@/lib/sales/types";

interface DailySalesPillProps {
  report: DailySalesReport | null;
  isLoading: boolean;
  isError: boolean;
  onRetry?: () => void;
  onClick?: () => void;
  currency?: string;
}

export const formatCurrency = (amount: number, currency: string = "INR"): string => {
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: currency || "INR",
      minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `₹${amount.toFixed(2)}`;
  }
};

export const DailySalesPill: React.FC<DailySalesPillProps> = ({
  report,
  isLoading,
  isError,
  onRetry,
  onClick,
  currency = "INR",
}) => {
  // 1. Loading State (Shimmer skeleton, never shows fake ₹0)
  if (isLoading && !report) {
    return (
      <div
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border/80 bg-secondary/40 animate-pulse text-xs text-muted-foreground select-none shrink-0"
        data-testid="daily-sales-pill-loading"
      >
        <div className="w-3.5 h-3.5 rounded-full bg-muted-foreground/20" />
        <div className="w-16 h-3.5 rounded bg-muted-foreground/20" />
      </div>
    );
  }

  // 2. Error State
  if (isError && !report) {
    return (
      <button
        type="button"
        onClick={onRetry}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border border-destructive/40 bg-destructive/10 text-destructive text-xs font-semibold hover:bg-destructive/20 transition active:scale-95 cursor-pointer shrink-0"
        title="Failed to load daily sales. Click to retry."
        data-testid="daily-sales-pill-error"
      >
        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
        <span className="hidden sm:inline">Sales Error</span>
        <RotateCw className="w-3 h-3 hover:rotate-180 transition-transform duration-300" />
      </button>
    );
  }

  // 3. Success / Zero Sales State
  const netCollected = report?.net_collected ?? 0;
  const billsCount = report?.paid_bills_count ?? 0;

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-border/80 bg-card hover:bg-secondary/60 text-foreground transition shadow-soft active:scale-95 cursor-pointer shrink-0 select-none group"
      title="View today's detailed sales breakdown"
      data-testid="daily-sales-pill"
    >
      <TrendingUp className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 group-hover:scale-110 transition-transform" />
      <span className="text-xs font-bold font-mono tracking-tight text-foreground" data-testid="daily-sales-pill-amount">
        {formatCurrency(netCollected, currency)}
      </span>
      <span className="text-[11px] text-muted-foreground font-medium" data-testid="daily-sales-pill-bills">
        · {billsCount} {billsCount === 1 ? "Bill" : "Bills"}
      </span>
    </button>
  );
};
