import { useState } from "react";
import { useNetworkState, useSyncProgress, SyncManager } from "@/lib/offline";
import { Wifi, WifiOff, RefreshCw, Layers } from "lucide-react";
import { cn } from "@/lib/utils";

export function OperationsStatusIndicator({ className }: { className?: string }) {
  const { isOnline, connectionState } = useNetworkState();
  const { isSyncing, total, processed, error: syncError, lastSuccessfulSync, pendingOperationCount } = useSyncProgress();
  const [expanded, setExpanded] = useState(false);

  const formatLastSync = (iso: string | null) => {
    if (!iso) return "Never";
    const diffMs = Date.now() - new Date(iso).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className={cn("relative inline-block text-xs select-none", className)}>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className={cn(
          "flex items-center gap-2 rounded-full px-3 py-1.5 font-medium transition-all shadow-soft border",
          isOnline
            ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20 hover:bg-emerald-500/15"
            : "bg-destructive/15 text-destructive border-destructive/30 animate-pulse hover:bg-destructive/20"
        )}
      >
        <span className="flex items-center gap-1.5">
          {isOnline ? (
            <Wifi className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <WifiOff className="h-3.5 w-3.5 text-destructive" />
          )}
          <span className="font-semibold">{isOnline ? "Online" : "Offline Mode"}</span>
        </span>

        {pendingOperationCount > 0 && (
          <span className="flex items-center gap-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300">
            <Layers className="h-3 w-3" />
            {pendingOperationCount} pending
          </span>
        )}

        {isSyncing && (
          <RefreshCw className="h-3 w-3 animate-spin text-accent" />
        )}
      </button>

      {expanded && (
        <div className="absolute right-0 top-full mt-2 w-72 rounded-2xl border border-border/80 bg-popover p-4 shadow-float z-50 space-y-3">
          <div className="flex items-center justify-between border-b border-border/50 pb-2">
            <span className="font-semibold text-foreground flex items-center gap-1.5">
              <span className={cn("h-2 w-2 rounded-full", isOnline ? "bg-emerald-500" : "bg-destructive")} />
              Operations Engine Status
            </span>
            <span className="text-[10px] uppercase font-bold text-muted-foreground">{connectionState}</span>
          </div>

          <div className="space-y-1.5 text-muted-foreground">
            <div className="flex justify-between">
              <span>Pending Queue:</span>
              <span className="font-semibold text-foreground tabular-nums">{pendingOperationCount} operations</span>
            </div>
            <div className="flex justify-between">
              <span>Last Sync:</span>
              <span className="font-semibold text-foreground">{formatLastSync(lastSuccessfulSync)}</span>
            </div>
          </div>

          {isSyncing && (
            <div className="space-y-1 rounded-xl bg-muted/50 p-2 text-[11px]">
              <div className="flex justify-between font-medium text-foreground">
                <span>Syncing Queue...</span>
                <span>{processed} / {total}</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-accent transition-all duration-300"
                  style={{ width: `${total > 0 ? (processed / total) * 100 : 0}%` }}
                />
              </div>
            </div>
          )}

          {syncError && (
            <p className="rounded-xl bg-destructive/10 p-2 text-[10px] font-medium text-destructive">
              {syncError}
            </p>
          )}

          <div className="pt-1 flex gap-2">
            <button
              type="button"
              onClick={() => {
                void SyncManager.startSync();
              }}
              disabled={isSyncing || !isOnline}
              className="flex-1 rounded-xl bg-secondary hover:bg-secondary/80 py-1.5 text-center text-xs font-semibold transition disabled:opacity-50"
            >
              Manual Sync
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
