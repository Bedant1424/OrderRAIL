import React from "react";
import {
  type OperationsSettings,
  type OrderChannel,
  getTodayOpenStatus,
} from "@/lib/billing/operationsSettings";
import { Sliders, Clock, Store, ChefHat, UtensilsCrossed, Printer, CheckCircle2, AlertTriangle, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

interface LiveOperationsPreviewProps {
  settings: OperationsSettings;
}

const CHANNEL_LABELS: Record<OrderChannel, string> = {
  dine_in: "Dine-In",
  counter: "Counter POS",
  takeaway: "Takeaway",
  swiggy: "Swiggy",
  zomato: "Zomato",
};

const STATUS_BADGES: Record<string, { label: string; color: string }> = {
  open: { label: "Open for Orders", color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
  busy: { label: "High Volume (Busy)", color: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
  closed: { label: "Temporarily Closed", color: "bg-rose-500/10 text-rose-600 border-rose-500/20" },
  maintenance: { label: "Under Maintenance", color: "bg-purple-500/10 text-purple-600 border-purple-500/20" },
};

export const LiveOperationsPreview: React.FC<LiveOperationsPreviewProps> = ({ settings }) => {
  const todayStatus = getTodayOpenStatus(settings);
  const activeChannels = (Object.keys(settings.enabledChannels) as OrderChannel[]).filter(
    (k) => settings.enabledChannels[k]
  );

  const statusMeta = STATUS_BADGES[settings.status] || STATUS_BADGES.open;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground px-1">
        <span className="flex items-center gap-1.5 font-bold text-foreground">
          <Sliders className="h-3.5 w-3.5 text-primary" /> Live Operations Summary
        </span>
        <span className={cn("text-[10px] rounded-full px-2.5 py-0.5 border font-bold uppercase", statusMeta.color)}>
          {statusMeta.label}
        </span>
      </div>

      {/* Live Operations Overview Card */}
      <div className="rounded-3xl bg-card p-5 shadow-soft ring-1 ring-border/60 font-sans space-y-4 text-foreground">
        {/* 1. Today's Hours & Status Banner */}
        <div className="rounded-2xl bg-secondary/50 p-3 border border-border/40 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs">
            <Clock className="h-4 w-4 text-primary shrink-0" />
            <div>
              <div className="text-[10px] text-muted-foreground uppercase font-bold">Today's Schedule</div>
              <div className="font-bold text-foreground">{todayStatus.text}</div>
            </div>
          </div>

          <div className="flex items-center gap-1 text-[11px] font-bold">
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                todayStatus.isOpen ? "bg-emerald-500 animate-pulse" : "bg-rose-500"
              )}
            />
            <span className={todayStatus.isOpen ? "text-emerald-600" : "text-rose-600"}>
              {todayStatus.isOpen ? "Accepting Orders" : "Offline"}
            </span>
          </div>
        </div>

        {/* 2. Ordering Channels Summary */}
        <div className="space-y-2 text-xs border-b border-border/40 pb-3">
          <div className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground flex justify-between">
            <span>Enabled Order Channels</span>
            <span className="text-primary font-bold">{activeChannels.length} Active</span>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(settings.enabledChannels) as OrderChannel[]).map((ch) => {
              const isEnabled = settings.enabledChannels[ch];
              return (
                <span
                  key={ch}
                  className={cn(
                    "px-2.5 py-1 rounded-full text-[10px] font-semibold border transition",
                    isEnabled
                      ? "bg-primary/10 text-primary border-primary/20"
                      : "bg-muted text-muted-foreground border-border opacity-50 line-through"
                  )}
                >
                  {CHANNEL_LABELS[ch]}
                </span>
              );
            })}
          </div>
        </div>

        {/* 3. Kitchen KDS Controls */}
        <div className="space-y-2 text-xs border-b border-border/40 pb-3">
          <div className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground flex items-center gap-1.5">
            <ChefHat className="h-3.5 w-3.5 text-primary" /> Kitchen Display System (KDS)
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="flex justify-between text-muted-foreground">
              <span>Refresh Rate</span>
              <strong className="text-foreground font-mono">{settings.kdsRefreshInterval}</strong>
            </div>

            <div className="flex justify-between text-muted-foreground">
              <span>Kitchen Sound</span>
              <strong className={settings.kdsSoundEnabled ? "text-emerald-600" : "text-muted-foreground"}>
                {settings.kdsSoundEnabled ? "Enabled" : "Muted"}
              </strong>
            </div>

            <div className="flex justify-between text-muted-foreground">
              <span>Auto-Scroll</span>
              <strong className={settings.kdsAutoScroll ? "text-emerald-600" : "text-muted-foreground"}>
                {settings.kdsAutoScroll ? "ON" : "OFF"}
              </strong>
            </div>

            <div className="flex justify-between text-muted-foreground">
              <span>Delay Alerts</span>
              <strong className={settings.kdsHighlightDelayed ? "text-amber-600" : "text-muted-foreground"}>
                {settings.kdsHighlightDelayed ? "ON" : "OFF"}
              </strong>
            </div>
          </div>
        </div>

        {/* 4. Table & Session Controls */}
        <div className="space-y-2 text-xs border-b border-border/40 pb-3">
          <div className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground flex items-center gap-1.5">
            <UtensilsCrossed className="h-3.5 w-3.5 text-primary" /> Table & Dining Session
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="flex justify-between text-muted-foreground">
              <span>Session Timeout</span>
              <strong className="text-foreground font-mono">
                {settings.sessionTimeout === "never"
                  ? "Never"
                  : `${settings.sessionTimeout.replace("m", " mins")}`}
              </strong>
            </div>

            <div className="flex justify-between text-muted-foreground">
              <span>Auto-Release</span>
              <strong className={settings.autoReleaseTable ? "text-emerald-600" : "text-muted-foreground"}>
                {settings.autoReleaseTable ? "Enabled" : "Disabled"}
              </strong>
            </div>
          </div>
        </div>

        {/* 5. KOT Printing Controls */}
        <div className="space-y-2 text-xs">
          <div className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Printer className="h-3.5 w-3.5 text-primary" /> Kitchen Order Ticket (KOT)
          </div>

          <div className="flex flex-wrap gap-1.5 text-[10px]">
            <span
              className={cn(
                "px-2 py-0.5 rounded-full border font-semibold",
                settings.autoPrintKot
                  ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                  : "bg-muted text-muted-foreground border-border"
              )}
            >
              Auto-Print KOT: {settings.autoPrintKot ? "ON" : "OFF"}
            </span>

            <span
              className={cn(
                "px-2 py-0.5 rounded-full border font-semibold",
                settings.reprintOnEdit
                  ? "bg-blue-500/10 text-blue-600 border-blue-500/20"
                  : "bg-muted text-muted-foreground border-border"
              )}
            >
              Reprint on Edit: {settings.reprintOnEdit ? "ON" : "OFF"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
