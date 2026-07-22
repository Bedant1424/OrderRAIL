import { useState, useEffect, useRef } from "react";
import { useTableEngine } from "@/lib/counter/tableEngine/tableStore";
import { CreditCard, DollarSign, QrCode, Printer, CheckCircle, Percent, Hash, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface BillingDrawerV3Props {
  isOpen: boolean;
  onClose: () => void;
}

interface BilledItem {
  id: string;
  qty: number;
  name: string;
  price: number;
}

const SAMPLE_BILL_ITEMS: BilledItem[] = [
  { id: "b-1", qty: 1, name: "Double Espresso", price: 4.5 },
  { id: "b-2", qty: 2, name: "Artisan Club Sandwich", price: 24.0 },
  { id: "b-3", qty: 1, name: "Iced Vanilla Latte", price: 5.5 },
  { id: "b-4", qty: 1, name: "Sparkling Water", price: 3.5 },
];

export function BillingDrawerV3({ isOpen, onClose }: BillingDrawerV3Props) {
  const { selectedTable, requestBill, releaseTable } = useTableEngine();
  const [paymentMode, setPaymentMode] = useState<"cash" | "card" | "upi">("cash");
  const [cashTendered, setCashTendered] = useState<string>("40.00");
  const [discountPercent, setDiscountPercent] = useState<number>(10);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isOpen && e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const activeLabel = selectedTable ? selectedTable.label : "Table 4";
  const activeSessionCode = selectedTable?.activeSession?.sessionCode ?? "s-9821";

  const subtotal = SAMPLE_BILL_ITEMS.reduce((sum, item) => sum + item.price, 0); // 37.50
  const tax = subtotal * 0.08; // 3.00 (GST 8%)
  const discountAmount = subtotal * (discountPercent / 100); // 3.75 (10%)
  const netTotal = subtotal + tax - discountAmount; // 36.75

  const cashNum = parseFloat(cashTendered) || 0;
  const changeDue = Math.max(0, cashNum - netTotal);

  const handlePrintBillClick = () => {
    if (!selectedTable) return;
    const res = requestBill(selectedTable.id);
    if (res.success) {
      toast.success(`Bill Requested & Invoice Printed for ${selectedTable.label}!`);
    } else {
      toast.error(res.error ?? "Failed to request bill.");
    }
  };

  const handleSettleAndReleaseClick = () => {
    if (!selectedTable) return;
    const res = releaseTable(selectedTable.id);
    if (res.success) {
      toast.success(`Payment Collected! ${selectedTable.label} session closed & freed.`);
      onClose();
    } else {
      toast.error(res.error ?? "Failed to release table.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-background/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-[420px] bg-card/95 backdrop-blur-md h-full p-5 shadow-2xl flex flex-col justify-between animate-in slide-in-from-right duration-200 select-none border-l border-border/20">
        {/* Top Header */}
        <div>
          <div className="flex items-center justify-between pb-3 border-b border-border/20">
            <div>
              <h2 className="font-display text-base font-extrabold flex items-center gap-1.5 text-foreground">
                <Hash className="h-4 w-4 text-brand" />
                <span>BILLING & SETTLEMENT</span>
              </h2>
              <div className="text-xs text-muted-foreground font-mono mt-0.5">
                {activeLabel} (Session #{activeSessionCode})
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-xl p-1.5 bg-muted/60 text-muted-foreground hover:text-foreground hover:bg-muted transition active:scale-95"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Itemized Summary */}
          <div className="my-4">
            <div className="text-[11px] font-extrabold text-muted-foreground uppercase tracking-wider mb-2">
              Item Summary ({SAMPLE_BILL_ITEMS.length} Items)
            </div>

            <div className="max-h-[160px] overflow-y-auto section-scroll pr-1 space-y-2 font-mono text-xs">
              {SAMPLE_BILL_ITEMS.map((item) => (
                <div key={item.id} className="flex items-center justify-between text-muted-foreground">
                  <span className="truncate pr-2">
                    <strong className="text-foreground font-bold">{item.qty}x</strong> {item.name}
                  </span>
                  <span className="font-bold text-foreground shrink-0">
                    ${item.price.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Financial Calculations */}
        <div className="py-3 border-y border-border/20 space-y-2 font-mono text-xs bg-muted/20 p-3 rounded-2xl">
          <div className="flex items-center justify-between text-muted-foreground">
            <span>SUBTOTAL:</span>
            <span className="font-bold text-foreground">${subtotal.toFixed(2)}</span>
          </div>

          <div className="flex items-center justify-between text-muted-foreground">
            <span>TAX (GST 8%):</span>
            <span className="font-bold text-foreground">${tax.toFixed(2)}</span>
          </div>

          <div className="flex items-center justify-between text-muted-foreground">
            <span className="flex items-center gap-1">
              <Percent className="h-3.5 w-3.5 text-amber-500" /> DISCOUNT ({discountPercent}%):
            </span>
            <span className="font-bold text-emerald-600 dark:text-emerald-400">
              -${discountAmount.toFixed(2)}
            </span>
          </div>

          <div className="pt-2 border-t border-border/30 flex items-center justify-between text-base font-bold text-foreground">
            <span>NET TOTAL DUE:</span>
            <span className="text-2xl font-display text-brand font-extrabold">
              ${netTotal.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Payment Tender Options */}
        <div className="space-y-3">
          <div>
            <div className="text-[11px] font-extrabold text-muted-foreground uppercase tracking-wider mb-2">
              Payment Tender Mode
            </div>

            <div className="grid grid-cols-3 gap-1.5 p-1 rounded-2xl bg-muted/40 text-xs font-semibold">
              <button
                onClick={() => setPaymentMode("cash")}
                className={cn(
                  "py-2 rounded-xl transition flex items-center justify-center gap-1",
                  paymentMode === "cash"
                    ? "bg-brand text-brand-foreground shadow-soft"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <DollarSign className="h-3.5 w-3.5" /> Cash
              </button>
              <button
                onClick={() => setPaymentMode("card")}
                className={cn(
                  "py-2 rounded-xl transition flex items-center justify-center gap-1",
                  paymentMode === "card"
                    ? "bg-brand text-brand-foreground shadow-soft"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <CreditCard className="h-3.5 w-3.5" /> Card
              </button>
              <button
                onClick={() => setPaymentMode("upi")}
                className={cn(
                  "py-2 rounded-xl transition flex items-center justify-center gap-1",
                  paymentMode === "upi"
                    ? "bg-brand text-brand-foreground shadow-soft"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <QrCode className="h-3.5 w-3.5" /> UPI
              </button>
            </div>
          </div>

          {/* Cash Tendered & Change Due */}
          {paymentMode === "cash" && (
            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <div>
                <label className="text-[10px] text-muted-foreground uppercase font-sans font-semibold block mb-1">
                  Cash Tendered
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">$</span>
                  <input
                    ref={inputRef}
                    type="text"
                    value={cashTendered}
                    onChange={(e) => setCashTendered(e.target.value)}
                    className="w-full rounded-xl border-none bg-muted/40 py-2 pl-7 pr-2 font-bold text-foreground text-xs outline-none focus:ring-2 focus:ring-brand/60"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] text-muted-foreground uppercase font-sans font-semibold block mb-1">
                  Change Due
                </label>
                <div className="rounded-xl bg-emerald-500/10 py-2 px-3 font-extrabold text-emerald-600 dark:text-emerald-400 text-sm flex items-center">
                  ${changeDue.toFixed(2)}
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-2 pt-2">
            <button
              onClick={handlePrintBillClick}
              className="w-full rounded-2xl border border-border/30 bg-muted/40 hover:bg-muted/70 text-foreground py-2.5 text-xs font-semibold transition flex items-center justify-center gap-2 active:scale-95 shadow-soft"
            >
              <Printer className="h-4 w-4 text-brand" /> F8: PRINT BILL INVOICE
            </button>

            <button
              onClick={handleSettleAndReleaseClick}
              className="w-full rounded-2xl bg-brand hover:bg-brand/90 text-brand-foreground py-3 text-xs font-extrabold transition flex items-center justify-center gap-2 shadow-soft active:scale-95"
            >
              <CheckCircle className="h-4 w-4" />
              {paymentMode === "cash"
                ? "F10: COLLECT CASH & FREE TABLE ➔"
                : "F11: COLLECT CARD / UPI & FREE TABLE ➔"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
