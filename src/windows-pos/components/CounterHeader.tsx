import React, { useState, useEffect } from "react";
import { RefreshCw, Wifi, WifiOff, Store, Plus, Clock } from "lucide-react";
import { ChannelSelector } from "./ChannelSelector";
import type { ConnectionStatus, OrderSource } from "../types/counterTypes";

interface CounterHeaderProps {
  cafeName?: string;
  stationName?: string;
  connectionStatus: ConnectionStatus;
  lastSyncedAt: Date | null;
  isLoading: boolean;
  onRefresh: () => void;
  activeChannel: OrderSource;
  onSelectChannel: (channel: OrderSource) => void;
  onOpenNewOrder: () => void;
  channelCounts?: Partial<Record<OrderSource, number>>;
  pendingSyncCount?: number;
}

export const CounterHeader: React.FC<CounterHeaderProps> = ({
  cafeName = "Cheese Corner",
  stationName = "Counter 1",
  connectionStatus,
  lastSyncedAt,
  isLoading,
  onRefresh,
  activeChannel,
  onSelectChannel,
  onOpenNewOrder,
  channelCounts,
  pendingSyncCount = 0,
}) => {
  const [currentClock, setCurrentClock] = useState<string>(() =>
    new Date().toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    })
  );

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentClock(
        new Date().toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
        })
      );
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const getStatusBadge = () => {
    switch (connectionStatus) {
      case "connected":
        return (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <Wifi className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Live Realtime</span>
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
      case "offline":
      case "disconnected":
        return (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 text-xs font-medium">
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            <WifiOff className="w-3.5 h-3.5" />
            <span>Offline</span>
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
    <header className="h-13 bg-zinc-900 border-b border-zinc-800 px-4 py-2 flex items-center justify-between select-none shrink-0">
      {/* Brand & Station */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-orange-600 flex items-center justify-center text-white font-bold shadow-md shadow-orange-600/20 shrink-0">
          <Store className="w-4 h-4" />
        </div>
        <div>
          <h1 className="text-xs font-bold text-white tracking-wide flex items-center gap-2">
            {cafeName}
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-800 text-orange-400 font-mono font-semibold">
              {stationName}
            </span>
          </h1>
          <p className="text-[11px] text-zinc-400">Windows POS Station</p>
        </div>
      </div>

      {/* Center: Four-Channel Selector */}
      <div className="flex items-center gap-2">
        <ChannelSelector
          activeChannel={activeChannel}
          onSelectChannel={onSelectChannel}
          channelCounts={channelCounts}
        />

        <button
          onClick={onOpenNewOrder}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold shadow-md shadow-orange-600/20 transition-all ml-1"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Order</span>
        </button>
      </div>

      {/* Right: Live Clock, Sync Status & Trigger */}
      <div className="flex items-center gap-3">
        <div className="hidden lg:flex items-center gap-1.5 text-xs text-zinc-400 font-mono bg-zinc-950/60 px-2.5 py-1 rounded-lg border border-zinc-800/80">
          <Clock className="w-3 h-3 text-zinc-500" />
          <span>{currentClock}</span>
        </div>

        {getStatusBadge()}

        {pendingSyncCount > 0 && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30 text-xs font-mono font-medium animate-pulse">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <span>{pendingSyncCount} waiting to sync</span>
          </div>
        )}

        <span className="text-xs text-zinc-500 font-mono hidden xl:inline-block">
          Synced: {formatLastSync(lastSyncedAt)}
        </span>

        <button
          onClick={onRefresh}
          disabled={isLoading}
          title="Manual Force Sync"
          className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-zinc-700/50 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-orange-400" : ""}`} />
        </button>
      </div>
    </header>
  );
};
