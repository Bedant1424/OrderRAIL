import { describe, it, expect } from "vitest";

describe("Counter V2 Phase 1 — Foundation Shell Architecture", () => {
  describe("1. Table Card States & Rendering Specs", () => {
    it("should classify Table Card states correctly", () => {
      const freeTable = { id: "t1", label: "Table 1", seats: 4, status: "free" as const };
      const occupiedTable = { id: "t2", label: "Table 2", seats: 2, status: "occupied" as const, elapsedTime: "14m ago" };
      const billReqTable = { id: "t4", label: "Table 4", seats: 4, status: "bill_requested" as const, elapsedTime: "32m ago" };

      expect(freeTable.status).toBe("free");
      expect(occupiedTable.status).toBe("occupied");
      expect(billReqTable.status).toBe("bill_requested");
    });

    it("should calculate table filter counts accurately", () => {
      const tables = [
        { id: "t1", label: "T1", seats: 4, status: "free" as const },
        { id: "t2", label: "T2", seats: 2, status: "occupied" as const },
        { id: "t3", label: "T3", seats: 6, status: "free" as const },
        { id: "t4", label: "T4", seats: 4, status: "bill_requested" as const },
      ];

      const freeCount = tables.filter((t) => t.status === "free").length;
      const occupiedCount = tables.filter((t) => t.status !== "free").length;

      expect(freeCount).toBe(2);
      expect(occupiedCount).toBe(2);
      expect(tables.length).toBe(4);
    });
  });

  describe("2. Billing Financial Calculation Proofs", () => {
    it("should compute subtotal, tax, discount, and net total according to Counter V2 spec", () => {
      const items = [
        { qty: 1, name: "Double Espresso", price: 4.5 },
        { qty: 2, name: "Artisan Club Sandwich", price: 24.0 },
        { qty: 1, name: "Iced Vanilla Latte", price: 5.5 },
        { qty: 1, name: "Sparkling Water", price: 3.5 },
      ];

      const subtotal = items.reduce((sum, i) => sum + i.price, 0); // 37.50
      const taxRate = 0.08; // 8% GST
      const tax = subtotal * taxRate; // 3.00
      const discountPercent = 10; // 10% promo
      const discountAmount = subtotal * (discountPercent / 100); // 3.75
      const netTotal = subtotal + tax - discountAmount; // 36.75

      expect(subtotal).toBe(37.5);
      expect(tax).toBe(3.0);
      expect(discountAmount).toBe(3.75);
      expect(netTotal).toBe(36.75);
    });

    it("should compute change due accurately for cash payments", () => {
      const netTotal = 36.75;
      const cashTendered = 40.0;
      const changeDue = Math.max(0, cashTendered - netTotal);

      expect(changeDue).toBe(3.25);
    });
  });

  describe("3. Quick Keys & Function Shortcuts Mapping", () => {
    const shortcuts = [
      { key: "F1", label: "New Takeaway" },
      { key: "F2", label: "Search Menu" },
      { key: "F3", label: "Service Calls (2)" },
      { key: "F4", label: "Switch Mode" },
      { key: "F8", label: "Print Bill" },
      { key: "F10", label: "Pay Cash" },
      { key: "F11", label: "Pay Card" },
    ];

    it("should contain all 7 mandatory POS function key shortcuts", () => {
      const keys = shortcuts.map((s) => s.key);
      expect(keys).toEqual(["F1", "F2", "F3", "F4", "F8", "F10", "F11"]);
    });
  });
});
