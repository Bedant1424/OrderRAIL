import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { useCafe } from "@/lib/cafe";
import { Wifi, Printer, Clock, User, Store, Bell } from "lucide-react";
import { maskEmail, usePermissions } from "@/lib/permissions";
import { ServiceRequestPopoverV3 } from "./ServiceRequestPopoverV3";

export function CounterHeaderV3() {
  const { cafe } = useCafe();
  const { user } = useAuth();
  const { isDemo } = usePermissions();
  const [timeStr, setTimeStr] = useState<string>("");
  const [isCallsOpen, setIsCallsOpen] = useState<boolean>(false);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(now.toLocaleTimeString([], { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const cashierName = user?.email
    ? isDemo
      ? maskEmail(user.email)
      : user.email.split("@")[0]
    : "Sarah M.";

  return (
    <header className="fixed top-0 left-0 right-0 z-30 h-14 bg-card/95 backdrop-blur border-b border-border/80 px-4 flex items-center justify-between text-xs select-none shadow-soft">
      {/* Left: Branding & Cafe Name */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-brand text-brand-foreground font-display font-bold text-sm shadow-soft">
            OR
          </span>
          <div>
            <div className="flex items-center gap-1.5 font-display font-semibold text-sm leading-tight text-foreground">
              <Store className="h-3.5 w-3.5 text-brand" />
              <span>{cafe?.name ?? "Cafe Central"}</span>
            </div>
            <div className="text-[10px] text-muted-foreground font-mono">
              Counter Interface v3 (Redesigned)
            </div>
          </div>
        </div>

        <div className="h-4 w-px bg-border/80 hidden sm:block" />

        {/* Cashier Badge */}
        <div className="hidden sm:flex items-center gap-1.5 rounded-full bg-secondary/80 px-3 py-1 text-secondary-foreground font-medium text-[11px]">
          <User className="h-3 w-3 text-muted-foreground" />
          <span>Cashier: <strong className="text-foreground capitalize">{cashierName}</strong></span>
        </div>
      </div>

      {/* Right: Service Request Bell, Health Badges, Clock */}
      <div className="flex items-center gap-2.5">
        {/* Floating Service Call Bell Trigger */}
        <div className="relative">
          <button
            onClick={() => setIsCallsOpen(!isCallsOpen)}
            className="flex items-center gap-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 px-3 py-1 text-amber-700 dark:text-amber-400 font-bold text-[11px] hover:bg-amber-500/20 transition active:scale-95"
          >
            <Bell className="h-3.5 w-3.5 animate-pulse text-amber-500" />
            <span>🔔 2 Calls</span>
          </button>

          <ServiceRequestPopoverV3
            isOpen={isCallsOpen}
            onClose={() => setIsCallsOpen(false)}
          />
        </div>

        {/* Network Status */}
        <div className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 text-emerald-700 dark:text-emerald-400 font-mono text-[11px] font-semibold">
          <Wifi className="h-3 w-3 text-emerald-500" />
          <span>● ONLINE</span>
        </div>

        {/* Printer Status */}
        <div className="hidden md:flex items-center gap-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 px-2.5 py-1 text-blue-700 dark:text-blue-400 font-mono text-[11px] font-semibold">
          <Printer className="h-3 w-3 text-blue-500" />
          <span>● READY</span>
        </div>

        {/* Live System Clock */}
        <div className="flex items-center gap-1.5 rounded-xl bg-muted px-3 py-1 font-mono text-xs font-bold text-foreground">
          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
          <span>{timeStr || "14:32:05"}</span>
        </div>
      </div>
    </header>
  );
}
