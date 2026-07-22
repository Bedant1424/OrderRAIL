import { memo } from "react";
import { cn } from "@/lib/utils";
import { TableEntity } from "@/lib/counter/tableEngine/tableTypes";
import { Clock, Receipt, CheckCircle2, Sparkles, AlertTriangle, Bookmark, Droplet } from "lucide-react";

interface TableCardV3Props {
  table: TableEntity;
  isSelected?: boolean;
  onSelect?: (table: TableEntity) => void;
}

export const TableCardV3 = memo(function TableCardV3({
  table,
  isSelected = false,
  onSelect,
}: TableCardV3Props) {
  const isAvailable = table.status === "AVAILABLE";
  const isOccupied = table.status === "OCCUPIED";
  const isBillReq = table.status === "BILL_REQUESTED";
  const isCleaning = table.status === "CLEANING";
  const isReserved = table.status === "RESERVED";
  const isOutOfService = table.status === "OUT_OF_SERVICE";

  // Micro-badge service call indicator recommendation from COUNTER_V3_DESIGN_REVIEW.md
  const hasWaterCall = table.id === "t-2";
  const hasBillCall = table.id === "t-4";

  return (
    <div
      tabIndex={0}
      role="button"
      aria-label={`${table.label}, status ${table.status}`}
      onClick={() => onSelect?.(table)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect?.(table);
        }
      }}
      className={cn(
        "group relative flex flex-col justify-between rounded-2xl p-3 transition-all duration-150 cursor-pointer select-none border shadow-soft hover:shadow-float hover:scale-[1.02] active:scale-[0.98] outline-none focus-visible:ring-2 focus-visible:ring-brand min-h-[82px]",
        isAvailable && "bg-card border-emerald-500/30 hover:border-emerald-500/60 dark:border-emerald-500/20",
        isOccupied && "bg-amber-500/5 border-amber-500/40 hover:border-amber-500/70 dark:border-amber-500/30",
        isBillReq && "bg-orange-500/10 border-orange-500/60 animate-pulse hover:border-orange-500 dark:border-orange-500/40",
        isCleaning && "bg-blue-500/5 border-blue-500/40 hover:border-blue-500/70 dark:border-blue-500/30",
        isReserved && "bg-purple-500/5 border-purple-500/40 hover:border-purple-500/70 dark:border-purple-500/30",
        isOutOfService && "bg-muted/40 border-muted-foreground/30 opacity-75 hover:opacity-100",
        isSelected && "ring-2 ring-brand ring-offset-2 ring-offset-background border-brand shadow-md bg-brand/5"
      )}
    >
      {/* Top Row: Label & Micro Service Call Badge */}
      <div className="flex items-center justify-between gap-1.5">
        <div className="flex items-center gap-1.5">
          <span className="font-display text-base font-bold tracking-tight text-foreground">
            {table.label}
          </span>
          {isSelected && (
            <CheckCircle2 className="h-4 w-4 text-brand fill-brand/20 shrink-0" />
          )}
        </div>

        {/* Micro-badge Service Alert Indicator */}
        {hasWaterCall && (
          <span className="flex items-center gap-1 text-[10px] font-bold text-blue-500 bg-blue-500/10 px-1.5 py-0.5 rounded-md animate-bounce" title="Water Requested">
            <Droplet className="h-3 w-3 fill-blue-500" />
          </span>
        )}
        {hasBillCall && (
          <span className="flex items-center gap-1 text-[10px] font-bold text-orange-500 bg-orange-500/10 px-1.5 py-0.5 rounded-md animate-pulse" title="Bill Requested">
            <Receipt className="h-3 w-3" />
          </span>
        )}
      </div>

      {/* Bottom Row: Status Badge & Timer */}
      <div className="flex items-center justify-between mt-2 pt-1 border-t border-border/30 text-xs">
        {isAvailable && (
          <span className="rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 px-2 py-0.5 text-[9px] font-bold tracking-wider uppercase">
            FREE
          </span>
        )}
        {isOccupied && (
          <span className="rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/20 px-2 py-0.5 text-[9px] font-bold tracking-wider uppercase">
            OCCUPIED
          </span>
        )}
        {isBillReq && (
          <span className="rounded-full bg-orange-500 text-white border border-orange-600 px-2 py-0.5 text-[9px] font-bold tracking-wider uppercase flex items-center gap-1">
            <Receipt className="h-2.5 w-2.5 animate-spin" /> BILL REQ
          </span>
        )}
        {isCleaning && (
          <span className="rounded-full bg-blue-500/15 text-blue-700 dark:text-blue-400 border border-blue-500/20 px-2 py-0.5 text-[9px] font-bold tracking-wider uppercase flex items-center gap-1">
            <Sparkles className="h-2.5 w-2.5" /> CLEANING
          </span>
        )}
        {isReserved && (
          <span className="rounded-full bg-purple-500/15 text-purple-700 dark:text-purple-400 border border-purple-500/20 px-2 py-0.5 text-[9px] font-bold tracking-wider uppercase flex items-center gap-1">
            <Bookmark className="h-2.5 w-2.5" /> RESERVED
          </span>
        )}
        {isOutOfService && (
          <span className="rounded-full bg-muted text-muted-foreground border border-border px-2 py-0.5 text-[9px] font-bold tracking-wider uppercase flex items-center gap-1">
            <AlertTriangle className="h-2.5 w-2.5" /> OUT OF SVC
          </span>
        )}

        {(isOccupied || isBillReq) && (
          <div className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground font-semibold">
            <Clock className="h-3 w-3" />
            <span>14m</span>
          </div>
        )}
      </div>
    </div>
  );
});
