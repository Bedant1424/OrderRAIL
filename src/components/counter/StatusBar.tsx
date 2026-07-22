import { Wifi, Printer, RefreshCw, Bell } from "lucide-react";

export function StatusBar() {
  return (
    <footer className="fixed bottom-0 left-0 right-0 z-30 h-8 bg-muted/95 backdrop-blur border-t border-border/80 px-4 flex items-center justify-between text-[11px] font-mono text-muted-foreground select-none">
      {/* Realtime Event Log Line */}
      <div className="flex items-center gap-2 truncate pr-4">
        <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
        <span className="truncate text-foreground font-medium">
          STATUS LOG: 14:31:58 — Order #22 (Table 4) submitted to kitchen | KOT Spooler: Job #104 ACK | Supabase Sync: 100% OK
        </span>
      </div>

      {/* Health Badges Footer Right */}
      <div className="hidden lg:flex items-center gap-4 shrink-0 text-[10px] font-semibold">
        <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
          <Wifi className="h-3 w-3" /> NET: ● ONLINE
        </span>
        <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
          <Printer className="h-3 w-3" /> PRINTER: ● READY
        </span>
        <span className="flex items-center gap-1 text-foreground">
          <RefreshCw className="h-3 w-3 text-brand" /> SYNC: ● 100% OK
        </span>
        <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
          <Bell className="h-3 w-3" /> SR: ● 2 PENDING
        </span>
      </div>
    </footer>
  );
}
