import { describe, it, expect } from "vitest";
import {
  KotBuilder,
  type KotBuilderPayload,
  type KotAmendmentBuilderPayload,
  type KotCancelBuilderPayload,
} from "../lib/printing/kotBuilder";
import { ESC_POS } from "../lib/printing/constants";

describe("Milestone 1B: KOT Amendment & Cancellation Formatting Tests", () => {
  const baseRestaurant = "Cheese Corner Cafe";

  // --- 1. Amendment with Added Items ---
  it("1. Amendment with Added Items (58mm & 80mm)", () => {
    const payload: KotAmendmentBuilderPayload = {
      restaurantName: baseRestaurant,
      kotNumber: "101-M1",
      orderNumber: 1001,
      tableLabel: "Table 4",
      timestamp: "02:15 PM",
      operatorName: "Counter",
      orderSource: "DINE_IN",
      delta: {
        added: [
          { name: "Truffle Fries", qty: 2, note: "Extra crispy" },
          { name: "Cold Coffee", qty: 1 },
        ],
      },
    };

    const res58 = KotBuilder.buildAmendmentKot(payload, 58);
    expect(res58.text).toContain("CHEESE CORNER CAFE");
    expect(res58.text).toContain("** MODIFIED KOT **");
    expect(res58.text).toContain("TABLE 4");
    expect(res58.text).toContain("KOT #: 101-M1");
    expect(res58.text).toContain("Order #: 1001");
    expect(res58.text).toContain("Operator: Counter");
    expect(res58.text).toContain("[+] ADDED ITEMS:");
    expect(res58.text).toContain("+2x  Truffle Fries");
    expect(res58.text).toContain("> Note: Extra crispy");
    expect(res58.text).toContain("+1x  Cold Coffee");
    expect(res58.text).toContain("TOTAL CHANGES: 2 item(s)");

    // ESC/POS check
    expect(res58.escpos).toContain(ESC_POS.INIT);
    expect(res58.escpos).toContain("** MODIFIED KOT **");
    expect(res58.escpos).toContain(ESC_POS.FEED_AND_CUT);

    // 80mm width check
    const res80 = KotBuilder.buildAmendmentKot(payload, 80);
    expect(res80.text).toContain("CHEESE CORNER CAFE");
    expect(res80.text).toContain("+2x  Truffle Fries");
    // 80mm line width is 48 chars
    expect(res80.text.split("\n")[0].length).toBe(48);
  });

  // --- 2. Amendment with Removed Items ---
  it("2. Amendment with Removed Items", () => {
    const payload: KotAmendmentBuilderPayload = {
      restaurantName: baseRestaurant,
      kotNumber: "102-M1",
      orderNumber: 1002,
      tableLabel: "Table 2",
      timestamp: "02:30 PM",
      operatorName: "Staff",
      delta: {
        removed: [
          { name: "Garlic Bread", qty: 1, note: "Customer changed mind" },
        ],
      },
    };

    const res = KotBuilder.buildAmendmentKot(payload, 58);
    expect(res.text).toContain("[-] REMOVED ITEMS:");
    expect(res.text).toContain("-1x  Garlic Bread");
    expect(res.text).toContain("> Note: Customer changed mind");
    expect(res.text).toContain("TOTAL CHANGES: 1 item(s)");
  });

  // --- 3. Amendment with Quantity Changes ---
  it("3. Amendment with Quantity Changes", () => {
    const payload: KotAmendmentBuilderPayload = {
      restaurantName: baseRestaurant,
      kotNumber: "103-M1",
      orderNumber: 1003,
      tableLabel: "Table 7",
      timestamp: "02:45 PM",
      delta: {
        modified: [
          { name: "Veg Cheese Burger", old_qty: 1, new_qty: 3 },
          { name: "Pasta Alfredo", old_qty: 4, new_qty: 2 },
        ],
      },
    };

    const res = KotBuilder.buildAmendmentKot(payload, 58);
    expect(res.text).toContain("[Δ] QUANTITY / NOTE CHANGES:");
    expect(res.text).toContain("* Veg Cheese Burger");
    expect(res.text).toContain("Qty : 1 -> 3 (+2)");
    expect(res.text).toContain("* Pasta Alfredo");
    expect(res.text).toContain("Qty : 4 -> 2 (-2)");
    expect(res.text).toContain("TOTAL CHANGES: 2 item(s)");
  });

  // --- 4. Amendment with Note Changes ---
  it("4. Amendment with Note Changes", () => {
    const payload: KotAmendmentBuilderPayload = {
      restaurantName: baseRestaurant,
      kotNumber: "104-M1",
      orderNumber: 1004,
      tableLabel: "Table 5",
      timestamp: "03:00 PM",
      delta: {
        modified: [
          {
            name: "Paneer Tikka Pizza",
            old_qty: 1,
            new_qty: 1,
            old_note: "Normal",
            new_note: "No spicy, extra oregano",
          },
        ],
      },
    };

    const res = KotBuilder.buildAmendmentKot(payload, 58);
    expect(res.text).toContain("[Δ] QUANTITY / NOTE CHANGES:");
    expect(res.text).toContain("* Paneer Tikka Pizza");
    expect(res.text).toContain('Note: "No spicy, extra oregano"');
    // Quantity was not changed, so Qty line should not appear
    expect(res.text).not.toContain("Qty :");
  });

  // --- 5. Mixed Amendment (Added + Removed + Modified) ---
  it("5. Mixed Amendment (Added + Removed + Modified)", () => {
    const payload: KotAmendmentBuilderPayload = {
      restaurantName: baseRestaurant,
      kotNumber: "105-M2",
      orderNumber: 1005,
      tableLabel: "Table 9",
      timestamp: "03:15 PM",
      operatorName: "Counter",
      orderSource: "TAKEAWAY",
      specialInstructions: "Pack sauce separately",
      delta: {
        added: [{ name: "Brownie Sundae", qty: 2 }],
        removed: [{ name: "Vanilla Ice Cream", qty: 1 }],
        modified: [
          {
            name: "Margherita Pizza",
            old_qty: 1,
            new_qty: 2,
            old_note: "",
            new_note: "Thin crust",
          },
        ],
      },
    };

    const res = KotBuilder.buildAmendmentKot(payload, 58);
    expect(res.text).toContain("TAKEAWAY");
    expect(res.text).toContain("[+] ADDED ITEMS:");
    expect(res.text).toContain("+2x  Brownie Sundae");
    expect(res.text).toContain("[-] REMOVED ITEMS:");
    expect(res.text).toContain("-1x  Vanilla Ice Cream");
    expect(res.text).toContain("[Δ] QUANTITY / NOTE CHANGES:");
    expect(res.text).toContain("* Margherita Pizza");
    expect(res.text).toContain("Qty : 1 -> 2 (+1)");
    expect(res.text).toContain('Note: "Thin crust"');
    expect(res.text).toContain("SPECIAL INSTRUCTIONS:");
    expect(res.text).toContain("Pack sauce separately");
    expect(res.text).toContain("TOTAL CHANGES: 3 item(s)");
  });

  // --- 6. Cancellation KOT ---
  it("6. Cancellation KOT ticket format and stop warnings", () => {
    const payload: KotCancelBuilderPayload = {
      restaurantName: baseRestaurant,
      kotNumber: "106",
      orderNumber: 1006,
      tableLabel: "Table 3",
      timestamp: "03:30 PM",
      operatorName: "Counter",
      reason: "Table cancelled by customer",
      cancelledItems: [
        { name: "Cheese Burst Burger", qty: 2 },
        { name: "Peri Peri Fries", qty: 1, notes: "Extra dip" },
      ],
    };

    const res = KotBuilder.buildCancelKot(payload, 58);
    expect(res.text).toContain("*** CANCELLED KOT ***");
    expect(res.text).toContain("TABLE 3");
    expect(res.text).toContain("KOT #: 106");
    expect(res.text).toContain("Order #: 1006");
    expect(res.text).toContain("REASON: Table cancelled by customer");
    expect(res.text).toContain("CANCELLED ITEMS:");
    expect(res.text).toContain("2x   Cheese Burst Burger");
    expect(res.text).toContain("1x   Peri Peri Fries");
    expect(res.text).toContain("> Extra dip");
    expect(res.text).toContain("*** DO NOT PREPARE / STOP ***");

    // ESC/POS check
    expect(res.escpos).toContain(ESC_POS.INIT);
    expect(res.escpos).toContain("*** CANCELLED KOT ***");
    expect(res.escpos).toContain("*** DO NOT PREPARE / STOP ***");
    expect(res.escpos).toContain(ESC_POS.FEED_AND_CUT);
  });

  // --- 7. Cancellation Reason Fallback ---
  it("7. Cancellation Reason default fallback when omitted", () => {
    const payload: KotCancelBuilderPayload = {
      kotNumber: "107",
      orderNumber: 1007,
      tableLabel: "Takeaway",
      orderSource: "TAKEAWAY",
    };

    const res = KotBuilder.buildCancelKot(payload, 58);
    expect(res.text).toContain("REASON: Cancelled by operator");
    expect(res.text).toContain("*** ALL ITEMS FOR THIS ORDER ***");
    expect(res.text).toContain("*** DO NOT PREPARE / STOP ***");
  });

  // --- 8. Empty Delta Handling ---
  it("8. Empty delta handling in Amendment KOT", () => {
    const payload: KotAmendmentBuilderPayload = {
      kotNumber: "108-M1",
      orderNumber: 1008,
      tableLabel: "Table 1",
      delta: {},
    };

    const res = KotBuilder.buildAmendmentKot(payload, 58);
    expect(res.text).toContain("*** NO ITEM CHANGES RECORDED ***");
    expect(res.text).toContain("TOTAL CHANGES: 0 item(s)");
  });

  // --- 9. Normal KOT Regression ---
  it("9. Normal KOT regression: standard build() unchanged", () => {
    const normalPayload: KotBuilderPayload = {
      restaurantName: "Cheese Corner",
      kotNumber: 50,
      orderNumber: 500,
      tableLabel: "Table 10",
      timestamp: "04:00 PM",
      customerName: "Alice",
      customerPhone: "9876543210",
      items: [
        { id: "1", name: "Farmhouse Pizza", qty: 2, modifiers: ["Extra Cheese"] },
      ],
      specialInstructions: "Serve hot",
    };

    const res = KotBuilder.build(normalPayload, 58);
    expect(res.text).toContain("CHEESE CORNER");
    expect(res.text).not.toContain("** MODIFIED KOT **");
    expect(res.text).not.toContain("*** CANCELLED KOT ***");
    expect(res.text).toContain("TABLE 10");
    expect(res.text).toContain("KOT #: 50");
    expect(res.text).toContain("Order #: 500");
    expect(res.text).toContain("Customer: Alice");
    expect(res.text).toContain("Phone   : 9876543210");
    expect(res.text).toContain("2x   Farmhouse Pizza");
    expect(res.text).toContain("> Extra Cheese");
    expect(res.text).toContain("SPECIAL INSTRUCTIONS:");
    expect(res.text).toContain("Serve hot");
    expect(res.text).toContain("TOTAL ITEMS: 2");
  });

  // --- 10. 58mm vs 80mm Formatting Consistency ---
  it("10. 58mm (32 cols) vs 80mm (48 cols) formatting consistency", () => {
    const payload: KotCancelBuilderPayload = {
      restaurantName: baseRestaurant,
      kotNumber: "109",
      orderNumber: 1009,
      tableLabel: "Table 8",
      reason: "Order rejected by kitchen due to ingredients stockout",
      cancelledItems: [{ name: "Special Chef Lasagna", qty: 1 }],
    };

    const res58 = KotBuilder.buildCancelKot(payload, 58);
    const res80 = KotBuilder.buildCancelKot(payload, 80);

    // 58mm divider length is 32
    expect(res58.text.split("\n")[0].length).toBe(32);
    // 80mm divider length is 48
    expect(res80.text.split("\n")[0].length).toBe(48);

    expect(res58.text).toContain("Special Chef Lasagna");
    expect(res80.text).toContain("Special Chef Lasagna");
  });
});
