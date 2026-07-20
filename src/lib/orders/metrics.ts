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

/**
 * Task 1, 2, 3, 4 & 6:
 * Calculates validated operational metrics strictly over active, un-stale orders.
 */
export function calculateOperationalSummary(orders: Order[]): OperationalSummaryModel {
  const now = Date.now();
  const maxOperationalAgeMs = 24 * 60 * 60 * 1000; // 24 hours demo data protection limit

  // Task 1, 2 & 3: Filter active orders with valid, realistic timestamps
  const activeOrders = orders.filter((o) => {
    // Must be an active status
    if (o.status !== "placed" && o.status !== "in_kitchen" && o.status !== "ready") {
      return false;
    }

    // Task 2: Validate timestamp
    if (!o.created_at) return false;
    const createdTime = new Date(o.created_at).getTime();
    if (isNaN(createdTime)) return false;

    const diffMs = now - createdTime;

    // Task 3: Ignore future timestamps or stale demo data (> 24h)
    if (diffMs < 0 || diffMs > maxOperationalAgeMs) {
      return false;
    }

    return true;
  });

  const activeCount = activeOrders.length;
  const occupiedTableSet = new Set(activeOrders.map((o) => o.table_id));
  const occupiedTablesCount = occupiedTableSet.size;

  // Task 6: Wording polish
  const activeOrdersText = activeCount === 1 ? "1 order" : `${activeCount} orders`;
  const occupiedTablesText = occupiedTablesCount === 1 ? "1 table occupied" : `${occupiedTablesCount} tables occupied`;

  // Scenario A: 0 active orders
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

  // Task 6: Exact integer minutes without approximation symbols (~8 mins -> 8 min)
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
