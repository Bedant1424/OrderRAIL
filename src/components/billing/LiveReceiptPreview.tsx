import React from "react";
import type { ReceiptSettings } from "@/lib/billing/receiptSettings";
import { Printer } from "lucide-react";
import { cn } from "@/lib/utils";
import { ReceiptBuilder, type ReceiptBuilderPayload } from "@/lib/printing/receiptBuilder";

interface LiveReceiptPreviewProps {
  settings: ReceiptSettings;
  cafeName?: string;
  cafeAddress?: string;
  cafePhone?: string;
  cafeLogoUrl?: string | null;
  currency?: string;
}

export const LiveReceiptPreview: React.FC<LiveReceiptPreviewProps> = ({
  settings,
  cafeName = "ORDERRAIL CAFE",
  cafeAddress = "123 Main Street, Food Street City",
  cafePhone = "+91 98765 43210",
  cafeLogoUrl,
  currency = "INR",
}) => {
  const is58mm = settings.receiptWidth === "58mm";
  const widthmm: 58 | 80 = is58mm ? 58 : 80;

  // Build full address string incorporating address and phone if toggled on
  let fullAddress = "";
  if (settings.showAddress && cafeAddress) {
    fullAddress = cafeAddress;
  }
  if (settings.showPhone && cafePhone) {
    fullAddress = fullAddress ? `${fullAddress} | Ph: ${cafePhone}` : `Ph: ${cafePhone}`;
  }

  const samplePayload: ReceiptBuilderPayload = {
    billNumber: `${settings.showInvoiceNum ? (settings.invoicePrefix || "INV-") : ""}000101`,
    orderNumber: 101,
    tableLabel: "Table #04",
    cashierName: "Counter",
    timestamp: "12:45 PM",
    cafeName: cafeName || "ORDERRAIL CAFE",
    address: fullAddress || undefined,
    gstin: settings.showGst ? (settings.gstNumber || "27AAAAA0000A1Z5") : undefined,
    customerName: "Rahul Das",
    customerPhone: "+91 98765 43210",
    items: [
      { name: "Espresso Coffee", price: 120, qty: 2 },
      { name: "Butter Croissant", price: 120, qty: 1 },
      { name: "Masala Dosa", price: 180, qty: 1 },
    ],
    subtotal: 540,
    tax: 27,
    netTotal: 567,
    paymentStatus: "paid",
  };

  // Generate canonical formatted text using production ReceiptBuilder
  const receiptText = ReceiptBuilder.buildText(samplePayload, widthmm);

  return (
    <div className="space-y-3">
      {/* Live Preview Header Badge */}
      <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground px-1">
        <span className="flex items-center gap-1.5 font-bold text-foreground">
          <Printer className="h-3.5 w-3.5 text-primary" /> Live Thermal Receipt Preview
        </span>
        <span className="text-[10px] rounded-full bg-emerald-500/10 text-emerald-600 px-2 py-0.5 border border-emerald-500/20 font-mono">
          {settings.receiptWidth}
        </span>
      </div>

      {/* Printed Thermal Receipt Simulation Card */}
      <div
        className={cn(
          "mx-auto bg-white text-black p-4 rounded-2xl shadow-xl border border-gray-300 font-mono text-[11px] flex flex-col gap-3 select-none transition-all duration-200 overflow-x-auto",
          is58mm ? "w-full max-w-[290px]" : "w-full max-w-[390px]"
        )}
      >
        <pre className="whitespace-pre font-mono text-[11px] leading-tight text-black overflow-x-auto font-bold">
          {receiptText}
        </pre>
      </div>

      {/* Thermal Printer Settings Config Strip */}
      <div className="rounded-2xl bg-card p-3 border border-border/60 text-[11px] text-muted-foreground space-y-1">
        <div className="flex items-center justify-between font-medium">
          <span>Width: <strong className="text-foreground">{settings.receiptWidth}</strong></span>
          <span>Copies: <strong className="text-foreground">{settings.printCopies}</strong></span>
          <span>Auto-Print: <strong className={settings.autoPrint ? "text-emerald-600 font-bold" : "text-muted-foreground"}>{settings.autoPrint ? "ON" : "OFF"}</strong></span>
        </div>
      </div>
    </div>
  );
};

