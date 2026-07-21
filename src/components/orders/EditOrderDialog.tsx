import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Minus, Trash2, Search, X, Edit3, ShoppingBag } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { supabase, formatMoney, formatOrderLabel, type Order, type OrderItem, type MenuItem } from "@/lib/db";
import { editOrderInDb, type EditOrderItemPayload } from "@/lib/orders/repository";
import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";

export interface EditOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: (Order & { order_items: OrderItem[] }) | null;
  tableLabel?: string;
  currency?: string;
  cafeId?: string;
  role?: "owner" | "staff";
  onSaved?: () => void;
}

export default function EditOrderDialog({
  open,
  onOpenChange,
  order,
  tableLabel = "?",
  currency = "USD",
  cafeId,
  role = "staff",
  onSaved
}: EditOrderDialogProps) {
  const [items, setItems] = useState<EditOrderItemPayload[]>([]);
  const [notes, setNotes] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Initialize form state when order changes
  useEffect(() => {
    if (order) {
      setItems(
        (order.order_items ?? []).map((it) => ({
          id: it.id,
          menu_item_id: it.menu_item_id,
          name: it.name,
          price_cents: it.price_cents,
          qty: it.qty,
          note: it.note ?? null,
        }))
      );
      setNotes(order.note ?? "");
    } else {
      setItems([]);
      setNotes("");
    }
  }, [order]);

  // Query menu items for Owner add item capability
  const menuItemsQ = useQuery({
    queryKey: ["edit-order-menu-items", cafeId],
    enabled: !!cafeId && open && role === "owner",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("menu_items")
        .select("*")
        .eq("cafe_id", cafeId!)
        .eq("is_available", true)
        .order("name");
      if (error) throw error;
      return (data ?? []) as MenuItem[];
    },
  });

  const filteredMenuItems = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return menuItemsQ.data ?? [];
    return (menuItemsQ.data ?? []).filter((m) => m.name.toLowerCase().includes(q));
  }, [menuItemsQ.data, searchQuery]);

  const totalCents = useMemo(() => {
    return items.reduce((sum, it) => sum + it.price_cents * it.qty, 0);
  }, [items]);

  const handleQtyChange = (index: number, delta: number) => {
    setItems((prev) => {
      const copy = [...prev];
      const newQty = copy[index].qty + delta;
      if (newQty <= 0) {
        return copy.filter((_, i) => i !== index);
      }
      copy[index] = { ...copy[index], qty: newQty };
      return copy;
    });
  };

  const handleRemove = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddMenuItem = (menuItem: MenuItem) => {
    setItems((prev) => {
      const existingIdx = prev.findIndex((it) => it.menu_item_id === menuItem.id || it.name === menuItem.name);
      if (existingIdx >= 0) {
        const copy = [...prev];
        copy[existingIdx] = { ...copy[existingIdx], qty: copy[existingIdx].qty + 1 };
        return copy;
      }
      return [
        ...prev,
        {
          menu_item_id: menuItem.id,
          name: menuItem.name,
          price_cents: menuItem.price_cents,
          qty: 1,
          note: null,
        },
      ];
    });
    toast.success(`Added ${menuItem.name}`);
  };

  const handleSave = async () => {
    if (!order) return;
    if (items.length === 0) {
      toast.error("An order must contain at least one item.");
      return;
    }

    setIsSaving(true);
    try {
      await editOrderInDb({
        orderId: order.id,
        items,
        notes: notes.trim() || null,
        updatedBy: role,
      });
      toast.success("Order changes saved and synced!");
      onOpenChange(false);
      onSaved?.();
    } catch (err: any) {
      toast.error(err?.message || "Failed to save order modifications.");
    } finally {
      setIsSaving(false);
    }
  };

  if (!order) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 overflow-hidden sm:rounded-3xl border-border bg-card">
        {/* Header */}
        <DialogHeader className="p-5 border-b border-border/60 bg-muted/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="grid h-9 w-9 place-items-center rounded-2xl bg-brand/10 text-brand font-bold">
                <Edit3 className="h-4 w-4" />
              </div>
              <div>
                <DialogTitle className="font-display text-lg font-bold">
                  Edit {formatOrderLabel(order.order_number)}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Table {tableLabel} · Modify items, quantities & notes
                </DialogDescription>
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* Content Body */}
        <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
          {/* Item List */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <span>Order Items ({items.length})</span>
              {role === "owner" && (
                <button
                  type="button"
                  onClick={() => setShowAddMenu(!showAddMenu)}
                  className="text-xs font-bold text-accent hover:underline inline-flex items-center gap-1"
                >
                  <Plus className="h-3.5 w-3.5" /> Add Item
                </button>
              )}
            </div>

            {/* Menu item picker for Owner */}
            {showAddMenu && role === "owner" && (
              <div className="rounded-2xl border border-border bg-secondary/30 p-3 space-y-2 animate-in fade-in duration-150">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search menu..."
                    className="w-full rounded-xl border border-border bg-background pl-8 pr-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-ring/60"
                  />
                </div>
                <div className="max-h-40 overflow-y-auto divide-y divide-border/40 text-xs">
                  {filteredMenuItems.length === 0 ? (
                    <div className="py-3 text-center text-muted-foreground text-[11px]">No items found</div>
                  ) : (
                    filteredMenuItems.map((mi) => (
                      <div
                        key={mi.id}
                        className="py-2 flex items-center justify-between cursor-pointer hover:bg-background/80 px-2 rounded-lg transition"
                        onClick={() => handleAddMenuItem(mi)}
                      >
                        <div>
                          <div className="font-semibold text-foreground">{mi.name}</div>
                          <div className="text-[10px] text-muted-foreground">{formatMoney(mi.price_cents, currency)}</div>
                        </div>
                        <button
                          type="button"
                          className="grid h-6 w-6 place-items-center rounded-full bg-accent text-accent-foreground text-xs font-bold"
                        >
                          +
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Items Draft list */}
            {items.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground italic border border-dashed rounded-2xl p-4">
                No items in this order. Add an item above.
              </div>
            ) : (
              <div className="divide-y divide-border/50 rounded-2xl border border-border/60 bg-background p-2">
                {items.map((item, idx) => (
                  <div key={item.id ?? `new-${idx}`} className="py-2.5 px-2 flex items-center justify-between gap-3 text-xs">
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-foreground truncate">{item.name}</div>
                      <div className="text-[11px] text-muted-foreground tabular-nums">
                        {formatMoney(item.price_cents, currency)} each
                      </div>
                    </div>

                    {/* Quantity Controls */}
                    <div className="flex items-center gap-1.5 bg-secondary/60 rounded-xl p-1">
                      <button
                        type="button"
                        onClick={() => handleQtyChange(idx, -1)}
                        className="grid h-6 w-6 place-items-center rounded-lg bg-background text-foreground hover:bg-muted transition font-bold"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="w-5 text-center font-bold tabular-nums text-foreground">{item.qty}</span>
                      <button
                        type="button"
                        onClick={() => handleQtyChange(idx, 1)}
                        className="grid h-6 w-6 place-items-center rounded-lg bg-background text-foreground hover:bg-muted transition font-bold"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>

                    {/* Row Subtotal */}
                    <div className="w-16 text-right font-bold tabular-nums text-foreground">
                      {formatMoney(item.price_cents * item.qty, currency)}
                    </div>

                    {/* Trash Delete Action */}
                    <button
                      type="button"
                      onClick={() => handleRemove(idx)}
                      className="grid h-7 w-7 place-items-center rounded-lg text-destructive/70 hover:text-destructive hover:bg-destructive/10 transition"
                      title="Remove item"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Notes Input */}
          <div className="space-y-1.5 pt-1">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Order Notes / Special Instructions
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add or modify order notes..."
              rows={2}
              className="w-full rounded-2xl border border-border bg-background p-3 text-xs outline-none focus:ring-2 focus:ring-ring/60 resize-none"
            />
          </div>

          {/* Revised Order Total */}
          <div className="rounded-2xl bg-secondary/50 p-3 flex items-center justify-between text-xs">
            <span className="font-semibold text-muted-foreground">Updated Total Amount</span>
            <span className="font-display text-base font-bold tabular-nums text-foreground">
              {formatMoney(totalCents, currency)}
            </span>
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="p-4 border-t border-border/60 bg-muted/20 flex flex-row items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-full px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isSaving || items.length === 0}
            onClick={() => void handleSave()}
            className="btn-primary-action rounded-full px-5 py-2 text-xs font-semibold shadow-soft disabled:opacity-50"
          >
            {isSaving ? "Saving..." : "Save Changes"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
