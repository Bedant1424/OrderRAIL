import { Link, useParams } from "react-router-dom";
import { ShoppingBag } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useCart } from "@/lib/cart";
import { formatMoney } from "@/lib/db";

export function FloatingCart({ currency }: { currency: string }) {
  const { count, subtotalCents } = useCart();
  const { tableId } = useParams();
  return (
  <div
    style={{
      position: "fixed",
      bottom: 150,
      left: 20,
      right: 20,
      zIndex: 999999,
      background: "red",
      color: "white",
      padding: 20,
      fontSize: 28,
      fontWeight: "bold",
    }}
  >
    THIS IS FLOATING CART
  </div>
);
