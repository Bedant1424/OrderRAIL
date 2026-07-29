import { describe, it, expect, beforeEach } from "vitest";
import { OrderService } from "../lib/orders/orderService";
import { enqueueOperation, getOperation, getAllOperations, clearAllOperations } from "../lib/offline/indexedDbQueue";
import { supabase } from "../lib/db";
import type { Operation } from "../lib/offline/types";

describe("Stale IndexedDB Operations Reconciliation & Automatic Deletion Suite", () => {
  beforeEach(async () => {
    await clearAllOperations();
  });

  it("1. IndexedDB Verification: Failed operation exists prior to reconciliation", async () => {
    const fakeOp: Operation = {
      operationId: "op-failed-test-101",
      operationType: "CREATE_ORDER",
      payload: {
        id: "temp-ord-9991",
        dining_session_id: "sess-table-1-uuid",
        table_id: "table-1-uuid",
        total_cents: 4500
      },
      createdAt: new Date().toISOString(),
      retryCount: 1,
      status: "Failed",
      error: "403 Forbidden"
    };

    await enqueueOperation(fakeOp);

    const fetched = await getOperation("op-failed-test-101");
    expect(fetched).not.toBeNull();
    expect(fetched?.status).toBe("Failed");
  });

  it("2. Reconciliation Execution: Deletes stale IndexedDB operation when PostgreSQL order exists for dining session", async () => {
    const sampleDbOrderId = "041bb055-484e-4163-bc7b-9f6c9d4bf537";
    const sampleSessionId = "sess-table-1-uuid";

    // Seed fake failed operation in IndexedDB
    const fakeOp: Operation = {
      operationId: "op-failed-stale-202",
      operationType: "CREATE_ORDER",
      payload: {
        id: "temp-ord-9992",
        dining_session_id: sampleSessionId,
        table_id: "table-1-uuid",
        total_cents: 4500
      },
      createdAt: new Date().toISOString(),
      retryCount: 1,
      status: "Failed",
      error: "Previous DB constraint error"
    };

    await enqueueOperation(fakeOp);

    // Verify operation is present before reconciliation
    const beforeOps = await getAllOperations();
    expect(beforeOps.some((o) => o.operationId === "op-failed-stale-202")).toBe(true);

    const originalFrom = supabase?.from ? supabase.from.bind(supabase) : undefined;
    if (supabase) {
      supabase.from = ((table: string) => {
        if (table === "orders") {
          return {
            select: () => ({
              or: () => Promise.resolve({
                data: [
                  {
                    id: sampleDbOrderId,
                    dining_session_id: sampleSessionId,
                    table_id: "table-1-uuid",
                    total_cents: 4500
                  }
                ],
                error: null
              })
            })
          } as any;
        }
        return originalFrom ? originalFrom(table) : ({} as any);
      }) as any;
    }

    try {
      // Execute reconciliation
      const queuedOrders = await OrderService.getQueuedOfflineOrders();

      // Show operation deleted from IndexedDB after reconciliation
      const afterOp = await getOperation("op-failed-stale-202");
      expect(afterOp).toBeNull();

      // Verify no queued orders returned with SYNC FAILED state
      expect(queuedOrders.some((o) => o.operationId === "op-failed-stale-202")).toBe(false);
      expect(queuedOrders.some((o) => o.syncState === "Sync Failed")).toBe(false);
    } finally {
      if (supabase && originalFrom) {
        supabase.from = originalFrom;
      }
    }
  });
});
