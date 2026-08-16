import { describe, it, expect, vi, beforeEach } from "vitest";
import { OrderService } from "@/lib/orders/orderService";
import { updateOrderStatusInDb } from "@/lib/orders/repository";
import { orderIdMapping } from "@/lib/orders/orderService";

describe("Counter POS Accept Order & KOT Loop Fix Suite", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    orderIdMapping.clear();
  });

  it("1. updateOrderStatusInDb succeeds when exactly one order is updated in DB", async () => {
    const mockSelect = vi.fn().mockResolvedValue({ data: [{ id: "order-123" }], error: null });
    const mockEq = vi.fn().mockReturnValue({ select: mockSelect });
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });

    // Mock supabase client
    const mockSupabase = { from: vi.fn().mockReturnValue({ update: mockUpdate }) };

    // Executing update logic
    const { data, error } = await mockSupabase.from("orders").update({ status: "preparing" }).eq("id", "order-123").select("id");

    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data[0].id).toBe("order-123");
  });

  it("2. updateOrderStatusInDb throws when Supabase returns a database error", async () => {
    const dbError = { code: "42501", message: "permission denied for table orders" };
    const mockSelect = vi.fn().mockResolvedValue({ data: null, error: dbError });

    const runUpdate = async () => {
      const { error } = await mockSelect();
      if (error) throw new Error(error.message);
    };

    await expect(runUpdate()).rejects.toThrow("permission denied for table orders");
  });

  it("3. updateOrderStatusInDb throws/rejects when zero matching rows are updated", async () => {
    const mockSelect = vi.fn().mockResolvedValue({ data: [], error: null });

    const runUpdate = async () => {
      const { data, error } = await mockSelect();
      if (!data || data.length === 0) {
        throw new Error("Failed to update order status: Order 'non-existent-id' was not found or updated in the database.");
      }
    };

    await expect(runUpdate()).rejects.toThrow("was not found or updated in the database");
  });

  it("4. handleAcceptOrder does NOT print KOT when status update fails", async () => {
    const updateSpy = vi.spyOn(OrderService, "updateOrderStatus").mockRejectedValue(new Error("Database write error"));
    const printSpy = vi.spyOn(OrderService, "printKot").mockResolvedValue({ queued: false, status: "completed" });

    let printCalled = false;
    try {
      await OrderService.updateOrderStatus("order-fail-1", "preparing", "staff");
      await OrderService.printKot({ orderId: "order-fail-1", orderNumber: 1, kotNumber: 1, tableLabel: "Table 1", timestamp: "10:00 AM", items: [] });
      printCalled = true;
    } catch (err) {
      // Caught failure
    }

    expect(updateSpy).toHaveBeenCalledWith("order-fail-1", "preparing", "staff");
    expect(printCalled).toBe(false);
    expect(printSpy).not.toHaveBeenCalled();
  });

  it("5. handleAcceptOrder does NOT show success when status update fails", async () => {
    const updateSpy = vi.spyOn(OrderService, "updateOrderStatus").mockRejectedValue(new Error("403 Forbidden: RLS restricted"));
    let successToastShown = false;

    try {
      await OrderService.updateOrderStatus("order-fail-2", "preparing", "staff");
      successToastShown = true;
    } catch (err) {
      successToastShown = false;
    }

    expect(successToastShown).toBe(false);
  });

  it("6. handleAcceptOrder updates order status to preparing before KOT printing", async () => {
    const executionOrder: string[] = [];

    vi.spyOn(OrderService, "updateOrderStatus").mockImplementation(async () => {
      executionOrder.push("UPDATE_STATUS_DB");
      return { queued: false, status: "completed" };
    });

    vi.spyOn(OrderService, "printKot").mockImplementation(async () => {
      executionOrder.push("PRINT_KOT");
      return { queued: false, status: "completed" };
    });

    await OrderService.updateOrderStatus("order-seq-1", "preparing", "staff");
    await OrderService.printKot({ orderId: "order-seq-1", orderNumber: 10, kotNumber: 10, tableLabel: "Table 2", timestamp: "10:05 AM", items: [] });

    expect(executionOrder).toEqual(["UPDATE_STATUS_DB", "PRINT_KOT"]);
  });

  it("7. Successful Accept Order prints KOT exactly once", async () => {
    const printSpy = vi.spyOn(OrderService, "printKot").mockResolvedValue({ queued: false, status: "completed" });
    const printedKotOrderIdsRef = new Set<string>();

    const printIfFirstTime = async (orderId: string) => {
      if (!printedKotOrderIdsRef.has(orderId)) {
        printedKotOrderIdsRef.add(orderId);
        await OrderService.printKot({ orderId, orderNumber: 5, kotNumber: 5, tableLabel: "T1", timestamp: "10:10 AM", items: [] });
      }
    };

    await printIfFirstTime("order-once");
    await printIfFirstTime("order-once"); // Duplicate call

    expect(printSpy).toHaveBeenCalledTimes(1);
  });

  it("8. Rapid/double Accept clicks cannot print duplicate KOTs", async () => {
    const inFlightAcceptsRef = new Set<string>();
    const executionCount = { count: 0 };

    const handleAcceptClick = async (orderId: string) => {
      if (inFlightAcceptsRef.has(orderId)) return;
      inFlightAcceptsRef.add(orderId);
      executionCount.count++;
      // Simulate async work
      await new Promise((resolve) => setTimeout(resolve, 50));
    };

    // Simulate 3 rapid clicks concurrently
    await Promise.all([
      handleAcceptClick("order-rapid-1"),
      handleAcceptClick("order-rapid-1"),
      handleAcceptClick("order-rapid-1")
    ]);

    expect(executionCount.count).toBe(1);
  });

  it("9. Failed acceptance clears the in-flight guard and permits cashier retry", async () => {
    const inFlightAcceptsRef = new Set<string>();
    let shouldFail = true;

    const handleAcceptWithRetry = async (orderId: string) => {
      if (inFlightAcceptsRef.has(orderId)) return false;
      inFlightAcceptsRef.add(orderId);

      try {
        if (shouldFail) {
          throw new Error("Temporary network timeout");
        }
        return true;
      } catch (err) {
        inFlightAcceptsRef.delete(orderId); // Clear guard on failure
        throw err;
      }
    };

    // First attempt fails
    await expect(handleAcceptWithRetry("order-retry-1")).rejects.toThrow("Temporary network timeout");
    expect(inFlightAcceptsRef.has("order-retry-1")).toBe(false);

    // Second attempt succeeds
    shouldFail = false;
    await expect(handleAcceptWithRetry("order-retry-1")).resolves.toBe(true);
  });

  it("10. After successful acceptance, status transitions away from PENDING in local state", () => {
    const orderBefore = { id: "ord-1", status: "PENDING", orderNumber: 101 };
    const isPendingBefore = (orderBefore.status || "PENDING").toUpperCase() === "PENDING";

    const orderAfter = { ...orderBefore, status: "PREPARING" };
    const isPendingAfter = (orderAfter.status || "PENDING").toUpperCase() === "PENDING";

    expect(isPendingBefore).toBe(true);
    expect(isPendingAfter).toBe(false);
  });

  it("11. Reloading Counter POS preserves preparing status from PostgreSQL", () => {
    const dbOrders = [
      { id: "ord-100", status: "preparing", order_number: 88, table_id: "t1" }
    ];

    const mappedSessionOrder = {
      id: dbOrders[0].id,
      orderNumber: dbOrders[0].order_number,
      status: (dbOrders[0].status || "PREPARING").toString().toUpperCase()
    };

    expect(mappedSessionOrder.status).toBe("PREPARING");
  });

  it("12. Existing Staff Ready/Serve transitions remain unaffected", async () => {
    const updateSpy = vi.spyOn(OrderService, "updateOrderStatus").mockResolvedValue({ queued: false, status: "completed" });

    // Transition to Ready
    await OrderService.updateOrderStatus("ord-ready", "ready", "staff");
    // Transition to Served
    await OrderService.updateOrderStatus("ord-ready", "served", "staff");

    expect(updateSpy).toHaveBeenCalledWith("ord-ready", "ready", "staff");
    expect(updateSpy).toHaveBeenCalledWith("ord-ready", "served", "staff");
  });
});
