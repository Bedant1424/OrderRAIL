import { cn } from "@/lib/utils";
import { Users, Clock, Receipt, CheckCircle2 } from "lucide-react";

export type TableState = "free" | "occupied" | "bill_requested";

export interface TableCardData {
  id: string;
  label: string;
  seats: number;
  status: TableState;
  elapsedTime?: string;
  itemsCount?: number;
  totalAmount?: number;
  sessionCode?: string;
}

interface TableCardProps {
  table: TableCardData;
  isSelected?: boolean;
  onSelect?: (table: TableCardData) => void;
}

export function TableCard({ table, isSelected = false, onSelect }: TableCardProps) {
  const isFree = table.status === "free";
  const isOccupied = table.status === "occupied";
  const isBillReq = table.status === "bill_requested";

  return (
    <div
      onClick={() => onSelect?.(table)}
      className={cn(
        "group relative flex flex-col justify-between rounded-2xl p-3.5 transition-all duration-150 cursor-pointer select-none border shadow-soft hover:shadow-float active:scale-[0.98]",
        isFree && "bg-card border-emerald-500/30 hover:border-emerald-500/60 dark:border-emerald-500/20",
        isOccupied && "bg-amber-500/5 border-amber-500/40 hover:border-amber-500/70 dark:border-amber-500/30",
        isBillReq && "bg-orange-500/10 border-orange-500/60 animate-pulse hover:border-orange-500 dark:border-orange-500/40",
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

        {/* Status Badge */}
        {isFree && (
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
      </div>

      {/* Middle Row: Seat Count & Timers / Items */}
      <div className="my-2.5 flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-1 font-medium">
          <Users className="h-3.5 w-3.5 text-muted-foreground/70" />
          <span>{table.seats} Seats</span>
        </div>

        {!isFree && table.elapsedTime && (
          <div className="flex items-center gap-1 font-mono text-[11px] text-amber-700 dark:text-amber-400 font-semibold">
            <Clock className="h-3 w-3" />
            <span>{table.elapsedTime}</span>
          </div>
        )}
      </div>

      {/* Bottom Action / Summary Bar */}
      <div className="pt-2 border-t border-border/40 flex items-center justify-between text-xs">
        {isFree ? (
          <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 group-hover:underline">
            + Open Table
          </span>
        ) : (
          <div className="flex items-center justify-between w-full font-mono text-[11px]">
            <span className="text-muted-foreground font-medium">
              {table.itemsCount ?? 0} items
            </span>
            <span className="font-bold text-foreground">
              ${(table.totalAmount ?? 0).toFixed(2)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
