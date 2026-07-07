import { useEffect, useState, useMemo } from "react";
import { X, Plus, Minus, Search } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase, formatMoney, type Order, type OrderItem, type MenuItem } from "@/lib/db";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface EditOrderDialogProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order;
  originalItems: OrderItem[];
  editorType: "customer" | "staff";
  cafeId: string;
  onSaved: () => void;
}

export function EditOrderDialog({
  isOpen,
  onClose,
  order,
  originalItems,
  editorType,
  cafeId,
  onSaved,
}: EditOrderDialogProps) {
  const [items, setItems] = useState<any[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [search, setSearch] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Initialize edit states
  useEffect(() => {
    if (isOpen) {
      setItems(
        originalItems.map((i) => ({
          menu_item_id: i.menu_item_id,
          name: i.name,
          price_cents: i.price_cents,
          qty: i.qty,
          note: i.note || "",
        })),
      );
      setNote(order.note || "");
      setShowConfirm(false);
    }
  }, [isOpen, originalItems, order]);

  // Load menu items to allow adding new items
  useEffect(() => {
    if (isOpen && cafeId) {
      const loadMenu = async () => {
        const { data } = await supabase
          .from("menu_items")
          .select("*")
          .eq("cafe_id", cafeId)
          .eq("is_available", true);
        if (data) setMenuItems(data as MenuItem[]);
      };
      void loadMenu();
    }
  }, [isOpen, cafeId]);

  const filteredMenu = useMemo(() => {
    return menuItems.filter((i) =>
      i.name.toLowerCase().includes(search.toLowerCase())
    );
  }, [menuItems, search]);

  const subtotalCents = useMemo(() => {
    return items.reduce((sum, i) => sum + i.price_cents * i.qty, 0);
  }, [items]);

  const handleAdd = (menuItem: MenuItem) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.menu_item_id === menuItem.id);
      if (existing) {
        return prev.map((i) =>
          i.menu_item_id === menuItem.id ? { ...i, qty: i.qty + 1 } : i
        );
      }
      return [
        ...prev,
        {
          menu_item_id: menuItem.id,
          name: menuItem.name,
          price_cents: menuItem.price_cents,
          qty: 1,
          note: "",
        },
      ];
    });
    toast.success(`Added ${menuItem.name}`);
  };

  const handleQtyChange = (menuItemId: string, change: number) => {
    setItems((prev) =>
      prev
        .map((i) => {
          if (i.menu_item_id === menuItemId) {
            const next = i.qty + change;
            return { ...i, qty: next };
          }
          return i;
        })
        .filter((i) => i.qty > 0)
    );
  };

  const handleItemNoteChange = (menuItemId: string, newNote: string) => {
    setItems((prev) =>
      prev.map((i) =>
        i.menu_item_id === menuItemId ? { ...i, note: newNote } : i
      )
    );
  };

  const save = async () => {
    if (!items.length) {
      toast.error("Order must contain at least one item.");
      return;
    }

    setSaving(true);
    try {
      // 1. Fetch current database status to verify client state matches
      const { data: latestOrder, error: fetchErr } = await supabase
        .from("orders")
        .select("status")
        .eq("id", order.id)
        .maybeSingle();

      if (fetchErr || !latestOrder) {
        throw new Error("Could not verify order status.");
      }

      // Customer check: Reject if preparing, ready, served, cancelled
      if (
        editorType === "customer" &&
        latestOrder.status !== "pending"
      ) {
        toast.error("This order is already being prepared and cannot be modified.");
        onClose();
        return;
      }

      // Generate audit changes list
      const changes: string[] = [];
      const oldMap = new Map(originalItems.map((i) => [i.menu_item_id, i]));
      const newMap = new Map(items.map((i) => [i.menu_item_id, i]));

      items.forEach((n) => {
        const o = oldMap.get(n.menu_item_id);
        if (!o) {
          changes.push(`added ${n.name} x${n.qty}`);
        } else if (o.qty !== n.qty) {
          changes.push(`changed ${n.name} qty from ${o.qty} to ${n.qty}`);
        }
      });

      originalItems.forEach((o) => {
        if (!newMap.has(o.menu_item_id)) {
          changes.push(`removed ${o.name}`);
        }
      });

      if ((order.note || "") !== note) {
        changes.push("updated order note");
      }

      const summary = changes.join(", ") || "modified order details";

      // 2. Perform updates inside database
      // Delete old items
      const { error: delErr } = await supabase
        .from("order_items")
        .delete()
        .eq("order_id", order.id);
      if (delErr) throw delErr;

      // Insert new items
      const { error: insErr } = await supabase.from("order_items").insert(
        items.map((i) => ({
          order_id: order.id,
          menu_item_id: i.menu_item_id,
          name: i.name,
          price_cents: i.price_cents,
          qty: i.qty,
          note: i.note.trim() || null,
        })),
      );
      if (insErr) throw insErr;

      // Update parent order total and note
      const { error: updErr } = await supabase
        .from("orders")
        .update({
          total_cents: subtotalCents,
          note: note.trim() || null,
        })
        .eq("id", order.id);
      if (updErr) throw updErr;

      // Write audit log entry
      const { error: audErr } = await supabase.from("order_audits").insert({
        order_id: order.id,
        editor: editorType,
        change_summary: summary,
      });
      if (audErr) throw audErr;

      toast.success("Order changes saved successfully!");
      onSaved();
      onClose();
    } catch (e) {
      console.error(e);
      toast.error("Could not save changes. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveClick = () => {
    // Staff warning check for terminal statuses
    const isTerminal = ["ready", "served", "completed"].includes(order.status);
    if (editorType === "staff" && isTerminal) {
      setShowConfirm(true);
    } else {
      void save();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="flex h-[85vh] w-full max-w-lg flex-col rounded-3xl border border-border bg-card shadow-float overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border p-4">
              <div>
                <h3 className="font-display text-lg font-bold">Edit Order</h3>
                <p className="text-xs text-muted-foreground">#{order.id.slice(0, 8).toUpperCase()}</p>
              </div>
              <button
                onClick={onClose}
                className="grid h-8 w-8 place-items-center rounded-full bg-secondary hover:bg-secondary/80 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              {/* Active Items */}
              <div>
                <h4 className="font-display text-sm font-semibold mb-2 text-foreground/80">Items in Order</h4>
                <ul className="space-y-3">
                  {items.map((i) => (
                    <li key={i.menu_item_id} className="rounded-2xl border border-border/80 bg-muted/30 p-3 space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-medium text-sm">{i.name}</span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleQtyChange(i.menu_item_id, -1)}
                            className="grid h-7 w-7 place-items-center rounded-full border border-border bg-card text-muted-foreground hover:bg-secondary transition"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="font-semibold text-sm w-4 text-center">{i.qty}</span>
                          <button
                            onClick={() => handleQtyChange(i.menu_item_id, 1)}
                            className="grid h-7 w-7 place-items-center rounded-full border border-border bg-card text-muted-foreground hover:bg-secondary transition"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                      <input
                        type="text"
                        placeholder="Add note for item..."
                        value={i.note}
                        onChange={(e) => handleItemNoteChange(i.menu_item_id, e.target.value)}
                        className="w-full rounded-xl bg-card border border-border/60 px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-accent"
                      />
                    </li>
                  ))}
                  {!items.length && (
                    <p className="text-center text-xs text-muted-foreground py-4">No items remaining in order.</p>
                  )}
                </ul>
              </div>

              {/* Add New Items */}
              <div>
                <h4 className="font-display text-sm font-semibold mb-2 text-foreground/80">Add more items</h4>
                <div className="relative mb-3">
                  <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search menu..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full rounded-full bg-muted border-none pl-10 pr-4 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                </div>
                <div className="max-h-48 overflow-y-auto divide-y divide-border/60 border border-border/80 rounded-2xl">
                  {filteredMenu.map((m) => (
                    <div key={m.id} className="flex items-center justify-between p-3 gap-3 text-sm">
                      <div>
                        <p className="font-medium">{m.name}</p>
                        <p className="text-xs text-muted-foreground">{formatMoney(m.price_cents)}</p>
                      </div>
                      <button
                        onClick={() => handleAdd(m)}
                        className="flex items-center gap-1 rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground shadow-soft hover:bg-accent/90 transition"
                      >
                        <Plus className="h-3.5 w-3.5" /> Add
                      </button>
                    </div>
                  ))}
                  {!filteredMenu.length && (
                    <p className="text-center text-xs text-muted-foreground py-4">No matching items.</p>
                  )}
                </div>
              </div>

              {/* Order Note */}
              <div>
                <h4 className="font-display text-sm font-semibold mb-1 text-foreground/80">General Order Note</h4>
                <textarea
                  placeholder="Notes for the chef..."
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="w-full h-20 rounded-2xl bg-muted/30 border border-border/80 p-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-accent resize-none"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-border p-4 bg-muted/10 space-y-3">
              <div className="flex justify-between font-semibold text-sm">
                <span>Total Amount</span>
                <span className="tabular-nums text-foreground">{formatMoney(subtotalCents)}</span>
              </div>
              <div className="flex gap-2">
                <button
                  disabled={saving}
                  onClick={onClose}
                  className="flex-1 rounded-full bg-secondary py-2.5 text-sm font-medium text-secondary-foreground hover:bg-secondary/80 transition"
                >
                  Cancel
                </button>
                <button
                  disabled={saving || !items.length}
                  onClick={handleSaveClick}
                  className="flex-1 rounded-full bg-accent py-2.5 text-sm font-semibold text-accent-foreground hover:bg-accent/90 transition disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          </motion.div>

          {/* Staff Terminal Confirmation Dialog */}
          <AnimatePresence>
            {showConfirm && (
              <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
                <motion.div
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.95, opacity: 0 }}
                  className="w-full max-w-sm rounded-3xl border border-border bg-card p-6 shadow-float"
                >
                  <h3 className="font-display text-lg font-bold">Lock Alert</h3>
                  <p className="mt-2 text-sm text-muted-foreground leading-normal">
                    This order is already <span className="font-semibold text-foreground uppercase">{order.status}</span>.
                    The kitchen may have finished preparing it. Are you sure you want to save these modifications?
                  </p>
                  <div className="mt-6 flex gap-2">
                    <button
                      onClick={() => setShowConfirm(false)}
                      className="flex-1 rounded-full bg-secondary py-2 text-sm font-semibold text-secondary-foreground"
                    >
                      No, Go Back
                    </button>
                    <button
                      onClick={() => {
                        setShowConfirm(false);
                        void save();
                      }}
                      className="flex-1 rounded-full bg-accent py-2 text-sm font-semibold text-accent-foreground"
                    >
                      Yes, Save Changes
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </div>
      )}
    </AnimatePresence>
  );
}
