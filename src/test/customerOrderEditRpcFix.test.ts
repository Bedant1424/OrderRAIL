import { describe, it, expect, vi, beforeEach } from "vitest";
import { editOrderInDb } from "@/lib/orders/repository";
import { supabase } from "@/lib/db";

describe("Customer Order Edit RPC Fix & Session Resolution Suite", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("1. Anonymous customer edits own pending order with active guest session -> passes order.session_id to update_order (not guest_session_id)", async () => {
    const mockOrder = {
      id: "8adf0946-8d1f-41c8-aeaa-615098a35449",
      session_id: "1a0b4ef7-b10a-4ee1-b6db-de5ea2822e89", // Browser session ID
      guest_session_id: "gs-mock-guest-1", // Guest session ID
      dining_session_id: "fc836f95-54dc-4b39-abb2-4eb90f925cc4",
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

    const rpcSpy = vi.spyOn(supabase, "rpc").mockResolvedValue({ data: null, error: null } as any);

    const items = [
      { menu_item_id: "burger-1", name: "Cheese Burger", price_cents: 250, qty: 2 }
    ];

    await editOrderInDb({
      orderId: "8adf0946-8d1f-41c8-aeaa-615098a35449",
      items,
      notes: "No onions",
      updatedBy: "customer",
      guestSessionId: "gs-mock-guest-1",
      sessionId: "1a0b4ef7-b10a-4ee1-b6db-de5ea2822e89",
      expectedVersion: 1
    });

    // Assert: p_session_id MUST be order.session_id ("1a0b4ef7..."), NOT guestSessionId ("gs-mock-guest-1")
    expect(rpcSpy).toHaveBeenCalledWith("update_order", {
      p_order_id: "8adf0946-8d1f-41c8-aeaa-615098a35449",
      p_session_id: "1a0b4ef7-b10a-4ee1-b6db-de5ea2822e89",
      p_expected_version: 1,
      p_note: "No onions",
      p_total_cents: 500,
      p_items: [
        { menu_item_id: "burger-1", name: "Cheese Burger", price_cents: 250, qty: 2 }
      ]
    });
  });

  it("2. Different guest session cannot edit order (403 Forbidden without calling RPC)", async () => {
    const mockOrder = {
      id: "ord-guest-a",
      session_id: "browser-session-a",
      guest_session_id: "gs-mock-guest-a",
      dining_session_id: "ds-table-1",
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

    const rpcSpy = vi.spyOn(supabase, "rpc");

    await expect(
      editOrderInDb({
        orderId: "ord-guest-a",
        items: [{ menu_item_id: "b1", name: "Burger", price_cents: 500, qty: 1 }],
        updatedBy: "customer",
        guestSessionId: "gs-mock-guest-b", // Unauthorized different guest
        sessionId: "browser-session-b"
      })
    ).rejects.toThrow("403 Forbidden: Guests may only edit their own orders");

    expect(rpcSpy).not.toHaveBeenCalled();
  });

  it("3. Legacy order without guest_session_id edits cleanly with currentOrder.session_id", async () => {
    const mockOrder = {
      id: "ord-legacy-1",
      session_id: "browser-sess-legacy",
      guest_session_id: null,
      dining_session_id: "ds-legacy",
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

    const rpcSpy = vi.spyOn(supabase, "rpc").mockResolvedValue({ data: null, error: null } as any);

    await editOrderInDb({
      orderId: "ord-legacy-1",
      items: [{ menu_item_id: "b1", name: "Burger", price_cents: 500, qty: 1 }],
      updatedBy: "customer",
      guestSessionId: null,
      sessionId: "different-client-session"
    });

    // Expect order's stored session_id ("browser-sess-legacy") to take precedence
    expect(rpcSpy).toHaveBeenCalledWith("update_order", expect.objectContaining({
      p_order_id: "ord-legacy-1",
      p_session_id: "browser-sess-legacy"
    }));
  });

  it("4. Session fallback precedence: currentOrder.session_id > sessionId > getSessionId()", async () => {
    const orderWithSession = {
      id: "ord-p1",
      session_id: "stored-session-id",
      guest_session_id: null,
      dining_session_id: null,
      version: 1,
      status: "pending"
    };

    vi.spyOn(supabase, "from").mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: orderWithSession, error: null })
        })
      })
    } as any);

    const rpcSpy = vi.spyOn(supabase, "rpc").mockResolvedValue({ data: null, error: null } as any);

    await editOrderInDb({
      orderId: "ord-p1",
      items: [{ menu_item_id: "b1", name: "Burger", price_cents: 500, qty: 1 }],
      updatedBy: "customer",
      sessionId: "passed-session-id"
    });

    expect(rpcSpy).toHaveBeenCalledWith("update_order", expect.objectContaining({
      p_session_id: "stored-session-id"
    }));
  });

  it("5. Rejects customer edit if order status is already 'preparing'", async () => {
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

  it("6. Propagates RPC errors if update_order returns an error", async () => {
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
});
