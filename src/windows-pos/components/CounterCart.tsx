import React, { useState, useMemo } from "react";
import {
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  ChefHat,
  RefreshCw,
  FileText,
  AlertTriangle,
  User,
  Phone,
  Hash,
} from "lucide-react";
import { CounterMenuImage } from "./CounterMenuImage";
import {
  CounterOrderBuilderService,
  type CounterCartItem,
  type CreatedCounterOrderResult,
} from "../services/counterOrderBuilderService";
import type { OrderSource, CounterTable } from "../types/counterTypes";

export interface CounterCartProps {
  channel: OrderSource;
  cafeId: string;
  cafeName?: string;
  tables: CounterTable[];
  selectedTableId?: string | null;
  onSelectTable?: (tableId: string) => void;
  cartItems: CounterCartItem[];
  onUpdateQty: (cartItemId: string, delta: number) => void;
  onRemoveItem: (cartItemId: string) => void;
  onUpdateItemNote: (cartItemId: string, note: string) => void;
  onClearCart: () => void;
  onOrderSubmitted: (result: CreatedCounterOrderResult) => void;
  onCancel?: () => void;
}

export const CounterCart: React.FC<CounterCartProps> = ({
  channel,
  cafeId,
  cafeName = "Cheese Corner",
  tables,
  selectedTableId,
  onSelectTable,
  cartItems,
  onUpdateQty,
  onRemoveItem,
  onUpdateItemNote,
  onClearCart,
  onOrderSubmitted,
  onCancel,
}) => {
  const [targetTableId, setTargetTableId] = useState<string>(
    selectedTableId || tables[0]?.id || ""
  );
  const [externalOrderRef, setExternalOrderRef] = useState<string>("");
  const [customerName, setCustomerName] = useState<string>("");
  const [customerPhone, setCustomerPhone] = useState<string>("");
  const [orderNote, setOrderNote] = useState<string>("");
  const [activeEditingNoteId, setActiveEditingNoteId] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Sync targetTableId if external prop updates
  React.useEffect(() => {
    if (selectedTableId) {
      setTargetTableId(selectedTableId);
    }
  }, [selectedTableId]);

  const totalCents = useMemo(() => {
    return cartItems.reduce((sum, it) => sum + it.priceCents * it.qty, 0);
  }, [cartItems]);

  const totalItemsCount = useMemo(() => {
    return cartItems.reduce((sum, it) => sum + it.qty, 0);
  }, [cartItems]);

  const formatPrice = (cents: number) => `₹${(cents / 100).toFixed(2)}`;

  const handleSubmit = async () => {
    if (cartItems.length === 0) {
      setErrorMessage("Cart is empty. Please add items to the cart.");
      return;
    }

    if (channel === "DINE_IN" && (!targetTableId || targetTableId === "express" || targetTableId.trim() === "")) {
      setErrorMessage("Please select a valid table for Dine-In orders.");
      return;
    }

    if ((channel === "SWIGGY" || channel === "ZOMATO") && !externalOrderRef.trim()) {
      setErrorMessage(`Please enter an external order reference for ${channel}.`);
      return;
    }

    const selectedTableObj = tables.find((t) => t.id === targetTableId);

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const result = await CounterOrderBuilderService.submitOrder(
        {
          cafeId,
          orderSource: channel,
          items: cartItems,
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

      if (!result.success) {
        setErrorMessage(result.error || "Order submission failed.");
      } else {
        onOrderSubmitted(result);
        onClearCart();
      }
    } catch (err: any) {
      setErrorMessage(err?.message || "Unexpected error submitting order.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-88 xl:w-96 flex flex-col h-full bg-zinc-950 select-none overflow-hidden">
      {/* Cart Header */}
      <div className="p-3 border-b border-zinc-800 bg-zinc-900/70 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShoppingCart className="w-4 h-4 text-orange-400" />
          <span className="font-bold text-xs text-white uppercase tracking-wider">
            Current Cart
          </span>
          <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-zinc-800 text-zinc-300">
            {totalItemsCount} {totalItemsCount === 1 ? "Item" : "Items"}
          </span>
        </div>

        {cartItems.length > 0 && (
          <button
            onClick={onClearCart}
            className="text-[11px] text-zinc-500 hover:text-rose-400 transition-colors"
          >
            Clear All
          </button>
        )}
      </div>

      {/* Channel Context & Metadata Form */}
      <div className="p-3 bg-zinc-900/40 border-b border-zinc-800/80 space-y-2.5">
        {/* Table Selection for Dine-In */}
        {channel === "DINE_IN" && (
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 block mb-1">
              Table Selection *
            </label>
            <select
              value={targetTableId}
              onChange={(e) => {
                setTargetTableId(e.target.value);
                onSelectTable?.(e.target.value);
              }}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-orange-500"
            >
              {tables.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label} {t.status === "occupied" ? "(Occupied)" : "(Vacant)"}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* External Order Ref for Aggregators */}
        {(channel === "SWIGGY" || channel === "ZOMATO") && (
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-orange-400 flex items-center gap-1 mb-1">
              <Hash className="w-3 h-3" />
              <span>{channel} Order Reference *</span>
            </label>
            <input
              type="text"
              value={externalOrderRef}
              onChange={(e) => setExternalOrderRef(e.target.value)}
              placeholder={`e.g. #${channel === "SWIGGY" ? "8821" : "4419"}`}
              className="w-full bg-zinc-900 border border-orange-500/40 rounded-lg px-2.5 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-orange-400 placeholder:text-zinc-600"
            />
          </div>
        )}

        {/* Customer Name & Phone */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <div className="flex items-center gap-1 text-[10px] font-semibold text-zinc-400 uppercase mb-1">
              <User className="w-2.5 h-2.5" />
              <span>Customer</span>
            </div>
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Optional"
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-zinc-700 placeholder:text-zinc-600"
            />
          </div>
          <div>
            <div className="flex items-center gap-1 text-[10px] font-semibold text-zinc-400 uppercase mb-1">
              <Phone className="w-2.5 h-2.5" />
              <span>Phone</span>
            </div>
            <input
              type="text"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="Optional"
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-zinc-700 placeholder:text-zinc-600"
            />
          </div>
        </div>
      </div>

      {/* Cart Line Items List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {cartItems.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-zinc-600 text-xs">
            <ShoppingCart className="w-10 h-10 mb-2 text-zinc-700" />
            <span className="font-semibold text-zinc-400">Cart is Empty</span>
            <span className="text-[11px] text-zinc-600 mt-1 max-w-xs">
              Click on any item in the menu catalog to add it to this order.
            </span>
          </div>
        ) : (
          cartItems.map((item) => {
            const isEditingNote = activeEditingNoteId === item.id;

            return (
              <div
                key={item.id}
                className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-2.5 shadow-sm space-y-1.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2 flex-1 min-w-0">
                    <CounterMenuImage
                      alt={item.name}
                      size="sm"
                      className="w-9 h-9 rounded-lg shrink-0 mt-0.5"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-xs text-white truncate">
                        {item.name}
                      </div>
                      <div className="text-[11px] font-mono text-zinc-400">
                        {formatPrice(item.priceCents)}
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="font-mono text-xs font-bold text-white">
                      {formatPrice(item.priceCents * item.qty)}
                    </div>
                  </div>
                </div>

                {/* Stepper + Note + Remove Row */}
                <div className="flex items-center justify-between pt-1 border-t border-zinc-800/60 text-xs">
                  <button
                    onClick={() =>
                      setActiveEditingNoteId(isEditingNote ? null : item.id)
                    }
                    className={`text-[11px] flex items-center gap-1 hover:text-white transition-colors ${
                      item.note ? "text-amber-400" : "text-zinc-500"
                    }`}
                  >
                    <FileText className="w-3 h-3" />
                    <span>{item.note ? "Edit note" : "Add note"}</span>
                  </button>

                  <div className="flex items-center gap-1.5">
                    <div className="flex items-center bg-zinc-950 border border-zinc-800 rounded-lg">
                      <button
                        onClick={() => onUpdateQty(item.id, -1)}
                        className="p-1 text-zinc-400 hover:text-white rounded-l-lg hover:bg-zinc-800 transition-colors"
                        title="Decrease quantity"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="font-mono text-xs font-bold text-white px-2">
                        {item.qty}
                      </span>
                      <button
                        onClick={() => onUpdateQty(item.id, 1)}
                        className="p-1 text-zinc-400 hover:text-white rounded-r-lg hover:bg-zinc-800 transition-colors"
                        title="Increase quantity"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    <button
                      onClick={() => onRemoveItem(item.id)}
                      className="p-1 text-zinc-600 hover:text-rose-400 rounded transition-colors ml-0.5"
                      title="Remove item"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Inline Note Editor */}
                {isEditingNote && (
                  <div className="pt-1">
                    <input
                      type="text"
                      value={item.note || ""}
                      onChange={(e) => onUpdateItemNote(item.id, e.target.value)}
                      placeholder="e.g. Extra spicy, no oregano..."
                      autoFocus
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1 text-[11px] text-white focus:outline-none focus:border-zinc-700"
                    />
                  </div>
                )}

                {/* Display Note when not editing */}
                {!isEditingNote && item.note && (
                  <div className="text-[11px] text-amber-300/80 bg-zinc-950/60 p-1.5 rounded border border-zinc-800/40 italic">
                    Note: {item.note}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Cart Footer: General Note, Subtotal, Submit */}
      <div className="p-3 border-t border-zinc-800 bg-zinc-900/80 space-y-2.5">
        {/* Kitchen Special Instructions */}
        <div>
          <label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 block mb-1">
            Kitchen Instructions
          </label>
          <input
            type="text"
            value={orderNote}
            onChange={(e) => setOrderNote(e.target.value)}
            placeholder="Special instructions for the KOT..."
            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-zinc-700 placeholder:text-zinc-600"
          />
        </div>

        {/* Error Banner */}
        {errorMessage && (
          <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{errorMessage}</span>
          </div>
        )}

        {/* Subtotal & Action */}
        <div className="flex items-center justify-between pt-1">
          <span className="text-xs text-zinc-400">Order Subtotal</span>
          <span className="text-base font-bold font-mono text-emerald-400">
            {formatPrice(totalCents)}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {onCancel && (
            <button
              onClick={onCancel}
              className="py-2.5 px-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white text-xs font-semibold border border-zinc-800 transition-colors"
            >
              Cancel
            </button>
          )}

          <button
            onClick={handleSubmit}
            disabled={isSubmitting || cartItems.length === 0}
            className="flex-1 py-2.5 px-4 rounded-xl bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-lg shadow-orange-600/20 transition-all"
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Firing KOT...</span>
              </>
            ) : (
              <>
                <ChefHat className="w-4 h-4" />
                <span>Submit & Fire KOT</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
