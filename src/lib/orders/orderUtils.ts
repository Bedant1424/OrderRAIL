import type { Order, OrderItem } from "@/lib/db";

/**
 * Shared Order Utilities, Aging Engine & Priority Calculations
 * Used across Owner Orders Hub, Staff KDS Dashboard, and Counter POS.
 */

export interface OrderStatusMeta {
  label: string;
  badgeStyle: string;
  columnTitle: string;
  columnHeaderBg: string;
}

export const ORDER_STATUS_MAP: Record<Order["status"], OrderStatusMeta> = {
  pending: {
    label: "Placed",
    badgeStyle: "bg-amber-500/10 text-amber-600 border-amber-500/20",
    columnTitle: "Incoming Orders",
    columnHeaderBg: "bg-amber-500/10 text-amber-700 border-amber-500/20"
  },
  preparing: {
    label: "Preparing",
    badgeStyle: "bg-orange-500/10 text-orange-600 border-orange-500/20",
    columnTitle: "Preparing",
    columnHeaderBg: "bg-orange-500/10 text-orange-700 border-orange-500/20"
  },
  ready: {
    label: "Ready",
    badgeStyle: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
    columnTitle: "Ready",
    columnHeaderBg: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20"
  },
  served: {
    label: "Served",
    badgeStyle: "bg-secondary text-muted-foreground border-border",
    columnTitle: "Today's Served",
    columnHeaderBg: "bg-secondary text-muted-foreground border-border"
  },
  cancelled: {
    label: "Cancelled",
    badgeStyle: "bg-destructive/10 text-destructive border-destructive/20",
    columnTitle: "Cancelled",
    columnHeaderBg: "bg-destructive/10 text-destructive border-destructive/20"
  }
};

export type AgingLevel = "normal" | "warning" | "urgent";

export interface AgingMeta {
  level: AgingLevel;
  badgeStyle: string;
  textClass: string;
  label: string;
}

/**
 * Task 1: Order Aging Indicator Thresholds:
 *   - Normal (0-10m): Green
 *   - Warning (10-20m): Amber
 *   - Urgent (20m+): Red
 */
export function getOrderAging(createdAt: string): AgingMeta {
  const diffMs = Date.now() - new Date(createdAt).getTime();
  const diffMins = Math.max(0, Math.floor(diffMs / (1000 * 60)));

  if (diffMins < 10) {
    return {
      level: "normal",
      badgeStyle: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
      textClass: "text-emerald-600 dark:text-emerald-400",
      label: "Normal"
    };
  }
  if (diffMins < 20) {
    return {
      level: "warning",
      badgeStyle: "bg-amber-500/10 text-amber-600 border-amber-500/20",
      textClass: "text-amber-600 dark:text-amber-400",
      label: "Delayed"
    };
  }
  return {
    level: "urgent",
    badgeStyle: "bg-destructive/10 text-destructive border-destructive/20 animate-pulse",
    textClass: "text-destructive font-bold",
    label: "Urgent"
  };
}

/**
 * Task 8: Order Priority Engine
 * Priority points based on:
 *   - Age > 15 mins (+2)
 *   - Special notes (+1)
 *   - High item count >= 4 (+1)
 */
export function getOrderPriority(order: Order & { order_items?: OrderItem[] }): {
  isHighPriority: boolean;
  score: number;
  reason?: string;
} {
  let score = 0;
  const diffMins = (Date.now() - new Date(order.created_at).getTime()) / (1000 * 60);
  const itemCount = (order.order_items ?? []).reduce((s, it) => s + it.qty, 0);

  if (diffMins >= 15) score += 2;
  if (order.notes?.trim()) score += 1;
  if (itemCount >= 4) score += 1;

  if (score >= 2) {
    let reason = "High priority";
    if (diffMins >= 20) reason = "Long wait time";
    else if (order.notes) reason = "Special notes";
    else if (itemCount >= 4) reason = "Large group order";

    return { isHighPriority: true, score, reason };
  }

  return { isHighPriority: false, score };
}

/**
 * Format relative elapsed time
 */
export function formatTimeElapsed(createdAt: string): string {
  const diffMs = Date.now() - new Date(createdAt).getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;

  const diffHours = Math.floor(diffMins / 60);
  const remainingMins = diffMins % 60;
  return `${diffHours}h ${remainingMins}m ago`;
}

export function isOrderActive(status: Order["status"]): boolean {
  return status === "pending" || status === "preparing" || status === "ready";
}

export function getNextOrderStatus(status: Order["status"]): Order["status"] | null {
  if (status === "pending") return "preparing";
  if (status === "preparing") return "ready";
  if (status === "ready") return "served";
  return null;
}
