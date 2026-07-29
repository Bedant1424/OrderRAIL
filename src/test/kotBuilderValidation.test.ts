import { describe, it, expect, beforeEach } from "vitest";
import { KotBuilder, type KotBuilderPayload } from "../lib/printing/kotBuilder";
import { PrinterAdapter } from "../lib/printing/printerAdapter";
import { printService } from "../lib/printing/PrintService";
import { MockProvider } from "../lib/printing/providers/MockProvider";

describe("Kitchen Order Ticket (KOT) Builder (58mm) & Integration Validation Tests", () => {
  beforeEach(() => {
    // Reset PrintService to clean MockProvider before each test
    printService.setProvider(new MockProvider({ simulatedDelayMs: 0 }));
    PrinterAdapter.setSimulatedState(null);
  });

  it("1. Single Item Order: Should generate valid 58mm ESC/POS & Text ticket for single item", () => {
    const payload: KotBuilderPayload = {
      restaurantName: "OrderRail Gourmet Cafe",
      kotNumber: "101",
      orderNumber: 1001,
      tableLabel: "Table 4",
      timestamp: "10:30 AM",
      items: [
        { id: "i1", name: "Artisan Cappuccino", qty: 1, price: 150 }
      ]
    };

    const result = KotBuilder.build(payload, 58);

    // Text assertions
    expect(result.text).toContain("ORDERRAIL GOURMET CAFE");
    expect(result.text).toContain("*** KITCHEN ORDER TICKET ***");
    expect(result.text).toContain("KOT #: 101");
    expect(result.text).toContain("Order #: 1001");
    expect(result.text).toContain("Table 4");
    expect(result.text).toContain("10:30 AM");
    expect(result.text).toContain("1x   Artisan Cappuccino");
    expect(result.text).toContain("TOTAL ITEMS: 1");

    // ESC/POS assertions
    expect(result.escpos).toContain("\x1B\x40"); // ESC/POS INIT
    expect(result.escpos).toContain("KITCHEN ORDER TICKET");
    expect(result.escpos).toContain("\x1D\x56\x41\x03"); // FEED & CUT
  });

  it("2. Multi-Item Order: Should correctly format multiple items and compute total item quantity", () => {
    const payload: KotBuilderPayload = {
      restaurantName: "OrderRail Pro Kitchen",
      kotNumber: "102",
      orderNumber: 1002,
      tableLabel: "Patio-3",
      timestamp: "11:15 AM",
      items: [
        { id: "i1", name: "Double Espresso", qty: 2, price: 120 },
        { id: "i2", name: "Avocado Toast", qty: 3, price: 280 },
        { id: "i3", name: "Truffle Fries", qty: 1, price: 200 }
      ]
    };

    const result = KotBuilder.build(payload, 58);

    expect(result.text).toContain("2x   Double Espresso");
    expect(result.text).toContain("3x   Avocado Toast");
    expect(result.text).toContain("1x   Truffle Fries");
    expect(result.text).toContain("TOTAL ITEMS: 6"); // 2 + 3 + 1 = 6
  });

  it("3. Notes & Modifiers: Should format item-level modifiers and order-level special instructions", () => {
    const payload: KotBuilderPayload = {
      restaurantName: "OrderRail Pro Kitchen",
      kotNumber: "103",
      orderNumber: 1003,
      tableLabel: "Table 12",
      timestamp: "12:00 PM",
      items: [
        {
          id: "i1",
          name: "Custom Club Sandwich",
          qty: 2,
          modifiers: ["Extra Cheese", "Gluten-Free Bread"],
          notes: "Cut into triangles"
        }
      ],
      specialInstructions: "Make it extra spicy, deliver immediately to table."
    };

    const result = KotBuilder.build(payload, 58);

    // Modifiers & notes assertions
    expect(result.text).toContain("* Modifiers: Extra Cheese, Gluten-Free Bread, Cut into triangles");
    expect(result.text).toContain("SPECIAL INSTRUCTIONS:");
    expect(result.text).toContain("Make it extra spicy, deliver");
    expect(result.text).toContain("immediately to table.");
  });

  it("4. Long Item Names: Should wrap text cleanly across multiple 32-column lines", () => {
    const payload: KotBuilderPayload = {
      restaurantName: "OrderRail Bistro",
      kotNumber: "104",
      orderNumber: 1004,
      tableLabel: "Table 1",
      timestamp: "01:00 PM",
      items: [
        {
          id: "i1",
          name: "Super Ultimate Supreme Loaded Barbecue Bacon Cheese Burger with Extra Crispy Onion Rings",
          qty: 1
        }
      ]
    };

    const result = KotBuilder.build(payload, 58);

    // Verify line wrapping without overflow (<= 32 chars)
    const lines = result.text.split("\n");
    for (const line of lines) {
      expect(line.length).toBeLessThanOrEqual(32);
    }
  });

  it("5. Reprint: Should include prominent ** REPRINT ** tag when isReprint is true", () => {
    const payload: KotBuilderPayload = {
      restaurantName: "OrderRail Bistro",
      kotNumber: "105",
      orderNumber: 1005,
      tableLabel: "Table 5",
      timestamp: "01:30 PM",
      isReprint: true,
      items: [
        { id: "i1", name: "Margherita Pizza", qty: 1 }
      ]
    };

    const result = KotBuilder.build(payload, 58);

    expect(result.text).toContain("** REPRINT **");
    expect(result.escpos).toContain("** REPRINT **");
  });

  it("6. Integration with PrinterAdapter & PrintService: Should dispatch 58mm KOT job successfully", async () => {
    const res = await PrinterAdapter.printKot({
      orderId: "ord-test-999",
      kotNumber: 999,
      orderNumber: 999,
      tableLabel: "Table 9",
      timestamp: "02:00 PM",
      items: [
        { id: "i1", name: "Iced Latte", qty: 2, price: 180, notes: "Oat milk" }
      ],
      notes: "Less ice"
    });

    expect(res.success).toBe(true);

    const history = printService.getJobHistory();
    expect(history.length).toBeGreaterThan(0);
    const lastJob = history[history.length - 1];
    expect(lastJob.type).toBe("KOT");
    expect(lastJob.destination).toBe("KOT_PRINTER");
    expect(lastJob.status).toBe("COMPLETED");
    expect(lastJob.payload.escpos).toBeDefined();
    expect(lastJob.payload.formattedText).toContain("2x   Iced Latte");
  });

  it("7. Existing Receipt Printing: Should remain unaffected and operational", async () => {
    const res = await PrinterAdapter.printReceipt({
      billId: "bill-101",
      billNumber: "INV-101",
      orderId: "ord-101",
      orderNumber: 101,
      tableLabel: "Table 2",
      timestamp: "02:30 PM",
      items: [
        { id: "i1", name: "Cold Brew", qty: 1, price: 160 }
      ],
      subtotal: 160,
      tax: 8,
      netTotal: 168,
      paymentStatus: "paid"
    });

    expect(res.success).toBe(true);

    const history = printService.getJobHistory();
    const lastJob = history[history.length - 1];
    expect(lastJob.type).toBe("RECEIPT");
    expect(lastJob.destination).toBe("BILL_PRINTER");
    expect(lastJob.status).toBe("COMPLETED");
  });
});
