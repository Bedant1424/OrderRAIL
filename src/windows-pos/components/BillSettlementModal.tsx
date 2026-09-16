import React, { useState, useMemo, useEffect } from "react";
import {
  X,
  Receipt,
  Printer,
  CheckCircle2,
  AlertTriangle,
  CreditCard,
  Banknote,
  QrCode,
  ArrowRight,
  RefreshCw,
  Percent,
} from "lucide-react";
import {
  CounterBillingService,
  type BillPreviewResult,
  type SettleCounterBillResult,
  type PrintCustomerReceiptResult,
} from "../services/counterBillingService";
import { getTaxSettings, type TaxSettings } from "@/lib/billing/taxSettings";
import type { CounterOrder, OrderSource } from "../types/counterTypes";
import type { PrintResult } from "../services/printer/counterPrinter";

export interface BillSettlementModalProps {
  isOpen: boolean;
  onClose: () => void;
  orders: CounterOrder[];
  channel: OrderSource;
  cafeId: string;
  cafeName?: string;
  tableLabel?: string;
  tableId?: string | null;
  diningSessionId?: string | null;
  onSettlementCompleted?: () => void;
}

export const BillSettlementModal: React.FC<BillSettlementModalProps> = ({
  isOpen,
  onClose,
  orders,
  channel,
  cafeId,
  cafeName = "Cheese Corner",
  tableLabel,
  tableId,
  diningSessionId,
  onSettlementCompleted,
}) => {
  // Tax settings state
  const [taxSettings, setTaxSettings] = useState<TaxSettings>(() => getTaxSettings(cafeId));

  // Discount state
  const [discountType, setDiscountType] = useState<"none" | "percent" | "flat">("none");
  const [discountInput, setDiscountInput] = useState<string>("");

  // Payment tender state
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "UPI">("CASH");
  const [tenderedInput, setTenderedInput] = useState<string>("");
  const [transactionRef, setTransactionRef] = useState<string>("");

  // Processing state
  const [isSettling, setIsSettling] = useState<boolean>(false);
  const [isPrinting, setIsPrinting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Settlement & Print Result state
  const [settlementResult, setSettlementResult] = useState<SettleCounterBillResult | null>(null);
  const [printResult, setPrintResult] = useState<PrintResult | null>(null);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setTaxSettings(getTaxSettings(cafeId));
      setDiscountType("none");
      setDiscountInput("");
      setPaymentMethod("CASH");
      setTenderedInput("");
      setTransactionRef("");
      setIsSettling(false);
      setIsPrinting(false);
      setErrorMessage(null);
      setSettlementResult(null);
      setPrintResult(null);
    }
  }, [isOpen, cafeId]);

  // Derived discount numbers
  const discountOptions = useMemo(() => {
    const num = parseFloat(discountInput) || 0;
    if (num <= 0 || discountType === "none") {
      return {};
    }
    if (discountType === "percent") {
      return { discountPct: num };
    }
    return { discountAmt: num };
  }, [discountType, discountInput]);

  // Compute live bill preview using canonical CounterBillingService
  const preview: BillPreviewResult | null = useMemo(() => {
    if (!orders || orders.length === 0) return null;
    try {
      return CounterBillingService.buildBillPreview(orders, {
        ...discountOptions,
        taxSettings,
        cafeId,
      });
    } catch (e: any) {
      return null;
    }
  }, [orders, discountOptions, taxSettings, cafeId]);

  // Sync default tendered amount with preview grand total
  useEffect(() => {
    if (preview && !tenderedInput && !settlementResult) {
      setTenderedInput(preview.grandTotal.toFixed(2));
    }
  }, [preview, tenderedInput, settlementResult]);

  if (!isOpen) return null;

  const grandTotal = preview ? preview.grandTotal : 0;
  const tenderedNumber = parseFloat(tenderedInput) || 0;
  const changeDue = paymentMethod === "CASH" ? Math.max(0, tenderedNumber - grandTotal) : 0;
  const isCashInsufficient = paymentMethod === "CASH" && tenderedNumber < grandTotal;

  // Formatting helpers
  const fmt = (amt: number) => `₹${amt.toFixed(2)}`;

  const handleSettle = async () => {
    if (!preview || orders.length === 0) return;
    if (isCashInsufficient) {
      setErrorMessage(
        `Tendered amount (₹${tenderedNumber.toFixed(2)}) is less than total (₹${grandTotal.toFixed(2)}).`
      );
      return;
    }

    setIsSettling(true);
    setErrorMessage(null);

    try {
      // 1. Generate or retrieve existing bill
      const billRecord = await CounterBillingService.generateBill({
        cafeId,
        orders,
        options: {
          ...discountOptions,
          taxSettings,
          cafeId,
        },
        tableId: channel === "DINE_IN" ? tableId : null,
        tableLabel: tableLabel || "Counter",
        diningSessionId: channel === "DINE_IN" ? diningSessionId : null,
      });

      // 2. Settle the bill with tenders and execute session closeout
      const settleRes = await CounterBillingService.settleBill({
        billId: billRecord.id,
        paymentMethod,
        amount: grandTotal,
        tenderedAmount: paymentMethod === "CASH" ? tenderedNumber : grandTotal,
        changeDue,
        transactionRef: transactionRef.trim() || undefined,
        tableId: channel === "DINE_IN" ? tableId : null,
        diningSessionId: channel === "DINE_IN" ? diningSessionId : null,
        tableLabel: tableLabel || "Counter",
        cafeId,
        orders,
      });

      setSettlementResult(settleRes);

      // 3. Proactively attempt customer receipt printing (decoupled)
      try {
        const pRes = await CounterBillingService.printCustomerReceipt({
          bill: settleRes.bill,
          orderSource: channel,
          tableLabel: tableLabel || "Counter",
          cafeName,
          cafeId,
        });
        setPrintResult(pRes.printResult);
      } catch (printErr: any) {
        setPrintResult({
          status: "FAILED",
          message: printErr?.message || "Printer communication error",
          timestamp: new Date(),
        });
      }

      onSettlementCompleted?.();
    } catch (err: any) {
      console.error("[BillSettlementModal] Settlement error:", err);
      setErrorMessage(err?.message || "Failed to finalize bill settlement.");
    } finally {
      setIsSettling(false);
    }
  };

  const handleManualPrintReceipt = async () => {
    if (!settlementResult?.bill) return;

    setIsPrinting(true);
    try {
      const pRes = await CounterBillingService.printCustomerReceipt({
        bill: settlementResult.bill,
        orderSource: channel,
        tableLabel: tableLabel || "Counter",
        cafeName,
        cafeId,
        isReprint: true,
      });
      setPrintResult(pRes.printResult);
    } catch (err: any) {
      setPrintResult({
        status: "FAILED",
        message: err?.message || "Failed to trigger receipt reprint",
        timestamp: new Date(),
      });
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl">
        {/* Modal Header */}
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/95">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-600/10 border border-orange-500/20 flex items-center justify-center text-orange-400">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">Bill & Settlement</h2>
                <span className="px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-orange-500/10 text-orange-400 border border-orange-500/20">
                  {channel}
                </span>
                {tableLabel && (
                  <span className="px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-zinc-800 text-zinc-300">
                    {tableLabel}
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                {cafeName} &bull; {orders.length} Order{orders.length > 1 ? "s" : ""}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body: Left Items & Taxes | Right Tender & Settlement */}
        <div className="flex-1 flex overflow-hidden flex-col md:flex-row">
          {/* Left Column: Bill Line Items & Breakdown */}
          <div className="flex-1 border-r border-zinc-800 flex flex-col overflow-hidden bg-zinc-950/40">
            <div className="p-3.5 border-b border-zinc-800/80 bg-zinc-900/40 text-xs font-medium text-zinc-400">
              Bill Items Summary
            </div>

            {/* Line Items Scrollable List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {preview?.items.map((item, idx) => (
                <div
                  key={`${item.item_name}-${idx}`}
                  className="flex items-center justify-between text-xs py-1.5 border-b border-zinc-900/60"
                >
                  <div className="flex-1 pr-2">
                    <span className="font-semibold text-zinc-200">{item.item_name}</span>
                    <div className="text-[11px] text-zinc-500 font-mono">
                      {item.quantity} &times; {fmt(item.unit_price)}
                    </div>
                  </div>
                  <span className="font-mono font-medium text-zinc-300">
                    {fmt(item.line_total)}
                  </span>
                </div>
              ))}
            </div>

            {/* Subtotal, Discount & Taxes Breakdown */}
            {preview && (
              <div className="p-4 border-t border-zinc-800 bg-zinc-900/60 space-y-2 text-xs">
                {/* Subtotal */}
                <div className="flex justify-between text-zinc-400">
                  <span>Subtotal</span>
                  <span className="font-mono text-zinc-200">{fmt(preview.subtotal)}</span>
                </div>

                {/* Discount Selector */}
                {!settlementResult && (
                  <div className="py-1.5 border-y border-zinc-800/60">
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="text-zinc-400 flex items-center gap-1">
                        <Percent className="w-3 h-3 text-orange-400" />
                        Discount
                      </span>
                      <div className="flex items-center gap-1 bg-zinc-950 p-0.5 rounded-lg border border-zinc-800">
                        <button
                          type="button"
                          onClick={() => {
                            setDiscountType("none");
                            setDiscountInput("");
                          }}
                          className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                            discountType === "none"
                              ? "bg-zinc-800 text-white"
                              : "text-zinc-400 hover:text-white"
                          }`}
                        >
                          None
                        </button>
                        <button
                          type="button"
                          onClick={() => setDiscountType("percent")}
                          className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                            discountType === "percent"
                              ? "bg-orange-600 text-white"
                              : "text-zinc-400 hover:text-white"
                          }`}
                        >
                          %
                        </button>
                        <button
                          type="button"
                          onClick={() => setDiscountType("flat")}
                          className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                            discountType === "flat"
                              ? "bg-orange-600 text-white"
                              : "text-zinc-400 hover:text-white"
                          }`}
                        >
                          Flat ₹
                        </button>
                      </div>
                    </div>

                    {discountType !== "none" && (
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          placeholder={discountType === "percent" ? "Enter %" : "Enter ₹"}
                          value={discountInput}
                          onChange={(e) => setDiscountInput(e.target.value)}
                          className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-orange-500 font-mono"
                          min="0"
                        />
                        {preview.discount > 0 && (
                          <span className="text-rose-400 font-mono font-medium shrink-0">
                            -{fmt(preview.discount)}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Show Applied Discount if Settled */}
                {settlementResult && preview.discount > 0 && (
                  <div className="flex justify-between text-rose-400">
                    <span>Discount</span>
                    <span className="font-mono">-{fmt(preview.discount)}</span>
                  </div>
                )}

                {/* Configured GST Breakdown */}
                {preview.totalTax > 0 && (
                  <>
                    <div className="flex justify-between text-zinc-400">
                      <span>CGST ({(preview.appliedTaxSettings.gstPercentage / 2).toFixed(1)}%)</span>
                      <span className="font-mono text-zinc-300">{fmt(preview.cgst)}</span>
                    </div>
                    <div className="flex justify-between text-zinc-400">
                      <span>SGST ({(preview.appliedTaxSettings.gstPercentage / 2).toFixed(1)}%)</span>
                      <span className="font-mono text-zinc-300">{fmt(preview.sgst)}</span>
                    </div>
                  </>
                )}

                {/* Service Charge */}
                {preview.serviceCharge > 0 && (
                  <div className="flex justify-between text-zinc-400">
                    <span>Service Charge</span>
                    <span className="font-mono text-zinc-300">{fmt(preview.serviceCharge)}</span>
                  </div>
                )}

                {/* Round Off */}
                {preview.roundOff !== 0 && (
                  <div className="flex justify-between text-zinc-400">
                    <span>Round Off</span>
                    <span className="font-mono text-zinc-300">
                      {preview.roundOff > 0 ? `+${fmt(preview.roundOff)}` : fmt(preview.roundOff)}
                    </span>
                  </div>
                )}

                {/* Grand Total */}
                <div className="flex justify-between items-baseline pt-2 border-t border-zinc-800 text-sm">
                  <span className="font-bold text-white">Grand Total</span>
                  <span className="text-lg font-bold font-mono text-emerald-400">
                    {fmt(preview.grandTotal)}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Payment Tender & Actions */}
          <div className="w-full md:w-96 flex flex-col p-4 bg-zinc-900/90 overflow-y-auto">
            {/* If NOT Settled: Payment Input Screen */}
            {!settlementResult ? (
              <div className="flex-1 flex flex-col justify-between space-y-4">
                <div className="space-y-4">
                  {/* Payment Method Selector */}
                  <div>
                    <label className="text-xs font-semibold text-zinc-300 block mb-2">
                      Payment Mode
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setPaymentMethod("CASH");
                          setTenderedInput(grandTotal.toFixed(2));
                        }}
                        className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all ${
                          paymentMethod === "CASH"
                            ? "bg-orange-600/10 border-orange-500 text-orange-400 shadow-md shadow-orange-950/20"
                            : "bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700"
                        }`}
                      >
                        <Banknote className="w-5 h-5" />
                        <span className="text-xs font-bold">CASH</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setPaymentMethod("UPI");
                          setTenderedInput(grandTotal.toFixed(2));
                        }}
                        className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all ${
                          paymentMethod === "UPI"
                            ? "bg-orange-600/10 border-orange-500 text-orange-400 shadow-md shadow-orange-950/20"
                            : "bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700"
                        }`}
                      >
                        <QrCode className="w-5 h-5" />
                        <span className="text-xs font-bold">UPI / QR</span>
                      </button>
                    </div>
                  </div>

                  {/* CASH Specific Input: Tendered & Change */}
                  {paymentMethod === "CASH" && (
                    <div className="space-y-3 bg-zinc-950/60 p-3.5 rounded-xl border border-zinc-800/80">
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-zinc-400">Cash Received</span>
                          <span className="text-zinc-500 font-mono text-[11px]">
                            Payable: {fmt(grandTotal)}
                          </span>
                        </div>
                        <input
                          type="number"
                          step="any"
                          value={tenderedInput}
                          onChange={(e) => setTenderedInput(e.target.value)}
                          className={`w-full bg-zinc-900 border rounded-lg px-3 py-2 text-base font-bold font-mono text-white focus:outline-none ${
                            isCashInsufficient
                              ? "border-rose-500/80 focus:border-rose-500"
                              : "border-zinc-700 focus:border-orange-500"
                          }`}
                        />
                      </div>

                      {/* Quick Cash Shortcuts */}
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          onClick={() => setTenderedInput(grandTotal.toFixed(2))}
                          className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-[11px] font-mono text-zinc-300 font-medium"
                        >
                          Exact
                        </button>
                        {[100, 200, 500].map((step) => {
                          const roundedVal = Math.ceil(grandTotal / step) * step;
                          if (roundedVal <= grandTotal && roundedVal !== grandTotal) return null;
                          return (
                            <button
                              key={step}
                              type="button"
                              onClick={() => setTenderedInput(roundedVal.toFixed(2))}
                              className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-[11px] font-mono text-zinc-300 font-medium"
                            >
                              ₹{roundedVal}
                            </button>
                          );
                        })}
                      </div>

                      {/* Change Due Display */}
                      <div className="pt-2 border-t border-zinc-800/80 flex justify-between items-baseline">
                        <span className="text-xs text-zinc-400">Change to Return</span>
                        <span
                          className={`font-mono text-base font-bold ${
                            isCashInsufficient ? "text-rose-400 text-xs" : "text-emerald-400"
                          }`}
                        >
                          {isCashInsufficient ? "Insufficient Cash" : fmt(changeDue)}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* UPI Specific Input: Optional UTR / Reference */}
                  {paymentMethod === "UPI" && (
                    <div className="space-y-2 bg-zinc-950/60 p-3.5 rounded-xl border border-zinc-800/80">
                      <label className="text-xs text-zinc-400 block">
                        UPI Reference / UTR (Optional)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. 423819283712"
                        value={transactionRef}
                        onChange={(e) => setTransactionRef(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-orange-500"
                      />
                      <p className="text-[10px] text-zinc-500 leading-tight">
                        Cashier-recorded payment reference for audit records. Does not verify with
                        external banking APIs.
                      </p>
                    </div>
                  )}

                  {/* Error Banner */}
                  {errorMessage && (
                    <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>{errorMessage}</span>
                    </div>
                  )}
                </div>

                {/* Settlement Confirmation Action */}
                <button
                  type="button"
                  onClick={handleSettle}
                  disabled={isSettling || isCashInsufficient || grandTotal <= 0}
                  className="w-full py-3 rounded-xl bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-orange-600/20 transition-all cursor-pointer"
                >
                  {isSettling ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Settling & Finalizing...</span>
                    </>
                  ) : (
                    <>
                      <span>Confirm & Settle</span>
                      <span className="font-mono">({fmt(grandTotal)})</span>
                      <ArrowRight className="w-4 h-4 ml-1" />
                    </>
                  )}
                </button>
              </div>
            ) : (
              /* If ALREADY Settled: Paid Confirmation & Receipt Actions */
              <div className="flex-1 flex flex-col justify-between space-y-4">
                <div className="space-y-4">
                  {/* Paid Success Banner */}
                  <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center space-y-2">
                    <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <h3 className="text-sm font-bold text-white">Bill Paid & Settled</h3>
                    <p className="text-xs text-zinc-400">
                      Invoice #{settlementResult.bill.bill_number} &bull; Mode:{" "}
                      <span className="font-bold text-zinc-200">
                        {settlementResult.bill.payment_method}
                      </span>
                    </p>
                    {settlementResult.changeDue > 0 && (
                      <div className="pt-2 border-t border-emerald-500/20 text-xs text-emerald-400 font-mono font-bold">
                        Change Returned: {fmt(settlementResult.changeDue)}
                      </div>
                    )}
                    {settlementResult.tableFreed && (
                      <div className="text-[11px] text-zinc-400">
                        Table released and session closed.
                      </div>
                    )}
                  </div>

                  {/* Independent Printer Status Banner */}
                  {printResult && (
                    <div
                      className={`p-3 rounded-xl border text-xs flex items-center gap-2.5 ${
                        printResult.status === "SPOOLER_ACCEPTED"
                          ? "bg-blue-500/10 border-blue-500/20 text-blue-400"
                          : printResult.status === "UNAVAILABLE"
                          ? "bg-amber-500/10 border-amber-500/20 text-amber-400"
                          : "bg-rose-500/10 border-rose-500/20 text-rose-400"
                      }`}
                    >
                      <Printer className="w-4 h-4 shrink-0" />
                      <div className="flex-1 text-[11px]">
                        <div className="font-bold uppercase tracking-wider">
                          Printer: {printResult.status.replace(/_/g, " ")}
                        </div>
                        <div className="text-zinc-400 truncate">
                          {printResult.status === "SPOOLER_ACCEPTED"
                            ? "Raw ESC/POS job spooled to Windows queue"
                            : printResult.message || "Printer not connected. Receipt skipped."}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Manual Reprint Button */}
                  <button
                    type="button"
                    onClick={handleManualPrintReceipt}
                    disabled={isPrinting}
                    className="w-full py-2.5 px-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold flex items-center justify-center gap-2 border border-zinc-700 transition-colors"
                  >
                    {isPrinting ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Printer className="w-3.5 h-3.5" />
                    )}
                    <span>Print Customer Receipt (ESC/POS)</span>
                  </button>
                </div>

                {/* Close Button */}
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold transition-colors cursor-pointer"
                >
                  Done / Close
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
