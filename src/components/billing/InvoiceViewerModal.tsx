import React from "react";
import type { InvoiceRecord } from "@/lib/billing/invoiceService";
import { getReceiptSettings } from "@/lib/billing/receiptSettings";
import { getTaxSettings } from "@/lib/billing/taxSettings";
import { formatMoney } from "@/lib/db";
import { useCafe } from "@/lib/cafe";
import { X, Printer, Download, Mail, Send, RotateCcw, CheckCircle2, XCircle, Sparkles } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";

interface InvoiceViewerModalProps {
  isOpen: boolean;
  invoice: InvoiceRecord | null;
  onClose: () => void;
}

export const InvoiceViewerModal: React.FC<InvoiceViewerModalProps> = ({
  isOpen,
  invoice,
  onClose,
}) => {
  const { cafe } = useCafe();
  if (!isOpen || !invoice) return null;

  const receiptSettings = getReceiptSettings(cafe?.id, cafe);
  const taxSettings = getTaxSettings(cafe?.id);
  const currency = cafe?.currency || "INR";

  const is58mm = receiptSettings.receiptWidth === "58mm";

  const handlePrint = () => {
    toast.success(`Printing Invoice ${invoice.invoiceNumber}...`);
    window.print();
  };

  const handleDownload = () => {
    const textContent = `
========================================
           ${cafe?.name || "CHEESE CORNER"}
           ${cafe?.address || "123 Main Street"}
           Ph: ${cafe?.phone || "+91 98765 43210"}
           GSTIN: ${receiptSettings.gstNumber || "N/A"}
========================================
Invoice #: ${invoice.invoiceNumber}
Date: ${new Date(invoice.createdAt).toLocaleString()}
Table: ${invoice.tableLabel} (${invoice.orderSource})
Customer: ${invoice.customerName} (${invoice.customerPhone})
----------------------------------------
ITEMS:
${invoice.items.map((i) => `${i.qty}x ${i.name.padEnd(20)} ${formatMoney(i.priceCents * i.qty, currency)}`).join("\n")}
----------------------------------------
Subtotal:       ${formatMoney(invoice.subtotalCents, currency)}
CGST (${(taxSettings.gstPercentage / 2)}%):      ${formatMoney(invoice.cgstCents, currency)}
SGST (${(taxSettings.gstPercentage / 2)}%):      ${formatMoney(invoice.sgstCents, currency)}
${invoice.serviceChargeCents > 0 ? `Service Charge: ${formatMoney(invoice.serviceChargeCents, currency)}\n` : ""}GRAND TOTAL:    ${formatMoney(invoice.grandTotalCents, currency)}
Payment Method: ${invoice.paymentMethod}
Status:         ${invoice.status}
========================================
${receiptSettings.thankYouMessage || "Thank you for visiting!"}
    `.trim();

    const blob = new Blob([textContent], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${invoice.invoiceNumber}.txt`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success(`Invoice ${invoice.invoiceNumber} downloaded!`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="relative w-full max-w-xl bg-card rounded-3xl shadow-2xl border border-border overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border bg-muted/40">
          <div className="flex items-center gap-3">
            <h2 className="font-display text-lg font-bold text-foreground">
              Invoice Viewer
            </h2>
            <span className="font-mono text-xs font-bold text-primary px-2.5 py-0.5 rounded-full bg-primary/10 border border-primary/20">
              {invoice.invoiceNumber}
            </span>
            <span
              className={cn(
                "text-[10px] font-bold px-2 py-0.5 rounded-full uppercase border",
                invoice.status === "Paid"
                  ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                  : "bg-rose-500/10 text-rose-600 border-rose-500/20"
              )}
            >
              {invoice.status}
            </span>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Receipt Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-secondary/30">
          {/* Simulated Printed Thermal Receipt */}
          <div
            className={cn(
              "mx-auto bg-white text-black p-5 rounded-2xl shadow-xl border border-gray-300 font-mono text-[11px] flex flex-col gap-3 select-none",
              is58mm ? "w-full max-w-[270px]" : "w-full max-w-[340px]"
            )}
          >
            {/* Header branding */}
            <div className="flex flex-col items-center text-center gap-1 border-b border-dashed border-gray-400 pb-3">
              {receiptSettings.showLogo && cafe?.logo_url && (
                <img
                  src={cafe.logo_url}
                  alt="Logo"
                  className="h-10 w-10 object-contain rounded-full mb-1 border border-gray-200"
                />
              )}
              <h2 className="text-sm font-black uppercase tracking-wider text-black">
                {cafe?.name || "CHEESE CORNER"}
              </h2>
              {receiptSettings.showAddress && cafe?.address && (
                <p className="text-[10px] text-gray-700 leading-tight">{cafe.address}</p>
              )}
              {receiptSettings.showPhone && cafe?.phone && (
                <p className="text-[10px] text-gray-700">Ph: {cafe.phone}</p>
              )}
              {receiptSettings.showGst && receiptSettings.gstNumber && (
                <p className="text-[10px] font-bold text-gray-800 mt-0.5">
                  GSTIN: {receiptSettings.gstNumber}
                </p>
              )}
              {receiptSettings.fssaiNumber && (
                <p className="text-[9px] text-gray-600">FSSAI LIC: {receiptSettings.fssaiNumber}</p>
              )}
              {receiptSettings.receiptHeader && (
                <p className="text-[10px] font-semibold italic text-gray-800 mt-1 bg-gray-100 px-2 py-0.5 rounded-xs">
                  "{receiptSettings.receiptHeader}"
                </p>
              )}
            </div>

            {/* Invoice Metadata */}
            <div className="grid grid-cols-2 gap-1 text-[10px] border-b border-dashed border-gray-400 pb-2">
              <div className="flex flex-col">
                <span className="font-bold text-black">{invoice.invoiceNumber}</span>
                <span className="text-gray-700">Order: {invoice.orderNumber}</span>
                <span className="text-gray-700">Table: {invoice.tableLabel} ({invoice.orderSource})</span>
                <span className="text-gray-700 font-sans font-semibold mt-0.5">Cust: {invoice.customerName}</span>
              </div>
              <div className="flex flex-col text-right">
                <span className="text-gray-700">{new Date(invoice.createdAt).toLocaleDateString()}</span>
                <span className="text-gray-700">{new Date(invoice.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                <span className="text-gray-700 font-mono text-[9px]">{invoice.customerPhone}</span>
                <span className="font-bold text-emerald-700 mt-0.5">Method: {invoice.paymentMethod}</span>
              </div>
            </div>

            {/* Items Table */}
            <div className="flex flex-col gap-1 border-b border-dashed border-gray-400 pb-3">
              <div className="grid grid-cols-12 text-[9px] font-extrabold text-black uppercase tracking-wider pb-1 border-b border-gray-300">
                <span className="col-span-6">Item</span>
                <span className="col-span-2 text-center">Qty</span>
                <span className="col-span-4 text-right">Amt</span>
              </div>
              {invoice.items.map((item) => (
                <div key={item.id} className="grid grid-cols-12 items-baseline text-black py-0.5">
                  <div className="col-span-6 pr-1">
                    <span className="font-semibold truncate block">{item.name}</span>
                    {item.note && (
                      <span className="text-[9px] font-semibold text-gray-700 italic block pl-1">
                        + {item.note}
                      </span>
                    )}
                  </div>
                  <span className="col-span-2 text-center">{item.qty}</span>
                  <span className="col-span-4 text-right font-bold">
                    {formatMoney(item.priceCents * item.qty, currency)}
                  </span>
                </div>
              ))}
            </div>

            {/* Totals & Taxes */}
            <div className="flex flex-col gap-1 text-[10px] border-b border-dashed border-gray-400 pb-3">
              <div className="flex justify-between text-gray-700">
                <span>Subtotal</span>
                <span>{formatMoney(invoice.subtotalCents, currency)}</span>
              </div>

              {taxSettings.gstEnabled && (
                <>
                  <div className="flex justify-between text-gray-700">
                    <span>CGST ({(taxSettings.gstPercentage / 2)}%)</span>
                    <span>{formatMoney(invoice.cgstCents, currency)}</span>
                  </div>
                  <div className="flex justify-between text-gray-700">
                    <span>SGST ({(taxSettings.gstPercentage / 2)}%)</span>
                    <span>{formatMoney(invoice.sgstCents, currency)}</span>
                  </div>
                </>
              )}

              {invoice.serviceChargeCents > 0 && (
                <div className="flex justify-between text-gray-700">
                  <span>Service Charge</span>
                  <span>{formatMoney(invoice.serviceChargeCents, currency)}</span>
                </div>
              )}

              {invoice.roundingCents !== 0 && (
                <div className="flex justify-between text-gray-700">
                  <span>Rounding</span>
                  <span>{formatMoney(invoice.roundingCents, currency)}</span>
                </div>
              )}

              <div className="flex justify-between text-xs font-black text-black pt-1 border-t border-gray-300">
                <span>GRAND TOTAL</span>
                <span>{formatMoney(invoice.grandTotalCents, currency)}</span>
              </div>
            </div>

            {/* Thank You & Footer */}
            <div className="flex flex-col items-center text-center gap-1.5 pt-1">
              {receiptSettings.thankYouMessage && (
                <p className="text-[10px] font-bold text-gray-800 whitespace-pre-line leading-tight">
                  {receiptSettings.thankYouMessage}
                </p>
              )}
              {receiptSettings.footerInfo && (
                <p className="text-[9px] text-gray-600 whitespace-pre-line leading-tight border-t border-dotted border-gray-300 pt-1.5 w-full">
                  {receiptSettings.footerInfo}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons Toolbar */}
        <div className="p-4 border-t border-border bg-card flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 rounded-2xl bg-primary text-primary-foreground px-4 py-2 text-xs font-bold transition hover:opacity-90 shadow-soft cursor-pointer"
            >
              <Printer className="h-4 w-4" />
              <span>Print Invoice</span>
            </button>

            <button
              onClick={handleDownload}
              className="inline-flex items-center gap-1.5 rounded-2xl bg-secondary text-foreground border border-border/60 px-4 py-2 text-xs font-bold transition hover:bg-muted cursor-pointer"
            >
              <Download className="h-4 w-4" />
              <span>Download File</span>
            </button>

            <button
              onClick={() => toast.success(`Reprinting invoice ${invoice.invoiceNumber}...`)}
              className="inline-flex items-center gap-1.5 rounded-2xl bg-secondary text-foreground border border-border/60 px-3 py-2 text-xs font-semibold transition hover:bg-muted cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Reprint</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => toast.info("Email receipt dispatch coming soon.")}
              className="inline-flex items-center gap-1 rounded-2xl bg-muted/60 text-muted-foreground border border-border/40 px-3 py-2 text-xs font-semibold hover:bg-muted cursor-pointer"
            >
              <Mail className="h-3.5 w-3.5" />
              <span>Email</span>
              <span className="text-[9px] text-accent font-bold">(Soon)</span>
            </button>

            <button
              onClick={() => toast.info("WhatsApp receipt dispatch coming soon.")}
              className="inline-flex items-center gap-1 rounded-2xl bg-muted/60 text-muted-foreground border border-border/40 px-3 py-2 text-xs font-semibold hover:bg-muted cursor-pointer"
            >
              <Send className="h-3.5 w-3.5" />
              <span>WhatsApp</span>
              <span className="text-[9px] text-accent font-bold">(Soon)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
