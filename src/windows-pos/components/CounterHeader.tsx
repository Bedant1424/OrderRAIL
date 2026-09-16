import React from "react";
import { RefreshCw, Wifi, WifiOff, Store } from "lucide-react";
import type { ConnectionStatus } from "../types/counterTypes";

interface CounterHeaderProps {
  cafeName?: string;
  connectionStatus: ConnectionStatus;
  lastSyncedAt: Date | null;
  isLoading: boolean;
  onRefresh: () => void;
}

export const CounterHeader: React.FC<CounterHeaderProps> = ({
  cafeName = "Cheese Corner",
  connectionStatus,
  lastSyncedAt,
  isLoading,
  onRefresh,
}) => {
  const getStatusBadge = () => {
    switch (connectionStatus) {
      case "connected":
        return (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <Wifi className="w-3.5 h-3.5" />
            <span>Live Realtime</span>
          </div>
        );
      case "reconnecting":
        return (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs font-medium">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
            <Wifi className="w-3.5 h-3.5" />
            <span>Reconnecting...</span>
          </div>
        );
      case "disconnected":
        return (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 text-xs font-medium">
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            <WifiOff className="w-3.5 h-3.5" />
            <span>Disconnected</span>
          </div>
        );
    }
  };

  const formatLastSync = (date: Date | null) => {
    if (!date) return "--:--:--";
    return date.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  return (
    <header className="h-14 bg-zinc-900 border-b border-zinc-800 px-4 flex items-center justify-between select-none">
      {/* Brand & Station */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-orange-600 flex items-center justify-center text-white font-bold shadow-md shadow-orange-600/20">
          <Store className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-sm font-semibold text-white tracking-wide flex items-center gap-2">
            {cafeName}
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 font-mono">
              POS v1.0
            </span>
          </h1>
          <p className="text-xs text-zinc-400">Windows Counter Station</p>
        </div>
      </div>

      {/* Sync Status & Action */}
      <div className="flex items-center gap-3">
        {getStatusBadge()}

        <span className="text-xs text-zinc-500 font-mono hidden sm:inline-block">
          Synced: {formatLastSync(lastSyncedAt)}
        </span>

        <button
          onClick={onRefresh}
          disabled={isLoading}
          title="Manual Force Sync"
          className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-zinc-700/50 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin text-orange-400" : ""}`} />
        </button>
      </div>
    </header>
  );
};
