import React, { useState } from "react";
import { X, AlertTriangle, Trash2, CheckCircle, Clock } from "lucide-react";
import { toast } from "sonner";
import { OrderService } from "@/lib/orders/orderService";
import { cn } from "@/lib/utils";

export const CANCELLATION_REASONS = [
  "Customer cancelled",
  "Item unavailable",
  "Kitchen issue",
  "Duplicate order",
  "Payment issue",
  "Staff correction",
  "Other",
] as const;

export type CancellationReasonType = (typeof CANCELLATION_REASONS)[number];

interface CancelOrderModalProps {
  open: boolean;
  onClose: () => void;
  order: {
    id: string;
    order_number: number;
    orderNumber?: number;
    status?: string;
    tableLabel?: string;
    items?: Array<{ id?: string; name: string; price?: number; qty: number; notes?: string }>;
    order_items?: Array<{ id?: string; name: string; price_cents?: number; qty: number; note?: string }>;
  } | null;
  actor?: "counter" | "staff" | "owner";
  onSuccess?: () => void;
}

export default function CancelOrderModal({
  open,
  onClose,
  order,
  actor = "counter",
  onSuccess,
}: CancelOrderModalProps) {
  const [selectedReason, setSelectedReason] = useState<CancellationReasonType>("Customer cancelled");
  const [otherExplanation, setOtherExplanation] = useState("");
  const [additionalNote, setAdditionalNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!open || !order) return null;

  const orderNum = order.order_number || order.orderNumber || 101;
  const isOther = selectedReason === "Other";
  const isValid = selectedReason && (!isOther || otherExplanation.trim().length > 0);

  const rawItems = order.order_items || order.items || [];
  const items = rawItems.map((i: any) => ({
    id: i.id,
    name: i.name,
    qty: i.qty,
    price: i.price || (i.price_cents ? i.price_cents / 100 : 0),
    notes: i.note || i.notes,
  }));

  const handleConfirmCancel = async () => {
    if (!isValid || isSubmitting) return;

    setIsSubmitting(true);
    const finalReason = isOther
      ? `Other: ${otherExplanation.trim()}${additionalNote.trim() ? ` (${additionalNote.trim()})` : ""}`
      : `${selectedReason}${additionalNote.trim() ? ` - ${additionalNote.trim()}` : ""}`;

    try {
      const res = await OrderService.cancelOrder(order.id, actor, undefined, finalReason);

      if (res.result?.requires_cancel_kot) {
        try {
          const printRes = await OrderService.printCancelKot({
            orderId: order.id,
            orderNumber: orderNum,
            kotNumber: orderNum,
            tableLabel: order.tableLabel || "Express",
            timestamp: new Date().toLocaleTimeString("en-IN", {
              hour: "2-digit",
              minute: "2-digit",
              hour12: true,
            }),
            cancellationReason: finalReason,
            cancelledItems: items,
          });

          if (!printRes.queued) {
            toast.success("Order cancelled and kitchen notified");
          } else {
            toast.info("Order cancelled, but kitchen notification is queued");
          }
        } catch (printErr: any) {
          console.warn("[CancelOrderModal] Print error:", printErr);
          toast.warning("Order cancelled, but kitchen notification failed to print");
        }
      } else {
        toast.success("Order cancelled");
      }

      onSuccess?.();
      onClose();
    } catch (err: any) {
      console.error("[CancelOrderModal] Cancellation error:", err);
      toast.error(err?.message || "Failed to cancel order");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-card rounded-3xl border border-border/80 shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150 text-foreground"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-border/60 flex items-center justify-between shrink-0 bg-destructive/5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-destructive/10 text-destructive shrink-0">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <div className="text-[10px] uppercase font-extrabold tracking-wider text-destructive">
                Cancel Order Confirmation
              </div>
              <h2 className="font-display text-lg font-bold">
                Order #{orderNum} {order.tableLabel ? `· ${order.tableLabel}` : ""}
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-muted-foreground hover:bg-muted cursor-pointer transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* Confirmation Prompt */}
          <div className="p-3.5 rounded-2xl bg-muted/40 border border-border/60 text-xs text-muted-foreground leading-relaxed">
            Are you sure you want to cancel this order? This will cancel all items and update the dining session billing total.
          </div>

          {/* Reason Selection */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-foreground">
              Cancellation Reason <span className="text-destructive">*</span>
            </label>
            <select
              value={selectedReason}
              onChange={(e) => setSelectedReason(e.target.value as CancellationReasonType)}
              className="w-full h-10 px-3 rounded-xl border border-border bg-background text-xs font-semibold text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary/40 transition cursor-pointer"
            >
              {CANCELLATION_REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          {/* Other Explanation Input */}
          {isOther && (
            <div className="space-y-1.5 animate-in fade-in duration-150">
              <label className="text-xs font-bold text-foreground">
                Explanation for "Other" <span className="text-destructive">*</span>
              </label>
              <textarea
                value={otherExplanation}
                onChange={(e) => setOtherExplanation(e.target.value)}
                placeholder="Explain reason for cancellation..."
                rows={2}
                className="w-full p-3 rounded-xl border border-border bg-background text-xs text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary/40 transition resize-none"
              />
            </div>
          )}

          {/* Additional Notes (Optional) */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-muted-foreground">
              Additional Notes <span className="text-[10px] font-normal">(Optional)</span>
            </label>
            <input
              type="text"
              value={additionalNote}
              onChange={(e) => setAdditionalNote(e.target.value)}
              placeholder="e.g. Customer changed mind after 5 mins"
              className="w-full h-9 px-3 rounded-xl border border-border bg-background text-xs text-foreground outline-none focus:border-primary transition"
            />
          </div>

          {/* Items Preview */}
          <div className="space-y-1.5 pt-2">
            <div className="text-[11px] uppercase tracking-wider font-extrabold text-muted-foreground">
              Items to be cancelled ({items.reduce((s, i) => s + i.qty, 0)})
            </div>
            <div className="p-3 rounded-2xl border border-border/60 bg-muted/20 space-y-1.5 max-h-36 overflow-y-auto text-xs">
              {items.map((it, idx) => (
                <div key={idx} className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground">
                    <strong className="text-foreground">{it.qty}×</strong> {it.name}
                  </span>
                  {it.notes && <span className="text-[10px] italic text-muted-foreground">"{it.notes}"</span>}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-border/60 flex items-center justify-end gap-2 bg-muted/10 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-xl text-xs font-bold text-muted-foreground hover:bg-muted hover:text-foreground transition cursor-pointer"
          >
            Keep Order
          </button>
          <button
            type="button"
            onClick={handleConfirmCancel}
            disabled={!isValid || isSubmitting}
            className={cn(
              "px-4 py-2 rounded-xl text-xs font-bold text-white bg-destructive hover:bg-destructive/90 transition shadow-sm flex items-center gap-1.5 cursor-pointer",
              (!isValid || isSubmitting) && "opacity-50 cursor-not-allowed"
            )}
          >
            <Trash2 className="w-3.5 h-3.5" />
            {isSubmitting ? "Cancelling..." : "Confirm Cancellation"}
          </button>
        </div>
      </div>
    </div>
  );
}
