import { useNavigate, useParams } from "react-router-dom";
import { Minus, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { motion } from "framer-motion";
import { useCart } from "@/lib/cart";
import { formatMoney, type Cafe, type TableRow } from "@/lib/db";
import { getSessionId } from "@/lib/session";
import { submitOrder } from "@/lib/orderQueue";
import { toast } from "sonner";

export function CartView({ cafe, table }: { cafe: Cafe; table: TableRow }) {
  const { lines, setQty, remove, subtotalCents, clear } = useCart();
  const { tableId } = useParams();
  const navigate = useNavigate();
  const [note, setNote] = useState("");
  const [placing, setPlacing] = useState(false);

  const placeOrder = async () => {
    if (!lines.length) return;
    setPlacing(true);
    try {
      const orderId = crypto.randomUUID();
      const { queued } = await submitOrder({
        id: orderId,
        cafe_id: cafe.id,
        table_id: table.id,
        session_id: getSessionId(),
        note: note.trim() || null,
        total_cents: subtotalCents,
        items: lines.map((l) => ({
          menu_item_id: l.item.id,
          name: l.item.name,
          price_cents: l.item.price_cents,
          qty: l.qty,
          note: l.note ?? null,
        })),
      });
      clear();
      if (queued) {
        toast.success("Order saved offline — it'll send when you're back online.");
      } else {
        toast.success("Order sent to the kitchen ☕");
      }
      navigate(`/t/${tableId}/order/${orderId}`);
    } catch (e) {
      console.error(e);
      toast.error("Could not place order. Please try again.");
    } finally {
      setPlacing(false);
    }
  };

  if (!lines.length) {
    return (
      <div className="px-6 py-24 text-center">
        <div className="mx-auto mb-6 grid h-20 w-20 place-items-center rounded-full bg-secondary">
          <span aria-hidden className="text-3xl">🥐</span>
        </div>
        <h2 className="font-display text-2xl font-semibold">Your basket is empty</h2>
        <p className="mt-2 text-muted-foreground">Add something delicious from the menu.</p>
        <button
          onClick={() => navigate(`/t/${tableId}`)}
          className="mt-6 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-soft"
        >
          Browse menu
        </button>
      </div>
    );
  }

  return (
    <div className="pb-40">
      <div className="px-4 pt-4">
        <h1 className="font-display text-3xl font-semibold">Your Order</h1>
        <p className="mt-1 text-sm text-muted-foreground">Table {table.label} · {cafe.name}</p>
      </div>

      <ul className="mt-6 space-y-3 px-4">
        {lines.map((l) => (
          <motion.li
            layout
            key={l.item.id}
            className="flex items-center gap-3 rounded-2xl bg-card p-3 shadow-soft ring-1 ring-border/60"
          >
            {l.item.image_url ? (
              <img src={l.item.image_url} alt="" className="h-14 w-14 rounded-xl object-cover" />
            ) : (
              <div className="h-14 w-14 rounded-xl bg-gradient-warm" aria-hidden />
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{l.item.name}</p>
              <p className="text-sm text-muted-foreground tabular-nums">
                {formatMoney(l.item.price_cents, cafe.currency)}
              </p>
            </div>
            <div className="flex items-center gap-1 rounded-full bg-secondary p-1">
              <button
                aria-label="Decrease"
                onClick={() => setQty(l.item.id, l.qty - 1)}
                className="grid h-8 w-8 place-items-center rounded-full text-secondary-foreground transition hover:bg-background"
              >
                {l.qty === 1 ? <Trash2 className="h-4 w-4" /> : <Minus className="h-4 w-4" />}
              </button>
              <span className="w-6 text-center text-sm font-semibold tabular-nums">{l.qty}</span>
              <button
                aria-label="Increase"
                onClick={() => setQty(l.item.id, l.qty + 1)}
                className="grid h-8 w-8 place-items-center rounded-full text-secondary-foreground transition hover:bg-background"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </motion.li>
        ))}
      </ul>

      <div className="mt-6 px-4">
        <label className="block text-sm font-medium">Note for staff (optional)</label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value.slice(0, 300))}
          placeholder="Any allergies or special requests?"
          rows={3}
          className="mt-2 w-full resize-none rounded-2xl border border-border bg-card p-3 text-sm outline-none focus:ring-2 focus:ring-ring/60"
        />
      </div>

      <div className="fixed inset-x-0 bottom-16 z-30 pb-safe">
        <div className="mx-auto max-w-md px-4">
          <div className="rounded-2xl bg-card p-4 shadow-float ring-1 ring-border">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Subtotal</span>
              <span className="font-display text-xl font-semibold tabular-nums">
                {formatMoney(subtotalCents, cafe.currency)}
              </span>
            </div>
            <button
              onClick={placeOrder}
              disabled={placing}
              className="w-full rounded-full bg-gradient-accent px-6 py-3.5 text-sm font-semibold text-accent-foreground shadow-soft transition active:scale-[0.99] disabled:opacity-60"
            >
              {placing ? "Sending…" : "Place Order"}
            </button>
            <p className="mt-2 text-center text-xs text-muted-foreground">Pay at the counter when you're ready.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
