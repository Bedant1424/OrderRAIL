import { Link, useParams } from "react-router-dom";
import { ShoppingBag, ArrowRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useCart } from "@/lib/cart";
import { formatMoney } from "@/lib/db";
import { cn } from "@/lib/utils";
import { BOTTOM_NAV_HEIGHT, FLOATING_CART_GAP } from "@/lib/constants";

export function FloatingCart({ currency }: { currency: string }) {
  const { count, subtotalCents, editingOrderId } = useCart();
  const { tableId } = useParams();

  return (
    <AnimatePresence>
      {count > 0 && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: "spring", stiffness: 380, damping: 32 }}
          style={{
            bottom: `calc(${BOTTOM_NAV_HEIGHT} + ${FLOATING_CART_GAP} + env(safe-area-inset-bottom))`
          }}
          className="pointer-events-none fixed inset-x-0 z-30 px-4"
        >
          <Link
            to={`/t/${tableId}/cart`}
            className={cn(
              "pointer-events-auto mx-auto flex w-full max-w-[420px] items-center justify-between gap-3 rounded-full px-4 py-3 bg-cc-text text-white shadow-xl border border-white/10 hover:bg-cc-text/95 active:scale-[0.98] transition-all"
            )}
          >
            <span className="flex items-center gap-2.5 min-w-0">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-cc-primary text-white shadow-xs">
                <ShoppingBag className="h-4 w-4" />
              </span>
              <span className="font-sans text-sm font-bold tracking-tight truncate">
                {editingOrderId ? "Editing: " : ""}{count} {count === 1 ? "item" : "items"}
              </span>
            </span>
            <span className="flex items-center gap-2 font-sans text-sm font-extrabold tabular-nums shrink-0">
              <span>{formatMoney(subtotalCents, currency)}</span>
              <span className="rounded-full bg-cc-primary px-3 py-1 text-xs font-bold text-white flex items-center gap-1 shadow-xs">
                View Cart <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </span>
          </Link>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
