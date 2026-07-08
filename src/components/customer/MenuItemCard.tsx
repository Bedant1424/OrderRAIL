import { useState } from "react";
import { Plus, Minus, Trash2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { MenuItem } from "@/lib/db";
import { formatMoney } from "@/lib/db";
import { useCart } from "@/lib/cart";
import { useImageUrl } from "@/lib/useImageUrl";
import { Drawer, DrawerContent, DrawerFooter } from "@/components/ui/drawer";
import { toast } from "sonner";

import { MenuImage } from "./MenuImage";

export function MenuItemCard({ item, currency }: { item: MenuItem; currency: string }) {
  const { add, lines, setQty, editingOrderId } = useCart();
  const imgUrl = useImageUrl(item.image_url);
  const [isOpen, setIsOpen] = useState(false);
  const [quantity, setQuantity] = useState(0);
  const cartLine = lines.find((l) => l.item.id === item.id);
  const cartQty = cartLine ? cartLine.qty : 0;

  const handleCardClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest("button") || target.closest("svg")) {
      return;
    }
    // When opening the modal, start with the cart quantity (0 = show ADD button)
    setQuantity(cartQty);
    setIsOpen(true);
  };

  const handleAddToCart = () => {
    if (quantity <= 0) return;

    const existingLine = lines.find((l) => l.item.id === item.id);
    const existingQty = existingLine ? existingLine.qty : 0;

    if (existingQty === 0) {
      add({
        id: item.id,
        name: item.name,
        price_cents: item.price_cents,
        image_url: item.image_url,
      });
      if (quantity > 1) {
        setQty(item.id, quantity);
      }
    } else {
      setQty(item.id, quantity);
    }
    setIsOpen(false);
    toast.success(`Added ${quantity} × ${item.name} to cart`);
  };

  const isEditing = !!editingOrderId;
  const displayQty = quantity;
  const totalPrice = item.price_cents * (displayQty > 0 ? displayQty : 1);

  return (
    <>
      <motion.article
        layout
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        onClick={handleCardClick}
        className="group relative flex gap-4 rounded-3xl bg-card p-3 shadow-soft ring-1 ring-border/60 cursor-pointer transition hover:ring-accent/40"
      >
        {imgUrl ? (
          <MenuImage src={imgUrl} alt={item.name} />
        ) : (
          <div className="h-24 w-24 shrink-0 rounded-2xl bg-gradient-warm flex items-center justify-center ring-1 ring-border/60" aria-hidden>
            <span className="text-xl">☕</span>
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          {item.veg_type !== "unspecified" && (
            <span
              aria-label={item.veg_type === "veg" ? "Vegetarian" : "Non-vegetarian"}
              title={item.veg_type === "veg" ? "Vegetarian" : "Non-vegetarian"}
              className={`mb-1 inline-block h-2.5 w-2.5 shrink-0 self-start rounded-full ring-1 ${
                item.veg_type === "veg"
                  ? "bg-emerald-500 ring-emerald-600"
                  : "bg-rose-500 ring-rose-600"
              }`}
            />
          )}
          {item.tags && item.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-1">
              {item.tags.map((tag) => (
                <span
                  key={tag}
                  className={`rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                    tag === "Bestseller" ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" :
                    tag === "New" ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300" :
                    tag === "Popular" ? "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300" :
                    tag === "Chef's Choice" ? "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300" :
                    tag === "Spicy" ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300" :
                    tag === "Veg" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" :
                    tag === "Non-Veg" ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300" :
                    "bg-secondary text-secondary-foreground"
                  }`}
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
          <h3 className="break-anywhere font-display text-lg font-semibold leading-tight">{item.name}</h3>
          {item.description && (
            <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{item.description}</p>
          )}
          <div className="mt-auto flex items-end justify-between pt-2">
            <span className="font-semibold tabular-nums">{formatMoney(item.price_cents, currency)}</span>
            <AnimatePresence mode="wait">
              {cartQty === 0 ? (
                <motion.button
                  key="add-btn"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  transition={{ duration: 0.1 }}
                  type="button"
                  aria-label={`Add ${item.name}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    add({ id: item.id, name: item.name, price_cents: item.price_cents, image_url: item.image_url });
                  }}
                  className="grid h-10 w-10 place-items-center rounded-full bg-primary text-primary-foreground shadow-soft transition-transform active:scale-90"
                >
                  <Plus className="h-5 w-5" strokeWidth={2.5} />
                </motion.button>
              ) : (
                <motion.div
                  key="qty-selector"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  transition={{ duration: 0.1 }}
                  className="flex items-center gap-1.5 rounded-full bg-secondary p-1 h-10"
                >
                  <button
                    type="button"
                    aria-label="Decrease quantity"
                    onClick={(e) => {
                      e.stopPropagation();
                      setQty(item.id, cartQty - 1);
                    }}
                    className="grid h-8 w-8 place-items-center rounded-full text-secondary-foreground transition hover:bg-background"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span
                    className="w-5 text-center text-sm font-semibold tabular-nums select-none"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {cartQty}
                  </span>
                  <button
                    type="button"
                    aria-label="Increase quantity"
                    onClick={(e) => {
                      e.stopPropagation();
                      setQty(item.id, cartQty + 1);
                    }}
                    className="grid h-8 w-8 place-items-center rounded-full text-secondary-foreground transition hover:bg-background"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.article>

      <Drawer open={isOpen} onOpenChange={setIsOpen}>
        <DrawerContent className="max-w-md mx-auto">
          {/* Hero image — flush with modal top via negative margin over the drag handle */}
          {imgUrl ? (
            <div className="relative w-full aspect-[4/3] overflow-hidden rounded-t-[10px] bg-muted -mt-6">
              <img src={imgUrl} alt={item.name} className="h-full w-full object-cover" />
            </div>
          ) : (
            <div className="w-full aspect-[4/3] bg-gradient-warm flex items-center justify-center rounded-t-[10px] -mt-6" aria-hidden>
              <span className="text-4xl">☕</span>
            </div>
          )}

          <div className="p-5 flex-1 overflow-y-auto max-h-[45vh]">
            <div className="flex flex-wrap gap-1.5 mb-2">
              {item.tags?.map((tag) => (
                <span
                  key={tag}
                  className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                    tag === "Bestseller" ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" :
                    tag === "New" ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300" :
                    tag === "Popular" ? "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300" :
                    tag === "Chef's Choice" ? "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300" :
                    tag === "Spicy" ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300" :
                    tag === "Veg" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" :
                    tag === "Non-Veg" ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300" :
                    "bg-secondary text-secondary-foreground"
                  }`}
                >
                  {tag}
                </span>
              ))}
            </div>

            <h2 className="font-display text-2xl font-bold text-foreground leading-tight">{item.name}</h2>

            <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
              {item.description || "Freshly prepared with premium ingredients by our experienced chefs."}
            </p>

            {/* Price row with ADD / quantity selector */}
            <div className="mt-6 flex items-center justify-between">
              <span className="text-xl font-bold text-foreground tabular-nums">
                {formatMoney(item.price_cents, currency)}
              </span>

              <AnimatePresence mode="wait">
                {displayQty === 0 ? (
                  <motion.button
                    key="modal-add-btn"
                    initial={{ scale: 0.85, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.85, opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    type="button"
                    onClick={() => setQuantity(1)}
                    className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground shadow-soft transition-transform active:scale-95"
                  >
                    ADD
                  </motion.button>
                ) : (
                  <motion.div
                    key="modal-qty-selector"
                    initial={{ scale: 0.85, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.85, opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="flex items-center gap-3 rounded-full bg-secondary p-1"
                  >
                    <button
                      type="button"
                      onClick={() => setQuantity((q) => Math.max(0, q - 1))}
                      className="grid h-8 w-8 place-items-center rounded-full text-secondary-foreground transition hover:bg-background"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="w-8 text-center text-sm font-semibold tabular-nums select-none">{displayQty}</span>
                    <button
                      type="button"
                      onClick={() => setQuantity((q) => q + 1)}
                      className="grid h-8 w-8 place-items-center rounded-full text-secondary-foreground transition hover:bg-background"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          <DrawerFooter className="border-t border-border/60 bg-card p-4">
            <button
              type="button"
              onClick={handleAddToCart}
              disabled={displayQty === 0}
              className="w-full rounded-full bg-gradient-accent py-3.5 text-sm font-semibold text-accent-foreground shadow-soft transition active:scale-[0.99] flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
            >
              <span>{isEditing ? "Update Order" : "Add to Cart"}</span>
              <span>·</span>
              <span className="tabular-nums">{formatMoney(totalPrice, currency)}</span>
            </button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </>
  );
}
