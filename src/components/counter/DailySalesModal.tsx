import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  TrendingUp,
  RefreshCw,
  Receipt,
  CreditCard,
  Banknote,
  QrCode,
  Layers,
  Percent,
  Clock,
  AlertCircle,
  X,
  FileText,
} from "lucide-react";
import type { DailySalesReport } from "@/lib/sales/types";
import { formatCurrency } from "./DailySalesPill";

interface DailySalesModalProps {
  isOpen: boolean;
  onClose: () => void;
  report: DailySalesReport | null;
  isLoading: boolean;
  isError: boolean;
  onRefresh: () => void;
  currency?: string;
}

const formatBusinessDate = (dateStr?: string): string => {
  if (!dateStr) return "Today";
  try {
    const [year, month, day] = dateStr.split("-").map(Number);
    if (!year || !month || !day) return dateStr;
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
};

export const DailySalesModal: React.FC<DailySalesModalProps> = ({
  isOpen,
  onClose,
  report,
  isLoading,
  isError,
  onRefresh,
  currency = "INR",
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="max-w-2xl max-h-[90vh] overflow-y-auto p-0 gap-0 border-border bg-card shadow-2xl rounded-2xl"
        data-testid="daily-sales-modal"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border/80 bg-secondary/30 sticky top-0 backdrop-blur-md z-10">
          <div>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <DialogTitle className="text-lg font-bold tracking-tight text-foreground font-display">
                Daily Sales
              </DialogTitle>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5" data-testid="daily-sales-business-date">
              Business date:{" "}
              <span className="font-semibold text-foreground">
                {report?.business_date ? formatBusinessDate(report.business_date) : "Loading…"}
              </span>
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onRefresh}
              disabled={isLoading}
              className="p-2 rounded-lg border border-border/80 bg-background text-muted-foreground hover:text-foreground hover:bg-secondary transition active:scale-95 disabled:opacity-50 cursor-pointer"
              title="Refresh Daily Sales"
              data-testid="daily-sales-refresh-button"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin text-primary" : ""}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg border border-border/80 bg-background text-muted-foreground hover:text-foreground hover:bg-secondary transition active:scale-95 cursor-pointer"
              title="Close"
              data-testid="daily-sales-close-button"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-6">
          {/* Loading State */}
          {isLoading && !report && (
            <div className="space-y-4 animate-pulse py-8" data-testid="daily-sales-modal-loading">
              <div className="h-28 bg-secondary/60 rounded-xl" />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="h-20 bg-secondary/40 rounded-xl" />
                <div className="h-20 bg-secondary/40 rounded-xl" />
                <div className="h-20 bg-secondary/40 rounded-xl" />
                <div className="h-20 bg-secondary/40 rounded-xl" />
              </div>
              <div className="h-36 bg-secondary/40 rounded-xl" />
            </div>
          )}

          {/* Error State */}
          {isError && !report && (
            <div className="p-6 text-center space-y-3 bg-destructive/5 border border-destructive/20 rounded-xl" data-testid="daily-sales-modal-error">
              <AlertCircle className="w-8 h-8 text-destructive mx-auto" />
              <div className="text-sm font-semibold text-foreground">Failed to load Daily Sales Report</div>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Unable to retrieve authoritative sales totals from the server.
              </p>
              <button
                type="button"
                onClick={onRefresh}
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-semibold text-xs transition active:scale-95 cursor-pointer inline-flex items-center gap-1.5"
                data-testid="daily-sales-modal-retry"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Retry
              </button>
            </div>
          )}

          {/* Report Data */}
          {report && (
            <>
              {/* 1. Primary Metrics Card (Realized Collections) */}
              <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent border border-emerald-500/20 shadow-soft space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                    Realized Collections (Paid Sales)
                  </span>
                  <span className="text-[11px] font-semibold text-muted-foreground">
                    {report.paid_bills_count} {report.paid_bills_count === 1 ? "Paid Bill" : "Paid Bills"}
                  </span>
                </div>

                <div className="flex flex-wrap items-baseline gap-3">
                  <span className="text-3xl sm:text-4xl font-extrabold font-mono tracking-tight text-foreground" data-testid="daily-sales-net-collected">
                    {formatCurrency(report.net_collected, currency)}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2 border-t border-emerald-500/15">
                  <div className="space-y-0.5">
                    <span className="text-[11px] text-muted-foreground">Paid Bills</span>
                    <p className="text-sm font-bold font-mono text-foreground" data-testid="daily-sales-paid-count">
                      {report.paid_bills_count}
                    </p>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[11px] text-muted-foreground">Average Bill</span>
                    <p className="text-sm font-bold font-mono text-foreground" data-testid="daily-sales-avg-bill">
                      {formatCurrency(report.average_bill_value, currency)}
                    </p>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[11px] text-muted-foreground">Items Sold</span>
                    <p className="text-sm font-bold font-mono text-foreground" data-testid="daily-sales-items-sold">
                      {report.total_items_sold}
                    </p>
                  </div>
                </div>
              </div>

              {/* 2. Tender Breakdown */}
              <div className="space-y-2.5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5 text-primary" /> Tender Breakdown
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="p-3 rounded-xl border border-border/80 bg-secondary/30 space-y-1" data-testid="daily-sales-tender-cash">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                      <Banknote className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> Cash
                    </div>
                    <p className="text-base font-bold font-mono text-foreground">
                      {formatCurrency(report.tenders.cash, currency)}
                    </p>
                  </div>

                  <div className="p-3 rounded-xl border border-border/80 bg-secondary/30 space-y-1" data-testid="daily-sales-tender-upi">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                      <QrCode className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" /> UPI
                    </div>
                    <p className="text-base font-bold font-mono text-foreground">
                      {formatCurrency(report.tenders.upi, currency)}
                    </p>
                  </div>

                  <div className="p-3 rounded-xl border border-border/80 bg-secondary/30 space-y-1" data-testid="daily-sales-tender-card">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                      <CreditCard className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" /> Card
                    </div>
                    <p className="text-base font-bold font-mono text-foreground">
                      {formatCurrency(report.tenders.card, currency)}
                    </p>
                  </div>

                  <div className="p-3 rounded-xl border border-border/80 bg-secondary/30 space-y-1" data-testid="daily-sales-tender-other">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                      <Layers className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" /> Other / Split
                    </div>
                    <p className="text-base font-bold font-mono text-foreground">
                      {formatCurrency(report.tenders.other, currency)}
                    </p>
                  </div>
                </div>
              </div>

              {/* 3. Financial & Tax Breakdown */}
              <div className="p-4 rounded-xl border border-border/80 bg-secondary/20 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-primary" /> Financial Subtotals & Tax Breakdown
                </h4>
                <div className="space-y-2 text-xs divide-y divide-border/60">
                  <div className="flex justify-between items-center pt-1" data-testid="daily-sales-gross-subtotal">
                    <span className="text-muted-foreground">Gross Sales (Food & Beverage Subtotal)</span>
                    <span className="font-semibold font-mono text-foreground">{formatCurrency(report.gross_subtotal, currency)}</span>
                  </div>

                  <div className="flex justify-between items-center pt-2" data-testid="daily-sales-discounts">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Percent className="w-3 h-3 text-amber-500" /> Discounts Applied
                    </span>
                    <span className="font-semibold font-mono text-rose-600 dark:text-rose-400">
                      - {formatCurrency(report.total_discounts, currency)}
                    </span>
                  </div>

                  <div className="flex justify-between items-center pt-2" data-testid="daily-sales-tax">
                    <div className="space-y-0.5">
                      <span className="text-muted-foreground">Total GST Collected</span>
                      <div className="text-[10px] text-muted-foreground">
                        CGST: {formatCurrency(report.cgst, currency)} · SGST: {formatCurrency(report.sgst, currency)}
                      </div>
                    </div>
                    <span className="font-semibold font-mono text-foreground">{formatCurrency(report.total_tax, currency)}</span>
                  </div>

                  {report.total_service_charge > 0 && (
                    <div className="flex justify-between items-center pt-2" data-testid="daily-sales-service-charge">
                      <span className="text-muted-foreground">Service Charge</span>
                      <span className="font-semibold font-mono text-foreground">{formatCurrency(report.total_service_charge, currency)}</span>
                    </div>
                  )}

                  {report.total_round_off !== 0 && (
                    <div className="flex justify-between items-center pt-2" data-testid="daily-sales-round-off">
                      <span className="text-muted-foreground">Round-Off Adjustment</span>
                      <span className="font-semibold font-mono text-foreground">
                        {report.total_round_off > 0 ? "+" : ""}{formatCurrency(report.total_round_off, currency)}
                      </span>
                    </div>
                  )}

                  <div className="flex justify-between items-center pt-2.5 font-bold text-sm text-foreground">
                    <span>Net Realized Revenue</span>
                    <span className="font-mono text-emerald-600 dark:text-emerald-400">{formatCurrency(report.net_collected, currency)}</span>
                  </div>
                </div>
              </div>

              {/* 4. Operational Pipeline (Distinctly Separated) */}
              <div className="p-4 rounded-xl border border-blue-500/20 bg-blue-500/5 space-y-3" data-testid="daily-sales-pipeline-section">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" /> Operational Pipeline (Open / In-Progress)
                  </h4>
                  <span className="text-[10px] text-blue-600/80 dark:text-blue-400/80 font-semibold">
                    Not included in Collections
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div className="p-2.5 rounded-lg bg-card/60 border border-border/60" data-testid="daily-sales-unsettled-count">
                    <span className="text-[11px] text-muted-foreground">Unsettled Orders</span>
                    <p className="text-sm font-bold font-mono text-foreground mt-0.5">
                      {report.pipeline.unsettled_orders_count} {report.pipeline.unsettled_orders_count === 1 ? "Order" : "Orders"}
                    </p>
                  </div>

                  <div className="p-2.5 rounded-lg bg-card/60 border border-border/60" data-testid="daily-sales-unsettled-value">
                    <span className="text-[11px] text-muted-foreground">Unsettled Value</span>
                    <p className="text-sm font-bold font-mono text-foreground mt-0.5">
                      {formatCurrency(report.pipeline.unsettled_pipeline_cents / 100, currency)}
                    </p>
                  </div>

                  <div className="p-2.5 rounded-lg bg-card/60 border border-border/60" data-testid="daily-sales-cancelled-count">
                    <span className="text-[11px] text-muted-foreground">Cancelled Orders</span>
                    <p className="text-sm font-bold font-mono text-foreground mt-0.5">
                      {report.pipeline.cancelled_orders_count} {report.pipeline.cancelled_orders_count === 1 ? "Order" : "Orders"}
                    </p>
                  </div>
                </div>

                <p className="text-[11px] text-muted-foreground italic">
                  Unsettled pipeline represents orders currently being prepared or seated at active dining tables and has not yet been paid.
                </p>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
