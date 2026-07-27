import { useState, useEffect } from "react";
import { isDemoDeployment } from "@/lib/permissions";
import {
  NetworkManager,
  useNetworkState,
  usePendingOperationCount,
  SyncManager,
  getAllOperations,
  clearAllOperations,
  type Operation,
} from "@/lib/offline";
import { Wrench, Wifi, WifiOff, RefreshCw, Trash2, Code, X } from "lucide-react";
import { cn } from "@/lib/utils";

export function DemoDevToolsPanel() {
  const isDemo = isDemoDeployment();
  const { isOnline, isForcedOffline } = useNetworkState();
  const pendingOperationCount = usePendingOperationCount();
  const [isOpen, setIsOpen] = useState(false);
  const [ops, setOps] = useState<Operation[]>([]);
  const [selectedOp, setSelectedOp] = useState<Operation | null>(null);

  useEffect(() => {
    if (isOpen) {
      void refreshOps();
    }
  }, [isOpen, pendingOperationCount]);

  const refreshOps = async () => {
    const list = await getAllOperations();
    setOps(list);
  };

  // Production users must NEVER see this developer panel
  if (!isDemo) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 select-none print:hidden">
      {!isOpen ? (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-1.5 rounded-full bg-slate-900 text-slate-100 border border-slate-700 px-3.5 py-2 text-xs font-semibold shadow-float hover:bg-slate-800 transition"
        >
          <Wrench className="h-3.5 w-3.5 text-amber-400" />
          <span>Dev Tools</span>
          {pendingOperationCount > 0 && (
            <span className="rounded-full bg-amber-500 text-slate-950 px-1.5 py-0.2 text-[10px] font-bold">
              {pendingOperationCount}
            </span>
          )}
        </button>
      ) : (
        <div className="w-80 sm:w-96 rounded-3xl border border-slate-700 bg-slate-900 text-slate-100 p-5 shadow-float space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Wrench className="h-4 w-4 text-amber-400" />
              <h3 className="font-display text-sm font-bold">Offline Operations DevTools</h3>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="rounded-full p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Force Online / Offline Controls */}
          <div className="space-y-2">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Network Simulation State
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => NetworkManager.forceOnline()}
                className={cn(
                  "flex items-center justify-center gap-1.5 rounded-xl border py-2 text-xs font-semibold transition",
                  isOnline && !isForcedOffline
                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-bold"
                    : "bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-750"
                )}
              >
                <Wifi className="h-3.5 w-3.5" />
                Force Online
              </button>
              <button
                type="button"
                onClick={() => NetworkManager.forceOffline()}
                className={cn(
                  "flex items-center justify-center gap-1.5 rounded-xl border py-2 text-xs font-semibold transition",
                  isForcedOffline
                    ? "bg-rose-500/20 text-rose-300 border-rose-500/40 font-bold"
                    : "bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-750"
                )}
              >
                <WifiOff className="h-3.5 w-3.5" />
                Force Offline
              </button>
            </div>
          </div>

          {/* Queue Controls */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Persistent Operations Queue ({ops.length})
              </label>
              <button
                type="button"
                onClick={async () => {
                  await clearAllOperations();
                  await refreshOps();
                  await SyncManager.refreshPendingCount();
                }}
                className="text-[10px] text-rose-400 hover:underline flex items-center gap-1"
              >
                <Trash2 className="h-3 w-3" /> Clear Queue
              </button>
            </div>

            <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
              {ops.length === 0 ? (
                <p className="text-center py-4 text-xs text-slate-500 border border-dashed border-slate-800 rounded-xl">
                  Queue is empty.
                </p>
              ) : (
                ops.map((op) => (
                  <div
                    key={op.operationId}
                    onClick={() => setSelectedOp(op)}
                    className={cn(
                      "cursor-pointer rounded-xl border p-2 text-xs transition flex items-center justify-between",
                      selectedOp?.operationId === op.operationId
                        ? "border-amber-500 bg-amber-500/10 text-amber-200"
                        : "border-slate-800 bg-slate-850 hover:border-slate-700"
                    )}
                  >
                    <div>
                      <div className="font-semibold">{op.operationType}</div>
                      <div className="text-[10px] text-slate-400">{op.operationId.substring(0, 8)}... · {op.status}</div>
                    </div>
                    <Code className="h-3.5 w-3.5 text-slate-500" />
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Payload Inspector Modal/Box */}
          {selectedOp && (
            <div className="rounded-2xl border border-slate-800 bg-slate-950 p-3 space-y-2">
              <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400">
                <span>Payload: {selectedOp.operationType}</span>
                <button onClick={() => setSelectedOp(null)} className="text-slate-500 hover:text-slate-200">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <pre className="text-[10px] text-emerald-400 max-h-32 overflow-auto bg-slate-900 p-2 rounded-xl border border-slate-800">
                {JSON.stringify(selectedOp.payload, null, 2)}
              </pre>
            </div>
          )}

          <div className="pt-2 border-t border-slate-800 flex gap-2">
            <button
              type="button"
              onClick={async () => {
                await SyncManager.startSync();
                await refreshOps();
              }}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold py-2 text-xs transition"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Trigger Sync Now
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
