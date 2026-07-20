import type { Order } from "@/lib/db";

/**
 * Shared Order Utilities & Status Pipeline Engine
 * Used across Owner Orders Hub, Staff KDS Dashboard, and future Counter POS.
 */

export interface OrderStatusMeta {
  label: string;
  badgeStyle: string;
  columnTitle: string;
  columnHeaderBg: string;
}

export const ORDER_STATUS_MAP: Record<Order["status"], OrderStatusMeta> = {
  placed: {
    label: "Placed",
    badgeStyle: "bg-blue-500/10 text-blue-600 border-blue-500/20",
    columnTitle: "New Orders",
    columnHeaderBg: "bg-blue-500/10 text-blue-700 border-blue-500/20"
  },
  in_kitchen: {
    label: "Cooking",
    badgeStyle: "bg-amber-500/10 text-amber-600 border-amber-500/20",
    columnTitle: "Preparing",
    columnHeaderBg: "bg-amber-500/10 text-amber-700 border-amber-500/20"
  },
  ready: {
    label: "Ready",
    badgeStyle: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
    columnTitle: "Ready for Pickup",
    columnHeaderBg: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20"
  },
  served: {
    label: "Served",
    badgeStyle: "bg-secondary text-muted-foreground border-border",
    columnTitle: "Served / Done",
    columnHeaderBg: "bg-secondary text-muted-foreground border-border"
  },
  cancelled: {
    label: "Cancelled",
    badgeStyle: "bg-destructive/10 text-destructive border-destructive/20",
    columnTitle: "Cancelled",
    columnHeaderBg: "bg-destructive/10 text-destructive border-destructive/20"
  }
};

/**
 * Format relative elapsed time (e.g. "2m ago", "45m ago", "1h 10m ago")
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

/**
 * Returns true if the order is currently active (placed, in_kitchen, or ready)
 */
export function isOrderActive(status: Order["status"]): boolean {
  return status === "placed" || status === "in_kitchen" || status === "ready";
}

/**
 * Returns the logical next status step in the restaurant pipeline
 */
export function getNextOrderStatus(status: Order["status"]): Order["status"] | null {
  if (status === "placed") return "in_kitchen";
  if (status === "in_kitchen") return "ready";
  if (status === "ready") return "served";
  return null;
}
