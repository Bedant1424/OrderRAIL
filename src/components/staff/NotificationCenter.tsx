import * as React from "react";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ShoppingBag, 
  Edit2, 
  CheckCircle2, 
  XCircle, 
  Droplet, 
  Receipt, 
  HandPlatter, 
  HelpCircle, 
  Trash2, 
  X 
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface NotificationItem {
  id: string;
  type: 
    | "new_order"
    | "updated_order"
    | "cancelled_order"
    | "completed_order"
    | "need_water"
    | "need_bill"
    | "call_waiter"
    | "general_request";
  title: string;
  description: string;
  timestamp: string; // ISO string
  relatedId: string; // e.g. orderId or serviceRequestId
  relatedType: "order" | "service_request";
  read?: boolean;
}

interface NotificationCenterProps {
  notifications: NotificationItem[];
  onClose: () => void;
  onDismiss: (id: string) => void;
  onClearAll: () => void;
  onNotificationClick: (item: NotificationItem) => void;
}

function formatRelativeTime(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);

  if (diffSec < 10) return "Just now";
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

const TYPE_CONFIG: Record<
  NotificationItem["type"],
  {
    icon: React.ComponentType<{ className?: string }>;
    colorClass: string; // text, bg
  }
> = {
  new_order: {
    icon: ShoppingBag,
    colorClass: "text-success bg-success/8",
  },
  updated_order: {
    icon: Edit2,
    colorClass: "text-blue-500 bg-blue-500/8",
  },
  cancelled_order: {
    icon: XCircle,
    colorClass: "text-destructive bg-destructive/8",
  },
  completed_order: {
    icon: CheckCircle2,
    colorClass: "text-success bg-success/8",
  },
  need_water: {
    icon: Droplet,
    colorClass: "text-warning bg-warning/8",
  },
  need_bill: {
    icon: Receipt,
    colorClass: "text-warning bg-warning/8",
  },
  call_waiter: {
    icon: HandPlatter,
    colorClass: "text-warning bg-warning/8",
  },
  general_request: {
    icon: HelpCircle,
    colorClass: "text-muted-foreground bg-muted/50",
  },
};

export function NotificationCenter({
  notifications,
  onClose,
  onDismiss,
  onClearAll,
  onNotificationClick,
}: NotificationCenterProps) {
  // Trigger relative time recalculation
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 10000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex flex-col text-card-foreground">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/50 px-4 py-3 bg-muted/5">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-accent animate-pulse" />
          <h3 className="font-display text-sm font-semibold">Notifications</h3>
        </div>
        <div className="flex items-center gap-3">
          {notifications.length > 0 && (
            <button
              onClick={onClearAll}
              className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-destructive transition active:scale-95"
            >
              <Trash2 className="h-3 w-3" /> Clear all
            </button>
          )}
          <button
            onClick={onClose}
            className="grid h-6 w-6 place-items-center rounded-full bg-secondary/80 text-muted-foreground hover:bg-secondary hover:text-foreground transition active:scale-95"
            aria-label="Close panel"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* List */}
      <div className="max-h-[380px] overflow-y-auto p-1.5 scrollbar-thin">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
            <div className="grid h-10 w-10 place-items-center rounded-full bg-muted/40 text-muted-foreground mb-2">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <p className="text-xs font-medium text-foreground">All caught up</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">No notifications today.</p>
          </div>
        ) : (
          <div className="space-y-0.5 overflow-x-hidden">
            <AnimatePresence initial={false}>
              {notifications.map((n) => {
                const config = TYPE_CONFIG[n.type] || TYPE_CONFIG.general_request;
                const Icon = config.icon;
                return (
                  <motion.div
                    key={n.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: 200, height: 0 }}
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    drag="x"
                    dragConstraints={{ left: 0, right: 0 }}
                    dragElastic={{ left: 0.5, right: 0.5 }}
                    onDragEnd={(_, info) => {
                      if (Math.abs(info.offset.x) > 80) {
                        onDismiss(n.id);
                      }
                    }}
                    onClick={() => onNotificationClick(n)}
                    className={cn(
                      "group relative flex items-start gap-3 rounded-xl p-2.5 cursor-pointer select-none",
                      "hover:bg-muted/30 transition duration-150 active:scale-[0.99] touch-pan-y"
                    )}
                  >
                    {/* Icon container */}
                    <div className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-xl", config.colorClass)}>
                      <Icon className="h-4.5 w-4.5" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 pr-4">
                      <div className="flex items-center gap-1.5">
                        <p className={cn("text-xs font-semibold text-foreground leading-snug truncate", !n.read && "font-bold")}>
                          {n.title}
                        </p>
                        {!n.read && (
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-normal mt-0.5 break-words">
                        {n.description}
                      </p>
                      <p className="text-[9px] text-muted-foreground/80 mt-1 tabular-nums">
                        {formatRelativeTime(n.timestamp)}
                      </p>
                    </div>

                    {/* Individual close button (shows on hover for desktop) */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDismiss(n.id);
                      }}
                      className={cn(
                        "absolute right-2 top-2.5 grid h-5 w-5 place-items-center rounded-full bg-secondary/60 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition",
                        "opacity-0 group-hover:opacity-100 lg:opacity-0 active:scale-90"
                      )}
                      aria-label="Dismiss notification"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
