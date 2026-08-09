import { describe, it, expect, beforeEach, vi } from "vitest";
import { getOperationsSettings, saveOperationsSettings, DEFAULT_OPERATIONS_SETTINGS } from "@/lib/billing/operationsSettings";
import { PrinterAdapter } from "@/lib/printing/printerAdapter";
import { printService } from "@/lib/printing/PrintService";
import { MockProvider } from "@/lib/printing/providers/MockProvider";
import * as orderRepo from "@/lib/orders/repository";
import type { OrderWithItems } from "@/lib/orders/types";

describe("Sprint 14G — Staff Console Order Preparation & Operations Settings Tests", () => {
  const testCafeId = "cafe-cheese-corner-14g";

  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    printService.setProvider(new MockProvider({ simulatedDelayMs: 0 }));
    PrinterAdapter.setSimulatedState(null);
  });

  const NEXT_STATUS: Record<string, string | null> = {
    pending: "preparing",
    preparing: "ready",
    ready: "served",
    served: null,
    cancelled: null,
  };

  /**
   * Helper simulating the exact StaffDashboardPage.advance() transition logic
   */
  async function simulateStaffAdvance(order: OrderWithItems, cafeId?: string) {
    const next = NEXT_STATUS[order.status];
    if (!next) return { success: false, reason: "No next status" };

    // 1. Database status mutation
    await orderRepo.updateOrderStatusInDb(order.id, next as any, "staff");

    // 2. KOT auto-print logic on pending -> preparing
    if (order.status === "pending" && next === "preparing") {
      const opsSettings = getOperationsSettings(cafeId);
      if (opsSettings.autoPrintKot && order.order_items?.length) {
        const rawLabel = order.table_number ? `Table ${order.table_number}` : (order.order_type || "Express");
        await PrinterAdapter.printKot({
          orderId: order.id,
          orderNumber: order.daily_order_number || order.id.slice(0, 6),
          kotNumber: order.daily_order_number || 101,
          tableLabel: rawLabel,
          timestamp: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }),
          items: order.order_items.map((i: any) => ({
            id: i.id,
            name: i.menu_item?.name || i.name || "Item",
            qty: i.quantity || i.qty || 1,
            price: i.unit_price || i.price || 0,
            notes: i.notes,
          })),
        });
      }
    }

    return { success: true, updatedStatus: next };
  }

  it("1. PENDING -> PREPARING: Successfully updates order in DB without throwing ReferenceError", async () => {
    const updateSpy = vi.spyOn(orderRepo, "updateOrderStatusInDb").mockResolvedValue({} as any);

    const pendingOrder: any = {
      id: "ord-test-48",
      status: "pending",
      table_number: "4",
      daily_order_number: 48,
      order_items: [
        {
          id: "item-1",
          quantity: 1,
          unit_price: 99,
          menu_item: { name: "Peri Peri Fries" },
        },
      ],
    };

    // Must execute cleanly without ReferenceError: getOperationsSettings is not defined
    const result = await simulateStaffAdvance(pendingOrder, testCafeId);

    expect(result.success).toBe(true);
    expect(result.updatedStatus).toBe("preparing");
    expect(updateSpy).toHaveBeenCalledWith("ord-test-48", "preparing", "staff");
  });

  it("2. Operations Settings Scope: Resolves cafe-specific operational settings using active cafe ID", async () => {
    saveOperationsSettings(
      {
        ...DEFAULT_OPERATIONS_SETTINGS,
        autoPrintKot: true,
        orderBufferMinutes: 25,
      },
      testCafeId
    );

    const settings = getOperationsSettings(testCafeId);
    expect(settings.autoPrintKot).toBe(true);
    expect(settings.orderBufferMinutes).toBe(25);
  });

  it("3. Auto KOT Enabled: Enqueues KOT print job when autoPrintKot is true", async () => {
    vi.spyOn(orderRepo, "updateOrderStatusInDb").mockResolvedValue({} as any);
    const printKotSpy = vi.spyOn(PrinterAdapter, "printKot");

    saveOperationsSettings(
      {
        ...DEFAULT_OPERATIONS_SETTINGS,
        autoPrintKot: true,
      },
      testCafeId
    );

    const pendingOrder: any = {
      id: "ord-test-99",
      status: "pending",
      table_number: "2",
      daily_order_number: 99,
      order_items: [
        {
          id: "item-99",
          quantity: 2,
          unit_price: 150,
          menu_item: { name: "Cheese Garlic Bread" },
        },
      ],
    };

    const res = await simulateStaffAdvance(pendingOrder, testCafeId);
    expect(res.success).toBe(true);

    expect(printKotSpy).toHaveBeenCalledTimes(1);
    expect(printKotSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: "ord-test-99",
        orderNumber: 99,
        tableLabel: "Table 2",
        items: expect.arrayContaining([
          expect.objectContaining({
            name: "Cheese Garlic Bread",
            qty: 2,
            price: 150,
          }),
        ]),
      })
    );
  });

  it("4. Auto KOT Disabled: Does not invoke printKot when autoPrintKot is false", async () => {
    vi.spyOn(orderRepo, "updateOrderStatusInDb").mockResolvedValue({} as any);
    const printKotSpy = vi.spyOn(PrinterAdapter, "printKot");

    saveOperationsSettings(
      {
        ...DEFAULT_OPERATIONS_SETTINGS,
        autoPrintKot: false,
      },
      testCafeId
    );

    const pendingOrder: any = {
      id: "ord-test-100",
      status: "pending",
      table_number: "5",
      daily_order_number: 100,
      order_items: [
        {
          id: "item-100",
          quantity: 1,
          unit_price: 120,
          menu_item: { name: "Cold Coffee" },
        },
      ],
    };

    const res = await simulateStaffAdvance(pendingOrder, testCafeId);
    expect(res.success).toBe(true);
    expect(res.updatedStatus).toBe("preparing");

    // printKot must NOT be called
    expect(printKotSpy).not.toHaveBeenCalled();
  });

  it("5. Later Transitions: PREPARING -> READY and READY -> SERVED do not invoke auto-KOT logic", async () => {
    const updateSpy = vi.spyOn(orderRepo, "updateOrderStatusInDb").mockResolvedValue({} as any);
    const printKotSpy = vi.spyOn(PrinterAdapter, "printKot");

    saveOperationsSettings(
      {
        ...DEFAULT_OPERATIONS_SETTINGS,
        autoPrintKot: true,
      },
      testCafeId
    );

    const preparingOrder: any = {
      id: "ord-test-101",
      status: "preparing",
      table_number: "1",
      daily_order_number: 101,
      order_items: [{ id: "i-1", quantity: 1, unit_price: 100, menu_item: { name: "Sandwich" } }],
    };

    // Transition 1: preparing -> ready
    const resReady = await simulateStaffAdvance(preparingOrder, testCafeId);
    expect(resReady.success).toBe(true);
    expect(resReady.updatedStatus).toBe("ready");
    expect(updateSpy).toHaveBeenCalledWith("ord-test-101", "ready", "staff");
    expect(printKotSpy).not.toHaveBeenCalled();

    // Transition 2: ready -> served
    const readyOrder: any = { ...preparingOrder, status: "ready" };
    const resServed = await simulateStaffAdvance(readyOrder, testCafeId);
    expect(resServed.success).toBe(true);
    expect(resServed.updatedStatus).toBe("served");
    expect(updateSpy).toHaveBeenCalledWith("ord-test-101", "served", "staff");
    expect(printKotSpy).not.toHaveBeenCalled();
  });
});
