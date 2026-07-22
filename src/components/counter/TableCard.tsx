import { memo } from "react";
import { cn } from "@/lib/utils";
import { TableEntity, TableState } from "@/lib/counter/tableEngine/tableTypes";
import { Users, Clock, Receipt, CheckCircle2, Sparkles, AlertTriangle, Bookmark } from "lucide-react";

interface TableCardProps {
  table: TableEntity;
  isSelected?: boolean;
  onSelect?: (table: TableEntity) => void;
}

export const TableCard = memo(function TableCard({
  table,
  isSelected = false,
  onSelect,
}: TableCardProps) {
  const isAvailable = table.status === "AVAILABLE";
  const isOccupied = table.status === "OCCUPIED";
  const isBillReq = table.status === "BILL_REQUESTED";
  const isCleaning = table.status === "CLEANING";
  const isReserved = table.status === "RESERVED";
  const isOutOfService = table.status === "OUT_OF_SERVICE";

  const session = table.activeSession;

  return (
    <div
      tabIndex={0}
      role="button"
      aria-label={`${table.label}, ${table.seats} seats, status ${table.status}`}
      onClick={() => onSelect?.(table)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect?.(table);
        }
      }}
      className={cn(
        "group relative flex flex-col justify-between rounded-2xl p-3.5 transition-all duration-150 cursor-pointer select-none border shadow-soft hover:shadow-float active:scale-[0.98] outline-none focus-visible:ring-2 focus-visible:ring-brand",
        isAvailable && "bg-card border-emerald-500/30 hover:border-emerald-500/60 dark:border-emerald-500/20",
        isOccupied && "bg-amber-500/5 border-amber-500/40 hover:border-amber-500/70 dark:border-amber-500/30",
        isBillReq && "bg-orange-500/10 border-orange-500/60 animate-pulse hover:border-orange-500 dark:border-orange-500/40",
        isCleaning && "bg-blue-500/5 border-blue-500/40 hover:border-blue-500/70 dark:border-blue-500/30",
        isReserved && "bg-purple-500/5 border-purple-500/40 hover:border-purple-500/70 dark:border-purple-500/30",
        isOutOfService && "bg-muted/40 border-muted-foreground/30 opacity-75 hover:opacity-100",
        isSelected && "ring-2 ring-brand ring-offset-2 ring-offset-background border-brand shadow-md"
      )}
    >
      {/* Top Row: Label & Status Badge */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="font-display text-base font-bold tracking-tight text-foreground">
            {table.label}
          </span>
          {isSelected && (
            <CheckCircle2 className="h-4 w-4 text-brand fill-brand/20 shrink-0" />
          )}
        </div>

        {/* Status Badges */}
        {isAvailable && (
          <span className="rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase">
            FREE
          </span>
        )}
        {isOccupied && (
          <span className="rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/20 px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase">
            OCCUPIED
          </span>
        )}
        {isBillReq && (
          <span className="rounded-full bg-orange-500 text-white border border-orange-600 px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase flex items-center gap-1 shadow-sm">
            <Receipt className="h-3 w-3 animate-spin" /> BILL REQ
          </span>
        )}
        {isCleaning && (
          <span className="rounded-full bg-blue-500/15 text-blue-700 dark:text-blue-400 border border-blue-500/20 px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase flex items-center gap-1">
            <Sparkles className="h-3 w-3" /> CLEANING
          </span>
        )}
        {isReserved && (
          <span className="rounded-full bg-purple-500/15 text-purple-700 dark:text-purple-400 border border-purple-500/20 px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase flex items-center gap-1">
            <Bookmark className="h-3 w-3" /> RESERVED
          </span>
        )}
        {isOutOfService && (
          <span className="rounded-full bg-muted text-muted-foreground border border-border px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" /> OUT OF SVC
          </span>
        )}
      </div>

      {/* Middle Row: Seat Count & Timers / Items */}
      <div className="my-2.5 flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-1 font-medium">
          <Users className="h-3.5 w-3.5 text-muted-foreground/70" />
          <span>{table.seats} Seats</span>
        </div>

        {(isOccupied || isBillReq) && session && (
          <div className="flex items-center gap-1 font-mono text-[11px] text-amber-700 dark:text-amber-400 font-semibold">
            <Clock className="h-3 w-3" />
            <span>34m ago</span>
          </div>
        )}
      </div>

      {/* Bottom Action / Summary Bar */}
      <div className="pt-2 border-t border-border/40 flex items-center justify-between text-xs">
        {isAvailable && (
          <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 group-hover:underline">
            + Open Table
          </span>
        )}

        {(isOccupied || isBillReq) && (
          <div className="flex items-center justify-between w-full font-mono text-[11px]">
            <span className="text-muted-foreground font-medium">
              {session?.itemCount ?? 0} items
            </span>
            <span className="font-bold text-foreground">
              ${(session?.totalAmount ?? 0).toFixed(2)}
            </span>
          </div>
        )}

        {isCleaning && (
          <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 group-hover:underline">
            Mark Available
          </span>
        )}

        {isReserved && (
          <span className="text-[11px] font-semibold text-purple-600 dark:text-purple-400 group-hover:underline">
            Seat Guest
          </span>
        )}

        {isOutOfService && (
          <span className="text-[11px] font-semibold text-muted-foreground italic">
            Maintenance
          </span>
        )}
      </div>
    </div>
  );
});
