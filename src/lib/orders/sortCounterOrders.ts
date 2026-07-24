export interface OrderLike {
  id?: string;
  orderNumber?: number;
  createdAt?: string;
  timestamp?: string;
}

/**
 * Sorts counter orders such that the newest order appears first (descending by creation time).
 * Uses canonical ISO creation timestamp (e.g. `createdAt` / `created_at`), with fallbacks
 * for orderNumber and ID. Does not mutate the input array.
 */
export function sortCounterOrders<T extends OrderLike>(orders: T[]): T[] {
  return [...orders].sort((a, b) => {
    // 1. Primary: Compare canonical creation timestamp
    const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;

    if (timeA > 0 && timeB > 0 && timeA !== timeB) {
      return timeB - timeA; // Descending: Newest -> Oldest
    }

    // 2. Secondary fallback: Compare numeric order number descending
    const numA = a.orderNumber ?? 0;
    const numB = b.orderNumber ?? 0;
    if (numA !== numB) {
      return numB - numA;
    }

    // 3. Tertiary fallback: Deterministic ID comparison
    const idA = a.id ?? "";
    const idB = b.id ?? "";
    return idB.localeCompare(idA);
  });
}
