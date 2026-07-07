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

  useEffect(() => {
    localStorage.setItem(storageKey(tableId), JSON.stringify(lines));
  }, [lines, tableId]);

  const value = useMemo<CartCtx>(() => ({
    lines,
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
    clear: () => setLines([]),
    count: lines.reduce((n, l) => n + l.qty, 0),
    subtotalCents: lines.reduce((n, l) => n + l.qty * l.item.price_cents, 0),
  }), [lines]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCart() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useCart must be used inside CartProvider");
  return v;
}
