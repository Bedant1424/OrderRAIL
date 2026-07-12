import type { OrderStatus, OrderItemStatus } from "@/lib/db";

/**
 * Roll up order items status to order status.
 * Rules:
 * - If every active item is Served -> Order becomes Served.
 * - If every active item is Cancelled -> Order becomes Cancelled.
 * - Otherwise -> Order remains active (or returns to active if previously served/cancelled).
 */
export function rollupOrderStatus(
  items: { status: OrderItemStatus }[],
  currentOrderStatus: OrderStatus
): OrderStatus {
  if (items.length === 0) {
    return currentOrderStatus;
  }

  const totalCount = items.length;
  const cancelledCount = items.filter((i) => i.status === "cancelled").length;
  const servedCount = items.filter((i) => i.status === "served").length;

  if (cancelledCount === totalCount) {
    return "cancelled";
  }

  const activeCount = totalCount - cancelledCount;
  if (servedCount === activeCount) {
    return "served";
  }

  // Otherwise, order remains active (pending, preparing, ready).
  // If it was previously served or cancelled and now has active/preparing items, return preparing.
  if (currentOrderStatus === "served" || currentOrderStatus === "cancelled") {
    return "preparing";
  }

  return currentOrderStatus;
}
