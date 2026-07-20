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
  // Live auto-updating ticker timer (runs every 10s to keep elapsed time & aging fresh)
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 10000);
    return () => clearInterval(timer);
  }, []);

  // Group orders into columns with Live Board Cleanup (Recently Served Window: 2 hours)
  const columnsData = useMemo(() => {
    const map: Record<string, (Order & { order_items: OrderItem[] })[]> = {
      placed: [],
      in_kitchen: [],
      ready: [],
      served: [],
    };

    const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;

    for (const o of orders) {
      if (o.status === "served") {
        const servedTime = o.updated_at ? new Date(o.updated_at).getTime() : new Date(o.created_at).getTime();
        if (servedTime >= twoHoursAgo) {
          map.served.push(o);
        }
      } else if (o.status === "pending" || o.status === "placed") {
        map.placed.push(o);
      } else if (o.status === "preparing" || o.status === "in_kitchen") {
        map.in_kitchen.push(o);
      } else if (o.status === "ready") {
        map.ready.push(o);
      }
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
            {/* Enhanced Column Header with Metrics & Sticky Positioning */}
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
                  <span>{status === "served" ? "Recently Served Subtotal" : "Subtotal"}: {formatMoney(totalCents, currency)}</span>
                </div>
              </div>
            </div>

            {/* Independent Column Scrolling */}
            <div className="flex-1 space-y-3 overflow-y-auto pr-1">
              {columnOrders.length === 0 ? (
                <div className="py-20 text-center text-xs text-muted-foreground italic">
                  {status === "served" ? "No recently served orders (last 2h)" : `No orders in ${meta.label.toLowerCase()}`}
                </div>
              ) : (
                columnOrders.map((o) => {
                  const aging = getOrderAging(o.created_at);
                  const priority = getOrderPriority(o);
                  const nextStatus = getNextOrderStatus(o.status);

                  return (
                    <div
                      key={o.id}
                      onClick={() => onSelectOrder(o)}
                      className={cn(
                        "group relative cursor-pointer rounded-2xl bg-background p-4 shadow-soft ring-1 transition hover:ring-2 hover:ring-ring/60 select-none space-y-3",
                        priority.isHighPriority ? "ring-amber-500/50 bg-amber-500/5" : "ring-border/60"
                      )}
                    >
                      {/* Top Header Row */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-display text-base font-bold text-foreground">
                            {formatOrderLabel(o.order_number)}
                          </span>
                          <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold text-secondary-foreground">
                            Table {tableLabelMap.get(o.table_id) ?? "?"}
                          </span>
                        </div>

                        {/* Order Aging Visual Indicator */}
                        <div className="flex items-center gap-1">
                          <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold border", aging.badgeStyle)}>
                            <Timer className="h-3 w-3" />
                            {formatTimeElapsed(o.created_at)}
                          </span>
                        </div>
                      </div>

                      {/* Items Preview */}
                      <div className="space-y-1 text-xs text-muted-foreground">
                        {(o.order_items ?? []).map((it) => (
                          <div key={it.id} className="flex justify-between">
                            <span className="truncate pr-2">
                              <strong className="text-foreground">{it.qty}x</strong> {it.name}
                            </span>
                            <span className="tabular-nums shrink-0">{formatMoney(it.qty * it.price_cents, currency)}</span>
                          </div>
                        ))}
                      </div>

                      {/* Notes indicator */}
                      {o.notes && (
                        <div className="flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400 bg-amber-500/10 rounded-xl p-2 font-medium">
                          <FileText className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">Note: {o.notes}</span>
                        </div>
                      )}

                      {/* Priority Warning Banner */}
                      {priority.isHighPriority && (
                        <div className="flex items-center gap-1 text-[10px] font-bold text-amber-700 dark:text-amber-300">
                          <Flame className="h-3 w-3 text-amber-500" />
                          <span>{priority.reason}</span>
                        </div>
                      )}

                      {/* Footer & Single Primary Workflow Button */}
                      <div className="flex items-center justify-between border-t border-border/50 pt-2.5">
                        <span className="font-display text-sm font-bold tabular-nums text-foreground">
                          {formatMoney(o.total_cents, currency)}
                        </span>

                        {nextStatus ? (
                          <button
                            disabled={isUpdatingStatus}
                            onClick={(e) => {
                              e.stopPropagation();
                              onUpdateStatus(o.id, nextStatus);
                            }}
                            className={cn(
                              "inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-semibold shadow-soft transition active:scale-95 disabled:opacity-50",
                              nextStatus === "in_kitchen" && "bg-blue-600 text-white hover:bg-blue-700",
                              nextStatus === "ready" && "bg-amber-600 text-white hover:bg-amber-700",
                              nextStatus === "served" && "bg-emerald-600 text-white hover:bg-emerald-700"
                            )}
                          >
                            <span>
                              {nextStatus === "in_kitchen" && "Start Preparing"}
                              {nextStatus === "ready" && "Mark Ready"}
                              {nextStatus === "served" && "Serve Order"}
                            </span>
                            <ChevronRight className="h-3.5 w-3.5" />
                          </button>
                        ) : (
                          <span className="text-[11px] font-semibold text-emerald-600 flex items-center gap-1">
                            <CheckCircle className="h-3.5 w-3.5" /> Completed
                          </span>
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
