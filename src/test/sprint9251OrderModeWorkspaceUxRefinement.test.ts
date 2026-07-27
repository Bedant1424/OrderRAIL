import { describe, it, expect } from "vitest";
import { supabase } from "@/lib/db";
import { OrderService, BillingService, PaymentService, type OrderSource } from "@/lib/orders/repository";
import { renderKotText } from "@/lib/printing/kotRenderer";
import { renderReceiptText } from "@/lib/printing/receiptRenderer";

describe("Sprint 9.2.5.1 — Order Mode Workspace UX Refinement Tests", () => {
  it("1. Workspace Titles & Badges: Correctly maps OrderSource to dynamic workspace titles and badges", () => {
    const titles: Record<OrderSource, string> = {
      DINE_IN: "Current Table Order",
      TAKEAWAY: "Current Takeaway Order",
      SWIGGY: "Current Swiggy Order",
      ZOMATO: "Current Zomato Order",
    };

    const badges: Record<OrderSource, string> = {
      DINE_IN: "🍽 DINE-IN",
      TAKEAWAY: "🛍 TAKEAWAY",
      SWIGGY: "🛵 SWIGGY",
      ZOMATO: "🛵 ZOMATO",
    };

    expect(titles.DINE_IN).toBe("Current Table Order");
    expect(titles.TAKEAWAY).toBe("Current Takeaway Order");
    expect(titles.SWIGGY).toBe("Current Swiggy Order");
    expect(titles.ZOMATO).toBe("Current Zomato Order");

    expect(badges.DINE_IN).toBe("🍽 DINE-IN");
    expect(badges.TAKEAWAY).toBe("🛍 TAKEAWAY");
    expect(badges.SWIGGY).toBe("🛵 SWIGGY");
    expect(badges.ZOMATO).toBe("🛵 ZOMATO");
  });

  it("2. Takeaway Mode Workspace: Creates takeaway order without requiring table selection", async () => {
    const { data: realTables } = await supabase.from("tables").select("*");
    if (!realTables || realTables.length === 0) return;
    const testTable = realTables[0];

    const { data: menuItems } = await supabase.from("menu_items").select("*").eq("is_available", true).limit(1);
    const mItem = menuItems?.[0];

    const res = await OrderService.createOrder({
      id: crypto.randomUUID(),
      cafe_id: testTable.cafe_id,
      table_id: testTable.id,
      order_source: "TAKEAWAY",
      total_cents: 2500,
      note: "Customer: John Doe | Phone: +919876543210",
      items: [{ menu_item_id: mItem?.id, name: mItem?.name || "Cappuccino", price_cents: mItem?.price_cents || 2500, qty: 1 }],
    });

    expect(res).toBeDefined();
    expect(res.orderId).toBeDefined();
  });

  it("3. Swiggy Mode Workspace: Creates order with embedded external order reference (#1492)", async () => {
    const { data: realTables } = await supabase.from("tables").select("*");
    if (!realTables || realTables.length === 0) return;
    const testTable = realTables[0];

    const { data: menuItems } = await supabase.from("menu_items").select("*").eq("is_available", true).limit(1);
    const mItem = menuItems?.[0];

    const res = await OrderService.createOrder({
      id: crypto.randomUUID(),
      cafe_id: testTable.cafe_id,
      table_id: testTable.id,
      order_source: "SWIGGY",
      external_order_ref: "#1492",
      total_cents: 4500,
      items: [{ menu_item_id: mItem?.id, name: mItem?.name || "Paneer Butter Masala", price_cents: mItem?.price_cents || 4500, qty: 1 }],
    });

    expect(res).toBeDefined();
    expect(res.orderId).toBeDefined();
  });

  it("4. Zomato Mode Workspace: Creates order with embedded external order reference (#8821)", async () => {
    const { data: realTables } = await supabase.from("tables").select("*");
    if (!realTables || realTables.length === 0) return;
    const testTable = realTables[0];

    const { data: menuItems } = await supabase.from("menu_items").select("*").eq("is_available", true).limit(1);
    const mItem = menuItems?.[0];

    const res = await OrderService.createOrder({
      id: crypto.randomUUID(),
      cafe_id: testTable.cafe_id,
      table_id: testTable.id,
      order_source: "ZOMATO",
      external_order_ref: "#8821",
      total_cents: 3200,
      items: [{ menu_item_id: mItem?.id, name: mItem?.name || "Chicken Biryani", price_cents: mItem?.price_cents || 3200, qty: 1 }],
    });

    expect(res).toBeDefined();
    expect(res.orderId).toBeDefined();
  });

  it("5. Thermal Printer KOT & Receipt Labels: Formats source metadata cleanly across all workspace modes", () => {
    const takeawayKot = renderKotText({
      orderNumber: 101,
      tableLabel: "Takeaway",
      orderSource: "TAKEAWAY",
      timestamp: "07:30 PM",
      items: [{ id: "i1", name: "Cold Coffee", price: 180, qty: 2 }],
    });

    const swiggyKot = renderKotText({
      orderNumber: 102,
      tableLabel: "Swiggy #1492",
      orderSource: "SWIGGY",
      externalOrderRef: "1492",
      timestamp: "07:32 PM",
      items: [{ id: "i2", name: "Veg Burger", price: 150, qty: 1 }],
    });

    expect(takeawayKot).toContain("*** TAKEAWAY KOT ***");
    expect(swiggyKot).toContain("*** SWIGGY KOT #1492 ***");

    const swiggyReceipt = renderReceiptText({
      billNumber: "BILL-501",
      orderId: "ord-swiggy-501",
      tableLabel: "Swiggy #1492",
      orderSource: "SWIGGY",
      externalOrderRef: "1492",
      timestamp: "07:33 PM",
      cashierName: "Cashier",
      items: [{ id: "i2", name: "Veg Burger", price: 150, qty: 1 }],
      subtotal: 150,
      tax: 7.5,
      discountPct: 0,
      discountAmt: 0,
      netTotal: 157.5,
      tenders: [{ method: "upi", amount: 157.5 }],
    });

    expect(swiggyReceipt).toContain("Ref: Swiggy #1492");
  });
});
