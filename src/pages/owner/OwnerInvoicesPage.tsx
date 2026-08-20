import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  FileText,
  Search,
  CheckCircle2,
  XCircle,
  Eye,
  DollarSign,
} from "lucide-react";
import { useCafe } from "@/lib/cafe";
import { BillRepository } from "@/lib/billing/BillRepository";
import type { BillWithItems } from "@/lib/billing/types";
import type { InvoiceRecord, InvoiceRecordItem } from "@/lib/billing/invoiceService";
import { InvoiceViewerModal } from "@/components/billing/InvoiceViewerModal";
import { GlobalNotificationControls } from "@/components/owner/GlobalNotificationControls";
import { formatMoney } from "@/lib/db";
import { cn } from "@/lib/utils";

type DateFilterPreset = "today" | "yesterday" | "7d" | "30d" | "all";
type StatusFilter = "all" | "paid" | "pending" | "cancelled" | "refunded";

/**
 * Maps canonical PostgreSQL BillWithItems record to InvoiceRecord view model
 */
export function mapBillToInvoiceRecord(bill: BillWithItems): InvoiceRecord {
  const statusUpper = (bill.payment_status || "PENDING").toUpperCase();
  let status: InvoiceRecord["status"] = "Pending";
  if (statusUpper === "PAID") status = "Paid";
  else if (statusUpper === "CANCELLED") status = "Cancelled";
  else if (statusUpper === "REFUNDED") status = "Refunded";
  else if (statusUpper === "PARTIALLY_PAID") status = "Partially Paid";
  else status = "Pending";

  const pmUpper = (bill.payment_method || "CASH").toUpperCase();
  let paymentMethod: InvoiceRecord["paymentMethod"] = "Cash";
  if (pmUpper.includes("UPI")) paymentMethod = "UPI";
  else if (pmUpper.includes("CARD")) paymentMethod = "Card";
  else if (pmUpper.includes("MIXED")) paymentMethod = "Mixed";

  const items: InvoiceRecordItem[] = (bill.items || []).map((item, i) => ({
    id: item.id || item.menu_item_id || `item-${i}`,
    name: item.item_name,
    qty: item.quantity,
    priceCents: Math.round((item.unit_price || 0) * 100),
    note: item.special_instructions || undefined,
  }));

  const invoiceNumber = `B-${bill.bill_number}`;

  return {
    id: bill.id,
    invoiceNumber,
    orderId: bill.session_id || bill.id,
    orderNumber: `${bill.bill_number}`,
    createdAt: bill.created_at || new Date().toISOString(),
    customerName: bill.customer_name?.trim() || "Walk-in Customer",
    customerPhone: bill.customer_phone?.trim() || "",
    tableLabel: bill.table_id || (bill.order_type === "TAKEAWAY" ? "Takeaway" : "Dine-In Table"),
    orderSource: bill.order_type === "TAKEAWAY" ? "TAKEAWAY" : "DINE_IN",
    paymentMethod,
    subtotalCents: Math.round((bill.subtotal || 0) * 100),
    cgstCents: Math.round((bill.cgst || 0) * 100),
    sgstCents: Math.round((bill.sgst || 0) * 100),
    totalTaxCents: Math.round(((bill.cgst || 0) + (bill.sgst || 0)) * 100),
    serviceChargeCents: Math.round((bill.service_charge || 0) * 100),
    roundingCents: Math.round((bill.round_off || 0) * 100),
    grandTotalCents: Math.round((bill.grand_total || 0) * 100),
    status,
    items,
    rawBill: bill,
  };
}

export default function OwnerInvoicesPage() {
  const { cafe } = useCafe();
  const currency = cafe?.currency || "INR";

  // State controls
  const [searchQuery, setSearchQuery] = useState("");
  const [datePreset, setDatePreset] = useState<DateFilterPreset>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceRecord | null>(null);
  const [isViewerOpen, setIsViewerOpen] = useState(false);

  // Compute sinceDate & untilDate for queries
  const { sinceDate, untilDate } = useMemo(() => {
    if (datePreset === "today") {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      return { sinceDate: d.toISOString(), untilDate: null };
    }
    if (datePreset === "yesterday") {
      const start = new Date();
      start.setDate(start.getDate() - 1);
      start.setHours(0, 0, 0, 0);
      const end = new Date();
      end.setDate(end.getDate() - 1);
      end.setHours(23, 59, 59, 999);
      return { sinceDate: start.toISOString(), untilDate: end.toISOString() };
    }
    if (datePreset === "7d") {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      return { sinceDate: d.toISOString(), untilDate: null };
    }
    if (datePreset === "30d") {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      return { sinceDate: d.toISOString(), untilDate: null };
    }
    return { sinceDate: null, untilDate: null };
  }, [datePreset]);

  // Query persisted bills from Supabase / BillRepository
  const { data: rawBills = [], isLoading } = useQuery({
    queryKey: ["owner-bills-archive", cafe?.id, sinceDate, untilDate],
    enabled: !!cafe?.id,
    queryFn: () => BillRepository.getBillsByDateRange(cafe!.id, sinceDate, untilDate),
    refetchInterval: 10000,
  });

  // Transform into standardized Invoice Records
  const allInvoices = useMemo(() => {
    return rawBills.map(mapBillToInvoiceRecord);
  }, [rawBills]);

  // Apply Search & Status Filters
  const filteredInvoices = useMemo(() => {
    return allInvoices.filter((inv) => {
      // Status Filter
      if (statusFilter === "paid" && inv.status !== "Paid") return false;
      if (statusFilter === "pending" && inv.status !== "Pending" && inv.status !== "Partially Paid") return false;
      if (statusFilter === "cancelled" && inv.status !== "Cancelled") return false;
      if (statusFilter === "refunded" && inv.status !== "Refunded") return false;

      // Search Query Filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchInvoice = inv.invoiceNumber.toLowerCase().includes(q);
        const matchOrder = String(inv.orderNumber).toLowerCase().includes(q);
        const matchCustomer = inv.customerName.toLowerCase().includes(q);
        const matchPhone = inv.customerPhone.toLowerCase().includes(q);
        const matchDate = new Date(inv.createdAt).toLocaleDateString().toLowerCase().includes(q);

        if (!matchInvoice && !matchOrder && !matchCustomer && !matchPhone && !matchDate) {
          return false;
        }
      }

      return true;
    });
  }, [allInvoices, statusFilter, searchQuery]);

  // Metrics Summary
  const metrics = useMemo(() => {
    const totalCount = filteredInvoices.length;
    const paidInvoices = filteredInvoices.filter((i) => i.status === "Paid");
    const totalRevenueCents = paidInvoices.reduce((sum, i) => sum + i.grandTotalCents, 0);
    const cancelledCount = filteredInvoices.filter((i) => i.status === "Cancelled").length;

    return {
      totalCount,
      paidCount: paidInvoices.length,
      totalRevenueCents,
      cancelledCount,
    };
  }, [filteredInvoices]);

  const handleOpenInvoice = (inv: InvoiceRecord) => {
    setSelectedInvoice(inv);
    setIsViewerOpen(true);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <header className="rounded-3xl bg-card p-6 shadow-soft ring-1 ring-border/60">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
                Invoice Archive
              </h1>
              <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary border border-primary/20">
                Receipt Management
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Permanent historical ledger of generated bills, tax records, customer invoices, and digital receipts.
            </p>
          </div>

          <GlobalNotificationControls />
        </div>
      </header>

      {/* Overview Metrics Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-3xl bg-card p-5 shadow-soft ring-1 ring-border/60 space-y-1">
          <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
            <span>Total Invoices</span>
            <FileText className="h-4 w-4 text-primary" />
          </div>
          <div className="font-display text-2xl font-bold text-foreground">
            {metrics.totalCount}
          </div>
          <div className="text-[10px] text-muted-foreground">Generated bills in selection</div>
        </div>

        <div className="rounded-3xl bg-card p-5 shadow-soft ring-1 ring-border/60 space-y-1">
          <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
            <span>Invoiced Revenue</span>
            <DollarSign className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="font-display text-2xl font-bold text-emerald-600">
            {formatMoney(metrics.totalRevenueCents, currency)}
          </div>
          <div className="text-[10px] text-muted-foreground">From paid invoice records</div>
        </div>

        <div className="rounded-3xl bg-card p-5 shadow-soft ring-1 ring-border/60 space-y-1">
          <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
            <span>Paid Invoices</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="font-display text-2xl font-bold text-foreground">
            {metrics.paidCount}
          </div>
          <div className="text-[10px] text-muted-foreground">Successfully settled orders</div>
        </div>

        <div className="rounded-3xl bg-card p-5 shadow-soft ring-1 ring-border/60 space-y-1">
          <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
            <span>Cancelled Invoices</span>
            <XCircle className="h-4 w-4 text-rose-500" />
          </div>
          <div className="font-display text-2xl font-bold text-foreground">
            {metrics.cancelledCount}
          </div>
          <div className="text-[10px] text-muted-foreground">Voided or cancelled bills</div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="rounded-3xl bg-card p-5 shadow-soft ring-1 ring-border/60 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by Invoice #, Customer, Phone, or Order #..."
              className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-border bg-background text-xs outline-none focus:ring-2 focus:ring-ring/60"
            />
          </div>

          {/* Date Range Preset Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5">
            {[
              { id: "all", label: "All Time" },
              { id: "today", label: "Today" },
              { id: "yesterday", label: "Yesterday" },
              { id: "7d", label: "Last 7 Days" },
              { id: "30d", label: "Last 30 Days" },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => setDatePreset(p.id as DateFilterPreset)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-semibold transition cursor-pointer border select-none shrink-0",
                  datePreset === p.id
                    ? "bg-primary text-primary-foreground border-primary shadow-soft"
                    : "bg-secondary/40 text-muted-foreground border-border/60 hover:bg-secondary"
                )}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Status Filter Buttons */}
          <div className="flex items-center gap-1.5 border-l border-border/60 pl-3">
            {[
              { id: "all", label: "All" },
              { id: "paid", label: "Paid" },
              { id: "pending", label: "Pending" },
              { id: "cancelled", label: "Cancelled" },
              { id: "refunded", label: "Refunded" },
            ].map((st) => (
              <button
                key={st.id}
                onClick={() => setStatusFilter(st.id as StatusFilter)}
                className={cn(
                  "px-3 py-1.5 rounded-2xl text-xs font-semibold transition cursor-pointer border select-none",
                  statusFilter === st.id
                    ? "bg-primary/10 text-primary border-primary/30 font-bold"
                    : "bg-secondary/20 text-muted-foreground border-border/40 hover:bg-secondary"
                )}
              >
                {st.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Invoice Archive Table (Desktop) / Cards (Mobile) */}
      <div className="rounded-3xl bg-card shadow-soft ring-1 ring-border/60 overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-xs text-muted-foreground">
            Loading historical invoices...
          </div>
        ) : filteredInvoices.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <FileText className="h-10 w-10 text-muted-foreground/40 mx-auto" />
            <div className="text-sm font-semibold text-foreground">No Invoice Records Found</div>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              No bills match your current search query or date range filter. Try adjusting your search query.
            </p>
          </div>
        ) : (
          <>
            {/* Desktop / Tablet Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/40 border-b border-border text-muted-foreground font-bold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="p-4">Invoice #</th>
                    <th className="p-4">Date & Time</th>
                    <th className="p-4">Customer</th>
                    <th className="p-4">Order & Channel</th>
                    <th className="p-4">Payment Method</th>
                    <th className="p-4 text-right">Grand Total</th>
                    <th className="p-4 text-center">Status</th>
                    <th className="p-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {filteredInvoices.map((inv) => (
                    <tr
                      key={inv.id}
                      onClick={() => handleOpenInvoice(inv)}
                      className="hover:bg-muted/30 transition cursor-pointer group"
                    >
                      {/* Invoice # */}
                      <td className="p-4 font-mono font-bold text-primary">
                        {inv.invoiceNumber}
                      </td>

                      {/* Date & Time */}
                      <td className="p-4 text-muted-foreground">
                        <div>{new Date(inv.createdAt).toLocaleDateString()}</div>
                        <div className="text-[10px] text-muted-foreground/80">
                          {new Date(inv.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </div>
                      </td>

                      {/* Customer */}
                      <td className="p-4">
                        <div className="font-semibold text-foreground">{inv.customerName}</div>
                        <div className="text-[10px] font-mono text-muted-foreground">{inv.customerPhone || "N/A"}</div>
                      </td>

                      {/* Order & Channel */}
                      <td className="p-4">
                        <div className="font-semibold text-foreground">Bill #{inv.orderNumber}</div>
                        <div className="text-[10px] text-muted-foreground">
                          {inv.tableLabel} ({inv.orderSource})
                        </div>
                      </td>

                      {/* Payment Method */}
                      <td className="p-4 font-medium text-foreground">
                        {inv.paymentMethod}
                      </td>

                      {/* Grand Total */}
                      <td className="p-4 text-right font-display text-sm font-bold text-foreground">
                        {formatMoney(inv.grandTotalCents, currency)}
                      </td>

                      {/* Status Badge */}
                      <td className="p-4 text-center">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full border uppercase",
                            inv.status === "Paid"
                              ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                              : inv.status === "Pending"
                              ? "bg-amber-500/10 text-amber-600 border-amber-500/20"
                              : inv.status === "Partially Paid"
                              ? "bg-blue-500/10 text-blue-600 border-blue-500/20"
                              : "bg-rose-500/10 text-rose-600 border-rose-500/20"
                          )}
                        >
                          {inv.status}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="p-4 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenInvoice(inv);
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground font-semibold text-xs transition cursor-pointer"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          <span>View</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card List View */}
            <div className="block md:hidden divide-y divide-border/40">
              {filteredInvoices.map((inv) => (
                <div
                  key={inv.id}
                  onClick={() => handleOpenInvoice(inv)}
                  className="p-4 space-y-3 hover:bg-muted/30 transition cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-primary text-xs">
                      {inv.invoiceNumber}
                    </span>
                    <span
                      className={cn(
                        "text-[10px] font-bold px-2.5 py-0.5 rounded-full border uppercase",
                        inv.status === "Paid"
                          ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                          : inv.status === "Pending"
                          ? "bg-amber-500/10 text-amber-600 border-amber-500/20"
                          : inv.status === "Partially Paid"
                          ? "bg-blue-500/10 text-blue-600 border-blue-500/20"
                          : "bg-rose-500/10 text-rose-600 border-rose-500/20"
                      )}
                    >
                      {inv.status}
                    </span>
                  </div>

                  <div className="flex justify-between items-baseline text-xs">
                    <div>
                      <div className="font-semibold text-foreground">{inv.customerName}</div>
                      <div className="text-[10px] text-muted-foreground">Bill #{inv.orderNumber} ({inv.tableLabel})</div>
                    </div>
                    <div className="text-right">
                      <div className="font-display font-bold text-sm text-foreground">
                        {formatMoney(inv.grandTotalCents, currency)}
                      </div>
                      <div className="text-[10px] text-muted-foreground">{inv.paymentMethod}</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-border/40 text-[10px] text-muted-foreground">
                    <span>{new Date(inv.createdAt).toLocaleString()}</span>
                    <span className="font-semibold text-primary flex items-center gap-1">
                      <Eye className="h-3 w-3" /> View Receipt
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Invoice Viewer Modal */}
      <InvoiceViewerModal
        isOpen={isViewerOpen}
        invoice={selectedInvoice}
        onClose={() => setIsViewerOpen(false)}
      />
    </div>
  );
}
