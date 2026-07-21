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
  Edit3
} from "lucide-react";
import { supabase, formatMoney, formatOrderLabel, type Order, type OrderItem, type TableRow } from "@/lib/db";
import { useCafe } from "@/lib/cafe";
import { GlobalNotificationControls } from "@/components/owner/GlobalNotificationControls";
import SharedOrderKanban from "@/components/orders/SharedOrderKanban";
import ModernOccupiedTablesWidget from "@/components/orders/ModernOccupiedTablesWidget";
import EditOrderDialog from "@/components/orders/EditOrderDialog";
import TableDetailsDrawer from "@/components/orders/TableDetailsDrawer";
import OrderHistoryView from "@/components/orders/OrderHistoryView";
import { ORDER_STATUS_MAP, getNextOrderStatus } from "@/lib/orders/orderUtils";
import { calculateOperationalSummary } from "@/lib/orders/metrics";
import { fetchCafeTables } from "@/lib/tables/tableRepository";
import { useOrders } from "@/lib/orders/useOrders";
import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";

type MainTab = "live" | "history";

export default function OwnerOrdersPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { cafe } = useCafe();
  const currency = cafe?.currency ?? "USD";

  // Navigation Tab State
  const [activeTab, setActiveTab] = useState<MainTab>(
    (searchParams.get("tab") as MainTab) ?? "live"
  );

  // Table Drawer & Selection States
  const [selectedFloorTable, setSelectedFloorTable] = useState<TableRow | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<(Order & { order_items: OrderItem[] }) | null>(null);
  const [editingOrder, setEditingOrder] = useState<(Order & { order_items: OrderItem[] }) | null>(null);

  // Consuming Shared Order Engine Hook
  const { orders, isLoading, updateStatus, cancelOrder, isUpdating, refetch: refetchOrders } = useOrders({
    cafeId: cafe?.id,
    dateRange: "all"
  });

  // Sync tab from URL params
  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam === "live" || tabParam === "history") setActiveTab(tabParam);
  }, [searchParams]);

  // Fetch tables mapping
  const tablesQ = useQuery({
    queryKey: ["owner-orders-tables", cafe?.id],
    enabled: !!cafe?.id,
    queryFn: () => fetchCafeTables(cafe!.id),
    refetchInterval: 10000,
  });

  const tables = tablesQ.data ?? [];

  // Table Label Mapping Helper
  const tableLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of tables) map.set(t.id, t.label);
    return map;
  }, [tables]);

  // Operational summary metrics
  const summary = useMemo(() => calculateOperationalSummary(orders, tables), [orders, tables]);

  // Deep-link trigger for orderId param
  useEffect(() => {
    const orderIdParam = searchParams.get("orderId");
    if (orderIdParam && orders.length > 0) {
      const match = orders.find((o) => o.id === orderIdParam || formatOrderLabel(o.order_number) === `#${orderIdParam}`);
      if (match) setSelectedOrder(match);
    }
  }, [searchParams, orders]);

  // Status Update Handler
  const handleUpdateStatus = async (orderId: string, nextStatus: Order["status"]) => {
    try {
      await updateStatus(orderId, nextStatus);
      if (selectedOrder?.id === orderId) {
        setSelectedOrder((prev) => (prev ? { ...prev, status: nextStatus } : null));
      }
    } catch {
      // Toast handled by hook
    }
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
            {cafe?.name ?? "OrderRail"} · Real-time restaurant operations, table lifecycle & order management
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

      {/* SECTION 2: Restaurant Floor Occupied Tables Chips (Milestone 1 & 8) */}
      <ModernOccupiedTablesWidget
        tables={tables}
        orders={orders}
        selectedTableId={selectedFloorTable?.id}
        onSelectTable={(table) => {
          setSelectedFloorTable(table);
        }}
      />

      {/* VIEW 1: LIVE WORKFLOW KANBAN (Incoming -> Preparing -> Ready) */}
      {activeTab === "live" && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Live Workflow</h2>
          </div>
          <SharedOrderKanban
            orders={orders}
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

      {/* VIEW 2: ORDER HISTORY MODULE (Milestones 2-7) */}
      {activeTab === "history" && (
        <section className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Order History & Archives</h2>
          <OrderHistoryView
            orders={orders}
            tables={tables}
            tableLabelMap={tableLabelMap}
            currency={currency}
            onSelectOrder={(order) => setSelectedOrder(order)}
          />
        </section>
      )}

      {/* Milestone 8: Table Details Drawer & Mark Table Free */}
      <TableDetailsDrawer
        open={!!selectedFloorTable}
        onOpenChange={(open) => !open && setSelectedFloorTable(null)}
        table={selectedFloorTable}
        orders={orders}
        currency={currency}
        onTableFreed={() => {
          void tablesQ.refetch();
          void refetchOrders();
        }}
      />

      {/* Order Details Drawer */}
      {selectedOrder && (
        <div
          className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex justify-end animate-in fade-in duration-150"
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

            {/* Actions */}
            <div className="border-t border-border/60 pt-4">
              {selectedOrder.status === "served" || selectedOrder.status === "cancelled" ? (
                <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-3 text-xs text-emerald-900 dark:text-emerald-200 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  <div>
                    <strong>Order Completed ({selectedOrder.status})</strong>
                    <p className="text-[11px] text-muted-foreground font-medium">Terminal state record.</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
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
