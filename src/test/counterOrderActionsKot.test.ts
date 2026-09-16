import { describe, it, expect, beforeEach, vi } from "vitest";
import { supabase } from "@/lib/db";
import { CounterOrderActionService } from "@/windows-pos/services/counterOrderActionService";
import { generateCounterKot } from "@/windows-pos/services/counterKotService";
import { MockCounterPrinter } from "@/windows-pos/services/printer/counterPrinter";
import type { CounterOrder } from "@/windows-pos/types/counterTypes";

vi.mock("@/lib/db", async () => {
  const actual = await vi.importActual<typeof import("@/lib/db")>("@/lib/db");
  return {
    ...actual,
    supabase: {
      from: vi.fn(),
    },
  };
});

describe("Counter Order Actions & KOT Pipeline Tests", () => {
  let mockPrinter: MockCounterPrinter;
  let capturedUpdates: { table: string; payload: any; filterId?: string }[] = [];

  const samplePendingOrder: CounterOrder = {
    id: "ord-999-uuid",
    orderNumber: 105,
    tableId: "table-4-uuid",
    diningSessionId: "sess-4-uuid",
    status: "pending",
    orderSource: "DINE_IN",
    createdAt: "2026-09-16T09:30:00.000Z",
    totalCents: 5200,
    customerName: "Rahul Sharma",
    customerPhone: "+919876543210",
    note: "Do not add coriander",
    items: [
      {
        id: "item-1",
        name: "Veg Cheese Burger",
        priceCents: 2800,
        qty: 2,
        note: "Extra cheese",
      },
      {
        id: "item-2",
        name: "Masala Lemonade",
        priceCents: 1200,
        qty: 2,
        note: null,
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrinter = new MockCounterPrinter();
    capturedUpdates = [];

    vi.mocked(supabase.from).mockImplementation((table: string) => {
      let updatePayload: any = null;
      let filterEqId: string | undefined = undefined;

      const builder: any = {
        update: vi.fn().mockImplementation((payload: any) => {
          updatePayload = payload;
          return builder;
        }),
        eq: vi.fn().mockImplementation((col: string, val: string) => {
          if (col === "id") filterEqId = val;
          return builder;
        }),
        select: vi.fn().mockImplementation(() => {
          capturedUpdates.push({ table, payload: updatePayload, filterId: filterEqId });
          return Promise.resolve({ data: [{ id: filterEqId || "ord-999-uuid" }], error: null });
        }),
      };

      return builder;
    });
  });

  it("1. Pending order can be accepted: updates DB to preparing and prints KOT via mock printer", async () => {
    const result = await CounterOrderActionService.acceptOrder(
      samplePendingOrder,
      "Table 4",
      "Cheese Corner",
      mockPrinter
    );

    expect(result.success).toBe(true);
    expect(result.newStatus).toBe("preparing");
    expect(result.orderNumber).toBe(105);

    // Verify DB update was executed
    const orderUpdate = capturedUpdates.find((u) => u.table === "orders");
    expect(orderUpdate).toBeDefined();
    expect(orderUpdate!.payload.status).toBe("preparing");
    expect(orderUpdate!.payload.last_updated_by).toBe("counter");
    expect(orderUpdate!.filterId).toBe("ord-999-uuid");

    // Verify KOT was generated
    expect(result.kot).toBeDefined();
    expect(result.kot!.text).toContain("CHEESE CORNER");
    expect(result.kot!.text).toContain("TABLE 4");
    expect(result.kot!.text).toContain("Veg Cheese Burger");

    // Verify mock printer received the KOT raw bytes
    expect(result.printResult).toBeDefined();
    expect(result.printResult!.status).toBe("ACCEPTED_FOR_TEST_PRINT");
    expect(mockPrinter.getLastPayload()).toBe(result.kot!.rawBytes);
    expect(mockPrinter.getHistory()).toHaveLength(1);
  });

  it("2. Already-preparing order cannot be accepted twice", async () => {
    const preparingOrder: CounterOrder = {
      ...samplePendingOrder,
      status: "preparing",
    };

    const result = await CounterOrderActionService.acceptOrder(
      preparingOrder,
      "Table 4",
      "Cheese Corner",
      mockPrinter
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain("already in 'preparing' status");

    // Ensure no DB update and no print call occurred
    expect(capturedUpdates).toHaveLength(0);
    expect(mockPrinter.getHistory()).toHaveLength(0);
  });

  it("3. Failed status update leaves order pending: does not generate or print KOT", async () => {
    vi.mocked(supabase.from).mockImplementation(() => {
      const builder: any = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockResolvedValue({
          data: null,
          error: { code: "PGRST500", message: "Network connection lost" },
        }),
      };
      return builder;
    });

    const result = await CounterOrderActionService.acceptOrder(
      samplePendingOrder,
      "Table 4",
      "Cheese Corner",
      mockPrinter
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain("Network connection lost");
    expect(result.newStatus).toBeUndefined();

    // Ensure printer was NOT invoked
    expect(mockPrinter.getHistory()).toHaveLength(0);
  });

  it("4. KOT payload contains required fields: Cheese Corner, table, order #, items, notes", () => {
    const kot = generateCounterKot(samplePendingOrder, "Table 4", "Cheese Corner");

    expect(kot.text).toContain("CHEESE CORNER");
    expect(kot.text).toContain("TABLE 4");
    expect(kot.text).toContain("105"); // Order / KOT number
    expect(kot.text).toContain("Veg Cheese Burger");
    expect(kot.text).toContain("Masala Lemonade");
    expect(kot.text).toContain("Extra cheese"); // Item note
    expect(kot.text).toContain("Do not add coriander"); // Order note
    expect(kot.text).toContain("DINE IN");

    expect(kot.rawBytes).toBeInstanceOf(Uint8Array);
    expect(kot.rawBytes.length).toBeGreaterThan(50);
  });

  it("5. Mock printer records print calls and retains last payload", async () => {
    const kot = generateCounterKot(samplePendingOrder, "Table 4", "Cheese Corner");
    const printRes = await mockPrinter.printRaw(kot.rawBytes, {
      title: "KOT",
      orderNumber: 105,
      tableLabel: "Table 4",
    });

    expect(printRes.status).toBe("ACCEPTED_FOR_TEST_PRINT");
    expect(printRes.bytesPrinted).toBe(kot.rawBytes.length);
    expect(mockPrinter.getLastPayload()).toBe(kot.rawBytes);
    expect(mockPrinter.getHistory()[0].context?.orderNumber).toBe(105);
  });

  it("6. Printer failure does not roll back order status: order remains preparing", async () => {
    mockPrinter.setShouldFail(true);

    const result = await CounterOrderActionService.acceptOrder(
      samplePendingOrder,
      "Table 4",
      "Cheese Corner",
      mockPrinter
    );

    // Order status update in DB still succeeded
    expect(result.success).toBe(true);
    expect(result.newStatus).toBe("preparing");
    expect(capturedUpdates).toHaveLength(1);

    // Print result reports FAILED without breaking the workflow
    expect(result.printResult).toBeDefined();
    expect(result.printResult!.status).toBe("FAILED");
    expect(result.printResult!.message).toContain("hardware error");
  });
});
