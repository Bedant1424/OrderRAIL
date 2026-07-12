import { Link, useParams } from "react-router-dom";
import { ShoppingBag } from "lucide-react";
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
              "pointer-events-auto mx-auto flex w-full max-w-[420px] items-center justify-between gap-4 rounded-full px-5 py-3.5 bg-primary text-primary-foreground shadow-none"
            )}
          >
            <span className="flex items-center gap-3">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-primary-foreground/15">
                <ShoppingBag className="h-4 w-4" />
              </span>
              <span className="text-base font-semibold">
                {editingOrderId ? "Editing: " : ""}{count} {count === 1 ? "item" : "items"}
              </span>
            </span>
            <span className="flex items-center gap-2 text-base font-bold tabular-nums">
              {formatMoney(subtotalCents, currency)}
              <span aria-hidden>→</span>
            </span>
          </Link>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
