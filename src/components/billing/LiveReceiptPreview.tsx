import React from "react";
import type { ReceiptSettings } from "@/lib/billing/receiptSettings";
import { Printer, Check, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

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
  const sampleInvoiceNum = `${settings.invoicePrefix || "INV-"}000101`;
  const is58mm = settings.receiptWidth === "58mm";

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
          "mx-auto bg-white text-black p-5 rounded-2xl shadow-xl border border-gray-300 font-mono text-[11px] flex flex-col gap-3 select-none transition-all duration-200",
          is58mm ? "w-full max-w-[270px]" : "w-full max-w-[340px]"
        )}
      >
        {/* 1. CAFE LOGO & HEADER */}
        <div className="flex flex-col items-center text-center gap-1 border-b border-dashed border-gray-400 pb-3">
          {settings.showLogo && cafeLogoUrl && (
            <img
              src={cafeLogoUrl}
              alt="Logo"
              className="h-10 w-10 object-contain rounded-full mb-1 border border-gray-200"
            />
          )}

          <h2 className="text-sm font-black uppercase tracking-wider text-black">
            {cafeName}
          </h2>

          {settings.showAddress && cafeAddress && (
            <p className="text-[10px] text-gray-700 leading-tight">{cafeAddress}</p>
          )}

          {settings.showPhone && cafePhone && (
            <p className="text-[10px] text-gray-700">Ph: {cafePhone}</p>
          )}

          {settings.showGst && settings.gstNumber && (
            <p className="text-[10px] font-bold text-gray-800 mt-0.5">
              GSTIN: {settings.gstNumber}
            </p>
          )}

          {settings.fssaiNumber && (
            <p className="text-[9px] text-gray-600">FSSAI LIC: {settings.fssaiNumber}</p>
          )}

          {settings.receiptHeader && (
            <p className="text-[10px] font-semibold italic text-gray-800 mt-1 bg-gray-100 px-2 py-0.5 rounded-xs">
              "{settings.receiptHeader}"
            </p>
          )}
        </div>

        {/* 2. INVOICE METADATA */}
        <div className="grid grid-cols-2 gap-1 text-[10px] border-b border-dashed border-gray-400 pb-2">
          <div className="flex flex-col">
            {settings.showInvoiceNum && (
              <span className="font-bold text-black">{sampleInvoiceNum}</span>
            )}
            <span className="text-gray-700">Table #04 (Dine In)</span>
            <span className="text-gray-700 font-sans font-semibold mt-0.5">Cust: Rahul Das</span>
          </div>
          <div className="flex flex-col text-right">
            <span className="text-gray-700">28 Jul 2026</span>
            <span className="text-gray-700">12:45 PM</span>
            <span className="text-gray-700 font-mono text-[9px]">+91 98765 43210</span>
          </div>
        </div>

        {/* 3. ITEMIZED TABLE */}
        <div className="flex flex-col gap-1 border-b border-dashed border-gray-400 pb-3">
          <div className="grid grid-cols-12 text-[9px] font-extrabold text-black uppercase tracking-wider pb-1 border-b border-gray-300">
            <span className="col-span-6">Item</span>
            <span className="col-span-2 text-center">Qty</span>
            <span className="col-span-4 text-right">Amt</span>
          </div>

          <div className="grid grid-cols-12 items-baseline text-black py-0.5">
            <span className="col-span-6 font-semibold truncate pr-1">Espresso Coffee</span>
            <span className="col-span-2 text-center">2</span>
            <span className="col-span-4 text-right font-bold">₹240.00</span>
          </div>

          <div className="grid grid-cols-12 items-baseline text-black py-0.5">
            <span className="col-span-6 font-semibold truncate pr-1">Butter Croissant</span>
            <span className="col-span-2 text-center">1</span>
            <span className="col-span-4 text-right font-bold">₹120.00</span>
          </div>

          <div className="grid grid-cols-12 items-baseline text-black py-0.5">
            <span className="col-span-6 font-semibold truncate pr-1">Masala Dosa</span>
            <span className="col-span-2 text-center">1</span>
            <span className="col-span-4 text-right font-bold">₹180.00</span>
          </div>
        </div>

        {/* 4. TOTALS & TAX BREAKDOWN */}
        <div className="flex flex-col gap-1 text-[10px] border-b border-dashed border-gray-400 pb-3">
          <div className="flex justify-between text-gray-700">
            <span>Subtotal</span>
            <span>₹540.00</span>
          </div>
          <div className="flex justify-between text-gray-700">
            <span>CGST (2.5%)</span>
            <span>₹13.50</span>
          </div>
          <div className="flex justify-between text-gray-700">
            <span>SGST (2.5%)</span>
            <span>₹13.50</span>
          </div>
          <div className="flex justify-between text-xs font-black text-black pt-1 border-t border-gray-300">
            <span>GRAND TOTAL</span>
            <span>₹567.00</span>
          </div>
        </div>

        {/* 5. THANK YOU MESSAGE & FOOTER */}
        <div className="flex flex-col items-center text-center gap-1.5 pt-1">
          {settings.thankYouMessage && (
            <p className="text-[10px] font-bold text-gray-800 whitespace-pre-line leading-tight">
              {settings.thankYouMessage}
            </p>
          )}

          {settings.footerInfo && (
            <p className="text-[9px] text-gray-600 whitespace-pre-line leading-tight border-t border-dotted border-gray-300 pt-1.5 w-full">
              {settings.footerInfo}
            </p>
          )}

          {settings.website && (
            <p className="text-[9px] text-gray-700 font-semibold">{settings.website}</p>
          )}

          <div className="text-[8px] text-gray-400 mt-1 uppercase font-sans">
            ORDERRAIL POS DIGITAL RECEIPT
          </div>
        </div>
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
