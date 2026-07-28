import React from "react";
import {
  type TaxSettings,
  calculateTaxAndTotals,
} from "@/lib/billing/taxSettings";
import { formatMoney } from "@/lib/db";
import { Calculator, Percent, Receipt, Info } from "lucide-react";
import { cn } from "@/lib/utils";

interface LiveTaxBillPreviewProps {
  settings: TaxSettings;
  currency?: string;
}

export const LiveTaxBillPreview: React.FC<LiveTaxBillPreviewProps> = ({
  settings,
  currency = "INR",
}) => {
  const baseSubtotalCents = 50000; // ₹500.00
  const calc = calculateTaxAndTotals(baseSubtotalCents, settings);

  const halfGstRate = (settings.gstPercentage / 2).toFixed(1).replace(/\.0$/, "");

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground px-1">
        <span className="flex items-center gap-1.5 font-bold text-foreground">
          <Calculator className="h-3.5 w-3.5 text-primary" /> Live Bill & Tax Preview
        </span>
        <span className="text-[10px] rounded-full bg-primary/10 text-primary px-2 py-0.5 border border-primary/20 font-bold uppercase">
          {settings.pricingMode === "inclusive" ? "Tax Inclusive" : "Tax Exclusive"}
        </span>
      </div>

      {/* Simulated Bill Calculation Card */}
      <div className="rounded-3xl bg-card p-5 shadow-soft ring-1 ring-border/60 font-sans space-y-4 text-foreground">
        {/* Sample Items List */}
        <div className="space-y-2 border-b border-border/50 pb-3 text-xs">
          <div className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground flex justify-between">
            <span>Sample Order Items</span>
            <span>Qty & Price</span>
          </div>

          <div className="flex items-center justify-between py-1 border-b border-border/30">
            <span className="font-semibold text-foreground">2× Cappuccino Coffee</span>
            <span className="font-mono text-muted-foreground">₹240.00</span>
          </div>

          <div className="flex items-center justify-between py-1">
            <span className="font-semibold text-foreground">1× Margherita Pizza</span>
            <span className="font-mono text-muted-foreground">₹260.00</span>
          </div>
        </div>

        {/* Dynamic Tax Calculation Breakdown */}
        <div className="space-y-2 text-xs">
          <div className="flex justify-between text-muted-foreground">
            <span>
              {settings.pricingMode === "inclusive" ? "Base Net Subtotal" : "Items Subtotal"}
            </span>
            <span className="font-mono font-semibold tabular-nums text-foreground">
              {formatMoney(calc.subtotalCents, currency)}
            </span>
          </div>

          {/* GST Breakdown */}
          {settings.gstEnabled && settings.showTaxBreakdown && (
            <>
              <div className="flex justify-between text-muted-foreground pl-2 text-[11px]">
                <span>CGST ({halfGstRate}%)</span>
                <span className="font-mono tabular-nums text-foreground">
                  {formatMoney(calc.cgstCents, currency)}
                </span>
              </div>
              <div className="flex justify-between text-muted-foreground pl-2 text-[11px]">
                <span>SGST ({halfGstRate}%)</span>
                <span className="font-mono tabular-nums text-foreground">
                  {formatMoney(calc.sgstCents, currency)}
                </span>
              </div>
            </>
          )}

          {/* Service Charge */}
          {settings.serviceChargeEnabled && settings.showServiceCharge && (
            <div className="flex justify-between text-muted-foreground">
              <span>Service Charge ({settings.serviceChargePercentage}%)</span>
              <span className="font-mono font-semibold tabular-nums text-foreground">
                {formatMoney(calc.serviceChargeCents, currency)}
              </span>
            </div>
          )}

          {/* Rounding Adjustment */}
          {calc.roundingAdjustmentCents !== 0 && (
            <div className="flex justify-between text-muted-foreground text-[11px]">
              <span>Rounding ({settings.roundingMode === "nearest_1" ? "Nearest ₹1" : "Nearest ₹0.50"})</span>
              <span className="font-mono tabular-nums text-foreground">
                {calc.roundingAdjustmentCents > 0 ? "+" : ""}
                {formatMoney(calc.roundingAdjustmentCents, currency)}
              </span>
            </div>
          )}

          {/* Grand Total */}
          <div className="pt-2 border-t border-border/60 flex items-center justify-between">
            <span className="font-display text-sm font-bold text-foreground">Calculated Grand Total</span>
            <span className="font-display text-xl font-bold tabular-nums text-primary">
              {formatMoney(calc.grandTotalCents, currency)}
            </span>
          </div>
        </div>

        {/* Pricing & Tax Summary Badges */}
        <div className="pt-3 border-t border-border/40 space-y-1.5 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-1.5 text-foreground font-semibold">
            <Info className="h-3.5 w-3.5 text-primary shrink-0" />
            <span>
              {settings.pricingMode === "inclusive"
                ? "Tax is included in menu price."
                : "Tax is added on top of subtotal at checkout."}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className={cn(
              "px-2 py-0.5 rounded-full text-[10px] font-semibold border",
              settings.gstEnabled
                ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                : "bg-muted text-muted-foreground border-border"
            )}>
              {settings.gstEnabled ? `GST Active (${settings.gstPercentage}%)` : "GST Disabled"}
            </span>

            <span className={cn(
              "px-2 py-0.5 rounded-full text-[10px] font-semibold border",
              settings.serviceChargeEnabled
                ? "bg-blue-500/10 text-blue-600 border-blue-500/20"
                : "bg-muted text-muted-foreground border-border"
            )}>
              {settings.serviceChargeEnabled ? `Service Charge (${settings.serviceChargePercentage}%)` : "No Service Charge"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
