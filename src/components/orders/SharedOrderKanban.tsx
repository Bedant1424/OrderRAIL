import { useMemo, useState, useEffect } from "react";
import { Clock, Utensils, ChevronRight, CheckCircle, AlertCircle, FileText, Flame, Timer } from "lucide-react";
import { formatMoney, formatOrderLabel, type Order, type OrderItem } from "@/lib/db";
import {
  ORDER_STATUS_MAP,
  formatTimeElapsed,
  getNextOrderStatus,
  getOrderAging,
  getOrderPriority
} from "@/lib/orders/orderUtils";
import { cn } from "@/lib/utils";

export interface SharedOrderKanbanProps {
  orders: (Order & { order_items: OrderItem[] })[];
  tableLabelMap: Map<string, string>;
  currency: string;
  onSelectOrder: (order: Order & { order_items: OrderItem[] }) => void;
  onUpdateStatus: (orderId: string, status: Order["status"]) => void;
  isUpdatingStatus?: boolean;
}

const KANBAN_COLUMNS: Order["status"][] = ["placed", "in_kitchen", "ready", "served"];

export default function SharedOrderKanban({
  orders,
  tableLabelMap,
  currency,
  onSelectOrder,
  onUpdateStatus,
  isUpdatingStatus = false,
}: SharedOrderKanbanProps) {
  // Live auto-updating ticker state (triggers re-render every 10s to keep elapsed time & aging fresh)
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 10000);
    return () => clearInterval(timer);
  }, []);

  // Group orders into columns
  const columnsData = useMemo(() => {
    const map: Record<Order["status"], (Order & { order_items: OrderItem[] })[]> = {
      placed: [],
      in_kitchen: [],
      ready: [],
      served: [],
      cancelled: []
    };
    for (const o of orders) {
      if (map[o.status]) map[o.status].push(o);
    }
    return map;
  }, [orders]);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {KANBAN_COLUMNS.map((status) => {
        const columnOrders = columnsData[status] ?? [];
        const meta = ORDER_STATUS_MAP[status];
        const totalCents = columnOrders.reduce((s, o) => s + o.total_cents, 0);

        return (
          <div
            key={status}
            className="flex flex-col rounded-3xl bg-card p-4 shadow-soft ring-1 ring-border/60 max-h-[calc(100vh-280px)] min-h-[500px]"
          >
            {/* Task 2: Enhanced Column Header with Metrics & Sticky Positioning */}
            <div className="sticky top-0 z-10 bg-card pb-3 mb-3 border-b border-border/60 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border", meta.columnHeaderBg)}>
                    {meta.columnTitle}
                  </span>
                  <span className="font-display text-sm font-bold text-foreground tabular-nums">
                    {columnOrders.length} {columnOrders.length === 1 ? "order" : "orders"}
                  </span>
                </div>
                <div className="mt-1 text-[11px] font-medium text-muted-foreground flex items-center gap-2">
                  <span>Subtotal: {formatMoney(totalCents, currency)}</span>
                </div>
              </div>
            </div>

            {/* Task 3: Independent Column Scrolling */}
            <div className="flex-1 space-y-3 overflow-y-auto pr-1">
              {columnOrders.length === 0 ? (
                <div className="py-20 text-center text-xs text-muted-foreground italic">
                  No orders in {meta.label.toLowerCase()}
                </div>
              ) : (
                columnOrders.map((order) => {
                  const itemCount = (order.order_items ?? []).reduce((s, it) => s + it.qty, 0);
                  const nextStatus = getNextOrderStatus(order.status);
                  const aging = getOrderAging(order.created_at);
                  const priority = getOrderPriority(order);

                  return (
                    <div
                      key={order.id}
                      onClick={() => onSelectOrder(order)}
                      className={cn(
                        "group cursor-pointer rounded-2xl border bg-background p-4 shadow-soft transition hover:border-accent/50 hover:shadow-float space-y-3 select-none relative",
                        aging.level === "urgent" && "border-destructive/40 bg-destructive/5",
                        aging.level === "warning" && "border-amber-500/30 bg-amber-500/5",
                        aging.level === "normal" && "border-border"
                      )}
                    >
                      {/* Card Top Header & Order ID */}
                      <div className="flex items-center justify-between">
                        <span className="font-display text-base font-bold text-foreground">
                          {formatOrderLabel(order.order_number)}
                        </span>

                        {/* Task 1: Order Aging Badge with Icon & Text */}
                        <div className={cn("inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border", aging.badgeStyle)}>
                          <Timer className="h-3 w-3" />
                          <span>{formatTimeElapsed(order.created_at)}</span>
                        </div>
                      </div>

                      {/* Task 8: Priority Indicators */}
                      {priority.isHighPriority && (
                        <div className="inline-flex items-center gap-1 text-[10px] font-extrabold text-red-600 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-lg">
                          <Flame className="h-3 w-3 fill-red-500 text-red-500" />
                          <span>{priority.reason}</span>
                        </div>
                      )}

                      {/* Table & Item Count Meta */}
                      <div className="flex items-center justify-between text-xs">
                        <div className="font-medium text-foreground">
                          Table {tableLabelMap.get(order.table_id) ?? "?"}
                        </div>
                        <div className="text-muted-foreground">
                          {itemCount} {itemCount === 1 ? "item" : "items"}
                        </div>
                      </div>

                      {/* Item Preview */}
                      <div className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                        {(order.order_items ?? []).map((it) => `${it.qty}x ${it.name}`).join(", ")}
                      </div>

                      {/* Special Notes */}
                      {order.notes && (
                        <div className="flex items-center gap-1 text-[10px] font-semibold text-amber-600 bg-amber-500/10 px-2 py-0.5 rounded-lg w-fit">
                          <FileText className="h-3 w-3" /> Special Note
                        </div>
                      )}

                      {/* Card Footer: Amount & Action Button */}
                      <div className="flex items-center justify-between border-t border-border/50 pt-2.5">
                        <span className="font-display text-sm font-bold tabular-nums text-foreground">
                          {formatMoney(order.total_cents, currency)}
                        </span>

                        {nextStatus && (
                          <button
                            disabled={isUpdatingStatus}
                            onClick={(e) => {
                              e.stopPropagation();
                              onUpdateStatus(order.id, nextStatus);
                            }}
                            className={cn(
                              "inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold transition shadow-soft active:scale-95",
                              nextStatus === "in_kitchen" && "bg-amber-500/15 text-amber-700 hover:bg-amber-500/25 dark:text-amber-300",
                              nextStatus === "ready" && "bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/25 dark:text-emerald-300",
                              nextStatus === "served" && "bg-brand text-brand-foreground hover:opacity-90"
                            )}
                          >
                            <span>
                              {nextStatus === "in_kitchen" && "Start Cooking"}
                              {nextStatus === "ready" && "Mark Ready"}
                              {nextStatus === "served" && "Serve Order"}
                            </span>
                            <ChevronRight className="h-3 w-3" />
                          </button>
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
  );
}
