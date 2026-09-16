import React from "react";
import { Users, Clock, ShoppingBag } from "lucide-react";
import type { CounterTable } from "../types/counterTypes";

interface TableGridProps {
  tables: CounterTable[];
  selectedTableId: string | null;
  onSelectTable: (tableId: string) => void;
}

export const TableGrid: React.FC<TableGridProps> = ({
  tables,
  selectedTableId,
  onSelectTable,
}) => {
  const formatCurrency = (cents: number) => {
    return `₹${(cents / 100).toFixed(2)}`;
  };

  return (
    <div className="flex-1 bg-zinc-950 p-4 overflow-y-auto">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Tables & Stations ({tables.length})
        </h2>
        <div className="flex items-center gap-4 text-xs text-zinc-400">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            Occupied ({tables.filter((t) => t.status === "occupied").length})
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-zinc-700" />
            Vacant ({tables.filter((t) => t.status !== "occupied").length})
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
        {tables.map((table) => {
          const isSelected = table.id === selectedTableId;
          const isOccupied = table.status === "occupied" || table.orders.length > 0;
          const activeOrderCount = table.orders.length;

          return (
            <button
              key={table.id}
              onClick={() => onSelectTable(table.id)}
              className={`text-left p-3.5 rounded-xl border transition-all relative overflow-hidden flex flex-col justify-between min-h-[110px] ${
                isSelected
                  ? "bg-zinc-800/90 border-orange-500 ring-1 ring-orange-500 shadow-lg shadow-orange-950/20"
                  : isOccupied
                  ? "bg-zinc-900 border-zinc-700/80 hover:border-zinc-500"
                  : "bg-zinc-900/40 border-zinc-800/80 hover:border-zinc-700 opacity-75 hover:opacity-100"
              }`}
            >
              {/* Top status indicator bar */}
              <div
                className={`absolute top-0 left-0 right-0 h-1 ${
                  isOccupied ? "bg-emerald-500" : "bg-zinc-700"
                }`}
              />

              {/* Table label & status tag */}
              <div className="flex items-start justify-between gap-1 w-full mt-0.5">
                <span className="font-semibold text-sm text-white tracking-wide">
                  {table.label}
                </span>

                <span
                  className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${
                    isOccupied
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                      : "bg-zinc-800 text-zinc-500 border border-zinc-700/50"
                  }`}
                >
                  {isOccupied ? "Occupied" : "Vacant"}
                </span>
              </div>

              {/* Middle details: active orders & elapsed */}
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
                  <div className="text-xs text-zinc-600 italic">No active orders</div>
                )}
              </div>

              {/* Footer indicator */}
              <div className="text-[11px] text-zinc-500 flex items-center justify-between w-full pt-1 border-t border-zinc-800/60">
                <span className="flex items-center gap-1">
                  <Users className="w-3 h-3 text-zinc-600" />
                  <span>Dine-In</span>
                </span>
                {table.sessionStartedAt && (
                  <span className="flex items-center gap-0.5 font-mono text-[10px] text-zinc-400">
                    <Clock className="w-2.5 h-2.5" />
                    {new Date(table.sessionStartedAt).toLocaleTimeString("en-IN", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
