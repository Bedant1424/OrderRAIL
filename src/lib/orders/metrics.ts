import type { Order } from "@/lib/db";

/**
 * Live Operational Metrics Engine
 * Centralizes all active order wait calculations, demo data protection, and timestamp validation.
 */

export interface OperationalSummaryModel {
  activeCount: number;
  occupiedTablesCount: number;
  avgWaitMinsFormatted: string;
  longestWaitMinsFormatted: string;
  activeOrdersText: string;
  occupiedTablesText: string;
}

export function calculateOperationalSummary(orders: Order[]): OperationalSummaryModel {
  const now = Date.now();
  const maxOperationalAgeMs = 24 * 60 * 60 * 1000; // 24 hours demo data protection limit

  // Filter active orders (including pending, placed, in_kitchen, preparing, ready)
  const activeOrders = orders.filter((o) => {
    if (
      o.status !== "pending" &&
      o.status !== "placed" &&
      o.status !== "preparing" &&
      o.status !== "in_kitchen" &&
      o.status !== "ready"
    ) {
      return false;
    }

    if (!o.created_at) return false;
    const createdTime = new Date(o.created_at).getTime();
    if (isNaN(createdTime)) return false;

    const diffMs = now - createdTime;

    if (diffMs < 0 || diffMs > maxOperationalAgeMs) {
      return false;
    }

    return true;
  });

  const activeCount = activeOrders.length;
  const occupiedTableSet = new Set(activeOrders.map((o) => o.table_id));
  const occupiedTablesCount = occupiedTableSet.size;

  const activeOrdersText = activeCount === 1 ? "1 order" : `${activeCount} orders`;
  const occupiedTablesText = occupiedTablesCount === 1 ? "1 table occupied" : `${occupiedTablesCount} tables occupied`;

  if (activeCount === 0) {
    return {
      activeCount: 0,
      occupiedTablesCount: 0,
      avgWaitMinsFormatted: "—",
      longestWaitMinsFormatted: "—",
      activeOrdersText,
      occupiedTablesText
    };
  }

  let totalWaitMs = 0;
  let maxWaitMs = 0;

  for (const o of activeOrders) {
    const createdTime = new Date(o.created_at).getTime();
    const waitMs = Math.max(0, now - createdTime);
    totalWaitMs += waitMs;
    if (waitMs > maxWaitMs) {
      maxWaitMs = waitMs;
    }
  }

  const avgMins = Math.round((totalWaitMs / activeCount) / (1000 * 60));
  const maxMins = Math.round(maxWaitMs / (1000 * 60));

  const avgWaitMinsFormatted = avgMins === 1 ? "1 min" : `${avgMins} min`;
  const longestWaitMinsFormatted = maxMins >= 20 ? `${maxMins} min (Urgent)` : `${maxMins} min`;

  return {
    activeCount,
    occupiedTablesCount,
    avgWaitMinsFormatted,
    longestWaitMinsFormatted,
    activeOrdersText,
    occupiedTablesText
  };
}
