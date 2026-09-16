import React, { useState, useMemo } from "react";
import { Plus, Minus, Trash2, X, ShoppingCart, Search, ChefHat, RefreshCw } from "lucide-react";
import { useMenu } from "@/hooks/useMenu";
import {
  CounterOrderBuilderService,
  type CounterCartItem,
} from "../services/counterOrderBuilderService";
import type { OrderSource, CounterTable } from "../types/counterTypes";

interface ChannelOrderEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  channel: OrderSource;
  cafeId: string;
  cafeName?: string;
  tables: CounterTable[];
  selectedTableId?: string | null;
  onOrderCreated?: () => void;
}

export const ChannelOrderEntryModal: React.FC<ChannelOrderEntryModalProps> = ({
  isOpen,
  onClose,
  channel,
  cafeId,
  cafeName = "Cheese Corner",
  tables,
  selectedTableId,
  onOrderCreated,
}) => {
  const { items: menuItems = [] } = useMenu(cafeId);

  // Cart & metadata state
  const [cart, setCart] = useState<CounterCartItem[]>([]);
  const [targetTableId, setTargetTableId] = useState<string>(selectedTableId || tables[0]?.id || "");
  const [externalOrderRef, setExternalOrderRef] = useState<string>("");
  const [customerName, setCustomerName] = useState<string>("");
  const [customerPhone, setCustomerPhone] = useState<string>("");
  const [orderNote, setOrderNote] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Reset cart and fields when modal opens
  React.useEffect(() => {
    if (isOpen) {
      setCart([]);
      setExternalOrderRef("");
      setCustomerName("");
      setCustomerPhone("");
      setOrderNote("");
      setSearchQuery("");
      setErrorMessage(null);
      if (selectedTableId) {
        setTargetTableId(selectedTableId);
      }
    }
  }, [isOpen, selectedTableId]);

  const filteredMenuItems = useMemo(() => {
    if (!searchQuery.trim()) return menuItems;
    const q = searchQuery.toLowerCase();
    return menuItems.filter(
      (it) => it.name.toLowerCase().includes(q) || (it as any).categoryName?.toLowerCase().includes(q)
    );
  }, [menuItems, searchQuery]);

  const addToCart = (item: any) => {
    setCart((prev) => {
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

  const updateQty = (cartItemId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((c) => {
          if (c.id === cartItemId) {
            const newQty = c.qty + delta;
            return newQty > 0 ? { ...c, qty: newQty } : null;
          }
          return c;
        })
        .filter(Boolean) as CounterCartItem[]
    );
  };

  const removeCartItem = (cartItemId: string) => {
    setCart((prev) => prev.filter((c) => c.id !== cartItemId));
  };

  const totalCents = useMemo(() => {
    return cart.reduce((sum, it) => sum + it.priceCents * it.qty, 0);
  }, [cart]);

  const handleSubmit = async () => {
    if (cart.length === 0) {
      setErrorMessage("Please add at least one item to the cart.");
      return;
    }

    const selectedTableObj = tables.find((t) => t.id === targetTableId);

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await CounterOrderBuilderService.submitOrder(
        {
          cafeId,
          orderSource: channel,
          items: cart,
          tableId: channel === "DINE_IN" ? targetTableId : null,
          tableLabel: selectedTableObj?.label || "Table",
          customerName: customerName.trim() || null,
          customerPhone: customerPhone.trim() || null,
          externalOrderRef: externalOrderRef.trim() || null,
          orderNote: orderNote.trim() || null,
          status: "preparing",
        },
        cafeName
      );

      if (!res.success) {
        setErrorMessage(res.error || "Failed to create order");
      } else {
        onOrderCreated?.();
        onClose();
      }
    } catch (err: any) {
      setErrorMessage(err?.message || "Unexpected order submission error");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/90">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <span>New {channel.replace(/_/g, " ")} Order</span>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-300">
                {cafeName}
              </span>
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Select items from menu and submit order with immediate KOT dispatch
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body: Left Menu Items + Right Order Cart */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left: Menu catalog */}
          <div className="flex-1 flex flex-col border-r border-zinc-800 p-4 overflow-hidden">
            <div className="relative mb-3">
              <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search menu items..."
                className="w-full pl-9 pr-4 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-700"
              />
            </div>

            <div className="flex-1 overflow-y-auto grid grid-cols-2 gap-2.5 pr-1">
              {filteredMenuItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => addToCart(item)}
                  className="text-left p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/80 hover:border-zinc-600 transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="text-xs font-semibold text-white line-clamp-1">
                      {item.name}
                    </div>
                    {item.description && (
                      <div className="text-[11px] text-zinc-500 line-clamp-1 mt-0.5">
                        {item.description}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-zinc-900">
                    <span className="font-mono text-xs text-emerald-400 font-bold">
                      ₹{(item.price_cents / 100).toFixed(2)}
                    </span>
                    <span className="text-[11px] text-zinc-400 flex items-center gap-1">
                      <Plus className="w-3 h-3" /> Add
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Right: Cart & Channel Specific Info */}
          <div className="w-80 flex flex-col p-4 bg-zinc-950/40 overflow-y-auto space-y-3">
            {/* Channel specific inputs */}
            {channel === "DINE_IN" && (
              <div>
                <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block mb-1">
                  Table Selection
                </label>
                <select
                  value={targetTableId}
                  onChange={(e) => setTargetTableId(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
                >
                  {tables.map((tbl) => (
                    <option key={tbl.id} value={tbl.id}>
                      {tbl.label} {tbl.status === "occupied" ? "(Occupied)" : "(Vacant)"}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {(channel === "SWIGGY" || channel === "ZOMATO") && (
              <div>
                <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block mb-1">
                  External Order Ref *
                </label>
                <input
                  type="text"
                  value={externalOrderRef}
                  onChange={(e) => setExternalOrderRef(e.target.value)}
                  placeholder={`e.g. #${channel === "SWIGGY" ? "1492" : "8821"}`}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-zinc-700"
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block mb-1">
                  Customer
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Optional"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block mb-1">
                  Phone
                </label>
                <input
                  type="text"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="Optional"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block mb-1">
                Order Note
              </label>
              <input
                type="text"
                value={orderNote}
                onChange={(e) => setOrderNote(e.target.value)}
                placeholder="Special kitchen note..."
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
              />
            </div>

            {/* Cart Items List */}
            <div className="flex-1 flex flex-col pt-2 border-t border-zinc-800/80">
              <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                Order Items ({cart.length})
              </span>

              {cart.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-zinc-600 text-xs py-8">
                  <ShoppingCart className="w-8 h-8 mb-2" />
                  <span>Cart is empty</span>
                </div>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {cart.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center justify-between bg-zinc-900 p-2 rounded-lg text-xs"
                    >
                      <div className="flex-1 pr-2">
                        <div className="font-medium text-white truncate">{c.name}</div>
                        <div className="font-mono text-[11px] text-zinc-400">
                          ₹{(c.priceCents / 100).toFixed(2)}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => updateQty(c.id, -1)}
                          className="p-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-5 text-center font-mono font-bold text-white">
                          {c.qty}
                        </span>
                        <button
                          onClick={() => updateQty(c.id, 1)}
                          className="p-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => removeCartItem(c.id)}
                          className="p-1 rounded text-rose-400 hover:bg-rose-500/10 ml-1"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Error banner */}
            {errorMessage && (
              <div className="p-2 rounded bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
                {errorMessage}
              </div>
            )}

            {/* Total & Submit Button */}
            <div className="pt-3 border-t border-zinc-800">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-zinc-400">Total:</span>
                <span className="text-base font-bold font-mono text-emerald-400">
                  ₹{(totalCents / 100).toFixed(2)}
                </span>
              </div>

              <button
                onClick={handleSubmit}
                disabled={isSubmitting || cart.length === 0}
                className="w-full py-2.5 px-4 rounded-xl bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-lg shadow-orange-600/20 transition-all"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Submitting & Sending KOT...</span>
                  </>
                ) : (
                  <>
                    <ChefHat className="w-4 h-4" />
                    <span>Submit & Send KOT</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
