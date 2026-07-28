import React from "react";
import type { PaymentSettings, PaymentMethodKey } from "@/lib/billing/paymentSettings";
import { CreditCard, CheckCircle2, QrCode, Banknote, Wallet, Building, Printer, Smartphone, ShieldCheck, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface LivePaymentPreviewProps {
  settings: PaymentSettings;
}

const METHOD_LABELS: Record<PaymentMethodKey, { label: string; icon: React.ElementType; color: string }> = {
  cash: { label: "Cash", icon: Banknote, color: "text-emerald-600 bg-emerald-500/10 border-emerald-500/20" },
  upi: { label: "UPI Instant QR", icon: QrCode, color: "text-primary bg-primary/10 border-primary/20" },
  card: { label: "Credit/Debit Card", icon: CreditCard, color: "text-blue-600 bg-blue-500/10 border-blue-500/20" },
  wallet: { label: "Digital Wallet", icon: Wallet, color: "text-purple-600 bg-purple-500/10 border-purple-500/20" },
  bank_transfer: { label: "Bank Transfer", icon: Building, color: "text-amber-600 bg-amber-500/10 border-amber-500/20" },
};

export const LivePaymentPreview: React.FC<LivePaymentPreviewProps> = ({ settings }) => {
  const activeMethodKeys = (Object.keys(settings.enabledMethods) as PaymentMethodKey[]).filter(
    (k) => settings.enabledMethods[k]
  );

  const defaultMeta = METHOD_LABELS[settings.defaultMethod] || METHOD_LABELS.cash;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground px-1">
        <span className="flex items-center gap-1.5 font-bold text-foreground">
          <CreditCard className="h-3.5 w-3.5 text-primary" /> Live Checkout & POS Preview
        </span>
        <span className="text-[10px] rounded-full bg-emerald-500/10 text-emerald-600 px-2 py-0.5 border border-emerald-500/20 font-bold uppercase">
          {activeMethodKeys.length} Methods Active
        </span>
      </div>

      {/* Checkout Screen Simulation Card */}
      <div className="rounded-3xl bg-card p-5 shadow-soft ring-1 ring-border/60 font-sans space-y-4 text-foreground">
        {/* Sample Payment Modal simulation */}
        <div className="space-y-3 border-b border-border/50 pb-4">
          <div className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground flex items-center justify-between">
            <span>Select Payment Method</span>
            <span className="text-emerald-600 font-bold">Total: ₹567.00</span>
          </div>

          <div className="space-y-2">
            {(Object.keys(settings.enabledMethods) as PaymentMethodKey[]).map((key) => {
              const isEnabled = settings.enabledMethods[key];
              const isDefault = settings.defaultMethod === key;
              const meta = METHOD_LABELS[key];
              const Icon = meta.icon;

              if (!isEnabled) return null;

              return (
                <div
                  key={key}
                  className={cn(
                    "flex items-center justify-between rounded-2xl p-2.5 border text-xs font-semibold transition",
                    isDefault
                      ? "bg-primary/5 border-primary text-foreground ring-1 ring-primary/40"
                      : "bg-secondary/40 border-border/60 text-muted-foreground"
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <div className={cn("p-1.5 rounded-xl border", meta.color)}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <span>{meta.label}</span>
                  </div>

                  {isDefault && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20">
                      <CheckCircle2 className="h-3 w-3" /> Preselected
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Default Method Summary */}
        <div className="rounded-2xl bg-secondary/50 p-3 border border-border/40 space-y-1 text-xs">
          <div className="text-[10px] text-muted-foreground uppercase font-bold">Default Payment Selection</div>
          <div className="flex items-center gap-2 font-bold text-foreground">
            <defaultMeta.icon className="h-4 w-4 text-primary" />
            <span>{defaultMeta.label}</span>
          </div>
        </div>

        {/* Settlement Rules */}
        <div className="space-y-2 text-xs border-b border-border/40 pb-3">
          <div className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
            Settlement Behavior
          </div>

          <div className="flex items-center justify-between text-muted-foreground text-[11px]">
            <span>Require Payment Before Closing</span>
            <span className={cn("font-semibold", settings.requirePaymentBeforeClosing ? "text-emerald-600" : "text-amber-600")}>
              {settings.requirePaymentBeforeClosing ? "Required" : "Optional"}
            </span>
          </div>

          <div className="flex items-center justify-between text-muted-foreground text-[11px]">
            <span>Auto-Close Order After Settlement</span>
            <span className={cn("font-semibold", settings.autoCloseOrder ? "text-emerald-600" : "text-muted-foreground")}>
              {settings.autoCloseOrder ? "Auto Close ON" : "Manual Close"}
            </span>
          </div>
        </div>

        {/* Receipt Dispatch Preview */}
        <div className="space-y-2 text-xs">
          <div className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
            Receipt Options
          </div>

          <div className="flex flex-wrap gap-1.5">
            {settings.offerDigitalReceipt && (
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 text-blue-600 px-2.5 py-0.5 border border-blue-500/20 text-[10px] font-semibold">
                <Smartphone className="h-3 w-3" /> Digital Receipt
              </span>
            )}

            {settings.offerPrintedReceipt && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 text-emerald-600 px-2.5 py-0.5 border border-emerald-500/20 text-[10px] font-semibold">
                <Printer className="h-3 w-3" /> Thermal Print
              </span>
            )}

            {settings.printCustomerCopy && (
              <span className="inline-flex items-center gap-1 rounded-full bg-secondary text-foreground px-2.5 py-0.5 border border-border/60 text-[10px] font-semibold">
                Customer Copy
              </span>
            )}

            {settings.printKitchenCopy && (
              <span className="inline-flex items-center gap-1 rounded-full bg-secondary text-foreground px-2.5 py-0.5 border border-border/60 text-[10px] font-semibold">
                Kitchen Copy
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
