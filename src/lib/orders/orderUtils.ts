import type { Order, OrderItem } from "@/lib/db";

/**
 * Shared Order Utilities & Status Maps
 * Unified between Staff Console & Owner Operations Center
 */

export interface OrderStatusMeta {
  label: string;
  badgeStyle: string;
  columnTitle: string;
  columnHeaderBg: string;
}

export const ORDER_STATUS_MAP: Record<Order["status"], OrderStatusMeta> = {
  pending: {
    label: "Incoming",
    badgeStyle: "bg-amber-500/10 text-amber-600 border-amber-500/20",
    columnTitle: "Incoming",
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
    columnTitle: "Completed Today",
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

export function getOrderPriority(order: Order & { order_items?: OrderItem[] }): {
  isHighPriority: boolean;
  score: number;
  reason?: string;
} {
  let score = 0;
  const diffMins = (Date.now() - new Date(order.created_at).getTime()) / (1000 * 60);
  const itemCount = (order.order_items ?? []).reduce((s, it) => s + it.qty, 0);

  if (diffMins >= 15) score += 2;
  if ((order.note || (order as any).notes)?.trim()) score += 1;
  if (itemCount >= 4) score += 1;

  if (score >= 2) {
    let reason = "High priority";
    if (diffMins >= 20) reason = "Long wait time";
    else if (order.note || (order as any).notes) reason = "Special notes";
    else if (itemCount >= 4) reason = "Large group order";

    return { isHighPriority: true, score, reason };
  }

  return { isHighPriority: false, score };
}

export function formatTimeElapsed(createdAt: string): string {
  const diffMs = Date.now() - new Date(createdAt).getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins} min`;

  const diffHours = Math.floor(diffMins / 60);
  const remainingMins = diffMins % 60;
  return `${diffHours}h ${remainingMins}m`;
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

/**
 * Computes daily sequence numbers for a list of orders.
 * Orders are grouped by local calendar date (YYYY-MM-DD), sorted chronologically by created_at,
 * and assigned sequential numbers starting from 1 for each date.
 * Returns a Map mapping order.id to its daily sequence number.
 */
export function computeDailyOrderNumbers<T extends { id?: string; created_at?: string; order_number?: number }>(
  orders?: T[] | null
): Map<string, number> {
  const resultMap = new Map<string, number>();
  if (!orders || !Array.isArray(orders) || orders.length === 0) return resultMap;

  // Group by date string YYYY-MM-DD
  const groupsByDate = new Map<string, T[]>();

  for (const order of orders) {
    if (!order || typeof order !== "object") continue;
    const ordId = order.id || "";
    if (!ordId) continue;

    if (!order.created_at) {
      resultMap.set(ordId, order.order_number ?? 1);
      continue;
    }

    const d = new Date(order.created_at);
    if (isNaN(d.getTime())) {
      resultMap.set(ordId, order.order_number ?? 1);
      continue;
    }
    const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const list = groupsByDate.get(dateKey) || [];
    list.push(order);
    groupsByDate.set(dateKey, list);
  }

  // Sort each date group chronologically (oldest first) and assign daily 1-indexed counter
  for (const list of groupsByDate.values()) {
    list.sort((a, b) => {
      const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
      if (timeA !== timeB) return timeA - timeB;
      const idA = a.id ? String(a.id) : "";
      const idB = b.id ? String(b.id) : "";
      return idA.localeCompare(idB);
    });

    list.forEach((order, index) => {
      if (order.id) {
        resultMap.set(order.id, index + 1);
      }
    });
  }

  return resultMap;
}

/**
 * Formats a display order number as a standard label string (e.g. "#1", "#2").
 */
export function formatOrderDisplayNumber(num?: number | null): string {
  if (num == null || isNaN(num)) return "#1";
  return `#${num}`;
}

/**
 * Resolves the unified backend-assigned daily display number label for an order.
 * Display-only frontend helper.
 */
export function formatOrderLabelUnified<T extends { daily_order_number?: number | null; order_number?: number | null }>(
  order?: T | null,
  dailyMap?: Map<string, number> | null
): string {
  if (!order) return "#1";
  const num = order.daily_order_number ?? (dailyMap && (order as any).id ? dailyMap.get((order as any).id) : undefined) ?? order.order_number ?? 1;
  return `#${num}`;
}

/**
 * Formats an invoice number string (e.g. "INV-000001").
 */
export function formatInvoiceNumber(invNum?: string | null): string {
  if (!invNum) return "N/A";
  return invNum;
}

export type OrderLane = "incoming" | "preparing" | "ready" | "completed" | "cancelled" | "history";

/**
 * Shared Authoritative Order Sorting Engine.
 * - Incoming, Preparing, Ready: Oldest first (FIFO queue for kitchen & service).
 * - Completed, Cancelled, History: Newest first (Sales ledger & historical view).
 * - Tie-breaker: creation timestamp comparison, then deterministic UUID string comparison.
 */
export function sortOrdersByLane<T extends { id?: string; created_at?: string; order_number?: number }>(
  orders?: T[] | null,
  lane: OrderLane = "incoming"
): T[] {
  if (!orders || !Array.isArray(orders) || orders.length === 0) return [];
  const list = orders.filter((o): o is T => o != null && typeof o === "object");

  if (lane === "incoming" || lane === "preparing" || lane === "ready") {
    return list.sort((a, b) => {
      const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
      if (timeA !== timeB) return timeA - timeB;
      const idA = a.id ? String(a.id) : "";
      const idB = b.id ? String(b.id) : "";
      return idA.localeCompare(idB);
    });
  } else {
    return list.sort((a, b) => {
      const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
      if (timeA !== timeB) return timeB - timeA;
      const idA = a.id ? String(a.id) : "";
      const idB = b.id ? String(b.id) : "";
      return idB.localeCompare(idA);
    });
  }
}
