import { useMemo, useState, useEffect } from "react";
import { Clock, Utensils, ChevronRight, CheckCircle, Edit3, FileText, Flame, Timer, Eye, X } from "lucide-react";
import { formatMoney, formatOrderLabel, type Order, type OrderItem } from "@/lib/db";
import {
  ORDER_STATUS_MAP,
  formatTimeElapsed,
  getNextOrderStatus,
  getOrderAging,
  getOrderPriority,
  computeDailyOrderNumbers,
  sortOrdersByLane,
  type OrderLane
} from "@/lib/orders/orderUtils";
import EditOrderDialog from "@/components/orders/EditOrderDialog";
import { cn } from "@/lib/utils";

export interface SharedOrderKanbanProps {
  orders: (Order & { order_items: OrderItem[] })[];
  tableLabelMap: Map<string, string>;
  currency: string;
  onSelectOrder?: (order: Order & { order_items: OrderItem[] }) => void;
  onUpdateStatus: (orderId: string, status: Order["status"]) => void;
  onCancelOrder?: (orderId: string) => void;
  isUpdatingStatus?: boolean;
  cafeId?: string;
  role?: "owner" | "staff" | "counter";
}

// Bug 3 Fix: Approved three-column workflow (Incoming, Preparing, Ready). History remains separate.
const KANBAN_COLUMNS: Order["status"][] = ["pending", "preparing", "ready"];

export default function SharedOrderKanban({
  orders,
  tableLabelMap,
  currency,
  onSelectOrder,
  onUpdateStatus,
  onCancelOrder,
  isUpdatingStatus = false,
  cafeId,
  role = "owner",
}: SharedOrderKanbanProps) {
  // Live auto-updating ticker timer
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 10000);
    return () => clearInterval(timer);
  }, []);

  const [editingOrder, setEditingOrder] = useState<(Order & { order_items: OrderItem[] }) | null>(null);

  const dailyOrderNumMap = useMemo(() => computeDailyOrderNumbers(orders), [orders]);

  // Group active orders into 3 columns and sort each lane chronologically
  const columnsData = useMemo(() => {
    const map: Record<Order["status"], (Order & { order_items: OrderItem[] })[]> = {
      pending: [],
      preparing: [],
      ready: [],
      served: [],
      cancelled: []
    };

    for (const o of orders) {
      if (map[o.status]) {
        map[o.status].push(o);
      }
    }

    const laneMap: Record<Order["status"], OrderLane> = {
      pending: "incoming",
      preparing: "preparing",
      ready: "ready",
      served: "completed",
      cancelled: "cancelled"
    };

    for (const key of Object.keys(map) as Order["status"][]) {
      map[key] = sortOrdersByLane(map[key], laneMap[key] ?? "incoming");
    }

    return map;
  }, [orders]);

  return (
    <>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
        {KANBAN_COLUMNS.map((status) => {
          const columnOrders = columnsData[status] ?? [];
          const meta = ORDER_STATUS_MAP[status];
          const totalCents = columnOrders.reduce((s, o) => s + o.total_cents, 0);

          return (
            <div
              key={status}
              className="flex flex-col rounded-3xl bg-card p-4 sm:p-5 shadow-soft ring-1 ring-border/60 max-h-[calc(100vh-220px)] min-h-[460px]"
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
                    <span>Subtotal: {formatMoney(totalCents, currency)}</span>
                  </div>
                </div>
              </div>

              {/* Column Cards Container */}
              <div className="flex-1 space-y-4 overflow-y-auto pr-1">
                {columnOrders.length === 0 ? (
                  <div className="py-16 text-center text-xs text-muted-foreground border border-dashed border-border/60 rounded-2xl p-6 bg-muted/20">
                    <p className="font-semibold text-foreground">No active orders</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Lane is clear in {meta.columnTitle.toLowerCase()}</p>
                  </div>
                ) : (
                  columnOrders.map((order) => {
                    const nextStatus = getNextOrderStatus(order.status);
                    const aging = getOrderAging(order.created_at);
                    const priority = getOrderPriority(order);
                    const tableLabel = tableLabelMap.get(order.table_id) ?? "?";
                    const dailyDisplayNum = (order as any).daily_order_number ?? dailyOrderNumMap?.get(order.id) ?? order.order_number;

                    return (
                      <div
                        key={order.id}
                        onClick={() => onSelectOrder?.(order)}
                        className={cn(
                          "group cursor-pointer rounded-2xl border bg-background p-4 sm:p-5 shadow-soft transition hover:border-accent/60 hover:shadow-float space-y-3.5 select-none relative overflow-hidden flex flex-col justify-between min-h-[260px]",
                          aging.level === "urgent" && "border-destructive/50 bg-destructive/5",
                          aging.level === "warning" && "border-amber-500/40 bg-amber-500/5",
                          aging.level === "normal" && "border-border/80"
                        )}
                      >
                        <div className="space-y-3">
                          {/* Order Header: Order Number & Timer */}
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-display text-lg font-bold tracking-tight text-foreground truncate">
                              {formatOrderLabel(dailyDisplayNum)}
                            </span>

                            <div className={cn("inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full border shrink-0", aging.badgeStyle)}>
                              <Timer className="h-3.5 w-3.5" />
                              <span>{formatTimeElapsed(order.created_at)}</span>
                            </div>
                          </div>

                          {/* Table # / Channel & Total Currency */}
                          <div className="flex items-center justify-between text-sm">
                            <div className="font-semibold text-foreground/90 flex items-center gap-1.5">
                              {((order as any).order_source === "TAKEAWAY" || !order.table_id) ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold bg-emerald-500/15 text-emerald-600 border border-emerald-500/20">
                                  🛍 Takeaway {(order as any).customer_name ? `(${ (order as any).customer_name })` : ''}
                                </span>
                              ) : (
                                <span>Table {tableLabel}</span>
                              )}
                            </div>
                            <div className="font-display text-base font-bold tabular-nums text-foreground whitespace-nowrap">
                              {formatMoney(order.total_cents, currency)}
                            </div>
                          </div>

                          {/* Priority Warning */}
                          {priority.isHighPriority && (
                            <div className="inline-flex items-center gap-1.5 text-[11px] font-extrabold text-red-600 bg-red-500/10 border border-red-500/20 px-2.5 py-0.5 rounded-xl">
                              <Flame className="h-3.5 w-3.5 fill-red-500 text-red-500" />
                              <span>{priority.reason}</span>
                            </div>
                          )}

                          {/* Items List */}
                          <div className="space-y-1 text-xs text-foreground/80 font-medium border-t border-border/40 pt-2.5">
                            {(order.order_items ?? []).map((it) => (
                              <div key={it.id} className="flex justify-between items-center">
                                <span>{it.qty} × {it.name}</span>
                              </div>
                            ))}
                          </div>

                          {/* Special Notes */}
                          {(order.note || (order as any).notes) && (
                            <div className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-300 bg-amber-500/10 border border-amber-500/20 p-2 rounded-xl">
                              <FileText className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
                              <span className="leading-tight font-medium">{order.note || (order as any).notes}</span>
                            </div>
                          )}
                        </div>

                        {/* Actions Area */}
                        <div className="space-y-2 pt-2">
                          {/* Large Full-Width Primary Action Button */}
                          {nextStatus && (
                            <button
                              type="button"
                              disabled={isUpdatingStatus}
                              onClick={(e) => {
                                e.stopPropagation();
                                onUpdateStatus(order.id, nextStatus);
                              }}
                              className={cn(
                                "w-full rounded-2xl py-3 px-4 text-xs font-bold transition shadow-soft active:scale-98 flex items-center justify-center gap-2 text-center",
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
                              <ChevronRight className="h-4 w-4 shrink-0" />
                            </button>
                          )}

                          {/* Secondary Text Action Buttons */}
                          <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 px-1">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingOrder(order);
                              }}
                              className="inline-flex items-center gap-1 hover:text-foreground font-semibold transition"
                            >
                              <Edit3 className="h-3.5 w-3.5 text-muted-foreground" /> Edit Order
                            </button>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectOrder?.(order);
                              }}
                              className="inline-flex items-center gap-1 hover:text-foreground font-semibold transition"
                            >
                              <Eye className="h-3.5 w-3.5 text-muted-foreground" /> Details
                            </button>

                            {onCancelOrder && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onCancelOrder(order.id);
                                }}
                                className="inline-flex items-center gap-1 hover:text-destructive font-semibold transition"
                              >
                                <X className="h-3.5 w-3.5 text-destructive/70" /> Cancel
                              </button>
                            )}
                          </div>
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

      {/* Edit Order Dialog */}
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
