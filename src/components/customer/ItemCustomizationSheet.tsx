import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { formatMoney, type MenuItem } from "@/lib/db";
import { getEligibleAddons, calculateCombinedUnitPrice, formatAddonNotes, type Addon } from "@/lib/addons";

interface ItemCustomizationSheetProps {
  item: MenuItem | null;
  isOpen: boolean;
  onClose: () => void;
  onAddToCart: (item: MenuItem, selectedAddonIds: string[], note: string, combinedPriceCents: number) => void;
}

export const ItemCustomizationSheet: React.FC<ItemCustomizationSheetProps> = ({
  item,
  isOpen,
  onClose,
  onAddToCart,
}) => {
  if (!item) return null;

  const eligibleAddons = getEligibleAddons(item);
  const basePriceRupees = item.price_cents / 100;
  const [selectedAddonIds, setSelectedAddonIds] = useState<string[]>([]);

  const handleToggleAddon = (addonId: string) => {
    setSelectedAddonIds((prev) =>
      prev.includes(addonId) ? prev.filter((id) => id !== addonId) : [...prev, addonId]
    );
  };

  const currentUnitPriceRupees = calculateCombinedUnitPrice(basePriceRupees, selectedAddonIds);
  const currentUnitPriceCents = Math.round(currentUnitPriceRupees * 100);
  const formattedNote = formatAddonNotes(selectedAddonIds);

  const handleAdd = () => {
    onAddToCart(item, selectedAddonIds, formattedNote, currentUnitPriceCents);
    setSelectedAddonIds([]);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md rounded-2xl p-6 bg-background border border-border/60 shadow-xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-foreground flex items-center justify-between">
            <span>{item.name}</span>
            <span className="text-sm font-semibold text-muted-foreground">{formatMoney(item.price_cents)}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="py-3 space-y-4">
          <p className="text-xs text-muted-foreground">
            {item.description || "Customize your order with optional add-ons below:"}
          </p>

          {eligibleAddons.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">No extra add-ons available for this item.</p>
          ) : (
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block">
                Select Extras / Add-ons
              </label>
              <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                {eligibleAddons.map((addon) => {
                  const isChecked = selectedAddonIds.includes(addon.id);
                  return (
                    <div
                      key={addon.id}
                      onClick={() => handleToggleAddon(addon.id)}
                      className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                        isChecked
                          ? "border-amber-500 bg-amber-500/10 text-foreground"
                          : "border-border/60 hover:bg-accent/40 text-muted-foreground"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={() => handleToggleAddon(addon.id)}
                          className="h-4 w-4 rounded-md border-amber-500 data-[state=checked]:bg-amber-500 data-[state=checked]:text-white"
                        />
                        <span className="text-sm font-medium text-foreground">{addon.name}</span>
                      </div>
                      <span className="text-xs font-bold text-amber-600 dark:text-amber-400">
                        +₹{addon.price}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="pt-2 flex items-center justify-between border-t border-border/40 gap-3">
          <div className="flex flex-col">
            <span className="text-[10px] text-muted-foreground uppercase font-medium">Item Subtotal</span>
            <span className="text-base font-extrabold text-foreground">
              {formatMoney(currentUnitPriceCents)}
            </span>
          </div>
          <Button
            onClick={handleAdd}
            className="rounded-xl px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-semibold text-xs shadow-md transition-all active:scale-95"
          >
            Add to Order — {formatMoney(currentUnitPriceCents)}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
