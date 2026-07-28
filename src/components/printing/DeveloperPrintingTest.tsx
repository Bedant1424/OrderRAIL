import React, { useState, useEffect, useCallback } from "react";
import {
  printService,
  PrinterNotFound,
  ConnectionFailed,
  PrintFailed,
  PrinterError,
} from "@/lib/printing";
import {
  Printer as PrinterIcon,
  RefreshCw,
  Power,
  PowerOff,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  Terminal,
  Sparkles,
  Wrench,
} from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";

export const DeveloperPrintingTest: React.FC = () => {
  const [driverName, setDriverName] = useState<string>("");
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [defaultPrinter, setDefaultPrinter] = useState<string | null>(null);
  const [printersList, setPrintersList] = useState<string[]>([]);
  const [selectedPrinter, setSelectedPrinter] = useState<string>("");
  
  const [loadingAction, setLoadingAction] = useState<"connect" | "disconnect" | "refresh" | "print" | null>(null);
  const [lastPrintResult, setLastPrintResult] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  // Sync state from printService
  const refreshStatus = useCallback(async () => {
    setLoadingAction("refresh");
    setLastError(null);
    try {
      setDriverName(printService.driverType);
      const connected = printService.isConnected();
      setIsConnected(connected);

      if (connected) {
        const def = await printService.getDefaultPrinter();
        setDefaultPrinter(def);
        const list = await printService.listPrinters();
        setPrintersList(list);
        if (!selectedPrinter && (def || list[0])) {
          setSelectedPrinter(def || list[0]);
        }
      } else {
        setDefaultPrinter(null);
        setPrintersList([]);
      }
    } catch (err: any) {
      handleFriendlyError(err);
    } finally {
      setLoadingAction(null);
    }
  }, [selectedPrinter]);

  useEffect(() => {
    void refreshStatus();
  }, []);

  const handleFriendlyError = (err: unknown) => {
    let friendlyMessage = "An unexpected error occurred during printer operation.";
    if (err instanceof PrinterNotFound) {
      friendlyMessage = err.message;
    } else if (err instanceof ConnectionFailed) {
      friendlyMessage = err.message;
    } else if (err instanceof PrintFailed) {
      friendlyMessage = err.message;
    } else if (err instanceof PrinterError) {
      friendlyMessage = err.message;
    } else if (err instanceof Error) {
      friendlyMessage = err.message;
    }
    setLastError(friendlyMessage);
    toast.error(friendlyMessage);
  };

  const handleConnect = async () => {
    setLoadingAction("connect");
    setLastError(null);
    try {
      await printService.connect();
      setIsConnected(true);
      toast.success("Successfully connected to printer driver!");
      await refreshStatus();
    } catch (err: any) {
      handleFriendlyError(err);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleDisconnect = async () => {
    setLoadingAction("disconnect");
    setLastError(null);
    try {
      await printService.disconnect();
      setIsConnected(false);
      setDefaultPrinter(null);
      setPrintersList([]);
      toast.info("Disconnected from printer driver.");
    } catch (err: any) {
      handleFriendlyError(err);
    } finally {
      setLoadingAction(null);
    }
  };

  const handlePrintTest = async () => {
    if (!isConnected) {
      toast.error("Printer driver is disconnected. Please connect first.");
      return;
    }

    setLoadingAction("print");
    setLastError(null);
    try {
      const target = selectedPrinter || defaultPrinter || undefined;
      await printService.printTest(target);
      const timestamp = new Date().toLocaleTimeString();
      const resMsg = `Test receipt successfully printed on "${target || 'Default Printer'}" at ${timestamp}`;
      setLastPrintResult(resMsg);
      toast.success(resMsg);
    } catch (err: any) {
      setLastPrintResult(null);
      handleFriendlyError(err);
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="flex items-center justify-between p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-amber-500/20 text-amber-600 font-bold">
            <Wrench className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-display font-bold text-sm text-foreground">
                Printing Infrastructure Diagnostic Tool
              </h3>
              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500 text-black">
                Developer Only
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Validate low-level PrintService abstraction, driver status, and test receipt spooling without business logic.
            </p>
          </div>
        </div>
      </div>

      {/* Main Diagnostic Panel */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Connection & Driver Status Card */}
        <div className="rounded-3xl bg-card p-5 shadow-soft border border-border space-y-4">
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <span className="font-bold text-xs text-foreground flex items-center gap-2">
              <Terminal className="h-4 w-4 text-primary" />
              Driver & Status Info
            </span>
            <span
              className={cn(
                "inline-flex items-center gap-1.5 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase border",
                isConnected
                  ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                  : "bg-rose-500/10 text-rose-600 border-rose-500/20"
              )}
            >
              {isConnected ? (
                <>
                  <CheckCircle2 className="h-3 w-3" /> Connected
                </>
              ) : (
                <>
                  <XCircle className="h-3 w-3" /> Disconnected
                </>
              )}
            </span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex justify-between items-center py-1 border-b border-border/40">
              <span className="text-muted-foreground font-medium">Active Driver Engine:</span>
              <span className="font-mono font-bold text-primary">{driverName || "QZ_TRAY"}</span>
            </div>

            <div className="flex justify-between items-center py-1 border-b border-border/40">
              <span className="text-muted-foreground font-medium">Default Printer:</span>
              <span className="font-mono font-semibold text-foreground">
                {defaultPrinter || <span className="text-muted-foreground italic">None Detected</span>}
              </span>
            </div>

            <div className="space-y-1.5 py-1">
              <span className="text-muted-foreground font-medium block">Available Printers ({printersList.length}):</span>
              {printersList.length === 0 ? (
                <div className="p-2.5 rounded-xl bg-muted/40 text-[11px] text-muted-foreground italic text-center">
                  No printers discovered. Connect driver to scan printers.
                </div>
              ) : (
                <div className="space-y-1.5 max-h-28 overflow-y-auto pr-1">
                  {printersList.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setSelectedPrinter(p)}
                      className={cn(
                        "w-full text-left p-2 rounded-xl text-xs font-mono transition flex items-center justify-between border cursor-pointer",
                        selectedPrinter === p
                          ? "bg-primary/10 text-primary border-primary/30 font-bold"
                          : "bg-background text-foreground border-border/60 hover:bg-muted/40"
                      )}
                    >
                      <span className="truncate">{p}</span>
                      {p === defaultPrinter && (
                        <span className="text-[9px] bg-secondary px-1.5 py-0.5 rounded text-muted-foreground">Default</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Action Controls Card */}
        <div className="rounded-3xl bg-card p-5 shadow-soft border border-border space-y-4">
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <span className="font-bold text-xs text-foreground flex items-center gap-2">
              <PrinterIcon className="h-4 w-4 text-primary" />
              Action Controls
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              disabled={loadingAction !== null || isConnected}
              onClick={handleConnect}
              className={cn(
                "inline-flex items-center justify-center gap-2 p-3 rounded-2xl text-xs font-bold transition border cursor-pointer",
                isConnected
                  ? "bg-muted text-muted-foreground border-border opacity-50 cursor-not-allowed"
                  : "bg-emerald-600 text-white hover:bg-emerald-700 shadow-soft"
              )}
            >
              {loadingAction === "connect" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Power className="h-4 w-4" />
              )}
              <span>Connect</span>
            </button>

            <button
              type="button"
              disabled={loadingAction !== null || !isConnected}
              onClick={handleDisconnect}
              className={cn(
                "inline-flex items-center justify-center gap-2 p-3 rounded-2xl text-xs font-bold transition border cursor-pointer",
                !isConnected
                  ? "bg-muted text-muted-foreground border-border opacity-50 cursor-not-allowed"
                  : "bg-rose-600 text-white hover:bg-rose-700 shadow-soft"
              )}
            >
              {loadingAction === "disconnect" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <PowerOff className="h-4 w-4" />
              )}
              <span>Disconnect</span>
            </button>

            <button
              type="button"
              disabled={loadingAction !== null}
              onClick={refreshStatus}
              className="col-span-2 inline-flex items-center justify-center gap-2 p-3 rounded-2xl bg-secondary text-foreground border border-border/60 hover:bg-muted font-bold text-xs transition cursor-pointer"
            >
              {loadingAction === "refresh" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              <span>Refresh Printers</span>
            </button>
          </div>

          <div className="pt-2 border-t border-border/40 space-y-2">
            <button
              type="button"
              disabled={loadingAction !== null || !isConnected}
              onClick={handlePrintTest}
              className={cn(
                "w-full inline-flex items-center justify-center gap-2 p-3.5 rounded-2xl font-bold text-xs transition cursor-pointer shadow-soft",
                !isConnected
                  ? "bg-muted text-muted-foreground border border-border opacity-50 cursor-not-allowed"
                  : "bg-primary text-primary-foreground hover:opacity-90"
              )}
            >
              {loadingAction === "print" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              <span>Print Test Receipt</span>
            </button>
            <p className="text-[10px] text-muted-foreground text-center">
              Spools a raw ESC/POS plain text test receipt to the target printer.
            </p>
          </div>
        </div>
      </div>

      {/* Diagnostics Logs & Results */}
      {(lastPrintResult || lastError) && (
        <div className="rounded-3xl bg-card p-5 shadow-soft border border-border space-y-3">
          <span className="font-bold text-xs text-foreground block">Execution Logs</span>

          {lastPrintResult && (
            <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{lastPrintResult}</span>
            </div>
          )}

          {lastError && (
            <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-400 text-xs flex items-start gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{lastError}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
