import { describe, it, expect } from "vitest";
import {
  KotBuilder,
  type KotBuilderPayload,
  type KotAmendmentBuilderPayload,
  type KotCancelBuilderPayload,
} from "../lib/printing/kotBuilder";
import { ESC_POS } from "../lib/printing/constants";

describe("Milestone 1B: Revised Compact KOT Amendment & Cancellation Formatting Tests", () => {
  const baseRestaurant = "Cheese Corner Cafe";

  // --- 1. Compact ADD items ---
  it("1. Compact Amendment with ADD items (58mm & 80mm)", () => {
    const payload: KotAmendmentBuilderPayload = {
      restaurantName: baseRestaurant,
      orderNumber: 101,
      revision: 1, // M1
      tableLabel: "Table 4",
      timestamp: "02:15 PM",
      delta: {
        added: [
          { name: "Mojito", qty: 1 },
          { name: "Ice Cream", qty: 1 },
        ],
      },
    };

    const res58 = KotBuilder.buildAmendmentKot(payload, 58);
    expect(res58.text).toContain("KOT #101-M1");
    expect(res58.text).toContain("MODIFIED");
    expect(res58.text).toContain("TABLE 4");
    expect(res58.text).toContain("ADD 1x Mojito");
    expect(res58.text).toContain("ADD 1x Ice Cream");

    // Must NOT contain verbose headers
    expect(res58.text).not.toContain("ADDED ITEMS");
    expect(res58.text).not.toContain("REMOVED ITEMS");
    expect(res58.text).not.toContain("QUANTITY / NOTE CHANGES");
    expect(res58.text).not.toContain("TOTAL CHANGES");

    // ESC/POS validation
    expect(res58.escpos).toContain(ESC_POS.INIT);
    expect(res58.escpos).toContain("KOT #101-M1");
    expect(res58.escpos).toContain("ADD 1x Mojito\n");
    expect(res58.escpos).toContain(ESC_POS.FEED_AND_CUT);

    // 80mm width check
    const res80 = KotBuilder.buildAmendmentKot(payload, 80);
    expect(res80.text).toContain("KOT #101-M1");
    expect(res80.text).toContain("ADD 1x Mojito");
    expect(res80.text.split("\n")[0].length).toBe(48);
  });

  // --- 2. Compact REMOVE items ---
  it("2. Compact Amendment with REMOVE items", () => {
    const payload: KotAmendmentBuilderPayload = {
      restaurantName: baseRestaurant,
      orderNumber: 101,
      revision: 1,
      tableLabel: "Table 4",
      delta: {
        removed: [
          { name: "French Fries", qty: 1 },
        ],
      },
    };

    const res = KotBuilder.buildAmendmentKot(payload, 58);
    expect(res.text).toContain("KOT #101-M1");
    expect(res.text).toContain("MODIFIED");
    expect(res.text).toContain("Table 4".toUpperCase());
    expect(res.text).toContain("REMOVE 1x French Fries");
    expect(res.text).not.toContain("REMOVED ITEMS");
  });

  // --- 3. Quantity Increase (represented as ADD <delta>x) ---
  it("3. Quantity Increase: 1x Burger -> 3x Burger (renders ADD 2x Burger)", () => {
    const payload: KotAmendmentBuilderPayload = {
      orderNumber: 102,
      revision: 2, // M2
      tableLabel: "Table 2",
      delta: {
        modified: [
          { name: "Veg Cheese Burger", old_qty: 1, new_qty: 3 },
        ],
      },
    };

    const res = KotBuilder.buildAmendmentKot(payload, 58);
    expect(res.text).toContain("KOT #102-M2");
    expect(res.text).toContain("ADD 2x Veg Cheese Burger"); // 3 - 1 = +2
    expect(res.text).not.toContain("Qty : 1 -> 3");
  });

  // --- 4. Quantity Decrease (represented as REMOVE <delta>x) ---
  it("4. Quantity Decrease: 3x Fries -> 1x Fries (renders REMOVE 2x Fries)", () => {
    const payload: KotAmendmentBuilderPayload = {
      orderNumber: 103,
      revision: 1,
      tableLabel: "Table 7",
      delta: {
        modified: [
          { name: "French Fries", old_qty: 3, new_qty: 1 },
        ],
      },
    };

    const res = KotBuilder.buildAmendmentKot(payload, 58);
    expect(res.text).toContain("KOT #103-M1");
    expect(res.text).toContain("REMOVE 2x French Fries"); // 3 - 1 = -2
    expect(res.text).not.toContain("Qty : 3 -> 1");
  });

  // --- 5. Note Modification (MOD <item> (Note: "<new note>")) ---
  it('5. Note Modification: renders MOD <item> (Note: "<new note>")', () => {
    const payload: KotAmendmentBuilderPayload = {
      orderNumber: 104,
      revision: 1,
      tableLabel: "Table 5",
      delta: {
        modified: [
          {
            name: "Paneer Pizza",
            old_qty: 1,
            new_qty: 1,
            old_note: "Normal",
            new_note: "Extra oregano, no chilly flakes",
          },
        ],
      },
    };

    const res = KotBuilder.buildAmendmentKot(payload, 58);
    expect(res.text).toContain('MOD Paneer Pizza (Note: "Extra oregano, no chilly flakes")');
  });

  // --- 6. Mixed Amendment (Removal + Addition + Qty Inc/Dec + Note) ---
  it("6. Mixed Amendment: clean compact actionable lines only", () => {
    const payload: KotAmendmentBuilderPayload = {
      restaurantName: baseRestaurant,
      orderNumber: 101,
      revision: 1,
      tableLabel: "Table 4",
      timestamp: "02:20 PM",
      delta: {
        removed: [{ name: "Fries", qty: 1 }],
        added: [
          { name: "Mojito", qty: 1 },
          { name: "Ice Cream", qty: 1 },
        ],
      },
    };

    const res = KotBuilder.buildAmendmentKot(payload, 58);
    const expectedLines = [
      "REMOVE 1x Fries",
      "ADD 1x Mojito",
      "ADD 1x Ice Cream",
    ];

    for (const expected of expectedLines) {
      expect(res.text).toContain(expected);
    }
  });

  // --- 7. Cancelled KOT with Original KOT Number ---
  it("7. Cancelled KOT uses original KOT number and STOP PREPARATION banner", () => {
    const payload: KotCancelBuilderPayload = {
      restaurantName: baseRestaurant,
      kotNumber: 105, // Original KOT #
      orderNumber: 105,
      tableLabel: "Table 4",
      cancelledItems: [
        { name: "Burger", qty: 2 },
        { name: "Fries", qty: 1 },
      ],
    };

    const res = KotBuilder.buildCancelKot(payload, 58);
    expect(res.text).toContain("KOT #105");
    expect(res.text).not.toContain("105-C1");
    expect(res.text).not.toContain("105-M");
    expect(res.text).toContain("*** CANCELLED ***");
    expect(res.text).toContain("TABLE 4");
    expect(res.text).toContain("STOP PREPARATION");
    expect(res.text).toContain("2x   Burger");
    expect(res.text).toContain("1x   Fries");

    // ESC/POS check
    expect(res.escpos).toContain("KOT #105");
    expect(res.escpos).toContain("*** CANCELLED ***");
    expect(res.escpos).toContain("STOP PREPARATION");
  });

  // --- 8. Normal Reprints (R1, R2, R3) ---
  it("8. Standard KOT Reprints with sequential R numbers (101-R1, 101-R2)", () => {
    const payloadR1: KotBuilderPayload = {
      restaurantName: baseRestaurant,
      orderNumber: 101,
      kotNumber: 101,
      tableLabel: "Table 4",
      isReprint: true,
      reprintNumber: 1,
      items: [{ name: "Cheese Burger", qty: 2 }],
    };

    const resR1 = KotBuilder.build(payloadR1, 58);
    expect(resR1.text).toContain("KOT #: 101-R1");
    expect(resR1.text).toContain("** REPRINT **");
    expect(resR1.text).toContain("2x   Cheese Burger");

    const payloadR2: KotBuilderPayload = {
      ...payloadR1,
      reprintNumber: 2,
    };
    const resR2 = KotBuilder.build(payloadR2, 58);
    expect(resR2.text).toContain("KOT #: 101-R2");
  });

  // --- 9. Offline Reprint (KOT #101-R, OFFLINE REPRINT) ---
  it("9. Offline Reprint: displays KOT #101-R and OFFLINE REPRINT when no canonical R number exists", () => {
    const payloadOffline: KotBuilderPayload = {
      restaurantName: baseRestaurant,
      orderNumber: 101,
      kotNumber: 101,
      tableLabel: "Table 4",
      isOfflineReprint: true,
      items: [{ name: "Cheese Burger", qty: 2 }],
    };

    const res = KotBuilder.build(payloadOffline, 58);
    expect(res.text).toContain("KOT #: 101-R");
    expect(res.text).toContain("OFFLINE REPRINT");
    expect(res.text).not.toContain("101-R1");
  });

  // --- 10. Normal KOT Regression ---
  it("10. Normal KOT regression: standard initial KOT untouched", () => {
    const payloadNormal: KotBuilderPayload = {
      restaurantName: baseRestaurant,
      orderNumber: 101,
      kotNumber: 101,
      tableLabel: "Table 4",
      items: [{ name: "Cold Brew", qty: 1 }],
    };

    const res = KotBuilder.build(payloadNormal, 58);
    expect(res.text).toContain("KOT #: 101");
    expect(res.text).not.toContain("101-R");
    expect(res.text).not.toContain("101-M");
    expect(res.text).not.toContain("** REPRINT **");
    expect(res.text).not.toContain("OFFLINE REPRINT");
    expect(res.text).toContain("1x   Cold Brew");
  });

  // --- 11. Atomic Reprint Allocation Concurrency Simulation ---
  it("11. Concurrency Simulation: Atomic reprint allocation guarantees unique sequential R numbers", () => {
    // Pure algorithmic model of the record_kot_reprint_atomic PostgreSQL stored procedure
    class OrderReprintStore {
      private lockedOrders = new Set<string>();
      private reprintEvents: Array<{ orderId: string; reprintNumber: number }> = [];

      public async recordKotReprintAtomic(orderId: string, actor: string): Promise<{ reprint_number: number; reprint_code: string }> {
        // Simulates PostgreSQL SELECT ... FOR UPDATE row-level lock
        while (this.lockedOrders.has(orderId)) {
          await new Promise((r) => setTimeout(r, 2));
        }
        this.lockedOrders.add(orderId);

        try {
          const currentCount = this.reprintEvents.filter((e) => e.orderId === orderId).length;
          const nextReprintNumber = currentCount + 1;

          this.reprintEvents.push({ orderId, reprintNumber: nextReprintNumber });

          return {
            reprint_number: nextReprintNumber,
            reprint_code: `R${nextReprintNumber}`,
          };
        } finally {
          this.lockedOrders.delete(orderId);
        }
      }
    }

    const store = new OrderReprintStore();
    const testOrderId = "order-concurrent-test-uuid";

    // Simulate 5 concurrent reprint requests fired simultaneously from multiple terminals
    const concurrentRequests = Array.from({ length: 5 }, (_, i) =>
      store.recordKotReprintAtomic(testOrderId, i % 2 === 0 ? "counter" : "staff")
    );

    return Promise.all(concurrentRequests).then((results) => {
      const allocatedNumbers = results.map((r) => r.reprint_number);
      const allocatedCodes = results.map((r) => r.reprint_code);

      // Verify no duplicates
      expect(new Set(allocatedNumbers).size).toBe(5);
      expect(allocatedNumbers.sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5]);
      expect(allocatedCodes.sort()).toEqual(["R1", "R2", "R3", "R4", "R5"]);
    });
  });
});
