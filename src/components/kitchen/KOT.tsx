import React from 'react';
import { KitchenTicket, KitchenStatus } from '@/lib/kitchen/types';
import { PriorityEngine } from '@/lib/kitchen/priorityEngine';
import { cn } from '@/lib/utils';
import { Clock, CheckCircle2, Printer, Utensils, Check, Play } from 'lucide-react';

export interface KotProps {
  ticket: KitchenTicket;
  nowMs?: number;
  className?: string;
  onStatusChange?: (ticketId: string, nextStatus: KitchenStatus) => void;
  onPrintKot?: (ticket: KitchenTicket) => void;
}

export const KOT: React.FC<KotProps> = ({
  ticket,
  nowMs = Date.now(),
  className,
  onStatusChange,
  onPrintKot,
}) => {
  const priority = PriorityEngine.getPriority(ticket.createdAtMs, nowMs);
  const elapsedTimeStr = PriorityEngine.formatElapsedTime(ticket.createdAtMs, nowMs);

  const priorityStyles: Record<string, string> = {
    NORMAL: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30',
    HIGH: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30',
    URGENT: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/30',
    CRITICAL: 'bg-rose-500/20 text-rose-600 dark:text-rose-400 border-rose-500/40 animate-pulse font-extrabold',
  };

  const statusBadgeStyles: Record<KitchenStatus, string> = {
    NEW: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
    PREPARING: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30',
    READY: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/30',
    SERVED: 'bg-muted text-muted-foreground border-border',
  };

  const totalItemsCount = ticket.items.reduce((acc, i) => acc + i.qty, 0);

  return (
    <div
      className={cn(
        'w-full max-w-sm bg-card text-card-foreground p-4 rounded-2xl border border-border/70 shadow-md font-sans text-xs flex flex-col justify-between gap-3 transition-all select-none',
        priority === 'CRITICAL' && 'border-rose-500/60 ring-2 ring-rose-500/20',
        className
      )}
    >
      {/* 1. KOT HEADER */}
      <div className="flex flex-col gap-2 border-b border-border/40 pb-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 font-mono font-extrabold text-sm text-foreground">
            <Utensils className="w-4 h-4 text-primary" />
            <span>KOT #{ticket.orderNumber}</span>
          </div>
          <div className="flex items-center gap-1.5">
            {/* Priority Badge */}
            <span
              className={cn(
                'px-2 py-0.5 rounded-full border text-[10px] uppercase font-bold tracking-wider',
                priorityStyles[priority]
              )}
            >
              {priority}
            </span>
            {/* Status Badge */}
            <span
              className={cn(
                'px-2 py-0.5 rounded-full border text-[10px] uppercase font-bold tracking-wider',
                statusBadgeStyles[ticket.status]
              )}
            >
              {ticket.status}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span className="font-extrabold text-foreground text-xs">{ticket.tableLabel}</span>
          <span className="font-mono">{ticket.orderType}</span>
          <span className="flex items-center gap-1 font-mono font-bold text-foreground bg-muted/40 px-2 py-0.5 rounded-lg border border-border/30">
            <Clock className="w-3 h-3 text-primary" /> {elapsedTimeStr}
          </span>
        </div>
      </div>

      {/* 2. ORDERED KITCHEN ITEMS */}
      <div className="flex flex-col gap-2 py-1 flex-1">
        <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider border-b border-border/30 pb-1">
          Items ({totalItemsCount})
        </div>
        {ticket.items.map((item, idx) => (
          <div key={item.id || idx} className="flex flex-col gap-0.5 py-1 border-b border-border/20 last:border-0">
            <div className="flex items-baseline justify-between">
              <span className="font-extrabold text-sm text-foreground pr-2 leading-tight">
                {item.name}
              </span>
              <span className="font-mono font-black text-base text-primary shrink-0">
                ×{item.qty}
              </span>
            </div>
            {item.notes && (
              <span className="text-[11px] italic font-medium text-amber-600 dark:text-amber-400 pl-2 border-l-2 border-amber-500 mt-0.5">
                Note: {item.notes}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* 3. KOT FOOTER & ACTIONS */}
      <div className="flex flex-col gap-2 pt-2 border-t border-border/40">
        <div className="flex items-center justify-between text-[10px] text-muted-foreground font-medium">
          <span>Time: {ticket.timestamp}</span>
          <span>{totalItemsCount} {totalItemsCount === 1 ? 'item' : 'items'}</span>
        </div>

        <div className="flex items-center gap-1.5">
          {ticket.status === 'NEW' && onStatusChange && (
            <button
              onClick={() => onStatusChange(ticket.id, 'PREPARING')}
              className="flex-1 h-9 rounded-xl bg-amber-500 text-amber-950 font-bold text-xs flex items-center justify-center gap-1.5 hover:bg-amber-400 transition"
            >
              <Play className="w-3.5 h-3.5 fill-current" /> Start Preparing
            </button>
          )}

          {ticket.status === 'PREPARING' && onStatusChange && (
            <button
              onClick={() => onStatusChange(ticket.id, 'READY')}
              className="flex-1 h-9 rounded-xl bg-emerald-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 hover:bg-emerald-500 transition"
            >
              <CheckCircle2 className="w-3.5 h-3.5" /> Mark Ready
            </button>
          )}

          {ticket.status === 'READY' && onStatusChange && (
            <button
              onClick={() => onStatusChange(ticket.id, 'SERVED')}
              className="flex-1 h-9 rounded-xl bg-primary text-primary-foreground font-bold text-xs flex items-center justify-center gap-1.5 hover:bg-primary/90 transition"
            >
              <Check className="w-3.5 h-3.5" /> Mark Served
            </button>
          )}

          {onPrintKot && (
            <button
              onClick={() => onPrintKot(ticket)}
              className="h-9 px-3 rounded-xl border border-border bg-muted/30 hover:bg-muted text-foreground font-bold text-xs flex items-center justify-center gap-1 transition"
              title="Print KOT Ticket"
            >
              <Printer className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
