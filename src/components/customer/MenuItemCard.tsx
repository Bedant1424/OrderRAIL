import { useState } from "react";
import { Plus, Minus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { MenuItem } from "@/lib/db";
import { formatMoney } from "@/lib/db";
import { useCart } from "@/lib/cart";
import { useImageUrl } from "@/lib/useImageUrl";
import { Drawer, DrawerContent, DrawerFooter } from "@/components/ui/drawer";
import { toast } from "@/components/ui/sonner";
import { useCustomerOverlay } from "@/hooks/useCustomerBack";
import { MenuImage } from "./MenuImage";

const getTagColorClass = (tag: string): string => {
  switch (tag) {
    case "Best Seller":
    case "Bestseller":
      return "bg-[#F59E0B]/15 text-[#2A1710] border border-[#F59E0B]/40 font-bold";
    case "New":
      return "bg-blue-50 text-blue-800 border border-blue-200 font-bold";
    case "Popular":
      return "bg-amber-50 text-amber-900 border border-amber-300 font-bold";
    case "Chef's Choice":
      return "bg-purple-50 text-purple-900 border border-purple-200 font-bold";
    case "Today's Special":
      return "bg-rose-50 text-rose-900 border border-rose-200 font-bold";
    case "Spicy":
      return "bg-red-50 text-red-800 border border-red-200 font-bold";
    case "Veg":
      return "bg-emerald-50 text-emerald-800 border border-emerald-300 font-bold";
    case "Non-Veg":
      return "bg-rose-50 text-rose-800 border border-rose-300 font-bold";
    default:
      return "bg-[#FFF8EA] text-[#75625B] border border-[#E8DCC8] font-medium";
  }
};

export function MenuItemCard({ item, currency }: { item: MenuItem; currency: string }) {
  const { add, lines, setQty, editingOrderId } = useCart();
  const imgUrl = useImageUrl(item.image_url);
  const [isOpen, setIsOpen] = useState(false);
  useCustomerOverlay(isOpen, setIsOpen, `item-details-${item.id}`);
  const [quantity, setQuantity] = useState(0);
  const cartLine = lines.find((l) => l.item.id === item.id);
  const cartQty = cartLine ? cartLine.qty : 0;

  const handleCardClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest("button") || target.closest("svg")) {
      return;
    }
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

  const tagsToRender = (item.tags || []).filter((t) => t !== "Veg" && t !== "Non-Veg");
  if (item.veg_type === "veg") {
    tagsToRender.unshift("Veg");
  } else if (item.veg_type === "non_veg") {
    tagsToRender.unshift("Non-Veg");
  }

  return (
    <>
      <motion.article
        layout
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        onClick={handleCardClick}
        className="group relative flex gap-3.5 rounded-2xl bg-white p-3 shadow-xs border border-[#E8DCC8] cursor-pointer transition hover:border-[#EA580C]/40 hover:shadow-sm"
      >
        <div className="relative h-24 w-24 shrink-0 rounded-xl overflow-hidden border border-[#E8DCC8] bg-[#FFF8EA]">
          {imgUrl ? (
            <MenuImage src={imgUrl} alt={item.name} />
          ) : (
            <div className="h-full w-full flex items-center justify-center text-xl bg-[#FFF8EA]" aria-hidden>
              ☕
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col justify-between">
          <div>
            {tagsToRender.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-1">
                {tagsToRender.map((tag) => (
                  <span
                    key={tag}
                    className={`rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${getTagColorClass(tag)}`}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
            <h3 className="break-anywhere font-display text-base font-bold leading-tight text-[#2A1710]">{item.name}</h3>
            {item.description && (
              <p className="mt-0.5 line-clamp-2 text-xs text-[#75625B] leading-relaxed">{item.description}</p>
            )}
          </div>

          <div className="mt-2 flex items-center justify-between pt-1">
            <span className="text-sm font-black text-[#2A1710] tabular-nums">{formatMoney(item.price_cents, currency)}</span>
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
                  className="inline-flex items-center justify-center gap-1 rounded-full bg-[#EA580C] hover:bg-[#EA580C]/90 text-white px-3 py-1.5 text-xs font-bold shadow-xs active:scale-95 transition-all min-h-[36px] min-w-[64px]"
                >
                  ADD <Plus className="h-3.5 w-3.5" strokeWidth={3} />
                </motion.button>
              ) : (
                <motion.div
                  key="qty-selector"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  transition={{ duration: 0.1 }}
                  className="flex items-center gap-1 rounded-full bg-[#FFF8EA] border border-[#E8DCC8] p-0.5 h-9"
                >
                  <button
                    type="button"
                    aria-label="Decrease quantity"
                    onClick={(e) => {
                      e.stopPropagation();
                      setQty(item.id, cartQty - 1);
                    }}
                    className="grid h-7 w-7 place-items-center rounded-full bg-white text-[#2A1710] border border-[#E8DCC8] hover:bg-[#EA580C] hover:text-white transition-all active:scale-90"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <span
                    className="w-5 text-center text-xs font-black text-[#2A1710] tabular-nums select-none"
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
                    className="grid h-7 w-7 place-items-center rounded-full bg-[#EA580C] text-white hover:bg-[#EA580C]/90 transition-all active:scale-90"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.article>

      <Drawer open={isOpen} onOpenChange={setIsOpen}>
        <DrawerContent className="max-w-md mx-auto bg-[#FFF8EA] border-t border-[#E8DCC8]">
          {imgUrl ? (
            <div className="relative w-full aspect-[16/10] overflow-hidden rounded-t-[10px] bg-[#FFF8EA] border-b border-[#E8DCC8] -mt-6">
              <img src={imgUrl} alt={item.name} className="h-full w-full object-cover" />
            </div>
          ) : (
            <div className="w-full aspect-[16/10] bg-[#FFF8EA] border-b border-[#E8DCC8] flex items-center justify-center rounded-t-[10px] -mt-6" aria-hidden>
              <span className="text-4xl">☕</span>
            </div>
          )}

          <div className="p-5 flex-1 overflow-y-auto max-h-[45vh]">
            {tagsToRender.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {tagsToRender.map((tag) => (
                  <span
                    key={tag}
                    className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${getTagColorClass(tag)}`}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

            <h2 className="font-display text-2xl font-extrabold text-[#2A1710] leading-tight">{item.name}</h2>

            <p className="mt-2 text-sm text-[#75625B] leading-relaxed">
              {item.description || "Freshly prepared with premium ingredients by our experienced chefs."}
            </p>

            <div className="mt-6 flex items-center justify-between border-t border-[#E8DCC8] pt-4">
              <span className="text-xl font-black text-[#2A1710] tabular-nums">
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
                    className="rounded-full bg-[#EA580C] hover:bg-[#EA580C]/90 px-6 py-2 text-sm font-bold text-white shadow-xs"
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
                    className="flex items-center gap-3 rounded-full bg-white border border-[#E8DCC8] p-1"
                  >
                    <button
                      type="button"
                      onClick={() => setQuantity((q) => Math.max(0, q - 1))}
                      className="grid h-8 w-8 place-items-center rounded-full bg-[#FFF8EA] text-[#2A1710] border border-[#E8DCC8] hover:bg-[#EA580C] hover:text-white transition-all active:scale-90"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="w-8 text-center text-sm font-black text-[#2A1710] tabular-nums select-none">{displayQty}</span>
                    <button
                      type="button"
                      onClick={() => setQuantity((q) => q + 1)}
                      className="grid h-8 w-8 place-items-center rounded-full bg-[#EA580C] text-white hover:bg-[#EA580C]/90 transition-all active:scale-90"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          <DrawerFooter className="border-t border-[#E8DCC8] bg-white p-4">
            <button
              type="button"
              onClick={handleAddToCart}
              disabled={displayQty === 0}
              className="w-full rounded-full bg-[#EA580C] hover:bg-[#EA580C]/90 py-3.5 text-sm font-bold text-white shadow-md flex items-center justify-center gap-2 disabled:opacity-50 transition"
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
