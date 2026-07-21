import { useMemo, useState, useEffect } from "react";
import { Clock, Utensils, ChevronRight, CheckCircle, Edit3, FileText, Flame, Timer } from "lucide-react";
import { formatMoney, formatOrderLabel, type Order, type OrderItem } from "@/lib/db";
import {
  ORDER_STATUS_MAP,
  formatTimeElapsed,
  getNextOrderStatus,
  getOrderAging,
  getOrderPriority
} from "@/lib/orders/orderUtils";
import EditOrderDialog from "@/components/orders/EditOrderDialog";
import { cn } from "@/lib/utils";

export interface SharedOrderKanbanProps {
  orders: (Order & { order_items: OrderItem[] })[];
  tableLabelMap: Map<string, string>;
  currency: string;
  onSelectOrder?: (order: Order & { order_items: OrderItem[] }) => void;
  onUpdateStatus: (orderId: string, status: Order["status"]) => void;
  isUpdatingStatus?: boolean;
  cafeId?: string;
  role?: "owner" | "staff";
}

const KANBAN_COLUMNS: Order["status"][] = ["pending", "preparing", "ready", "served"];

export default function SharedOrderKanban({
  orders,
  tableLabelMap,
  currency,
  onSelectOrder,
  onUpdateStatus,
  isUpdatingStatus = false,
  cafeId,
  role = "owner",
}: SharedOrderKanbanProps) {
  // Live ticker timer to refresh wait times every 10s
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 10000);
    return () => clearInterval(timer);
  }, []);

  // State for Edit Order Dialog
  const [editingOrder, setEditingOrder] = useState<(Order & { order_items: OrderItem[] }) | null>(null);

  // Group orders into columns
  // Milestone 6: Today's Served contains all served orders for current business day
  const columnsData = useMemo(() => {
    const map: Record<Order["status"], (Order & { order_items: OrderItem[] })[]> = {
      pending: [],
      preparing: [],
      ready: [],
      served: [],
      cancelled: []
    };

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayStartMs = todayStart.getTime();

    for (const o of orders) {
      if (o.status === "served") {
        const orderTime = new Date(o.updated_at || o.created_at).getTime();
        if (orderTime >= todayStartMs) {
          map.served.push(o);
        }
      } else if (map[o.status]) {
        map[o.status].push(o);
      }
    }

    return map;
  }, [orders]);

  return (
    <>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {KANBAN_COLUMNS.map((status) => {
          const columnOrders = columnsData[status] ?? [];
          const meta = ORDER_STATUS_MAP[status];
          const totalCents = columnOrders.reduce((s, o) => s + o.total_cents, 0);

          return (
            <div
              key={status}
              className="flex flex-col rounded-3xl bg-card p-4 shadow-soft ring-1 ring-border/60 max-h-[calc(100vh-250px)] min-h-[520px]"
            >
              {/* Sticky Column Header */}
              <div className="sticky top-0 z-10 bg-card pb-3 mb-3 border-b border-border/60 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold border", meta.columnHeaderBg)}>
                      {meta.columnTitle}
                    </span>
                    <span className="font-display text-sm font-bold text-foreground tabular-nums">
                      {columnOrders.length} {columnOrders.length === 1 ? "order" : "orders"}
                    </span>
                  </div>
                  <div className="mt-1 text-[11px] font-medium text-muted-foreground">
                    <span>{status === "served" ? "Today's Revenue" : "Subtotal"}: {formatMoney(totalCents, currency)}</span>
                  </div>
                </div>
              </div>

              {/* Column Cards Stream */}
              <div className="flex-1 space-y-4 overflow-y-auto pr-1">
                {columnOrders.length === 0 ? (
                  <div className="py-24 text-center text-xs text-muted-foreground italic">
                    {status === "served" ? "No served orders today" : `No orders in ${meta.columnTitle.toLowerCase()}`}
                  </div>
                ) : (
                  columnOrders.map((order) => {
                    const nextStatus = getNextOrderStatus(order.status);
                    const aging = getOrderAging(order.created_at);
                    const priority = getOrderPriority(order);
                    const tableLabel = tableLabelMap.get(order.table_id) ?? "?";

                    return (
                      <div
                        key={order.id}
                        onClick={() => onSelectOrder?.(order)}
                        className={cn(
                          "group cursor-pointer rounded-2xl border bg-background p-4 sm:p-5 shadow-soft transition hover:border-accent/60 hover:shadow-float space-y-3.5 select-none relative overflow-hidden",
                          aging.level === "urgent" && status !== "served" && "border-destructive/50 bg-destructive/5",
                          aging.level === "warning" && status !== "served" && "border-amber-500/40 bg-amber-500/5",
                          aging.level === "normal" && "border-border/80"
                        )}
                      >
                        {/* Redesigned Hierarchy Line 1: Order # and Elapsed Wait Time */}
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-display text-lg font-bold tracking-tight text-foreground truncate">
                            {formatOrderLabel(order.order_number)}
                          </span>

                          <div className={cn("inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full border shrink-0", aging.badgeStyle)}>
                            <Timer className="h-3 w-3" />
                            <span>{formatTimeElapsed(order.created_at)}</span>
                          </div>
                        </div>

                        {/* Redesigned Hierarchy Line 2: Table # */}
                        <div className="text-sm font-semibold text-foreground/90">
                          Table {tableLabel}
                        </div>

                        {/* Priority Badge if Applicable */}
                        {priority.isHighPriority && status !== "served" && (
                          <div className="inline-flex items-center gap-1.5 text-[11px] font-extrabold text-red-600 bg-red-500/10 border border-red-500/20 px-2.5 py-0.5 rounded-xl">
                            <Flame className="h-3.5 w-3.5 fill-red-500 text-red-500" />
                            <span>{priority.reason}</span>
                          </div>
                        )}

                        {/* Redesigned Hierarchy Line 3: Items List with Quantities */}
                        <div className="space-y-1 text-xs text-foreground/80 font-medium">
                          {(order.order_items ?? []).map((it) => (
                            <div key={it.id} className="flex justify-between items-center">
                              <span className="font-semibold text-foreground">{it.qty} × {it.name}</span>
                            </div>
                          ))}
                        </div>

                        {/* Special Instructions Note */}
                        {order.notes && (
                          <div className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-300 bg-amber-500/10 border border-amber-500/20 p-2 rounded-xl">
                            <FileText className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
                            <span className="leading-tight font-medium">{order.notes}</span>
                          </div>
                        )}

                        {/* Redesigned Hierarchy Line 4: Formatted Currency Total */}
                        <div className="border-t border-border/60 pt-3 flex items-center justify-between">
                          <span className="font-display text-base font-bold tabular-nums text-foreground whitespace-nowrap">
                            {formatMoney(order.total_cents, currency)}
                          </span>
                        </div>

                        {/* Redesigned Hierarchy Line 5: Actions Grid (Edit & Primary Action Button) */}
                        <div className="grid grid-cols-2 gap-2 pt-1">
                          {/* Milestone 5 Edit Action Button */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingOrder(order);
                            }}
                            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-border/80 bg-secondary/60 hover:bg-secondary py-2 px-3 text-xs font-semibold text-foreground transition shadow-sm active:scale-95"
                          >
                            <Edit3 className="h-3.5 w-3.5 text-muted-foreground" />
                            <span>Edit</span>
                          </button>

                          {/* Milestone 4 Lifecycle Color Action Buttons */}
                          {nextStatus ? (
                            <button
                              disabled={isUpdatingStatus}
                              onClick={(e) => {
                                e.stopPropagation();
                                onUpdateStatus(order.id, nextStatus);
                              }}
                              className={cn(
                                "inline-flex items-center justify-center gap-1.5 rounded-xl py-2 px-3 text-xs font-bold transition shadow-sm active:scale-95 text-center",
                                nextStatus === "preparing" && "bg-amber-500 hover:bg-amber-600 text-amber-950 border border-amber-600/30",
                                nextStatus === "ready" && "bg-orange-500 hover:bg-orange-600 text-white border border-orange-600/30",
                                nextStatus === "served" && "bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-700/30"
                              )}
                            >
                              <span>
                                {nextStatus === "preparing" && "Start Preparing"}
                                {nextStatus === "ready" && "Mark Ready"}
                                {nextStatus === "served" && "Serve Order"}
                              </span>
                              <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                            </button>
                          ) : (
                            <div className="inline-flex items-center justify-center gap-1 rounded-xl bg-secondary/80 text-muted-foreground border border-border py-2 px-3 text-xs font-semibold">
                              <CheckCircle className="h-3.5 w-3.5 text-emerald-500" /> Served
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Edit Order Shared Dialog */}
      <EditOrderDialog
        open={!!editingOrder}
        onOpenChange={(open) => {
          if (!open) setEditingOrder(null);
        }}
        order={editingOrder}
        tableLabel={editingOrder ? tableLabelMap.get(editingOrder.table_id) ?? "?" : "?"}
        currency={currency}
        cafeId={cafeId}
        role={role}
      />
    </>
  );
}
