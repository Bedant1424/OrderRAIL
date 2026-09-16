import React, { useState, useMemo } from "react";
import { Users, Clock, ShoppingBag, AlertTriangle, CheckCircle2 } from "lucide-react";
import type { CounterTable } from "../types/counterTypes";

interface TableGridProps {
  tables: CounterTable[];
  selectedTableId: string | null;
  onSelectTable: (tableId: string) => void;
}

type TableFilter = "ALL" | "OCCUPIED" | "VACANT" | "NEEDS_ATTENTION";

export const TableGrid: React.FC<TableGridProps> = ({
  tables,
  selectedTableId,
  onSelectTable,
}) => {
  const [filter, setFilter] = useState<TableFilter>("ALL");

  const formatCurrency = (cents: number) => `₹${(cents / 100).toFixed(2)}`;

  const formatElapsedTime = (sessionStartedAt?: string | null) => {
    if (!sessionStartedAt) return null;
    try {
      const diffMs = Date.now() - new Date(sessionStartedAt).getTime();
      if (diffMs < 0) return "Just started";
      const mins = Math.floor(diffMs / 60000);
      if (mins < 60) return `${mins}m ago`;
      const hrs = Math.floor(mins / 60);
      const remMins = mins % 60;
      return `${hrs}h ${remMins}m`;
    } catch {
      return null;
    }
  };

  const pendingTableIds = useMemo(() => {
    const set = new Set<string>();
    for (const t of tables) {
      if (t.orders.some((o) => o.status === "pending")) {
        set.add(t.id);
      }
    }
    return set;
  }, [tables]);

  const occupiedTablesCount = useMemo(
    () => tables.filter((t) => t.status === "occupied" || t.orders.length > 0).length,
    [tables]
  );
  const vacantTablesCount = tables.length - occupiedTablesCount;
  const needsAttentionCount = pendingTableIds.size;

  const filteredTables = useMemo(() => {
    switch (filter) {
      case "OCCUPIED":
        return tables.filter((t) => t.status === "occupied" || t.orders.length > 0);
      case "VACANT":
        return tables.filter((t) => t.status !== "occupied" && t.orders.length === 0);
      case "NEEDS_ATTENTION":
        return tables.filter((t) => pendingTableIds.has(t.id));
      case "ALL":
      default:
        return tables;
    }
  }, [tables, filter, pendingTableIds]);

  return (
    <div className="flex-1 bg-zinc-950 p-4 flex flex-col h-full overflow-hidden select-none">
      {/* Table Filter Tabs */}
      <div className="mb-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-1.5 bg-zinc-900/80 p-1 rounded-xl border border-zinc-800 text-xs">
          <button
            onClick={() => setFilter("ALL")}
            className={`px-3 py-1 rounded-lg font-semibold transition-all flex items-center gap-1.5 ${
              filter === "ALL"
                ? "bg-zinc-800 text-white shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <span>All</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-zinc-700/60 text-zinc-300">
              {tables.length}
            </span>
          </button>

          <button
            onClick={() => setFilter("OCCUPIED")}
            className={`px-3 py-1 rounded-lg font-semibold transition-all flex items-center gap-1.5 ${
              filter === "OCCUPIED"
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>Occupied</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-zinc-800 text-zinc-400">
              {occupiedTablesCount}
            </span>
          </button>

          <button
            onClick={() => setFilter("VACANT")}
            className={`px-3 py-1 rounded-lg font-semibold transition-all flex items-center gap-1.5 ${
              filter === "VACANT"
                ? "bg-zinc-800 text-white shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-600" />
            <span>Vacant</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-zinc-800 text-zinc-400">
              {vacantTablesCount}
            </span>
          </button>

          {needsAttentionCount > 0 && (
            <button
              onClick={() => setFilter("NEEDS_ATTENTION")}
              className={`px-3 py-1 rounded-lg font-semibold transition-all flex items-center gap-1.5 animate-pulse ${
                filter === "NEEDS_ATTENTION"
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm"
                  : "bg-amber-500/10 text-amber-400 hover:bg-amber-500/20"
              }`}
            >
              <AlertTriangle className="w-3 h-3 text-amber-400" />
              <span>Needs Attention</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-500/30 text-amber-200">
                {needsAttentionCount}
              </span>
            </button>
          )}
        </div>

        <span className="text-xs text-zinc-500 font-mono hidden md:inline">
          Dine-In Workstation Grid
        </span>
      </div>

      {/* Grid of Tables */}
      <div className="flex-1 overflow-y-auto">
        {filteredTables.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-center text-zinc-500 text-xs">
            <CheckCircle2 className="w-8 h-8 text-zinc-700 mb-2" />
            <span className="font-semibold text-zinc-400">No tables match this filter</span>
            <span className="text-[11px] text-zinc-600 mt-0.5">
              Select "All" to view all configured dining tables.
            </span>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {filteredTables.map((table) => {
              const isSelected = table.id === selectedTableId;
              const isOccupied = table.status === "occupied" || table.orders.length > 0;
              const hasPending = pendingTableIds.has(table.id);
              const activeOrderCount = table.orders.length;
              const pendingCount = table.orders.filter((o) => o.status === "pending").length;
              const elapsedStr = formatElapsedTime(table.activeSessionStartedAt || (table as any).sessionStartedAt);

              return (
                <button
                  key={table.id}
                  onClick={() => onSelectTable(table.id)}
                  className={`text-left p-3.5 rounded-xl border transition-all relative overflow-hidden flex flex-col justify-between min-h-[115px] ${
                    isSelected
                      ? "bg-zinc-800/90 border-orange-500 ring-1 ring-orange-500 shadow-lg shadow-orange-950/20"
                      : hasPending
                      ? "bg-amber-950/20 border-amber-500/50 hover:border-amber-400"
                      : isOccupied
                      ? "bg-zinc-900 border-zinc-700/80 hover:border-zinc-500"
                      : "bg-zinc-900/40 border-zinc-800/80 hover:border-zinc-700 opacity-75 hover:opacity-100"
                  }`}
                >
                  {/* Top Status Bar */}
                  <div
                    className={`absolute top-0 left-0 right-0 h-1 ${
                      hasPending
                        ? "bg-amber-500 animate-pulse"
                        : isOccupied
                        ? "bg-emerald-500"
                        : "bg-zinc-700"
                    }`}
                  />

                  {/* Table Label & Status Badge */}
                  <div className="flex items-start justify-between gap-1 w-full mt-0.5">
                    <span className="font-bold text-sm text-white tracking-wide">
                      {table.label}
                    </span>

                    {hasPending ? (
                      <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse">
                        {pendingCount} Pending
                      </span>
                    ) : (
                      <span
                        className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${
                          isOccupied
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            : "bg-zinc-800 text-zinc-500 border border-zinc-700/50"
                        }`}
                      >
                        {isOccupied ? "Occupied" : "Vacant"}
                      </span>
                    )}
                  </div>

                  {/* Middle Order & Unbilled Total */}
                  <div className="my-2 space-y-1 w-full">
                    {isOccupied ? (
                      <>
                        <div className="flex items-center gap-1.5 text-xs text-amber-300 font-medium">
                          <ShoppingBag className="w-3.5 h-3.5" />
                          <span>
                            {activeOrderCount} {activeOrderCount === 1 ? "Order" : "Orders"}
                          </span>
                        </div>
                        {table.unbilledTotalCents > 0 && (
                          <div className="text-xs font-mono font-bold text-white">
                            {formatCurrency(table.unbilledTotalCents)}
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="text-xs text-zinc-600 italic">Available for guests</div>
                    )}
                  </div>

                  {/* Footer: Elapsed Time & Session */}
                  <div className="text-[11px] text-zinc-500 flex items-center justify-between w-full pt-1 border-t border-zinc-800/60">
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3 text-zinc-600" />
                      <span>Dine-In</span>
                    </span>

                    {elapsedStr && (
                      <span className="flex items-center gap-1 font-mono text-[10px] text-zinc-400">
                        <Clock className="w-2.5 h-2.5" />
                        <span>{elapsedStr}</span>
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
