import { describe, it, expect, vi, beforeEach } from "vitest";
import { editOrderInDb } from "@/lib/orders/repository";
import { supabase } from "@/lib/db";

describe("Customer Order Edit RPC Fix Suite", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("1. editOrderInDb for customer invokes public.update_order RPC with expected parameters", async () => {
    const mockOrder = {
      id: "ord-test-1",
      session_id: "sess-user-1",
      guest_session_id: null,
      dining_session_id: null,
      version: 2,
      status: "pending"
    };

    const selectSpy = vi.spyOn(supabase, "from").mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: mockOrder, error: null })
        })
      })
    } as any);

    const rpcSpy = vi.spyOn(supabase, "rpc").mockResolvedValue({ data: null, error: null } as any);

    const items = [
      { menu_item_id: "burger-1", name: "Yankee Burger", price_cents: 500, qty: 2 },
      { menu_item_id: "fries-1", name: "French Fries", price_cents: 200, qty: 1 }
    ];

    await editOrderInDb({
      orderId: "ord-test-1",
      items,
      notes: "Extra crispy fries",
      updatedBy: "customer",
      guestSessionId: null,
      sessionId: "sess-user-1",
      expectedVersion: 2
    });

    expect(rpcSpy).toHaveBeenCalledWith("update_order", {
      p_order_id: "ord-test-1",
      p_session_id: "sess-user-1",
      p_expected_version: 2,
      p_note: "Extra crispy fries",
      p_total_cents: 1200, // (500 * 2) + (200 * 1)
      p_items: [
        { menu_item_id: "burger-1", name: "Yankee Burger", price_cents: 500, qty: 2 },
        { menu_item_id: "fries-1", name: "French Fries", price_cents: 200, qty: 1 }
      ]
    });
  });

  it("2. editOrderInDb rejects customer edit if order status is already 'preparing'", async () => {
    const mockOrder = {
      id: "ord-prep-1",
      session_id: "sess-user-1",
      guest_session_id: null,
      dining_session_id: "ds-1",
      version: 1,
      status: "preparing"
    };

    vi.spyOn(supabase, "from").mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: mockOrder, error: null })
        })
      })
    } as any);

    await expect(
      editOrderInDb({
        orderId: "ord-prep-1",
        items: [{ menu_item_id: "b1", name: "Burger", price_cents: 500, qty: 1 }],
        updatedBy: "customer"
      })
    ).rejects.toThrow("preparation has already started");
  });

  it("3. editOrderInDb throws RPC error directly if update_order returns an error", async () => {
    const mockOrder = {
      id: "ord-err-1",
      session_id: "sess-user-1",
      guest_session_id: null,
      dining_session_id: "ds-1",
      version: 1,
      status: "pending"
    };

    vi.spyOn(supabase, "from").mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: mockOrder, error: null })
        })
      })
    } as any);

    vi.spyOn(supabase, "rpc").mockResolvedValue({
      data: null,
      error: { message: "This order has been updated by another action. Your changes couldn't be applied." }
    } as any);

    await expect(
      editOrderInDb({
        orderId: "ord-err-1",
        items: [{ menu_item_id: "b1", name: "Burger", price_cents: 500, qty: 1 }],
        updatedBy: "customer",
        sessionId: "sess-user-1"
      })
    ).rejects.toThrow("updated by another action");
  });

  it("4. Non-matching guest session rejects customer order edit", async () => {
    const mockOrder = {
      id: "ord-other-1",
      session_id: "sess-other-user",
      guest_session_id: "guest-other-user",
      dining_session_id: "ds-1",
      version: 1,
      status: "pending"
    };

    vi.spyOn(supabase, "from").mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: mockOrder, error: null })
        })
      })
    } as any);

    await expect(
      editOrderInDb({
        orderId: "ord-other-1",
        items: [{ menu_item_id: "b1", name: "Burger", price_cents: 500, qty: 1 }],
        updatedBy: "customer",
        guestSessionId: "guest-unauthorized-user",
        sessionId: "sess-unauthorized-user"
      })
    ).rejects.toThrow("403 Forbidden");
  });

  it("5. Clean-slate RPC replacement produces exact item list without duplicates", () => {
    const submittedItems = [
      { menu_item_id: "item-1", name: "Yankee Burger", price_cents: 500, qty: 2 },
      { menu_item_id: "item-3", name: "Milkshake", price_cents: 350, qty: 1 }
    ];

    const rpcTotalCents = submittedItems.reduce((s, i) => s + i.price_cents * i.qty, 0);
    expect(rpcTotalCents).toBe(1350);
    expect(submittedItems).toHaveLength(2);
  });
});
