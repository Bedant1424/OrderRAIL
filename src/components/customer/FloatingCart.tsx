import { Link, useParams } from "react-router-dom";
import { ShoppingBag } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useCart } from "@/lib/cart";
import { formatMoney } from "@/lib/db";

export function FloatingCart({ currency }: { currency: string }) {
  const { count, subtotalCents } = useCart();
  const { tableId } = useParams();
   return (
    <AnimatePresence>
      {count > 0 && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: "spring", stiffness: 380, damping: 32 }}
          className="pointer-events-none fixed bottom-24 inset-x-0 z-30 px-4"
        >
          <Link
            to={`/t/${tableId}/cart`}
            className="pointer-events-auto mx-auto flex max-w-md items-center justify-between gap-4 rounded-full bg-primary px-5 py-3.5 text-primary-foreground shadow-float"
          >
            <span className="flex items-center gap-3">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-primary-foreground/15">
                <ShoppingBag className="h-4 w-4" />
              </span>
              <span className="text-sm font-medium">
                {count} {count === 1 ? "item" : "items"}
              </span>
            </span>
            <span className="flex items-center gap-2 text-sm font-semibold tabular-nums">
              {formatMoney(subtotalCents, currency)}
              <span aria-hidden>→</span>
            </span>
          </Link>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
