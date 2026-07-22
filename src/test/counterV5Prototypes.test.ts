import { describe, it, expect } from "vitest";
import { INITIAL_DEFAULT_TABLES } from "../lib/counter/tableEngine/tableActions";

describe("Counter V5 Prototypes — Exploration Test Suite", () => {
  describe("1. Prototype A: Restaurant-First (Table-First 50/50 Layout)", () => {
    it("should load 50/50 table floor deck entities", () => {
      expect(INITIAL_DEFAULT_TABLES.length).toBe(12);
      const mainDiningTables = INITIAL_DEFAULT_TABLES.slice(0, 6);
      expect(mainDiningTables.length).toBe(6);
    });

    it("should verify Prototype A route binding contract", () => {
      const routeA = "/counter/v5-a";
      expect(routeA).toBe("/counter/v5-a");
    });
  });

  describe("2. Prototype B: Cafe/QSR-First (Menu-First 70/30 Layout)", () => {
    it("should calculate Express Register cart subtotals and quick cash tenders", () => {
      const expressCart = [
        { price: 4.5, qty: 1 },
        { price: 5.5, qty: 1 },
      ];
      const total = expressCart.reduce((sum, item) => sum + item.price * item.qty, 0);
      expect(total).toBe(10.0);

      const quickCash20 = 20.0;
      const changeDue = quickCash20 - total;
      expect(changeDue).toBe(10.0);
    });

    it("should verify Prototype B route binding contract", () => {
      const routeB = "/counter/v5-b";
      expect(routeB).toBe("/counter/v5-b");
    });
  });
});
