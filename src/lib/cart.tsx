import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { MenuItem } from "@/lib/db";

export interface CartLine {
  item: Pick<MenuItem, "id" | "name" | "price_cents" | "image_url">;
  qty: number;
}

interface CartCtx {
  lines: CartLine[];
  add: (item: CartLine["item"]) => void;
  remove: (id: string) => void;
  setQty: (id: string, qty: number) => void;
  clear: () => void;
  count: number;
  subtotalCents: number;
  note: string;
  setNote: (note: string) => void;
  editingOrderId: string | null;
  editingOrderVersion: number | null;
  startEditing: (orderId: string, version: number, items: CartLine[], note?: string | null) => void;
  cancelEditing: () => void;
}

const Ctx = createContext<CartCtx | null>(null);

function storageKey(tableId: string) {
  return `orderrail.cart.${tableId}`;
}

export function CartProvider({ tableId, children }: { tableId: string; children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>(() => {
    try {
      const raw = localStorage.getItem(storageKey(tableId));
      return raw ? (JSON.parse(raw) as CartLine[]) : [];
    } catch {
      return [];
    }
  });

  const [note, setNoteState] = useState<string>(() => {
    try {
      return localStorage.getItem(`orderrail.cart_note.${tableId}`) || "";
    } catch {
      return "";
    }
  });

  const [editingOrderId, setEditingOrderId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(`orderrail.editing_order_id.${tableId}`);
    } catch {
      return null;
    }
  });

  const [editingOrderVersion, setEditingOrderVersion] = useState<number | null>(() => {
    try {
      const v = localStorage.getItem(`orderrail.editing_order_version.${tableId}`);
      return v ? parseInt(v, 10) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    localStorage.setItem(storageKey(tableId), JSON.stringify(lines));
  }, [lines, tableId]);

  useEffect(() => {
    localStorage.setItem(`orderrail.cart_note.${tableId}`, note);
  }, [note, tableId]);

  useEffect(() => {
    if (editingOrderId) {
      localStorage.setItem(`orderrail.editing_order_id.${tableId}`, editingOrderId);
    } else {
      localStorage.removeItem(`orderrail.editing_order_id.${tableId}`);
    }
  }, [editingOrderId, tableId]);

  useEffect(() => {
    if (editingOrderVersion !== null) {
      localStorage.setItem(`orderrail.editing_order_version.${tableId}`, String(editingOrderVersion));
    } else {
      localStorage.removeItem(`orderrail.editing_order_version.${tableId}`);
    }
  }, [editingOrderVersion, tableId]);

  const value = useMemo<CartCtx>(() => ({
    lines,
    note,
    setNote: setNoteState,
    editingOrderId,
    editingOrderVersion,
    add: (item) =>
      setLines((prev) => {
        const existing = prev.find((l) => l.item.id === item.id);
        if (existing) return prev.map((l) => (l.item.id === item.id ? { ...l, qty: l.qty + 1 } : l));
        return [...prev, { item, qty: 1 }];
      }),
    remove: (id) => setLines((prev) => prev.filter((l) => l.item.id !== id)),
    setQty: (id, qty) =>
      setLines((prev) =>
        qty <= 0 ? prev.filter((l) => l.item.id !== id) : prev.map((l) => (l.item.id === id ? { ...l, qty } : l)),
      ),
    clear: () => {
      setLines([]);
      setNoteState("");
      setEditingOrderId(null);
      setEditingOrderVersion(null);
    },
    startEditing: (orderId, version, items, orderNote) => {
      setLines(items);
      setEditingOrderId(orderId);
      setEditingOrderVersion(version);
      setNoteState(orderNote || "");
    },
    cancelEditing: () => {
      setLines([]);
      setNoteState("");
      setEditingOrderId(null);
      setEditingOrderVersion(null);
    },
    count: lines.reduce((n, l) => n + l.qty, 0),
    subtotalCents: lines.reduce((n, l) => n + l.qty * l.item.price_cents, 0),
  }), [lines, note, editingOrderId, editingOrderVersion]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCart() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useCart must be used inside CartProvider");
  return v;
}
