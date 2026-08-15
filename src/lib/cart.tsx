import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { MenuItem } from "@/lib/db";

export interface CartLine {
  lineId?: string;
  item: Pick<MenuItem, "id" | "name" | "price_cents" | "image_url">;
  qty: number;
  selectedAddonIds?: string[];
  note?: string;
}

interface CartCtx {
  lines: CartLine[];
  add: (item: CartLine["item"], selectedAddonIds?: string[], note?: string, customUnitPriceCents?: number) => void;
  remove: (lineId: string) => void;
  setQty: (lineId: string, qty: number) => void;
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
    add: (item, selectedAddonIds = [], noteStr = "", customUnitPriceCents) =>
      setLines((prev) => {
        const sortedAddons = [...selectedAddonIds].sort();
        const targetLineId = sortedAddons.length > 0 ? `${item.id}:${sortedAddons.join(",")}` : item.id;
        const linePrice = customUnitPriceCents !== undefined ? customUnitPriceCents : item.price_cents;
        const lineItem = { ...item, price_cents: linePrice };

        const existingIndex = prev.findIndex((l) => (l.lineId || l.item.id) === targetLineId);

        if (existingIndex !== -1) {
          return prev.map((l, idx) => (idx === existingIndex ? { ...l, qty: l.qty + 1 } : l));
        }

        return [
          ...prev,
          {
            lineId: targetLineId,
            item: lineItem,
            qty: 1,
            selectedAddonIds: sortedAddons,
            note: noteStr || undefined,
          },
        ];
      }),
    remove: (targetKey) =>
      setLines((prev) => prev.filter((l) => (l.lineId || l.item.id) !== targetKey)),
    setQty: (targetKey, qty) =>
      setLines((prev) =>
        qty <= 0
          ? prev.filter((l) => (l.lineId || l.item.id) !== targetKey)
          : prev.map((l) => ((l.lineId || l.item.id) === targetKey ? { ...l, qty } : l))
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
