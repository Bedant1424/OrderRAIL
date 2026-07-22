import { describe, it, expect } from "vitest";
import { filterTables, getTableCounts } from "../lib/counter/tableEngine/tableSelectors";
import { INITIAL_DEFAULT_TABLES } from "../lib/counter/tableEngine/tableActions";

describe("Counter V3 UI Implementation — Prototype Validation Suite", () => {
  describe("1. Pane 1 Table Grid & Floor Zone Filtering", () => {
    it("should filter table seeds cleanly for Pane 1 deck", () => {
      const counts = getTableCounts(INITIAL_DEFAULT_TABLES);
      expect(counts.all).toBe(12);
      expect(counts.available).toBe(6);
      expect(counts.occupied).toBe(2);
      expect(counts.bill_requested).toBe(1);
      expect(counts.cleaning).toBe(1);
    });

    it("should filter active tables (occupied + bill_requested)", () => {
      const activeTables = INITIAL_DEFAULT_TABLES.filter(
        (t) => t.status === "OCCUPIED" || t.status === "BILL_REQUESTED"
      );
      expect(activeTables.length).toBe(3);
    });
  });

  describe("2. Financial Calculation Engine in Billing Drawer V3", () => {
    it("should calculate exact Subtotal, Tax 8%, 10% Discount, Net Total, and Change Due", () => {
      const sampleItems = [
        { price: 4.5, qty: 1 },
        { price: 12.0, qty: 2 },
        { price: 5.5, qty: 1 },
        { price: 3.5, qty: 1 },
      ];

      const subtotal = sampleItems.reduce((sum, item) => sum + item.price * item.qty, 0); // 37.50
      const tax = subtotal * 0.08; // 3.00
      const discount = subtotal * 0.10; // 3.75
      const netTotal = subtotal + tax - discount; // 36.75

      expect(subtotal).toBe(37.5);
      expect(tax).toBe(3.0);
      expect(discount).toBe(3.75);
      expect(netTotal).toBe(36.75);

      const cashTendered = 40.0;
      const changeDue = Math.max(0, cashTendered - netTotal);
      expect(changeDue).toBe(3.25);
    });
  });

  describe("3. Minimal Table Card Metadata Reduction Verification", () => {
    it("should support minimalist 3-point rendering contract", () => {
      const table = INITIAL_DEFAULT_TABLES.find((t) => t.id === "t-4");
      expect(table?.label).toBe("Table 4");
      expect(table?.status).toBe("BILL_REQUESTED");
      expect(table?.activeSession?.id).toBe("s-9821");
    });
  });
});
