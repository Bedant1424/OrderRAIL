import React, { useState } from "react";
import { ArrowLeft, Store } from "lucide-react";
import { MenuCatalog } from "./MenuCatalog";
import { CounterCart } from "./CounterCart";
import type { ProductionMenuItem } from "@/hooks/useMenu";
import type {
  CounterCartItem,
  CreatedCounterOrderResult,
} from "../services/counterOrderBuilderService";
import type { OrderSource, CounterTable } from "../types/counterTypes";

export interface OrderEntryViewProps {
  channel: OrderSource;
  cafeId: string;
  cafeName?: string;
  tables: CounterTable[];
  selectedTableId?: string | null;
  onSelectTable?: (tableId: string) => void;
  onOrderSubmitted: (result: CreatedCounterOrderResult) => void;
  onClose: () => void;
}

export const OrderEntryView: React.FC<OrderEntryViewProps> = ({
  channel,
  cafeId,
  cafeName = "Cheese Corner",
  tables,
  selectedTableId,
  onSelectTable,
  onOrderSubmitted,
  onClose,
}) => {
  const [cartItems, setCartItems] = useState<CounterCartItem[]>([]);

  const handleAddToCart = (item: ProductionMenuItem) => {
    setCartItems((prev) => {
      const existing = prev.find((c) => c.menuItemId === item.id);
      if (existing) {
        return prev.map((c) =>
          c.menuItemId === item.id ? { ...c, qty: c.qty + 1 } : c
        );
      }
      return [
        ...prev,
        {
          id: `cart-${item.id}-${Date.now()}`,
          menuItemId: item.id,
          name: item.name,
          priceCents: item.price_cents,
          qty: 1,
        },
      ];
    });
  };

  const handleUpdateQty = (cartItemId: string, delta: number) => {
    setCartItems((prev) =>
      prev
        .map((c) => {
          if (c.id === cartItemId) {
            const nextQty = c.qty + delta;
            return nextQty > 0 ? { ...c, qty: nextQty } : null;
          }
          return c;
        })
        .filter(Boolean) as CounterCartItem[]
    );
  };

  const handleUpdateCartQtyByMenuItemId = (menuItemId: string, delta: number) => {
    setCartItems((prev) =>
      prev
        .map((c) => {
          if (c.menuItemId === menuItemId) {
            const nextQty = c.qty + delta;
            return nextQty > 0 ? { ...c, qty: nextQty } : null;
          }
          return c;
        })
        .filter(Boolean) as CounterCartItem[]
    );
  };

  const handleRemoveItem = (cartItemId: string) => {
    setCartItems((prev) => prev.filter((c) => c.id !== cartItemId));
  };

  const handleUpdateItemNote = (cartItemId: string, note: string) => {
    setCartItems((prev) =>
      prev.map((c) => (c.id === cartItemId ? { ...c, note } : c))
    );
  };

  const handleClearCart = () => {
    setCartItems([]);
  };

  const getChannelBadge = () => {
    switch (channel) {
      case "DINE_IN":
        return "bg-emerald-500/20 text-emerald-300 border-emerald-500/40";
      case "TAKEAWAY":
        return "bg-amber-500/20 text-amber-300 border-amber-500/40";
      case "SWIGGY":
        return "bg-orange-500/20 text-orange-300 border-orange-500/40";
      case "ZOMATO":
        return "bg-rose-500/20 text-rose-300 border-rose-500/40";
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-zinc-950 overflow-hidden select-none">
      {/* Top Breadcrumb Bar */}
      <div className="h-10 px-4 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-xs font-semibold transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Workstation</span>
          </button>

          <span className="text-zinc-600 text-xs">/</span>

          <div className="flex items-center gap-2">
            <span
              className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${getChannelBadge()}`}
            >
              {channel.replace(/_/g, " ")}
            </span>
            <span className="text-xs text-zinc-400 font-medium">
              Punching New Ticket
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-zinc-500 font-mono">
          <Store className="w-3.5 h-3.5 text-orange-400" />
          <span>{cafeName}</span>
        </div>
      </div>

      {/* Main Order Entry Split Pane */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Menu Catalog */}
        <MenuCatalog
          cafeId={cafeId}
          cartItems={cartItems}
          onAddToCart={handleAddToCart}
          onUpdateCartQty={handleUpdateCartQtyByMenuItemId}
        />

        {/* Right: Counter Cart */}
        <CounterCart
          channel={channel}
          cafeId={cafeId}
          cafeName={cafeName}
          tables={tables}
          selectedTableId={selectedTableId}
          onSelectTable={onSelectTable}
          cartItems={cartItems}
          onUpdateQty={handleUpdateQty}
          onRemoveItem={handleRemoveItem}
          onUpdateItemNote={handleUpdateItemNote}
          onClearCart={handleClearCart}
          onOrderSubmitted={onOrderSubmitted}
          onCancel={onClose}
        />
      </div>
    </div>
  );
};
