import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Dialog,
  DialogContent,
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
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  User,
  Phone,
} from "lucide-react";
import type {
  DailySalesReport,
  DailySalesTransaction,
} from "@/lib/sales/types";
import { DailySalesService } from "@/lib/sales/dailySalesService";
import { formatCurrency } from "./DailySalesPill";

interface DailySalesModalProps {
  isOpen: boolean;
  onClose: () => void;
  report: DailySalesReport | null;
  isLoading: boolean;
  isError: boolean;
  onRefresh: () => void;
  currency?: string;
  cafeId?: string;
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

const formatPaidTime = (isoString?: string): string => {
  if (!isoString) return "—";
  try {
    const d = new Date(isoString);
    return d.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return isoString;
  }
};

const PAGE_SIZE = 25;

export const DailySalesModal: React.FC<DailySalesModalProps> = ({
  isOpen,
  onClose,
  report,
  isLoading,
  isError,
  onRefresh,
  currency = "INR",
  cafeId,
}) => {
  const [activeTab, setActiveTab] = useState<"overview" | "transactions">("overview");
  const [transactions, setTransactions] = useState<DailySalesTransaction[]>([]);
  const [isTxLoading, setIsTxLoading] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [selectedTxId, setSelectedTxId] = useState<string | null>(null);

  const effectiveCafeId = cafeId || report?.cafe_id;

  const loadTransactions = useCallback(
    async (force = false) => {
      if (!effectiveCafeId || !isOpen) return;
      setIsTxLoading(true);
      try {
        const res = await DailySalesService.getDailySalesTransactions(
          effectiveCafeId,
          report?.business_date || null,
          { forceRefresh: force }
        );
        setTransactions(res.transactions || []);
      } catch (err) {
        console.error("[DailySalesModal] Failed to load transactions:", err);
      } finally {
        setIsTxLoading(false);
      }
    },
    [effectiveCafeId, report?.business_date, isOpen]
  );

  useEffect(() => {
    if (isOpen && effectiveCafeId) {
      void loadTransactions(false);
    }
  }, [isOpen, effectiveCafeId, report?.business_date, loadTransactions]);

  const handleManualRefresh = useCallback(() => {
    onRefresh();
    void loadTransactions(true);
  }, [onRefresh, loadTransactions]);

  const filteredTransactions = useMemo(() => {
    if (!searchQuery.trim()) return transactions;
    const q = searchQuery.toLowerCase().trim();
    return transactions.filter(
      (tx) =>
        String(tx.bill_number).includes(q) ||
        tx.table_label.toLowerCase().includes(q) ||
        (tx.customer_name && tx.customer_name.toLowerCase().includes(q)) ||
        (tx.customer_phone && tx.customer_phone.includes(q)) ||
        tx.payment_method.toLowerCase().includes(q)
    );
  }, [transactions, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredTransactions.length / PAGE_SIZE));
  const paginatedTransactions = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredTransactions.slice(start, start + PAGE_SIZE);
  }, [filteredTransactions, currentPage]);

  const toggleTxExpanded = (id: string) => {
    setSelectedTxId((prev) => (prev === id ? null : id));
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="max-w-3xl max-h-[90vh] overflow-y-auto p-0 gap-0 border-border bg-card shadow-2xl rounded-2xl"
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
              onClick={handleManualRefresh}
              disabled={isLoading}
              className="p-2 rounded-lg border border-border/80 bg-background text-muted-foreground hover:text-foreground hover:bg-secondary transition active:scale-95 disabled:opacity-50 cursor-pointer"
              title="Refresh Daily Sales"
              data-testid="daily-sales-refresh-button"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading || isTxLoading ? "animate-spin text-primary" : ""}`} />
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

        {/* Navigation Tabs */}
        <div className="flex border-b border-border/60 px-5 bg-secondary/10">
          <button
            type="button"
            onClick={() => setActiveTab("overview")}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === "overview"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
            data-testid="daily-sales-tab-overview"
          >
            <TrendingUp className="w-3.5 h-3.5" /> Overview
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("transactions")}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === "transactions"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
            data-testid="daily-sales-tab-transactions"
          >
            <Receipt className="w-3.5 h-3.5" /> Bills & Transactions
            {report?.paid_bills_count !== undefined && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full bg-secondary text-[10px] font-mono text-muted-foreground font-semibold">
                {report.paid_bills_count}
              </span>
            )}
          </button>
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
            <div
              className="p-6 text-center space-y-3 bg-destructive/5 border border-destructive/20 rounded-xl"
              data-testid="daily-sales-modal-error"
            >
              <AlertCircle className="w-8 h-8 text-destructive mx-auto" />
              <div className="text-sm font-semibold text-foreground">Failed to load Daily Sales Report</div>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Unable to retrieve authoritative sales totals from the server.
              </p>
              <button
                type="button"
                onClick={handleManualRefresh}
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-semibold text-xs transition active:scale-95 cursor-pointer inline-flex items-center gap-1.5"
                data-testid="daily-sales-modal-retry"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Retry
              </button>
            </div>
          )}

          {/* TAB 1: OVERVIEW */}
          {report && activeTab === "overview" && (
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
                  <span
                    className="text-3xl sm:text-4xl font-extrabold font-mono tracking-tight text-foreground"
                    data-testid="daily-sales-net-collected"
                  >
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

              {/* 4. Operational Pipeline */}
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

          {/* TAB 2: BILLS & TRANSACTIONS */}
          {activeTab === "transactions" && (
            <div className="space-y-4">
              {/* Search bar */}
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder="Search by bill #, table, customer name or phone…"
                  className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-border bg-secondary/20 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  data-testid="daily-sales-tx-search"
                />
              </div>

              {/* Empty State */}
              {!isTxLoading && filteredTransactions.length === 0 && (
                <div
                  className="p-8 text-center space-y-2 border border-dashed border-border/80 rounded-2xl bg-secondary/10"
                  data-testid="daily-sales-transactions-empty"
                >
                  <Receipt className="w-8 h-8 text-muted-foreground mx-auto" />
                  <p className="text-sm font-semibold text-foreground">No finalized bills found</p>
                  <p className="text-xs text-muted-foreground">
                    {searchQuery
                      ? "No bills matched your search query."
                      : "No finalized bills for this business date."}
                  </p>
                </div>
              )}

              {/* Transactions Table */}
              {filteredTransactions.length > 0 && (
                <div
                  className="rounded-xl border border-border/80 overflow-hidden bg-card divide-y divide-border/60"
                  data-testid="daily-sales-transactions-table"
                >
                  {/* Table Header */}
                  <div className="grid grid-cols-12 gap-2 p-3 bg-secondary/40 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                    <div className="col-span-2">Bill #</div>
                    <div className="col-span-2">Time</div>
                    <div className="col-span-3">Table / Source</div>
                    <div className="col-span-2">Tender</div>
                    <div className="col-span-1 text-center">Items</div>
                    <div className="col-span-2 text-right">Grand Total</div>
                  </div>

                  {/* Transaction Rows */}
                  {paginatedTransactions.map((tx) => {
                    const isExpanded = selectedTxId === tx.bill_id;
                    return (
                      <div
                        key={tx.bill_id}
                        onClick={() => toggleTxExpanded(tx.bill_id)}
                        className="transition hover:bg-secondary/20 cursor-pointer select-none"
                        data-testid={`daily-sales-transaction-row-${tx.bill_id}`}
                      >
                        <div className="grid grid-cols-12 gap-2 p-3 text-xs items-center">
                          <div className="col-span-2 font-mono font-bold text-foreground">
                            #{tx.bill_number}
                          </div>
                          <div className="col-span-2 text-muted-foreground font-mono text-[11px]">
                            {formatPaidTime(tx.paid_at)}
                          </div>
                          <div className="col-span-3 font-medium text-foreground truncate flex items-center gap-1">
                            {tx.table_label}
                            {tx.order_source === "TAKEAWAY" && (
                              <span className="text-[9px] px-1 py-0.2 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold">
                                Takeaway
                              </span>
                            )}
                          </div>
                          <div className="col-span-2">
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full font-mono uppercase ${
                                tx.payment_method === "CASH"
                                  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                                  : tx.payment_method === "UPI"
                                  ? "bg-blue-500/10 text-blue-700 dark:text-blue-400"
                                  : tx.payment_method === "CARD"
                                  ? "bg-purple-500/10 text-purple-700 dark:text-purple-400"
                                  : "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                              }`}
                            >
                              {tx.payment_method === "MIXED" ? "Split / Mixed" : tx.payment_method}
                            </span>
                          </div>
                          <div className="col-span-1 text-center font-mono text-muted-foreground">
                            {tx.total_items}
                          </div>
                          <div className="col-span-2 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400 flex items-center justify-end gap-1">
                            {formatCurrency(tx.grand_total, currency)}
                            {isExpanded ? (
                              <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                            )}
                          </div>
                        </div>

                        {/* Expanded Item & Financial Details */}
                        {isExpanded && (
                          <div className="p-4 bg-secondary/15 border-t border-border/40 space-y-3 text-xs">
                            {/* Customer & Cashier Info */}
                            <div className="flex flex-wrap items-center justify-between text-muted-foreground text-[11px] gap-2 pb-2 border-b border-border/40">
                              <div className="flex items-center gap-3">
                                {tx.customer_name && (
                                  <span className="flex items-center gap-1">
                                    <User className="w-3 h-3 text-primary" /> {tx.customer_name}
                                  </span>
                                )}
                                {tx.customer_phone && (
                                  <span className="flex items-center gap-1">
                                    <Phone className="w-3 h-3 text-primary" /> {tx.customer_phone}
                                  </span>
                                )}
                              </div>
                              <div>
                                Station/Cashier: <span className="font-semibold text-foreground">{tx.cashier_id}</span>
                              </div>
                            </div>

                            {/* Itemized list */}
                            {tx.items && tx.items.length > 0 && (
                              <div className="space-y-1.5">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                  Purchased Items
                                </span>
                                <div className="divide-y divide-border/30 bg-card/60 rounded-lg p-2.5 border border-border/40 space-y-1">
                                  {tx.items.map((it, idx) => (
                                    <div key={idx} className="flex justify-between items-center py-1 text-[11px]">
                                      <span className="text-foreground">
                                        <span className="font-mono font-bold text-muted-foreground mr-1.5">{it.quantity}x</span>
                                        {it.item_name}
                                      </span>
                                      <span className="font-mono text-muted-foreground font-medium">
                                        {formatCurrency(it.line_total, currency)}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Financial breakdown */}
                            <div className="pt-2 space-y-1 border-t border-border/40 text-[11px]">
                              <div className="flex justify-between text-muted-foreground">
                                <span>Subtotal</span>
                                <span className="font-mono">{formatCurrency(tx.subtotal, currency)}</span>
                              </div>
                              {tx.discount > 0 && (
                                <div className="flex justify-between text-rose-600 dark:text-rose-400">
                                  <span>Discount</span>
                                  <span className="font-mono">- {formatCurrency(tx.discount, currency)}</span>
                                </div>
                              )}
                              {(tx.cgst > 0 || tx.sgst > 0) && (
                                <div className="flex justify-between text-muted-foreground">
                                  <span>GST (CGST: {formatCurrency(tx.cgst, currency)} + SGST: {formatCurrency(tx.sgst, currency)})</span>
                                  <span className="font-mono">{formatCurrency(tx.cgst + tx.sgst, currency)}</span>
                                </div>
                              )}
                              {tx.service_charge > 0 && (
                                <div className="flex justify-between text-muted-foreground">
                                  <span>Service Charge</span>
                                  <span className="font-mono">{formatCurrency(tx.service_charge, currency)}</span>
                                </div>
                              )}
                              {tx.round_off !== 0 && (
                                <div className="flex justify-between text-muted-foreground">
                                  <span>Round Off</span>
                                  <span className="font-mono">{tx.round_off > 0 ? "+" : ""}{formatCurrency(tx.round_off, currency)}</span>
                                </div>
                              )}
                              <div className="flex justify-between font-bold text-foreground pt-1 border-t border-border/30">
                                <span>Total Paid</span>
                                <span className="font-mono text-emerald-600 dark:text-emerald-400">
                                  {formatCurrency(tx.grand_total, currency)}
                                </span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Local Pagination */}
              {totalPages > 1 && (
                <div
                  className="flex items-center justify-between pt-2 text-xs text-muted-foreground"
                  data-testid="daily-sales-transactions-pagination"
                >
                  <span>
                    Showing {(currentPage - 1) * PAGE_SIZE + 1}–
                    {Math.min(currentPage * PAGE_SIZE, filteredTransactions.length)} of{" "}
                    {filteredTransactions.length} bills
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage <= 1}
                      className="p-1.5 rounded-lg border border-border bg-secondary/30 disabled:opacity-40 cursor-pointer"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <span className="font-mono text-foreground font-semibold px-2">
                      {currentPage} / {totalPages}
                    </span>
                    <button
                      type="button"
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage >= totalPages}
                      className="p-1.5 rounded-lg border border-border bg-secondary/30 disabled:opacity-40 cursor-pointer"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
