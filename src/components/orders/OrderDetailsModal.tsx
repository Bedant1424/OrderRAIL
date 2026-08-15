import { X, CheckCircle2 } from "lucide-react";
import { formatMoney, formatOrderLabel, type Order } from "@/lib/db";
import { useCafe } from "@/lib/cafe";

function OrderStatusBadge({ status }: { status: Order["status"] }) {
  switch (status) {
    case "pending":
      return <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-600 border border-amber-500/20">Pending</span>;
    case "in_kitchen":
    case "preparing":
      return <span className="inline-flex items-center rounded-full bg-orange-500/10 px-2.5 py-0.5 text-xs font-semibold text-orange-600 border border-orange-500/20">Preparing</span>;
    case "ready":
      return <span className="inline-flex items-center rounded-full bg-blue-500/10 px-2.5 py-0.5 text-xs font-semibold text-blue-600 border border-blue-500/20">Ready</span>;
    case "served":
    case "completed":
      return <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 border border-emerald-500/20">Served</span>;
    case "cancelled":
      return <span className="inline-flex items-center rounded-full bg-destructive/10 px-2.5 py-0.5 text-xs font-semibold text-destructive border border-destructive/20">Cancelled</span>;
    default:
      return <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">{status}</span>;
  }
}

interface OrderDetailsModalProps {
  order: Order;
  onClose: () => void;
}

export default function OrderDetailsModal({ order, onClose }: OrderDetailsModalProps) {
  const { currency } = useCafe();

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-card rounded-3xl border border-border/80 shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150 text-foreground"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-border/60 flex items-center justify-between shrink-0">
          <div>
            <div className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Order Details</div>
            <h2 className="font-display text-xl font-bold">
              {formatOrderLabel(order.order_number)}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-muted-foreground hover:bg-muted cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* Status & Channel */}
          <div className="flex items-center justify-between rounded-2xl bg-secondary/50 p-4 border border-border/40">
            <div>
              <div className="text-[10px] text-muted-foreground uppercase font-bold">Channel</div>
              <div className="font-semibold text-xs text-foreground uppercase mt-0.5">
                {order.order_source || order.order_type || "Dine In"}
              </div>
            </div>
            <OrderStatusBadge status={order.status} />
          </div>

          {/* Customer Info if present */}
          {(order.customer_name || order.customer_phone) && (
            <div className="rounded-2xl bg-secondary/30 p-3.5 border border-border/40 text-xs space-y-1">
              <span className="text-[10px] text-muted-foreground uppercase font-bold block">Customer Details</span>
              {order.customer_name && <div className="font-bold text-foreground">{order.customer_name}</div>}
              {order.customer_phone && <div className="font-mono text-muted-foreground">{order.customer_phone}</div>}
            </div>
          )}

          {/* Items List */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Order Items ({(order.order_items ?? []).length})
            </h3>
            <div className="divide-y divide-border/50 rounded-2xl border border-border/60 bg-background p-3">
              {(order.order_items ?? []).map((it) => (
                <div key={it.id} className="py-2 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-semibold text-foreground">{it.qty}x</span> {it.name}
                    {it.note && (
                      <p className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 mt-0.5">
                        + {it.note}
                      </p>
                    )}
                  </div>
                  <span className="font-semibold tabular-nums text-foreground">
                    {formatMoney(it.qty * it.price_cents, currency)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Notes */}
          {order.notes && (
            <div className="rounded-2xl bg-amber-500/10 border border-amber-500/20 p-3 text-xs text-amber-900 dark:text-amber-200">
              <strong>Special Notes:</strong> {order.notes}
            </div>
          )}

          {/* Total Breakdown */}
          <div className="space-y-1.5 rounded-2xl bg-secondary/30 p-4 text-xs border border-border/40">
            <div className="flex justify-between font-display text-sm font-bold text-foreground">
              <span>Total Amount</span>
              <span className="tabular-nums">{formatMoney(order.total_cents, currency)}</span>
            </div>
          </div>

          {/* Timestamps */}
          <div className="text-[11px] text-muted-foreground space-y-0.5 pt-2">
            <div>Created: {new Date(order.created_at).toLocaleString()}</div>
            {order.updated_at && <div>Updated: {new Date(order.updated_at).toLocaleString()}</div>}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border/60 shrink-0 bg-muted/20">
          <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-2.5 text-xs text-emerald-900 dark:text-emerald-200 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span className="font-medium">Historical Ledger Record ({order.status})</span>
          </div>
        </div>
      </div>
    </div>
  );
}
