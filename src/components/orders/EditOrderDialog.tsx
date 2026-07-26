import { useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Minus, Trash2, Search, X, Edit3, Utensils, MessageSquare } from "lucide-react";
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
import { useCafe } from "@/lib/cafe";
import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";

export interface EditOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: (Order & { order_items: OrderItem[] }) | null;
  tableLabel?: string;
  currency?: string;
  cafeId?: string;
  role?: "owner" | "staff" | "counter";
  onSaved?: () => void;
}

export default function EditOrderDialog({
  open,
  onOpenChange,
  order,
  tableLabel = "?",
  currency = "INR",
  cafeId,
  role = "staff",
  onSaved
}: EditOrderDialogProps) {
  const qc = useQueryClient();
  const { cafe } = useCafe();
  const effectiveCafeId = cafeId || order?.cafe_id || cafe?.id;

  const [items, setItems] = useState<EditOrderItemPayload[]>([]);
  const [notes, setNotes] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [editingItemNoteIndex, setEditingItemNoteIndex] = useState<number | null>(null);

  // Sync state whenever order prop changes or dialog opens
  useEffect(() => {
    if (order && open) {
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
      setNotes(order.note ?? (order as any).notes ?? "");
      setSearchQuery("");
      setSelectedCategory("all");
    } else if (!open) {
      setItems([]);
      setNotes("");
      setSearchQuery("");
    }
  }, [order, open]);

  // Fetch Categories for active Cafe
  const categoriesQ = useQuery({
    queryKey: ["edit-order-categories", effectiveCafeId],
    enabled: !!effectiveCafeId && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("menu_categories")
        .select("*")
        .eq("cafe_id", effectiveCafeId!)
        .order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });

  // Fetch Active Menu Items for Cafe (Auto-loads on open)
  const menuItemsQ = useQuery({
    queryKey: ["edit-order-menu-items", effectiveCafeId],
    enabled: !!effectiveCafeId && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("menu_items")
        .select("*, menu_categories(name)")
        .eq("cafe_id", effectiveCafeId!)
        .eq("is_available", true)
        .order("name");
      if (error) throw error;
      return (data ?? []) as (MenuItem & { menu_categories?: { name: string } | null })[];
    },
  });

  // Filtered Menu Items using shared search & category logic
  const filteredMenuItems = useMemo(() => {
    let list = menuItemsQ.data ?? [];
    if (selectedCategory !== "all") {
      list = list.filter((m) => m.category_id === selectedCategory);
    }
    const q = searchQuery.toLowerCase().trim();
    if (q) {
      list = list.filter((m) => {
        const catName = m.menu_categories?.name?.toLowerCase() ?? "";
        const tagsStr = (m.tags ?? []).join(" ").toLowerCase();
        return (
          m.name.toLowerCase().includes(q) ||
          (m.description ?? "").toLowerCase().includes(q) ||
          catName.includes(q) ||
          tagsStr.includes(q)
        );
      });
    }
    return list;
  }, [menuItemsQ.data, selectedCategory, searchQuery]);

  // Realtime Total Recalculation
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

  const handleItemNoteChange = (index: number, noteText: string) => {
    setItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], note: noteText.trim() || null };
      return copy;
    });
  };

  const handleAddMenuItem = (menuItem: MenuItem) => {
    setItems((prev) => {
      const existingIdx = prev.findIndex(
        (it) => it.menu_item_id === menuItem.id || it.name.toLowerCase() === menuItem.name.toLowerCase()
      );
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
    toast.success(`Added ${menuItem.name} to order`);
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
        updatedBy: role === "owner" ? "owner" : "staff",
      });

      // Invalidate queries so order lists update in realtime across all dashboards
      await qc.invalidateQueries({ queryKey: ["orders"] });
      await qc.invalidateQueries({ queryKey: ["active-session-orders"] });
      await qc.invalidateQueries({ queryKey: ["owner-orders-tables"] });

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

  const categories = categoriesQ.data ?? [];
  const allMenuItems = menuItemsQ.data ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl p-0 overflow-hidden sm:rounded-3xl border-border bg-card shadow-2xl">
        {/* Dialog Header */}
        <DialogHeader className="p-5 border-b border-border/60 bg-muted/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-2xl bg-brand/10 text-brand font-bold shrink-0">
                <Edit3 className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="font-display text-lg font-bold">
                  Edit {formatOrderLabel(order.order_number)}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Table {tableLabel} · Realtime POS Order Modifier
                </DialogDescription>
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* Dialog Body Grid */}
        <div className="p-5 space-y-5 max-h-[72vh] overflow-y-auto section-scroll">
          {/* SECTION 1: Current Order Items & Quantities */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <span className="flex items-center gap-1.5 font-bold text-foreground">
                <Utensils className="h-3.5 w-3.5 text-brand" /> Order Items ({items.length})
              </span>
              <span className="text-[11px] font-bold text-foreground tabular-nums">
                Subtotal: {formatMoney(totalCents, currency)}
              </span>
            </div>

            {items.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground italic border border-dashed rounded-2xl p-4 bg-muted/20">
                No items in this order. Select items from the menu below.
              </div>
            ) : (
              <div className="divide-y divide-border/50 rounded-2xl border border-border/60 bg-background p-2.5 space-y-1 shadow-soft">
                {items.map((item, idx) => (
                  <div key={item.id ?? `new-${idx}`} className="py-2.5 px-2 space-y-2">
                    <div className="flex items-center justify-between gap-3 text-xs">
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-foreground truncate">{item.name}</div>
                        <div className="text-[11px] text-muted-foreground tabular-nums">
                          {formatMoney(item.price_cents, currency)} each
                        </div>
                      </div>

                      {/* Quantity Controls */}
                      <div className="flex items-center gap-1.5 bg-secondary/60 rounded-xl p-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleQtyChange(idx, -1)}
                          className="grid h-6 w-6 place-items-center rounded-lg bg-background text-foreground hover:bg-muted transition font-bold shadow-soft active:scale-95"
                          title="Decrease quantity"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="w-6 text-center font-extrabold tabular-nums text-foreground">{item.qty}</span>
                        <button
                          type="button"
                          onClick={() => handleQtyChange(idx, 1)}
                          className="grid h-6 w-6 place-items-center rounded-lg bg-background text-foreground hover:bg-muted transition font-bold shadow-soft active:scale-95"
                          title="Increase quantity"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>

                      {/* Line Item Price Total */}
                      <div className="w-16 text-right font-extrabold tabular-nums text-foreground shrink-0">
                        {formatMoney(item.price_cents * item.qty, currency)}
                      </div>

                      {/* Item Note Toggle & Remove */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => setEditingItemNoteIndex(editingItemNoteIndex === idx ? null : idx)}
                          className={cn(
                            "grid h-7 w-7 place-items-center rounded-lg transition",
                            item.note ? "bg-amber-500/15 text-amber-600" : "text-muted-foreground hover:bg-secondary"
                          )}
                          title="Add item note"
                        >
                          <MessageSquare className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemove(idx)}
                          className="grid h-7 w-7 place-items-center rounded-lg text-destructive/70 hover:text-destructive hover:bg-destructive/10 transition"
                          title="Remove item"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Per-Item Note Editor */}
                    {(editingItemNoteIndex === idx || item.note) && (
                      <div className="pl-2 pt-1">
                        <input
                          type="text"
                          value={item.note ?? ""}
                          onChange={(e) => handleItemNoteChange(idx, e.target.value)}
                          placeholder="Special instructions for this item (e.g. Extra spicy, No onions)..."
                          className="w-full rounded-xl border border-border bg-muted/30 px-3 py-1.5 text-[11px] outline-none focus:ring-2 focus:ring-ring/60"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* SECTION 2: Restaurant Menu Browser & Search Engine */}
          <div className="space-y-3 pt-2 border-t border-border/60">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Search className="h-3.5 w-3.5 text-brand" /> Add Items From Menu
              </label>
              {allMenuItems.length > 0 && (
                <span className="text-[11px] text-muted-foreground">
                  Showing {filteredMenuItems.length} of {allMenuItems.length} items
                </span>
              )}
            </div>

            {/* Search Input & Category Pills */}
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search menu by item name, category, or keyword..."
                  className="w-full rounded-2xl border border-border bg-background pl-9 pr-8 py-2 text-xs outline-none focus:ring-2 focus:ring-ring/60 shadow-soft"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Category Pills */}
              {categories.length > 0 && (
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 section-scroll">
                  <button
                    type="button"
                    onClick={() => setSelectedCategory("all")}
                    className={cn(
                      "rounded-full px-3 py-1 text-[11px] font-semibold shrink-0 transition",
                      selectedCategory === "all"
                        ? "bg-brand text-brand-foreground shadow-soft"
                        : "bg-secondary text-muted-foreground hover:text-foreground"
                    )}
                  >
                    All Items
                  </button>
                  {categories.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setSelectedCategory(cat.id)}
                      className={cn(
                        "rounded-full px-3 py-1 text-[11px] font-semibold shrink-0 transition",
                        selectedCategory === cat.id
                          ? "bg-brand text-brand-foreground shadow-soft"
                          : "bg-secondary text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Menu Items List */}
            <div className="rounded-2xl border border-border bg-muted/20 p-2 max-h-48 overflow-y-auto section-scroll">
              {menuItemsQ.isLoading ? (
                <div className="py-6 text-center text-xs text-muted-foreground">Loading restaurant menu...</div>
              ) : allMenuItems.length === 0 ? (
                <div className="py-6 text-center text-xs font-semibold text-muted-foreground">
                  No menu items available.
                </div>
              ) : filteredMenuItems.length === 0 ? (
                <div className="py-6 text-center text-xs text-muted-foreground">
                  No items found matching "{searchQuery}"
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {filteredMenuItems.map((mi) => (
                    <div
                      key={mi.id}
                      onClick={() => handleAddMenuItem(mi)}
                      className="p-2.5 flex items-center justify-between gap-2 rounded-xl border border-border/60 bg-background hover:border-brand/40 hover:bg-brand/5 cursor-pointer transition shadow-soft group"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-xs text-foreground truncate group-hover:text-brand transition">
                          {mi.name}
                        </div>
                        <div className="text-[11px] font-semibold text-muted-foreground tabular-nums">
                          {formatMoney(mi.price_cents, currency)}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="grid h-7 w-7 place-items-center rounded-xl bg-brand text-brand-foreground text-xs font-bold shadow-soft group-hover:scale-105 transition shrink-0"
                        title={`Add ${mi.name}`}
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* SECTION 3: Special Instructions / Order Notes */}
          <div className="space-y-1.5 pt-2 border-t border-border/60">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Overall Order Notes / Kitchen Instructions
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add overall order instructions (e.g. Deliver together, Guest allergic to peanuts)..."
              rows={2}
              className="w-full rounded-2xl border border-border bg-background p-3 text-xs outline-none focus:ring-2 focus:ring-ring/60 resize-none shadow-soft"
            />
          </div>

          {/* Realtime Recalculated Total Footer Card */}
          <div className="rounded-2xl bg-secondary/60 p-4 flex items-center justify-between text-xs border border-border/60">
            <span className="font-semibold text-muted-foreground">Recalculated Order Total</span>
            <span className="font-display text-lg font-bold tabular-nums text-foreground">
              {formatMoney(totalCents, currency)}
            </span>
          </div>
        </div>

        {/* Dialog Footer */}
        <DialogFooter className="p-4 border-t border-border/60 bg-muted/30 flex flex-row items-center justify-end gap-2">
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
            className="btn-primary-action rounded-full px-6 py-2.5 text-xs font-bold shadow-soft disabled:opacity-50"
          >
            {isSaving ? "Saving Modifications..." : "Save Changes"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
