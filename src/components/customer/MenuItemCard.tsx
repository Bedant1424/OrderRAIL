import { useState } from "react";
import { Plus, Minus, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { MenuItem } from "@/lib/db";
import { formatMoney } from "@/lib/db";
import { useCart } from "@/lib/cart";
import { useImageUrl } from "@/lib/useImageUrl";
import { Drawer, DrawerContent, DrawerFooter } from "@/components/ui/drawer";
import { toast } from "@/components/ui/sonner";
import { useCustomerOverlay } from "@/hooks/useCustomerBack";
import { MenuImage } from "./MenuImage";
import { getEligibleAddons, calculateCombinedUnitPrice, formatAddonNotes } from "@/lib/addons";

const getTagColorClass = (tag: string): string => {
  switch (tag) {
    case "Best Seller":
    case "Bestseller":
      return "bg-cc-accent/15 text-cc-text border border-cc-accent/40 font-bold";
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
      return "bg-cc-surface-soft text-cc-text-muted border border-cc-border font-medium";
  }
};

export function MenuItemCard({ item, currency }: { item: MenuItem; currency: string }) {
  const { add, lines, setQty, editingOrderId } = useCart();
  const imgUrl = useImageUrl(item.image_url);
  const [isOpen, setIsOpen] = useState(false);
  useCustomerOverlay(isOpen, setIsOpen, `item-details-${item.id}`);
  const [quantity, setQuantity] = useState(0);
  const [selectedAddonIds, setSelectedAddonIds] = useState<string[]>([]);
  const cartLine = lines.find((l) => l.item.id === item.id);
  const cartQty = cartLine ? cartLine.qty : 0;

  const eligibleAddons = getEligibleAddons(item);
  const basePriceRupees = item.price_cents / 100;

  const handleCardClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest("button") || target.closest("svg")) {
      return;
    }
    setQuantity(cartQty > 0 ? cartQty : 1);
    setSelectedAddonIds([]);
    setIsOpen(true);
  };

  const handleToggleAddon = (addonId: string) => {
    setSelectedAddonIds((prev) =>
      prev.includes(addonId) ? prev.filter((id) => id !== addonId) : [...prev, addonId]
    );
  };

  const combinedUnitPriceRupees = calculateCombinedUnitPrice(basePriceRupees, selectedAddonIds);
  const combinedUnitPriceCents = Math.round(combinedUnitPriceRupees * 100);
  const formattedNote = formatAddonNotes(selectedAddonIds);

  const handleAddToCart = () => {
    const qtyToAdd = quantity > 0 ? quantity : 1;
    add(
      {
        id: item.id,
        name: item.name,
        price_cents: combinedUnitPriceCents,
        image_url: item.image_url,
      },
      selectedAddonIds,
      formattedNote,
      combinedUnitPriceCents
    );
    if (qtyToAdd > 1) {
      const sortedAddons = [...selectedAddonIds].sort();
      const lineKey = sortedAddons.length > 0 ? `${item.id}:${sortedAddons.join(",")}` : item.id;
      setQty(lineKey, qtyToAdd);
    }

    setIsOpen(false);
    toast.success(`Added ${qtyToAdd} × ${item.name}${formattedNote ? ` (${formattedNote})` : ""} to cart`);
  };

  const isEditing = !!editingOrderId;
  const displayQty = quantity;
  const totalPriceCents = combinedUnitPriceCents * (displayQty > 0 ? displayQty : 1);

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
        className="group relative flex gap-3.5 rounded-2xl bg-cc-surface p-3 shadow-xs border border-cc-border cursor-pointer transition hover:border-cc-primary/40 hover:shadow-sm"
      >
        <MenuImage src={item.image_url} alt={item.name} size="lg" />

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
            <h3 className="break-anywhere font-sans text-[15px] font-bold leading-tight text-cc-text">{item.name}</h3>
            {item.description && (
              <p className="mt-0.5 line-clamp-2 text-xs font-medium text-cc-text-muted leading-relaxed">{item.description}</p>
            )}
          </div>

          <div className="mt-2 flex items-center justify-between pt-1">
            <span className="font-sans text-sm font-black text-cc-text tabular-nums">{formatMoney(item.price_cents, currency)}</span>
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
                  className="inline-flex items-center justify-center gap-1 rounded-full bg-cc-primary hover:bg-cc-primary-hover text-white px-3 py-1.5 text-xs font-bold shadow-xs active:scale-95 transition-all min-h-[36px] min-w-[64px]"
                >
                  ADD <Plus className="h-3.5 w-3.5" strokeWidth={2.2} />
                </motion.button>
              ) : (
                <motion.div
                  key="qty-selector"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  transition={{ duration: 0.1 }}
                  className="flex items-center gap-1 rounded-full bg-cc-surface-soft border border-cc-border p-0.5 h-9"
                >
                  <button
                    type="button"
                    aria-label="Decrease quantity"
                    onClick={(e) => {
                      e.stopPropagation();
                      setQty(item.id, cartQty - 1);
                    }}
                    className="grid h-7 w-7 place-items-center rounded-full bg-cc-surface text-cc-text border border-cc-border hover:bg-cc-primary hover:text-white transition-all active:scale-90"
                  >
                    <Minus className="h-3.5 w-3.5" strokeWidth={2.2} />
                  </button>
                  <span
                    className="w-5 text-center font-sans text-xs font-black text-cc-text tabular-nums select-none"
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
                    className="grid h-7 w-7 place-items-center rounded-full bg-cc-primary text-white hover:bg-cc-primary-hover transition-all active:scale-90"
                  >
                    <Plus className="h-3.5 w-3.5" strokeWidth={2.2} />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.article>

      <Drawer open={isOpen} onOpenChange={setIsOpen}>
        <DrawerContent className="max-w-md mx-auto bg-cc-background border-t border-cc-border">
          <div className="relative w-full aspect-[16/10] overflow-hidden rounded-t-2xl border-b border-cc-border -mt-6">
            <MenuImage src={item.image_url} alt={item.name} size="full" />
          </div>

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

            <h2 className="font-display text-xl font-extrabold text-cc-text leading-tight">{item.name}</h2>

            <p className="mt-2 text-xs font-medium text-cc-text-muted leading-relaxed">
              {item.description || "Freshly prepared with premium ingredients by our experienced chefs."}
            </p>

            {eligibleAddons.length > 0 && (
              <div className="mt-5 space-y-2 border-t border-cc-border pt-3">
                <label className="text-[11px] font-bold uppercase tracking-wider text-cc-text-muted block">
                  Add-ons / Extras
                </label>
                <div className="space-y-1.5">
                  {eligibleAddons.map((addon) => {
                    const isChecked = selectedAddonIds.includes(addon.id);
                    return (
                      <div
                        key={addon.id}
                        onClick={() => handleToggleAddon(addon.id)}
                        className={`flex items-center justify-between p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                          isChecked
                            ? "border-amber-500 bg-amber-500/10 text-cc-text font-semibold"
                            : "border-cc-border hover:bg-cc-surface-soft text-cc-text-muted"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className={`h-4 w-4 rounded border flex items-center justify-center transition-all ${
                              isChecked ? "bg-amber-500 border-amber-500 text-white" : "border-cc-border"
                            }`}
                          >
                            {isChecked && <Check className="h-3 w-3" strokeWidth={3} />}
                          </div>
                          <span>{addon.name}</span>
                        </div>
                        <span className="font-bold text-amber-600 dark:text-amber-400">+₹{addon.price}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="mt-6 flex items-center justify-between border-t border-cc-border pt-4">
              <span className="font-sans text-lg font-black text-cc-text tabular-nums">
                {formatMoney(combinedUnitPriceCents, currency)}
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
                    className="rounded-full bg-cc-primary hover:bg-cc-primary-hover px-6 py-2 text-sm font-bold text-white shadow-xs"
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
                    className="flex items-center gap-3 rounded-full bg-cc-surface border border-cc-border p-1"
                  >
                    <button
                      type="button"
                      onClick={() => setQuantity((q) => Math.max(0, q - 1))}
                      className="grid h-8 w-8 place-items-center rounded-full bg-cc-surface-soft text-cc-text border border-cc-border hover:bg-cc-primary hover:text-white transition-all active:scale-90"
                    >
                      <Minus className="h-4 w-4" strokeWidth={2.2} />
                    </button>
                    <span className="w-8 text-center font-sans text-xs font-black text-cc-text tabular-nums select-none">{displayQty}</span>
                    <button
                      type="button"
                      onClick={() => setQuantity((q) => q + 1)}
                      className="grid h-8 w-8 place-items-center rounded-full bg-cc-primary text-white hover:bg-cc-primary-hover transition-all active:scale-90"
                    >
                      <Plus className="h-4 w-4" strokeWidth={2.2} />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          <DrawerFooter className="border-t border-cc-border bg-cc-surface p-4">
            <button
              type="button"
              onClick={handleAddToCart}
              disabled={displayQty === 0}
              className="w-full rounded-full bg-cc-primary hover:bg-cc-primary-hover py-3.5 text-sm font-bold text-white shadow-md flex items-center justify-center gap-2 disabled:opacity-50 transition"
            >
              <span>{isEditing ? "Update Order" : "Add to Cart"}</span>
              <span>·</span>
              <span className="font-sans tabular-nums">{formatMoney(totalPriceCents, currency)}</span>
            </button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </>
  );
}
