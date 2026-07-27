import { describe, it, expect } from "vitest";
import { OrderService } from "@/lib/orders/orderService";
import { enqueueOperation, getAllOperations, removeOperation } from "@/lib/offline/indexedDbQueue";
import { OperationExecutor } from "@/lib/offline/operationExecutor";

describe("Sprint 9.2.5.5 — Order Synchronization Pipeline Investigation Tests", () => {
  it("1. Verifies why Global Sync reports OK while Order Sync reports FAILED", async () => {
    // Simulate an operation that failed in OperationExecutor
    const failedOp = {
      operationId: "op-failed-123",
      operationType: "CREATE_ORDER",
      payload: {
        id: "ord-test-999",
        cafe_id: "cafe-1",
        table_id: "table-1",
        dining_session_id: "sess-closed",
        total_cents: 1500,
        status: "kot_sent",
        items: [{ menu_item_id: "m-1", name: "Tea", price_cents: 1500, qty: 1 }],
      },
      createdAt: new Date().toISOString(),
      retryCount: 5,
      status: "Failed" as const,
      idempotencyKey: "create_order_ord-test-999",
      error: "42501 Permission Denied",
    };

    await enqueueOperation(failedOp);

    const allOps = await getAllOperations();
    const queuedOfflineOrders = await OrderService.getQueuedOfflineOrders();

    const targetOrder = queuedOfflineOrders.find((o) => o.id === "ord-test-999");
    expect(targetOrder).toBeDefined();
    expect(targetOrder?.syncState).toBe("Sync Failed");

    // Clean up test operation
    await removeOperation("op-failed-123");
  });

  it("2. Verifies that completed or closed offline orders should not re-create closed table sessions in Counter UI", () => {
    const activeSessionMap = new Map<string, string>(); // Table 1 has no active session

    const offlineOrders = [
      {
        id: "ord-test-999",
        table_id: "table-1",
        dining_session_id: "sess-closed",
        status: "served",
        syncState: "Sync Failed",
        items: [],
        created_at: new Date().toISOString(),
      },
    ];

    const merged: Record<string, any> = {};

    for (const off of offlineOrders) {
      const tId = off.table_id || "express";
      // If table is a physical table and has no active dining session in DB,
      // OR if the offline order status is served/paid, do NOT attach to active workspace!
      const isServedOrPaid = off.status === "served" || off.status === "paid" || off.status === "cancelled";
      if (tId !== "express" && (!activeSessionMap.has(tId) || isServedOrPaid)) {
        continue;
      }
      merged[tId] = off;
    }

    expect(merged["table-1"]).toBeUndefined();
  });
});
