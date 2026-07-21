import { useMemo, useState } from "react";
import {
  Search,
  Download,
  CheckSquare,
  Square,
  ChevronRight,
  X,
  Clock,
  Utensils,
  ArrowUpDown,
  Calendar,
  Filter,
  Eye,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import { formatMoney, formatOrderLabel, type Order, type OrderItem, type TableRow } from "@/lib/db";
import { ORDER_STATUS_MAP } from "@/lib/orders/orderUtils";
import { generateOrdersCSV } from "@/lib/orders/csvExporter";
import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";

export type DateFilterOption = "today" | "yesterday" | "7d" | "30d" | "this_month" | "custom";
export type StatusFilterOption = "all" | "pending" | "preparing" | "ready" | "served" | "cancelled";
export type SortOption = "newest" | "oldest" | "highest" | "lowest" | "table" | "order_number";

export interface OrderHistoryViewProps {
  orders: (Order & { order_items: OrderItem[] })[];
  tables: TableRow[];
  tableLabelMap: Map<string, string>;
  currency: string;
  onSelectOrder?: (order: Order & { order_items: OrderItem[] }) => void;
}

export default function OrderHistoryView({
  orders,
  tables,
  tableLabelMap,
  currency,
  onSelectOrder,
}: OrderHistoryViewProps) {
  // Milestone 3: Date Filter States
  const [dateFilter, setDateFilter] = useState<DateFilterOption>("today");
  const [customStartDate, setCustomStartDate] = useState<string>("");
  const [customEndDate, setCustomEndDate] = useState<string>("");

  // Milestone 4: Filter States
  const [statusFilter, setStatusFilter] = useState<StatusFilterOption>("all");
  const [tableFilter, setTableFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Milestone 5: Sorting State
  const [sortBy, setSortBy] = useState<SortOption>("newest");

  // Selection state for CSV export
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Calculate Date Boundaries
  const dateRangeBounds = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    if (dateFilter === "today") {
      return { startMs: startOfToday, endMs: Infinity };
    }

    if (dateFilter === "yesterday") {
      const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000;
      const endOfYesterday = startOfToday - 1;
      return { startMs: startOfYesterday, endMs: endOfYesterday };
    }

    if (dateFilter === "7d") {
      const startMs = startOfToday - 6 * 24 * 60 * 60 * 1000;
      return { startMs, endMs: Infinity };
    }

    if (dateFilter === "30d") {
      const startMs = startOfToday - 29 * 24 * 60 * 60 * 1000;
      return { startMs, endMs: Infinity };
    }

    if (dateFilter === "this_month") {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
      return { startMs: startOfMonth, endMs: Infinity };
    }

    if (dateFilter === "custom") {
      const startMs = customStartDate ? new Date(customStartDate).getTime() : 0;
      const endMs = customEndDate ? new Date(customEndDate).getTime() + 24 * 60 * 60 * 1000 - 1 : Infinity;
      return { startMs, endMs };
    }

    return { startMs: 0, endMs: Infinity };
  }, [dateFilter, customStartDate, customEndDate]);

  // Milestone 4 & 6: Combined Filtering (Logical AND across Date, Status, Table, Search)
  const filteredOrders = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();

    return orders.filter((o) => {
      // 1. Date filter
      const createdMs = new Date(o.created_at).getTime();
      if (createdMs < dateRangeBounds.startMs || createdMs > dateRangeBounds.endMs) {
        return false;
      }

      // 2. Status filter
      if (statusFilter !== "all" && o.status !== statusFilter) {
        return false;
      }

      // 3. Table filter
      if (tableFilter !== "all" && o.table_id !== tableFilter) {
        return false;
      }

      // 4. Milestone 6: Search across Order ID / #, Table Label, Items, Notes
      if (query) {
        const orderNumStr = formatOrderLabel(o.order_number).toLowerCase();
        const orderIdStr = o.id.toLowerCase();
        const tableLabelStr = (tableLabelMap.get(o.table_id) ?? "").toLowerCase();
        const noteStr = (o.note || (o as any).notes || "").toLowerCase();
        const itemsStr = (o.order_items ?? []).map((it) => it.name.toLowerCase()).join(" ");

        const match =
          orderNumStr.includes(query) ||
          orderIdStr.includes(query) ||
          tableLabelStr.includes(query) ||
          noteStr.includes(query) ||
          itemsStr.includes(query);

        if (!match) return false;
      }

      return true;
    });
  }, [orders, dateRangeBounds, statusFilter, tableFilter, searchQuery, tableLabelMap]);

  // Milestone 5: Sorting
  const sortedOrders = useMemo(() => {
    return [...filteredOrders].sort((a, b) => {
      if (sortBy === "oldest") {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }
      if (sortBy === "highest") {
        return b.total_cents - a.total_cents;
      }
      if (sortBy === "lowest") {
        return a.total_cents - b.total_cents;
      }
      if (sortBy === "table") {
        const tableA = parseInt((tableLabelMap.get(a.table_id) ?? "0").replace(/\D/g, ""), 10);
        const tableB = parseInt((tableLabelMap.get(b.table_id) ?? "0").replace(/\D/g, ""), 10);
        return tableA - tableB;
      }
      if (sortBy === "order_number") {
        return a.order_number - b.order_number;
      }
      // Default: Newest first
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [filteredOrders, sortBy, tableLabelMap]);

  // Selection handlers
  const isAllSelected = sortedOrders.length > 0 && selectedIds.length === sortedOrders.length;
  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(sortedOrders.map((o) => o.id));
    }
  };

  const toggleSelectRow = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  // CSV Exporter
  const handleExportCSV = () => {
    const listToExport =
      selectedIds.length > 0 ? sortedOrders.filter((o) => selectedIds.includes(o.id)) : sortedOrders;

    if (listToExport.length === 0) {
      toast.error("No matching orders to export.");
      return;
    }

    const csvContent = generateOrdersCSV(listToExport, tableLabelMap);
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `orderrail-history-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`Exported ${listToExport.length} orders to CSV.`);
  };

  return (
    <div className="space-y-6">
      {/* Control Bar: Search, Date Filter, Table Filter, Sort, Export */}
      <div className="rounded-3xl bg-card p-5 shadow-soft ring-1 ring-border/60 space-y-4">
        {/* Row 1: Search, Date Selector, Table Selector, Sort */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Milestone 6: Search Bar */}
          <div className="relative min-w-[240px] flex-1">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search Order #, Table, Items, or Notes..."
              className="w-full rounded-2xl border border-border bg-background pl-10 pr-8 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/60"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Milestone 3: Date Filter Selector */}
          <div className="flex items-center gap-1.5 rounded-2xl border border-border bg-background px-3 py-1.5 text-xs font-semibold">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as DateFilterOption)}
              className="bg-transparent outline-none cursor-pointer text-foreground font-bold"
            >
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="this_month">This Month</option>
              <option value="custom">Custom Date Range</option>
            </select>
          </div>

          {/* Table Selector Filter */}
          <div className="flex items-center gap-1.5 rounded-2xl border border-border bg-background px-3 py-1.5 text-xs font-semibold">
            <Utensils className="h-4 w-4 text-muted-foreground" />
            <select
              value={tableFilter}
              onChange={(e) => setTableFilter(e.target.value)}
              className="bg-transparent outline-none cursor-pointer text-foreground font-bold"
            >
              <option value="all">All Tables</option>
              {tables.map((t) => (
                <option key={t.id} value={t.id}>
                  Table {t.label}
                </option>
              ))}
            </select>
          </div>

          {/* Milestone 5: Sort Selector */}
          <div className="flex items-center gap-1.5 rounded-2xl border border-border bg-background px-3 py-1.5 text-xs font-semibold">
            <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="bg-transparent outline-none cursor-pointer text-foreground font-bold"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="highest">Highest Value</option>
              <option value="lowest">Lowest Value</option>
              <option value="table">Table Number</option>
              <option value="order_number">Order Number</option>
            </select>
          </div>

          {/* Export CSV Button */}
          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-2 rounded-full bg-secondary px-4 py-2 text-xs font-bold text-secondary-foreground shadow-soft transition hover:bg-secondary/80 active:scale-95 shrink-0"
          >
            <Download className="h-4 w-4" /> Export CSV ({selectedIds.length || sortedOrders.length})
          </button>
        </div>

        {/* Milestone 3: Custom Date Range Pickers (Visible when dateFilter === 'custom') */}
        {dateFilter === "custom" && (
          <div className="flex items-center gap-3 pt-2 border-t border-border/50 text-xs">
            <span className="font-bold text-muted-foreground">From:</span>
            <input
              type="date"
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
              className="rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-medium outline-none focus:ring-2 focus:ring-ring/60"
            />
            <span className="font-bold text-muted-foreground">To:</span>
            <input
              type="date"
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              className="rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-medium outline-none focus:ring-2 focus:ring-ring/60"
            />
          </div>
        )}

        {/* Row 2: Status Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 border-t border-border/50 pt-3">
          {[
            { id: "all", label: "All Statuses" },
            { id: "pending", label: "Incoming" },
            { id: "preparing", label: "Preparing" },
            { id: "ready", label: "Ready" },
            { id: "served", label: "Completed" },
            { id: "cancelled", label: "Cancelled" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id as StatusFilterOption)}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-xs font-bold transition duration-150",
                statusFilter === tab.id
                  ? "bg-brand text-brand-foreground shadow-soft"
                  : "bg-secondary/60 text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Milestone 7: History Table Polish */}
      <div className="rounded-3xl bg-card shadow-soft ring-1 ring-border/60 overflow-hidden">
        {sortedOrders.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground space-y-2">
            <Utensils className="mx-auto h-8 w-8 text-muted-foreground/50" />
            <p className="font-display text-base font-semibold">No orders match filter criteria</p>
            <p className="text-xs">Try clearing search query or adjusting date range filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground font-semibold border-b border-border/60">
                <tr>
                  <th className="p-4 w-10">
                    <button onClick={toggleSelectAll} className="grid place-items-center">
                      {isAllSelected ? (
                        <CheckSquare className="h-4 w-4 text-accent" />
                      ) : (
                        <Square className="h-4 w-4 text-muted-foreground" />
                      )}
                    </button>
                  </th>
                  <th className="p-4">Order #</th>
                  <th className="p-4">Table</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Items</th>
                  <th className="p-4 text-right">Total</th>
                  <th className="p-4 text-right">Created</th>
                  <th className="p-4 text-right">Completed</th>
                  <th className="p-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {sortedOrders.map((o) => {
                  const isSelected = selectedIds.includes(o.id);
                  const meta = ORDER_STATUS_MAP[o.status] ?? { label: o.status, badgeStyle: "bg-muted text-muted-foreground" };

                  return (
                    <tr
                      key={o.id}
                      onClick={() => onSelectOrder?.(o)}
                      className={cn(
                        "cursor-pointer transition hover:bg-secondary/40 select-none",
                        isSelected && "bg-accent/5"
                      )}
                    >
                      <td className="p-4" onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => toggleSelectRow(o.id)} className="grid place-items-center">
                          {isSelected ? (
                            <CheckSquare className="h-4 w-4 text-accent" />
                          ) : (
                            <Square className="h-4 w-4 text-muted-foreground" />
                          )}
                        </button>
                      </td>

                      {/* Order # */}
                      <td className="p-4 font-display font-bold text-foreground">
                        {formatOrderLabel(o.order_number)}
                      </td>

                      {/* Table */}
                      <td className="p-4 font-semibold text-foreground">
                        Table {tableLabelMap.get(o.table_id) ?? "?"}
                      </td>

                      {/* Status */}
                      <td className="p-4">
                        <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold border", meta.badgeStyle)}>
                          {meta.label}
                        </span>
                      </td>

                      {/* Items */}
                      <td className="p-4 text-xs text-muted-foreground max-w-xs truncate">
                        {(o.order_items ?? []).map((it) => `${it.qty}x ${it.name}`).join(", ")}
                      </td>

                      {/* Total */}
                      <td className="p-4 text-right font-display font-bold tabular-nums text-foreground">
                        {formatMoney(o.total_cents, currency)}
                      </td>

                      {/* Created */}
                      <td className="p-4 text-right text-xs text-muted-foreground tabular-nums">
                        {new Date(o.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </td>

                      {/* Completed */}
                      <td className="p-4 text-right text-xs text-muted-foreground tabular-nums">
                        {o.status === "served" || o.status === "cancelled"
                          ? new Date(o.updated_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                          : "—"}
                      </td>

                      {/* Actions */}
                      <td className="p-4 text-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectOrder?.(o);
                          }}
                          className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground hover:bg-secondary/80 transition"
                        >
                          <Eye className="h-3.5 w-3.5" /> Details
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
