import { useMemo } from "react";
import { Clock, Utensils, ChevronRight, CheckCircle, AlertCircle, FileText } from "lucide-react";
import { formatMoney, formatOrderLabel, type Order, type OrderItem } from "@/lib/db";
import { ORDER_STATUS_MAP, formatTimeElapsed, getNextOrderStatus } from "@/lib/orders/orderUtils";
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

        return (
          <div key={status} className="flex flex-col rounded-3xl bg-card p-4 shadow-soft ring-1 ring-border/60 min-h-[500px]">
            {/* Column Header */}
            <div className="flex items-center justify-between border-b border-border/60 pb-3 mb-3">
              <div className="flex items-center gap-2">
                <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border", meta.columnHeaderBg)}>
                  {meta.columnTitle}
                </span>
              </div>
              <span className="font-display text-sm font-bold text-muted-foreground tabular-nums">
                {columnOrders.length}
              </span>
            </div>

            {/* Column Order Cards */}
            <div className="flex-1 space-y-3 overflow-y-auto pr-1">
              {columnOrders.length === 0 ? (
                <div className="py-16 text-center text-xs text-muted-foreground italic">
                  No orders in {meta.label.toLowerCase()}
                </div>
              ) : (
                columnOrders.map((order) => {
                  const itemCount = (order.order_items ?? []).reduce((s, it) => s + it.qty, 0);
                  const nextStatus = getNextOrderStatus(order.status);

                  return (
                    <div
                      key={order.id}
                      onClick={() => onSelectOrder(order)}
                      className="group cursor-pointer rounded-2xl border border-border bg-background p-4 shadow-soft transition hover:border-accent/50 hover:shadow-float space-y-3 select-none"
                    >
                      {/* Card Top Header */}
                      <div className="flex items-center justify-between">
                        <span className="font-display text-base font-bold text-foreground">
                          {formatOrderLabel(order.order_number)}
                        </span>
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          {formatTimeElapsed(order.created_at)}
                        </span>
                      </div>

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

                      {/* Notes Indicator */}
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
