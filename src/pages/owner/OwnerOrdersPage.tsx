import { useMemo, useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
  Sparkles,
  LayoutGrid,
  History
} from "lucide-react";
import { supabase, formatMoney, formatOrderLabel, type Order, type OrderItem, type TableRow } from "@/lib/db";
import { useCafe } from "@/lib/cafe";
import { GlobalNotificationControls } from "@/components/owner/GlobalNotificationControls";
import SharedOrderKanban from "@/components/orders/SharedOrderKanban";
import { ORDER_STATUS_MAP } from "@/lib/orders/orderUtils";
import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";

type MainTab = "live" | "history";
type SortOption = "newest" | "oldest" | "highest" | "lowest";
type StatusFilter = "all" | "pending" | "placed" | "in_kitchen" | "ready" | "completed" | "served" | "cancelled";
type DateRangeFilter = "today" | "7d" | "30d" | "all";

export default function OwnerOrdersPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { cafe } = useCafe();
  const queryClient = useQueryClient();
  const currency = cafe?.currency ?? "USD";

  // Navigation Tab State (Live vs History)
  const [activeTab, setActiveTab] = useState<MainTab>(
    (searchParams.get("tab") as MainTab) ?? "live"
  );

  // Filter States
  const [searchQuery, setSearchQuery] = useState(searchParams.get("search") ?? "");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(
    (searchParams.get("status") as StatusFilter) ?? "all"
  );
  const [dateRange, setDateRange] = useState<DateRangeFilter>(
    (searchParams.get("range") as DateRangeFilter) ?? "all"
  );
  const [sortBy, setSortBy] = useState<SortOption>("newest");

  // Selection & Drawer States
  const [selectedOrder, setSelectedOrder] = useState<(Order & { order_items: OrderItem[] }) | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // Sync tab & filters from URL search parameters
  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam === "live" || tabParam === "history") setActiveTab(tabParam);

    const statusParam = searchParams.get("status");
    if (statusParam) setStatusFilter(statusParam as StatusFilter);

    const rangeParam = searchParams.get("range");
    if (rangeParam) setDateRange(rangeParam as DateRangeFilter);
  }, [searchParams]);

  // Compute date filter boundary
  const sinceDate = useMemo(() => {
    if (dateRange === "today") {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      return d.toISOString();
    }
    if (dateRange === "7d") {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      return d.toISOString();
    }
    if (dateRange === "30d") {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      return d.toISOString();
    }
    return null;
  }, [dateRange]);

  // Fetch orders query
  const ordersQ = useQuery({
    queryKey: ["owner-orders-page", cafe?.id, dateRange],
    enabled: !!cafe?.id,
    queryFn: async () => {
      let q = supabase
        .from("orders")
        .select("*, order_items(*)")
        .eq("cafe_id", cafe!.id)
        .order("created_at", { ascending: false });

      if (sinceDate) {
        q = q.gte("created_at", sinceDate);
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as (Order & { order_items: OrderItem[] })[];
    },
    refetchInterval: 5000,
  });

  // Fetch tables mapping
  const tablesQ = useQuery({
    queryKey: ["owner-orders-tables", cafe?.id],
    enabled: !!cafe?.id,
    queryFn: async () => {
      const { data } = await supabase.from("tables").select("*").eq("cafe_id", cafe!.id);
      return (data ?? []) as TableRow[];
    },
  });

  const orders = ordersQ.data ?? [];
  const tables = tablesQ.data ?? [];

  // Table Label Mapping Helper
  const tableLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of tables) map.set(t.id, t.label);
    return map;
  }, [tables]);

  // Deep-link trigger for specific orderId in URL
  useEffect(() => {
    const orderIdParam = searchParams.get("orderId");
    if (orderIdParam && orders.length > 0) {
      const match = orders.find((o) => o.id === orderIdParam || formatOrderLabel(o.order_number) === `#${orderIdParam}`);
      if (match) setSelectedOrder(match);
    }
  }, [searchParams, orders]);

  // Filtered & Sorted Orders for History View
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      const tableLabel = tableLabelMap.get(o.table_id) ?? "";
      const orderLabel = formatOrderLabel(o.order_number).toLowerCase();
      const query = searchQuery.toLowerCase().trim();

      if (
        query &&
        !orderLabel.includes(query) &&
        !tableLabel.toLowerCase().includes(query) &&
        !o.notes?.toLowerCase().includes(query)
      ) {
        return false;
      }

      if (statusFilter === "pending") {
        if (o.status !== "placed" && o.status !== "in_kitchen") return false;
      } else if (statusFilter === "completed") {
        if (o.status !== "served" && o.status !== "ready") return false;
      } else if (statusFilter !== "all" && o.status !== statusFilter) {
        return false;
      }

      return true;
    }).sort((a, b) => {
      if (sortBy === "oldest") return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      if (sortBy === "highest") return b.total_cents - a.total_cents;
      if (sortBy === "lowest") return a.total_cents - b.total_cents;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [orders, searchQuery, statusFilter, tableLabelMap, sortBy]);

  // Selection state helpers for History view
  const isAllSelected = filteredOrders.length > 0 && selectedIds.length === filteredOrders.length;
  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredOrders.map((o) => o.id));
    }
  };

  const toggleSelectRow = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  // Status Update Handler
  const updateOrderStatus = async (orderId: string, nextStatus: Order["status"]) => {
    setIsUpdatingStatus(true);
    try {
      const { error } = await supabase
        .from("orders")
        .update({ status: nextStatus, updated_at: new Date().toISOString() })
        .eq("id", orderId);
      if (error) throw error;
      toast.success(`Order updated to ${nextStatus}`);
      void queryClient.invalidateQueries({ queryKey: ["owner-orders-page"] });
      if (selectedOrder?.id === orderId) {
        setSelectedOrder((prev) => (prev ? { ...prev, status: nextStatus } : null));
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update status";
      toast.error(msg);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // CSV Export Handler
  const exportCSV = () => {
    const listToExport = selectedIds.length > 0
      ? filteredOrders.filter((o) => selectedIds.includes(o.id))
      : filteredOrders;

    if (listToExport.length === 0) {
      toast.error("No orders to export.");
      return;
    }

    const headers = ["Order ID", "Table", "Status", "Items", "Total ($)", "Created At"];
    const rows = listToExport.map((o) => [
      formatOrderLabel(o.order_number),
      `Table ${tableLabelMap.get(o.table_id) ?? "?"}`,
      o.status,
      (o.order_items ?? []).map((it) => `${it.qty}x ${it.name}`).join("; "),
      (o.total_cents / 100).toFixed(2),
      new Date(o.created_at).toLocaleString()
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.map((val) => `"${val}"`).join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `orderrail-export-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Exported ${listToExport.length} orders.`);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header & Main Nav Tabs */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Order Operations Center</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {cafe?.name ?? "OrderRail"} · Live restaurant orders & history
          </p>
        </div>

        <div className="flex items-center gap-3">
          <GlobalNotificationControls />

          {/* TASK 1 — Live vs History Navigation Tabs */}
          <div className="inline-flex rounded-full bg-secondary p-1 text-xs font-medium shadow-inner">
            <button
              onClick={() => setActiveTab("live")}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-4 py-1.5 transition duration-150 font-semibold",
                activeTab === "live"
                  ? "bg-brand text-brand-foreground shadow-soft"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <LayoutGrid className="h-3.5 w-3.5" /> Live KDS
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-4 py-1.5 transition duration-150 font-semibold",
                activeTab === "history"
                  ? "bg-brand text-brand-foreground shadow-soft"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <History className="h-3.5 w-3.5" /> History
            </button>
          </div>
        </div>
      </header>

      {/* VIEW 1: LIVE OPERATIONS KANBAN */}
      {activeTab === "live" && (
        <section className="space-y-4">
          <SharedOrderKanban
            orders={orders}
            tableLabelMap={tableLabelMap}
            currency={currency}
            onSelectOrder={(order) => setSelectedOrder(order)}
            onUpdateStatus={updateOrderStatus}
            isUpdatingStatus={isUpdatingStatus}
          />
        </section>
      )}

      {/* VIEW 2: ORDER HISTORY TABLE & EXPORT */}
      {activeTab === "history" && (
        <section className="space-y-6">
          {/* Controls Bar */}
          <div className="rounded-3xl bg-card p-4 shadow-soft ring-1 ring-border/60 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* Search Bar */}
              <div className="relative min-w-[240px] flex-1">
                <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by Order #, Table, or notes..."
                  className="w-full rounded-2xl border border-border bg-background pl-10 pr-4 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/60"
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

              {/* Date Range Selector */}
              <div className="flex items-center gap-1.5 rounded-2xl border border-border bg-background px-3 py-1.5 text-xs font-medium">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <select
                  value={dateRange}
                  onChange={(e) => setDateRange(e.target.value as DateRangeFilter)}
                  className="bg-transparent outline-none cursor-pointer text-foreground"
                >
                  <option value="all">All Dates</option>
                  <option value="today">Today</option>
                  <option value="7d">Last 7 Days</option>
                  <option value="30d">Last 30 Days</option>
                </select>
              </div>

              {/* Sort By Selector */}
              <div className="flex items-center gap-1.5 rounded-2xl border border-border bg-background px-3 py-1.5 text-xs font-medium">
                <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  className="bg-transparent outline-none cursor-pointer text-foreground"
                >
                  <option value="newest">Newest First</option>
                  <option value="oldest">Oldest First</option>
                  <option value="highest">Highest Total</option>
                  <option value="lowest">Lowest Total</option>
                </select>
              </div>

              {/* Export CSV Button */}
              <button
                onClick={exportCSV}
                className="inline-flex items-center gap-2 rounded-full bg-secondary px-4 py-2 text-xs font-semibold text-secondary-foreground shadow-soft transition hover:bg-secondary/80 active:scale-95"
              >
                <Download className="h-4 w-4" /> Export CSV ({selectedIds.length || filteredOrders.length})
              </button>
            </div>

            {/* Status Tabs */}
            <div className="flex flex-wrap items-center gap-1.5 border-t border-border/50 pt-3">
              {[
                { id: "all", label: "All Orders" },
                { id: "pending", label: "Pending", highlight: true },
                { id: "placed", label: "Placed" },
                { id: "in_kitchen", label: "Cooking" },
                { id: "ready", label: "Ready" },
                { id: "served", label: "Served" },
                { id: "cancelled", label: "Cancelled" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setStatusFilter(tab.id as StatusFilter)}
                  className={cn(
                    "rounded-full px-3.5 py-1.5 text-xs font-semibold transition duration-150",
                    statusFilter === tab.id
                      ? "bg-brand text-brand-foreground shadow-soft"
                      : "bg-secondary/60 text-muted-foreground hover:bg-secondary hover:text-foreground",
                    tab.highlight && statusFilter !== tab.id && "text-amber-600 bg-amber-500/10 font-bold"
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* History Table */}
          <div className="rounded-3xl bg-card shadow-soft ring-1 ring-border/60 overflow-hidden">
            {ordersQ.isLoading ? (
              <TableSkeleton />
            ) : filteredOrders.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground space-y-2">
                <Utensils className="mx-auto h-8 w-8 text-muted-foreground/50" />
                <p className="font-display text-base font-semibold">No history orders found</p>
                <p className="text-xs">Adjust your search parameters or date filters.</p>
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
                      <th className="p-4">Items Summary</th>
                      <th className="p-4 text-right">Total</th>
                      <th className="p-4 text-right">Time</th>
                      <th className="p-4 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {filteredOrders.map((o) => {
                      const isSelected = selectedIds.includes(o.id);
                      return (
                        <tr
                          key={o.id}
                          onClick={() => setSelectedOrder(o)}
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
                          <td className="p-4 font-display font-bold text-foreground">
                            {formatOrderLabel(o.order_number)}
                          </td>
                          <td className="p-4 font-medium text-foreground">
                            Table {tableLabelMap.get(o.table_id) ?? "?"}
                          </td>
                          <td className="p-4">
                            <OrderStatusBadge status={o.status} />
                          </td>
                          <td className="p-4 text-xs text-muted-foreground max-w-xs truncate">
                            {(o.order_items ?? []).map((it) => `${it.qty}x ${it.name}`).join(", ")}
                          </td>
                          <td className="p-4 text-right font-semibold tabular-nums text-foreground">
                            {formatMoney(o.total_cents, currency)}
                          </td>
                          <td className="p-4 text-right text-xs text-muted-foreground tabular-nums">
                            {new Date(o.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </td>
                          <td className="p-4 text-center">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedOrder(o);
                              }}
                              className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground hover:bg-secondary/80"
                            >
                              Details <ChevronRight className="h-3.5 w-3.5" />
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
        </section>
      )}

      {/* Order Details Drawer */}
      {selectedOrder && (
        <div
          className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex justify-end"
          onClick={() => setSelectedOrder(null)}
        >
          <div
            className="w-full max-w-md bg-card border-l border-border shadow-float h-full overflow-y-auto p-6 space-y-6 flex flex-col justify-between"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              {/* Drawer Header */}
              <div className="flex items-center justify-between border-b border-border/60 pb-4">
                <div>
                  <div className="text-xs uppercase tracking-widest text-muted-foreground">Order Details</div>
                  <h2 className="font-display text-2xl font-bold">
                    {formatOrderLabel(selectedOrder.order_number)}
                  </h2>
                </div>
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="grid h-8 w-8 place-items-center rounded-full bg-secondary text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Order Meta Header */}
              <div className="my-4 flex items-center justify-between rounded-2xl bg-secondary/50 p-4">
                <div>
                  <div className="text-xs text-muted-foreground">Location</div>
                  <div className="font-display text-base font-semibold">
                    Table {tableLabelMap.get(selectedOrder.table_id) ?? "?"}
                  </div>
                </div>
                <OrderStatusBadge status={selectedOrder.status} />
              </div>

              {/* Items List */}
              <div className="space-y-3">
                <h3 className="font-display text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Order Items ({selectedOrder.order_items?.length ?? 0})
                </h3>
                <div className="divide-y divide-border/50 rounded-2xl border border-border/60 bg-background p-3">
                  {(selectedOrder.order_items ?? []).map((it) => (
                    <div key={it.id} className="py-2.5 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-semibold text-foreground">{it.qty}x</span> {it.name}
                        {it.notes && <p className="text-[11px] text-muted-foreground italic">Note: {it.notes}</p>}
                      </div>
                      <span className="font-semibold tabular-nums text-foreground">
                        {formatMoney(it.qty * it.price_cents, currency)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Order Notes */}
              {selectedOrder.notes && (
                <div className="mt-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 p-3 text-xs text-amber-900 dark:text-amber-200">
                  <strong>Special Instructions:</strong> {selectedOrder.notes}
                </div>
              )}

              {/* Billing Breakdown */}
              <div className="mt-6 space-y-2 rounded-2xl bg-secondary/30 p-4 text-xs">
                <div className="flex justify-between text-muted-foreground">
                  <span>Gross Subtotal</span>
                  <span className="tabular-nums">{formatMoney(selectedOrder.total_cents, currency)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Discounts</span>
                  <span className="tabular-nums">$0.00</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Tax (Included)</span>
                  <span className="tabular-nums">$0.00</span>
                </div>
                <hr className="border-border/60 my-2" />
                <div className="flex justify-between font-display text-base font-bold text-foreground">
                  <span>Net Total</span>
                  <span className="tabular-nums">{formatMoney(selectedOrder.total_cents, currency)}</span>
                </div>
              </div>

              {/* Timeline */}
              <div className="mt-4 text-[11px] text-muted-foreground space-y-1">
                <div>Created: {new Date(selectedOrder.created_at).toLocaleString()}</div>
                <div>Last Updated: {new Date(selectedOrder.updated_at).toLocaleString()}</div>
              </div>
            </div>

            {/* Status Control Actions */}
            <div className="border-t border-border/60 pt-4 space-y-2">
              <div className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Update Status</div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  disabled={isUpdatingStatus || selectedOrder.status === "in_kitchen"}
                  onClick={() => updateOrderStatus(selectedOrder.id, "in_kitchen")}
                  className="rounded-xl bg-amber-500/10 text-amber-600 border border-amber-500/20 py-2 text-xs font-semibold hover:bg-amber-500/20 transition disabled:opacity-50"
                >
                  Mark Cooking
                </button>
                <button
                  disabled={isUpdatingStatus || selectedOrder.status === "ready"}
                  onClick={() => updateOrderStatus(selectedOrder.id, "ready")}
                  className="rounded-xl bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 py-2 text-xs font-semibold hover:bg-emerald-500/20 transition disabled:opacity-50"
                >
                  Mark Ready
                </button>
                <button
                  disabled={isUpdatingStatus || selectedOrder.status === "served"}
                  onClick={() => updateOrderStatus(selectedOrder.id, "served")}
                  className="rounded-xl bg-brand text-brand-foreground py-2 text-xs font-semibold shadow-soft hover:opacity-90 transition disabled:opacity-50"
                >
                  Mark Served
                </button>
                <button
                  disabled={isUpdatingStatus || selectedOrder.status === "cancelled"}
                  onClick={() => updateOrderStatus(selectedOrder.id, "cancelled")}
                  className="rounded-xl bg-destructive/10 text-destructive border border-destructive/20 py-2 text-xs font-semibold hover:bg-destructive/20 transition disabled:opacity-50"
                >
                  Cancel Order
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Order Status Badge Component
function OrderStatusBadge({ status }: { status: Order["status"] }) {
  const meta = ORDER_STATUS_MAP[status] ?? { label: status, badgeStyle: "bg-muted text-muted-foreground" };
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border", meta.badgeStyle)}>
      {meta.label}
    </span>
  );
}

// Table Skeleton Loader
function TableSkeleton() {
  return (
    <div className="p-4 space-y-3 animate-pulse">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="h-12 w-full bg-muted/40 rounded-xl" />
      ))}
    </div>
  );
}
