import React, { useState, useEffect, useMemo } from "react";
import { X, Plus, Minus, Trash2, Search, Edit3, ShoppingBag, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/db";
import { OrderService } from "@/lib/orders/orderService";
import { cn } from "@/lib/utils";

interface EditItemRow {
  id?: string;
  menu_item_id?: string | null;
  name: string;
  price_cents: number;
  qty: number;
  note?: string | null;
}

interface OrderEditModalProps {
  open: boolean;
  onClose: () => void;
  order: {
    id: string;
    order_number: number;
    orderNumber?: number;
    version?: number;
    status?: string;
    note?: string | null;
    tableLabel?: string;
    cafe_id?: string;
    items?: Array<{ id?: string; menu_item_id?: string; name: string; price?: number; price_cents?: number; qty: number; notes?: string; note?: string }>;
    order_items?: Array<{ id?: string; menu_item_id?: string; name: string; price_cents?: number; qty: number; note?: string }>;
  } | null;
  menuItems?: Array<{ id: string; name: string; price_cents: number; is_available?: boolean }>;
  actor?: "counter" | "staff" | "owner";
  onSuccess?: () => void;
}

export default function OrderEditModal({
  open,
  onClose,
  order,
  menuItems: propMenuItems,
  actor = "counter",
  onSuccess,
}: OrderEditModalProps) {
  const [items, setItems] = useState<EditItemRow[]>([]);
  const [orderNote, setOrderNote] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [fetchedMenuItems, setFetchedMenuItems] = useState<Array<{ id: string; name: string; price_cents: number }>>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize editable state whenever modal opens or order changes
  useEffect(() => {
    if (order && open) {
      const raw = order.order_items || order.items || [];
      const initialRows: EditItemRow[] = raw.map((i: any) => ({
        id: i.id,
        menu_item_id: i.menu_item_id || null,
        name: i.name,
        price_cents: typeof i.price_cents === "number" ? i.price_cents : Math.round((i.price || 0) * 100),
        qty: i.qty || 1,
        note: i.note || i.notes || null,
      }));
      setItems(initialRows);
      setOrderNote(order.note || "");
      setSearchQuery("");
    }
  }, [order, open]);

  // Fetch available menu items if not provided via props
  useEffect(() => {
    if (open && (!propMenuItems || propMenuItems.length === 0)) {
      const fetchCatalog = async () => {
        let query = supabase
          .from("menu_items")
          .select("id, name, price_cents, is_available")
          .eq("is_available", true)
          .order("name", { ascending: true });

        if (order?.cafe_id) {
          query = query.eq("cafe_id", order.cafe_id);
        }

        const { data } = await query;
        if (data) {
          setFetchedMenuItems(data);
        }
      };
      void fetchCatalog();
    }
  }, [open, order?.cafe_id, propMenuItems]);

  const availableMenuCatalog = propMenuItems && propMenuItems.length > 0 ? propMenuItems : fetchedMenuItems;

  // Filtered menu catalog search results
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return availableMenuCatalog.filter((mi) => mi.name.toLowerCase().includes(q)).slice(0, 8);
  }, [searchQuery, availableMenuCatalog]);

  if (!open || !order) return null;

  const orderNum = order.order_number || order.orderNumber || 101;
  const currentTotalCents = items.reduce((sum, it) => sum + it.price_cents * it.qty, 0);
  const originalRaw = order.order_items || order.items || [];
  const originalTotalCents = originalRaw.reduce((sum: number, it: any) => {
    const p = typeof it.price_cents === "number" ? it.price_cents : Math.round((it.price || 0) * 100);
    return sum + p * (it.qty || 1);
  }, 0);

  const formatMoney = (cents: number) => `₹${(cents / 100).toFixed(2)}`;

  // Item modifications
  const handleUpdateQty = (idx: number, delta: number) => {
    setItems((prev) => {
      const copy = [...prev];
      const nextQty = copy[idx].qty + delta;
      if (nextQty <= 0) {
        return copy.filter((_, i) => i !== idx);
      }
      copy[idx] = { ...copy[idx], qty: nextQty };
      return copy;
    });
  };

  const handleRemoveItem = (idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleUpdateItemNote = (idx: number, note: string) => {
    setItems((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], note: note || null };
      return copy;
    });
  };

  const handleAddCatalogItem = (catalogItem: { id: string; name: string; price_cents: number }) => {
    setItems((prev) => {
      const existingIdx = prev.findIndex((it) => it.menu_item_id === catalogItem.id || it.name.toLowerCase() === catalogItem.name.toLowerCase());
      if (existingIdx >= 0) {
        const copy = [...prev];
        copy[existingIdx] = { ...copy[existingIdx], qty: copy[existingIdx].qty + 1 };
        return copy;
      }
      return [
        ...prev,
        {
          menu_item_id: catalogItem.id,
          name: catalogItem.name,
          price_cents: catalogItem.price_cents,
          qty: 1,
          note: null,
        },
      ];
    });
    setSearchQuery("");
  };

  const handleSaveOrder = async () => {
    if (items.length === 0) {
      toast.error("An order must contain at least one item. Cancel the order instead if needed.");
      return;
    }

    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      const payloadItems = items.map((it) => ({
        id: it.id,
        menu_item_id: it.menu_item_id,
        name: it.name,
        price_cents: it.price_cents,
        qty: it.qty,
        note: it.note,
      }));

      const res = await OrderService.editOrder({
        orderId: order.id,
        items: payloadItems,
        notes: orderNote.trim() || null,
        updatedBy: actor,
        expectedVersion: order.version ?? 1,
      });

      if (res.result?.requires_amendment_kot) {
        try {
          const printRes = await OrderService.printAmendmentKot({
            orderId: order.id,
            orderNumber: orderNum,
            kotNumber: `${orderNum}-${res.result.amendment_code || `M${res.result.amendment_number}`}`,
            revision: res.result.amendment_number,
            tableLabel: order.tableLabel || "Express",
            timestamp: new Date().toLocaleTimeString("en-IN", {
              hour: "2-digit",
              minute: "2-digit",
              hour12: true,
            }),
            delta: res.result.delta,
          });

          if (!printRes.queued) {
            toast.success("Order updated and amendment KOT sent");
          } else {
            toast.info("Order updated, but amendment KOT is queued");
          }
        } catch (printErr: any) {
          console.warn("[OrderEditModal] Print warning:", printErr);
          toast.warning("Order updated, but amendment KOT failed to print");
        }
      } else {
        toast.success("Order updated");
      }

      onSuccess?.();
      onClose();
    } catch (err: any) {
      console.error("[OrderEditModal] Edit error:", err);
      const isConflict =
        err?.message?.toLowerCase().includes("conflict") ||
        err?.message?.toLowerCase().includes("version");
      if (isConflict) {
        toast.error("This order was updated elsewhere. Refresh and try again.");
      } else {
        toast.error(err?.message || "Failed to update order");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-card rounded-3xl border border-border/80 shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-150 text-foreground"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-border/60 flex items-center justify-between shrink-0 bg-secondary/30">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-primary/10 text-primary shrink-0">
              <Edit3 className="h-5 w-5" />
            </div>
            <div>
              <div className="text-[10px] uppercase font-extrabold tracking-wider text-muted-foreground">
                Edit Active Order
              </div>
              <h2 className="font-display text-lg font-bold">
                Order #{orderNum} {order.tableLabel ? `· ${order.tableLabel}` : ""}
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-muted-foreground hover:bg-muted cursor-pointer transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* Menu Search Bar */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <Search className="w-3.5 h-3.5 text-primary" /> Add Items to Order
            </label>
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search cafe menu to add items..."
                className="w-full h-10 pl-9 pr-3 rounded-xl border border-border bg-background text-xs font-medium text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary/40 transition"
              />
              <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-3 pointer-events-none" />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Search Dropdown Results */}
            {searchResults.length > 0 && (
              <div className="p-1 rounded-2xl border border-border/80 bg-popover shadow-lg max-h-48 overflow-y-auto space-y-1 animate-in fade-in duration-100 z-10">
                {searchResults.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleAddCatalogItem(item)}
                    className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-muted/70 text-xs font-medium transition cursor-pointer text-left"
                  >
                    <span>{item.name}</span>
                    <span className="font-mono font-bold text-primary">{formatMoney(item.price_cents)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Current Items List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-foreground">
              <span>Order Line Items ({items.reduce((s, i) => s + i.qty, 0)})</span>
              {items.length === 0 && <span className="text-destructive text-[11px]">No items in order</span>}
            </div>

            {items.length === 0 ? (
              <div className="p-6 rounded-2xl border border-dashed border-destructive/40 bg-destructive/5 text-center text-xs text-destructive">
                No items remaining. Add items from the search bar above or cancel the order.
              </div>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {items.map((it, idx) => (
                  <div
                    key={it.id || idx}
                    className="p-3 rounded-2xl border border-border/60 bg-card/80 flex flex-col gap-2 shadow-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-foreground truncate">{it.name}</div>
                        <div className="text-[11px] font-mono text-muted-foreground">
                          {formatMoney(it.price_cents)} each · Line Total: {formatMoney(it.price_cents * it.qty)}
                        </div>
                      </div>

                      {/* Quantity Stepper */}
                      <div className="flex items-center gap-1.5 shrink-0 bg-muted/40 p-1 rounded-xl border border-border/40">
                        <button
                          type="button"
                          onClick={() => handleUpdateQty(idx, -1)}
                          className="w-6 h-6 rounded-lg bg-card border border-border/60 flex items-center justify-center text-foreground hover:bg-muted transition cursor-pointer active:scale-95"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-6 text-center font-mono font-bold text-xs">{it.qty}</span>
                        <button
                          type="button"
                          onClick={() => handleUpdateQty(idx, 1)}
                          className="w-6 h-6 rounded-lg bg-card border border-border/60 flex items-center justify-center text-foreground hover:bg-muted transition cursor-pointer active:scale-95"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="w-6 h-6 rounded-lg bg-destructive/10 text-destructive flex items-center justify-center hover:bg-destructive/20 transition cursor-pointer ml-1"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    {/* Item Notes Input */}
                    <input
                      type="text"
                      value={it.note || ""}
                      onChange={(e) => handleUpdateItemNote(idx, e.target.value)}
                      placeholder="Special instructions (e.g. Less spicy, Extra cheese)..."
                      className="w-full h-7 px-2.5 rounded-lg border border-border/40 bg-muted/20 text-[11px] italic text-foreground placeholder:not-italic placeholder:text-muted-foreground outline-none focus:border-primary transition"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* General Order Note */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-muted-foreground">Order Note</label>
            <input
              type="text"
              value={orderNote}
              onChange={(e) => setOrderNote(e.target.value)}
              placeholder="e.g. Customer sitting near window"
              className="w-full h-9 px-3 rounded-xl border border-border bg-background text-xs text-foreground outline-none focus:border-primary transition"
            />
          </div>

          {/* Total Calculation Display */}
          <div className="p-3.5 rounded-2xl bg-secondary/40 border border-border/60 flex items-center justify-between text-xs">
            <div>
              <span className="text-muted-foreground font-medium">Previous Total: </span>
              <span className="font-mono line-through text-muted-foreground">{formatMoney(originalTotalCents)}</span>
            </div>
            <div className="text-right">
              <span className="text-xs font-bold text-foreground">New Total: </span>
              <span className="font-mono font-extrabold text-sm text-primary">{formatMoney(currentTotalCents)}</span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-border/60 flex items-center justify-end gap-2 bg-muted/10 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-xl text-xs font-bold text-muted-foreground hover:bg-muted hover:text-foreground transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSaveOrder}
            disabled={items.length === 0 || isSubmitting}
            className={cn(
              "px-5 py-2 rounded-xl text-xs font-bold text-primary-foreground bg-primary hover:bg-primary/90 transition shadow-sm flex items-center gap-1.5 cursor-pointer",
              (items.length === 0 || isSubmitting) && "opacity-50 cursor-not-allowed"
            )}
          >
            {isSubmitting ? "Saving..." : "Save Order Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
