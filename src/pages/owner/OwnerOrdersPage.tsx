import { useMemo, useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
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
  History,
  Radio,
  Timer,
  AlertCircle,
  CheckCircle2,
  Users,
  Edit3,
  TrendingUp,
  ChefHat
} from "lucide-react";
import { supabase, formatMoney, formatOrderLabel, type Order, type OrderItem, type TableRow } from "@/lib/db";
import { useCafe } from "@/lib/cafe";
import { GlobalNotificationControls } from "@/components/owner/GlobalNotificationControls";
import SharedOrderKanban from "@/components/orders/SharedOrderKanban";
import ModernOccupiedTablesWidget from "@/components/orders/ModernOccupiedTablesWidget";
import EditOrderDialog from "@/components/orders/EditOrderDialog";
import { ORDER_STATUS_MAP, getNextOrderStatus } from "@/lib/orders/orderUtils";
import { calculateOperationalSummary } from "@/lib/orders/metrics";
import { generateOrdersCSV } from "@/lib/orders/csvExporter";
import { useOrders } from "@/lib/orders/useOrders";
import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";

type MainTab = "live" | "history";
type SortOption = "newest" | "oldest" | "highest" | "lowest";
type StatusFilter = "all" | "pending" | "preparing" | "ready" | "served" | "cancelled";
type DateRangeFilter = "today" | "7d" | "30d" | "all";

export default function OwnerOrdersPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { cafe } = useCafe();
  const currency = cafe?.currency ?? "USD";

  // Navigation Tab State
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
  const [selectedTableIdFilter, setSelectedTableIdFilter] = useState<string | null>(null);

  // Drawer & Edit States
  const [selectedOrder, setSelectedOrder] = useState<(Order & { order_items: OrderItem[] }) | null>(null);
  const [editingOrder, setEditingOrder] = useState<(Order & { order_items: OrderItem[] }) | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Consuming Shared Order Engine Hook
  const { orders, isLoading, updateStatus, cancelOrder, isUpdating } = useOrders({
    cafeId: cafe?.id,
    dateRange
  });

  // Sync tab & filters from URL params
  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam === "live" || tabParam === "history") setActiveTab(tabParam);

    const statusParam = searchParams.get("status");
    if (statusParam) setStatusFilter(statusParam as StatusFilter);

    const rangeParam = searchParams.get("range");
    if (rangeParam) setDateRange(rangeParam as DateRangeFilter);
  }, [searchParams]);

  // Fetch tables mapping
  const tablesQ = useQuery({
    queryKey: ["owner-orders-tables", cafe?.id],
    enabled: !!cafe?.id,
    queryFn: async () => {
      const { data } = await supabase.from("tables").select("*").eq("cafe_id", cafe!.id);
      return (data ?? []) as TableRow[];
    },
  });

  const tables = tablesQ.data ?? [];

  // Table Label Mapping Helper
  const tableLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of tables) map.set(t.id, t.label);
    return map;
  }, [tables]);

  // Operational summary metrics (Milestone 1 Section 1)
  const summary = useMemo(() => calculateOperationalSummary(orders, tables), [orders, tables]);

  // Deep-link trigger for orderId param
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
      if (selectedTableIdFilter && o.table_id !== selectedTableIdFilter) return false;

      const tableLabel = tableLabelMap.get(o.table_id) ?? "";
      const orderLabel = formatOrderLabel(o.order_number).toLowerCase();
      const query = searchQuery.toLowerCase().trim();

      if (
        query &&
        !orderLabel.includes(query) &&
        !tableLabel.toLowerCase().includes(query) &&
        !(o.note || (o as any).notes)?.toLowerCase().includes(query)
      ) {
        return false;
      }

      if (statusFilter !== "all" && o.status !== statusFilter) {
        return false;
      }

      return true;
    }).sort((a, b) => {
      if (sortBy === "oldest") return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      if (sortBy === "highest") return b.total_cents - a.total_cents;
      if (sortBy === "lowest") return a.total_cents - b.total_cents;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [orders, searchQuery, statusFilter, tableLabelMap, sortBy, selectedTableIdFilter]);

  // Selection helpers
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

  // Status Update Handler using Shared Repository Engine
  const handleUpdateStatus = async (orderId: string, nextStatus: Order["status"]) => {
    try {
      await updateStatus(orderId, nextStatus);
      if (selectedOrder?.id === orderId) {
        setSelectedOrder((prev) => (prev ? { ...prev, status: nextStatus } : null));
      }
    } catch {
      // Toast handled by mutation hook
    }
  };

  // Standardized CSV Exporter
  const handleExportCSV = () => {
    const listToExport = selectedIds.length > 0
      ? filteredOrders.filter((o) => selectedIds.includes(o.id))
      : filteredOrders;

    if (listToExport.length === 0) {
      toast.error("No orders available to export.");
      return;
    }

    const csvContent = generateOrdersCSV(listToExport, tableLabelMap);
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `orderrail-orders-export-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`Exported ${listToExport.length} orders to standardized CSV.`);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* HEADER: Order Operations Center */}
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border/60 pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="font-display text-3xl font-extrabold tracking-tight">Order Operations Center</h1>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-600 border border-emerald-500/20">
              <Radio className="h-3.5 w-3.5 animate-pulse text-emerald-500" /> Live Sync Active
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {cafe?.name ?? "OrderRail"} · Shared real-time restaurant operational control & analytics
          </p>
        </div>

        <div className="flex items-center gap-3">
          <GlobalNotificationControls />

          {/* Navigation Tabs */}
          <div className="inline-flex rounded-full bg-secondary p-1 text-xs font-medium shadow-inner">
            <button
              onClick={() => setActiveTab("live")}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-4 py-1.5 transition duration-150 font-bold",
                activeTab === "live"
                  ? "bg-brand text-brand-foreground shadow-soft"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <LayoutGrid className="h-3.5 w-3.5" /> Live Workflow
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-4 py-1.5 transition duration-150 font-bold",
                activeTab === "history"
                  ? "bg-brand text-brand-foreground shadow-soft"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <History className="h-3.5 w-3.5" /> History & Archives
            </button>
          </div>
        </div>
      </header>

      {/* SECTION 1: Today's Operations Summary Cards */}
      <section className="space-y-2">
        <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Today's Operations</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {/* Active Orders */}
          <div className="rounded-2xl bg-card p-4 shadow-soft ring-1 ring-border/60">
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Active Orders</div>
            <div className="mt-1 font-display text-2xl font-black tabular-nums text-foreground">{summary.activeCount}</div>
            <div className="text-[11px] font-medium text-amber-600 dark:text-amber-400">{summary.activeOrdersText} in pipeline</div>
          </div>

          {/* Preparing */}
          <div className="rounded-2xl bg-card p-4 shadow-soft ring-1 ring-border/60">
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Preparing</div>
            <div className="mt-1 font-display text-2xl font-black tabular-nums text-orange-600 dark:text-orange-400">{summary.preparingCount}</div>
            <div className="text-[11px] text-muted-foreground">In kitchen</div>
          </div>

          {/* Ready */}
          <div className="rounded-2xl bg-card p-4 shadow-soft ring-1 ring-border/60">
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Ready</div>
            <div className="mt-1 font-display text-2xl font-black tabular-nums text-blue-600 dark:text-blue-400">{summary.readyCount}</div>
            <div className="text-[11px] text-muted-foreground">To serve</div>
          </div>

          {/* Completed Today */}
          <div className="rounded-2xl bg-card p-4 shadow-soft ring-1 ring-border/60">
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Completed Today</div>
            <div className="mt-1 font-display text-2xl font-black tabular-nums text-emerald-600 dark:text-emerald-400">{summary.ordersCompletedToday}</div>
            <div className="text-[11px] text-muted-foreground">Served orders</div>
          </div>

          {/* Revenue Today */}
          <div className="rounded-2xl bg-card p-4 shadow-soft ring-1 ring-border/60">
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Revenue Today</div>
            <div className="mt-1 font-display text-2xl font-black tabular-nums text-foreground">{formatMoney(summary.revenueTodayCents, currency)}</div>
            <div className="text-[11px] text-muted-foreground">Gross revenue</div>
          </div>

          {/* Occupied Tables */}
          <div className="rounded-2xl bg-card p-4 shadow-soft ring-1 ring-border/60">
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Occupied Tables</div>
            <div className="mt-1 font-display text-2xl font-black tabular-nums text-amber-600 dark:text-amber-400">{summary.occupiedTablesCount}</div>
            <div className="text-[11px] text-muted-foreground">{summary.occupiedTablesText}</div>
          </div>
        </div>
      </section>

      {/* SECTION 2: Restaurant Floor Occupied Tables */}
      <ModernOccupiedTablesWidget
        tables={tables}
        orders={orders}
        selectedTableId={selectedTableIdFilter}
        onSelectTable={(table, activeOrder) => {
          if (activeOrder) {
            setSelectedOrder(activeOrder);
          } else {
            setSelectedTableIdFilter(selectedTableIdFilter === table.id ? null : table.id);
          }
        }}
      />

      {/* VIEW 1: LIVE WORKFLOW KANBAN (Incoming -> Preparing -> Ready) */}
      {activeTab === "live" && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Live Workflow</h2>
            {selectedTableIdFilter && (
              <button
                onClick={() => setSelectedTableIdFilter(null)}
                className="text-xs font-bold text-accent hover:underline"
              >
                Filtered by Table · Show All
              </button>
            )}
          </div>
          <SharedOrderKanban
            orders={selectedTableIdFilter ? orders.filter((o) => o.table_id === selectedTableIdFilter) : orders}
            tableLabelMap={tableLabelMap}
            currency={currency}
            onSelectOrder={(order) => setSelectedOrder(order)}
            onUpdateStatus={handleUpdateStatus}
            onCancelOrder={cancelOrder}
            isUpdatingStatus={isUpdating}
            cafeId={cafe?.id}
            role="owner"
          />
        </section>
      )}

      {/* VIEW 2: ORDER HISTORY TABLE & CSV EXPORT */}
      {activeTab === "history" && (
        <section className="space-y-6">
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
                  className="bg-transparent outline-none cursor-pointer text-foreground font-semibold"
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
                  className="bg-transparent outline-none cursor-pointer text-foreground font-semibold"
                >
                  <option value="newest">Newest First</option>
                  <option value="oldest">Oldest First</option>
                  <option value="highest">Highest Total</option>
                  <option value="lowest">Lowest Total</option>
                </select>
              </div>

              {/* Export CSV Button */}
              <button
                onClick={handleExportCSV}
                className="inline-flex items-center gap-2 rounded-full bg-secondary px-4 py-2 text-xs font-bold text-secondary-foreground shadow-soft transition hover:bg-secondary/80 active:scale-95"
              >
                <Download className="h-4 w-4" /> Export CSV ({selectedIds.length || filteredOrders.length})
              </button>
            </div>

            {/* Status Filter Tabs */}
            <div className="flex flex-wrap items-center gap-1.5 border-t border-border/50 pt-3">
              {[
                { id: "all", label: "All Orders" },
                { id: "pending", label: "Incoming" },
                { id: "preparing", label: "Preparing" },
                { id: "ready", label: "Ready" },
                { id: "served", label: "Completed" },
                { id: "cancelled", label: "Cancelled" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setStatusFilter(tab.id as StatusFilter)}
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

          {/* History Table */}
          <div className="rounded-3xl bg-card shadow-soft ring-1 ring-border/60 overflow-hidden">
            {isLoading ? (
              <TableSkeleton />
            ) : filteredOrders.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground space-y-2">
                <Utensils className="mx-auto h-8 w-8 text-muted-foreground/50" />
                <p className="font-display text-base font-semibold">No historical orders found</p>
                <p className="text-xs">Adjust search query or date range filter.</p>
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
                  <div className="text-xs uppercase tracking-widest text-muted-foreground font-bold">Order Details</div>
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
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Order Items ({selectedOrder.order_items?.length ?? 0})
                  </h3>
                  {selectedOrder.status !== "served" && selectedOrder.status !== "cancelled" && (
                    <button
                      onClick={() => {
                        setEditingOrder(selectedOrder);
                        setSelectedOrder(null);
                      }}
                      className="text-xs font-bold text-accent hover:underline flex items-center gap-1"
                    >
                      <Edit3 className="h-3.5 w-3.5" /> Edit Items
                    </button>
                  )}
                </div>
                <div className="divide-y divide-border/50 rounded-2xl border border-border/60 bg-background p-3">
                  {(selectedOrder.order_items ?? []).map((it) => (
                    <div key={it.id} className="py-2.5 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-semibold text-foreground">{it.qty}x</span> {it.name}
                        {it.note && <p className="text-[11px] text-muted-foreground italic">Note: {it.note}</p>}
                      </div>
                      <span className="font-semibold tabular-nums text-foreground">
                        {formatMoney(it.qty * it.price_cents, currency)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Order Notes */}
              {(selectedOrder.note || (selectedOrder as any).notes) && (
                <div className="mt-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 p-3 text-xs text-amber-900 dark:text-amber-200">
                  <strong>Special Instructions:</strong> {selectedOrder.note || (selectedOrder as any).notes}
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

            {/* Terminal State Order Details Drawer Actions */}
            <div className="border-t border-border/60 pt-4">
              {selectedOrder.status === "served" || selectedOrder.status === "cancelled" ? (
                <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-3 text-xs text-emerald-900 dark:text-emerald-200 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  <div>
                    <strong>Order Completed ({selectedOrder.status})</strong>
                    <p className="text-[11px] text-muted-foreground">This workflow is in terminal read-only state.</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Next Action</div>
                  {getNextOrderStatus(selectedOrder.status) && (
                    <button
                      disabled={isUpdating}
                      onClick={() => handleUpdateStatus(selectedOrder.id, getNextOrderStatus(selectedOrder.status)!)}
                      className={cn(
                        "w-full rounded-2xl py-3 text-xs font-bold shadow-soft hover:opacity-90 transition disabled:opacity-50 flex items-center justify-center gap-1.5",
                        getNextOrderStatus(selectedOrder.status) === "preparing" && "bg-amber-500 text-amber-950",
                        getNextOrderStatus(selectedOrder.status) === "ready" && "bg-orange-500 text-white",
                        getNextOrderStatus(selectedOrder.status) === "served" && "bg-emerald-600 text-white"
                      )}
                    >
                      <span>
                        {getNextOrderStatus(selectedOrder.status) === "preparing" && "Start Preparing Order"}
                        {getNextOrderStatus(selectedOrder.status) === "ready" && "Mark Order Ready"}
                        {getNextOrderStatus(selectedOrder.status) === "served" && "Serve Order"}
                      </span>
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    disabled={isUpdating}
                    onClick={() => cancelOrder(selectedOrder.id)}
                    className="w-full rounded-xl bg-destructive/10 text-destructive border border-destructive/20 py-2 text-xs font-semibold hover:bg-destructive/20 transition disabled:opacity-50"
                  >
                    Cancel Order
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit Order Dialog */}
      <EditOrderDialog
        open={!!editingOrder}
        onOpenChange={(open) => {
          if (!open) setEditingOrder(null);
        }}
        order={editingOrder}
        tableLabel={editingOrder ? tableLabelMap.get(editingOrder.table_id) ?? "?" : "?"}
        currency={currency}
        cafeId={cafe?.id}
        role="owner"
      />
    </div>
  );
}

// Order Status Badge Component
function OrderStatusBadge({ status }: { status: Order["status"] }) {
  const meta = ORDER_STATUS_MAP[status] ?? { label: status, badgeStyle: "bg-muted text-muted-foreground" };
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold border", meta.badgeStyle)}>
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
