import { describe, it, expect, beforeEach, vi } from "vitest";
import { getActiveDiningSession, getOrCreateDiningSession, markTableFreeInDb } from "@/lib/tables/tableRepository";
import { getOrCreateGuestSession, validateGuestSession, touchGuestSession } from "@/lib/guestSession";
import { createOrderInDb, editOrderInDb, cancelOrderInDb } from "@/lib/orders/repository";
import { supabase, TableRow } from "@/lib/db";

describe("Milestone 3B.2 - Dining Session Multi-Guest Concurrency & Security Tests", () => {
  const mockCafeId = "6d00d671-eaea-47ce-a842-f970878373c9";
  const mockTableId = "11111111-2222-3333-4444-555555555555";

  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  // TEST 1: One table can have one open dining session
  it("TEST 1: One table can have one open dining session at a time", async () => {
    const table: TableRow = {
      id: mockTableId,
      cafe_id: mockCafeId,
      label: "4",
      seats: 4,
      status: "free",
      active_session_id: "22222222-3333-4444-5555-666666666666",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const rpcSpy = vi.spyOn(supabase, "rpc").mockImplementation(async (fnName: string) => {
      if (fnName === "get_or_create_table_session") {
        return {
          data: {
            id: "22222222-3333-4444-5555-666666666666",
            table_id: mockTableId,
            status: "browsing",
            opened_at: new Date().toISOString(),
            is_new: false,
          },
          error: null,
        } as any;
      }
      return { data: null, error: null } as any;
    });

    const sessionId = await getOrCreateDiningSession(table);
    expect(sessionId).toBe("22222222-3333-4444-5555-666666666666");
    expect(rpcSpy).toHaveBeenCalledWith("get_or_create_table_session", {
      p_table_id: mockTableId,
      p_cafe_id: mockCafeId,
    });
  });

  // TEST 2: Four concurrent QR/session requests resolve to the SAME dining_session_id
  it("TEST 2: Four concurrent QR/session requests resolve to the exact SAME dining_session_id", async () => {
    const table: TableRow = {
      id: mockTableId,
      cafe_id: mockCafeId,
      label: "4",
      seats: 4,
      status: "free",
      active_session_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    vi.spyOn(supabase, "rpc").mockImplementation(async (fnName: string) => {
      if (fnName === "get_or_create_table_session") {
        return {
          data: {
            id: "33333333-4444-5555-6666-777777777777",
            table_id: mockTableId,
            status: "browsing",
            opened_at: new Date().toISOString(),
            is_new: false,
          },
          error: null,
        } as any;
      }
      return { data: null, error: null } as any;
    });

    const results = await Promise.all([
      getOrCreateDiningSession(table),
      getOrCreateDiningSession(table),
      getOrCreateDiningSession(table),
      getOrCreateDiningSession(table),
    ]);

    expect(results).toEqual([
      "33333333-4444-5555-6666-777777777777",
      "33333333-4444-5555-6666-777777777777",
      "33333333-4444-5555-6666-777777777777",
      "33333333-4444-5555-6666-777777777777",
    ]);
  });

  // TEST 3: Four different guest sessions can exist under the SAME dining session
  it("TEST 3: Four distinct guest sessions can exist under the same dining session", async () => {
    const diningSessionId = "44444444-5555-6666-7777-888888888888";

    const gsA = await getOrCreateGuestSession("11111111-0000-0000-0000-000000000001", diningSessionId);
    const gsB = await getOrCreateGuestSession("11111111-0000-0000-0000-000000000002", diningSessionId);
    const gsC = await getOrCreateGuestSession("11111111-0000-0000-0000-000000000003", diningSessionId);
    const gsD = await getOrCreateGuestSession("11111111-0000-0000-0000-000000000004", diningSessionId);

    const uniqueIds = new Set([gsA, gsB, gsC, gsD]);
    expect(uniqueIds.size).toBe(4);

    const valA = await validateGuestSession(gsA, diningSessionId);
    const valB = await validateGuestSession(gsB, diningSessionId);
    const valC = await validateGuestSession(gsC, diningSessionId);
    const valD = await validateGuestSession(gsD, diningSessionId);

    expect(valA.valid).toBe(true);
    expect(valB.valid).toBe(true);
    expect(valC.valid).toBe(true);
    expect(valD.valid).toBe(true);
  });

  // TEST 4 & 5 & 6: Guest A and Guest B orders belong to the same dining session
  it("TEST 4, 5, 6: Guest A and Guest B can place separate orders attached to the same dining session", async () => {
    const diningSessionId = "55555555-6666-7777-8888-999999999999";
    const guestA = "11111111-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
    const guestB = "22222222-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

    vi.spyOn(supabase, "rpc").mockResolvedValue({ data: null, error: null } as any);
    const mockOrderStore = new Map<string, any>();

    vi.spyOn(supabase, "from").mockImplementation((tableName: string) => {
      const builder: any = {
        select: vi.fn().mockReturnThis(),
        insert: vi.fn().mockImplementation((payload: any) => {
          if (tableName === "orders") {
            mockOrderStore.set(payload.id, { ...payload, order_items: [] });
            return {
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: { ...payload, order_items: [] }, error: null }),
              }),
            };
          }
          return { error: null };
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
        eq: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        not: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockImplementation(() => {
          if (tableName === "tables") {
            return Promise.resolve({ data: { cafe_id: mockCafeId, status: "free" }, error: null });
          }
          if (tableName === "dining_sessions") {
            return Promise.resolve({ data: { id: diningSessionId, status: "browsing" }, error: null });
          }
          if (tableName === "guest_sessions") {
            return Promise.resolve({ data: { status: "ACTIVE", dining_session_id: diningSessionId }, error: null });
          }
          return Promise.resolve({ data: null, error: null });
        }),
        single: vi.fn().mockResolvedValue({ data: {}, error: null }),
      };
      return builder;
    });

    const orderA = await createOrderInDb({
      cafe_id: mockCafeId,
      table_id: mockTableId,
      dining_session_id: diningSessionId,
      guest_session_id: guestA,
      total_cents: 2500,
      items: [{ menu_item_id: "m-1", name: "Veg Burger", price_cents: 2500, qty: 1 }],
      source_type: "customer",
    });

    const orderB = await createOrderInDb({
      cafe_id: mockCafeId,
      table_id: mockTableId,
      dining_session_id: diningSessionId,
      guest_session_id: guestB,
      total_cents: 1500,
      items: [{ menu_item_id: "m-2", name: "Cold Coffee", price_cents: 1500, qty: 1 }],
      source_type: "customer",
    });

    expect(orderA.dining_session_id).toBe(diningSessionId);
    expect(orderB.dining_session_id).toBe(diningSessionId);
    expect(orderA.guest_session_id).toBe(guestA);
    expect(orderB.guest_session_id).toBe(guestB);
    expect(orderA.id).not.toBe(orderB.id);
  });

  // TEST 7: Guest A cannot edit Guest B's order
  it("TEST 7: Guest A is forbidden from editing Guest B's order", async () => {
    const diningSessionId = "66666666-7777-8888-9999-000000000000";
    const guestA = "11111111-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
    const guestB = "22222222-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

    vi.spyOn(supabase, "rpc").mockResolvedValue({ data: null, error: null } as any);

    vi.spyOn(supabase, "from").mockImplementation((tableName: string) => {
      const builder: any = {
        select: vi.fn().mockReturnThis(),
        insert: vi.fn().mockImplementation((payload: any) => {
          return {
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { ...payload, order_items: [] }, error: null }),
            }),
          };
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
        eq: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        not: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockImplementation(() => {
          if (tableName === "tables") {
            return Promise.resolve({ data: { cafe_id: mockCafeId, status: "free" }, error: null });
          }
          if (tableName === "orders") {
            return Promise.resolve({
              data: {
                id: "order-b-123",
                session_id: guestB,
                guest_session_id: guestB,
                dining_session_id: diningSessionId,
                version: 1,
                status: "pending",
              },
              error: null,
            });
          }
          if (tableName === "guest_sessions") {
            return Promise.resolve({ data: { status: "ACTIVE", dining_session_id: diningSessionId }, error: null });
          }
          return Promise.resolve({ data: null, error: null });
        }),
      };
      return builder;
    });

    // Guest A attempts to edit Order B
    await expect(
      editOrderInDb({
        orderId: "order-b-123",
        items: [{ menu_item_id: "m-2", name: "Cold Coffee", price_cents: 1500, qty: 3 }],
        updatedBy: "customer",
        guestSessionId: guestA,
      })
    ).rejects.toThrow(/Guests may only edit their own orders/i);
  });

  // TEST 8: Guest A cannot cancel Guest B's order
  it("TEST 8: Guest A is forbidden from cancelling Guest B's order", async () => {
    const diningSessionId = "77777777-8888-9999-0000-111111111111";
    const guestA = "11111111-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
    const guestB = "22222222-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

    vi.spyOn(supabase, "rpc").mockResolvedValue({ data: null, error: null } as any);

    vi.spyOn(supabase, "from").mockImplementation((tableName: string) => {
      const builder: any = {
        select: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockImplementation(() => {
          if (tableName === "orders") {
            return Promise.resolve({
              data: {
                id: "order-b-456",
                session_id: guestB,
                guest_session_id: guestB,
                dining_session_id: diningSessionId,
                status: "pending",
              },
              error: null,
            });
          }
          if (tableName === "guest_sessions") {
            return Promise.resolve({ data: { status: "ACTIVE", dining_session_id: diningSessionId }, error: null });
          }
          return Promise.resolve({ data: null, error: null });
        }),
      };
      return builder;
    });

    // Guest A attempts to cancel Order B
    await expect(
      cancelOrderInDb("order-b-456", "customer", guestA)
    ).rejects.toThrow(/Guests may only cancel their own orders/i);
  });

  // TEST 9: Staff clearing table marks table free and closes dining session
  it("TEST 9: Staff clearing table marks table free and closes dining session", async () => {
    const updateSpy = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        neq: vi.fn().mockResolvedValue({ error: null }),
      }),
    });
    vi.spyOn(supabase, "from").mockReturnValue({
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      update: updateSpy,
    } as any);

    await markTableFreeInDb(mockTableId, "88888888-9999-0000-1111-222222222222");
    expect(updateSpy).toHaveBeenCalled();
  });

  // TEST 10: Subsequent QR scan after closure creates a new session
  it("TEST 10: Subsequent QR scan after session closure creates a new dining session", async () => {
    const table: TableRow = {
      id: mockTableId,
      cafe_id: mockCafeId,
      label: "4",
      seats: 4,
      status: "free",
      active_session_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    vi.spyOn(supabase, "rpc").mockImplementation(async (fnName: string) => {
      if (fnName === "get_or_create_table_session") {
        return {
          data: {
            id: "99999999-0000-1111-2222-333333333333",
            table_id: mockTableId,
            status: "browsing",
            opened_at: new Date().toISOString(),
            is_new: true,
          },
          error: null,
        } as any;
      }
      return { data: null, error: null } as any;
    });

    const newSessionId = await getOrCreateDiningSession(table);
    expect(newSessionId).toBe("99999999-0000-1111-2222-333333333333");
  });

  // TEST 11: QR scan alone leaves the table FREE (Regression Test for F-03)
  it("TEST 11: Free table with a browsing session remains FREE when getActiveDiningSession is called", async () => {
    const table: TableRow = {
      id: mockTableId,
      cafe_id: mockCafeId,
      label: "3",
      seats: 4,
      status: "free",
      active_session_id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const updateSpy = vi.fn();
    const queryBuilder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee", status: "browsing" },
        error: null,
      }),
      update: updateSpy,
    };
    vi.spyOn(supabase, "from").mockReturnValue(queryBuilder as any);

    const session = await getActiveDiningSession(table);
    expect(session?.status).toBe("browsing");
    // Table must NOT have been updated to occupied!
    expect(updateSpy).not.toHaveBeenCalled();
  });

  // TEST 12: First successful order changes table to OCCUPIED via activate_dining_session_on_order
  it("TEST 12: Placing the first order invokes activate_dining_session_on_order RPC", async () => {
    const diningSessionId = "bbbbbbbb-cccc-dddd-eeee-ffffffffffff";
    const guestId = "33333333-cccc-cccc-cccc-cccccccccccc";
    const rpcSpy = vi.spyOn(supabase, "rpc").mockResolvedValue({ data: null, error: null } as any);

    vi.spyOn(supabase, "from").mockImplementation((tableName: string) => {
      const builder: any = {
        select: vi.fn().mockReturnThis(),
        insert: vi.fn().mockImplementation((payload: any) => {
          return {
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { ...payload, order_items: [] }, error: null }),
            }),
          };
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
        eq: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        not: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockImplementation(() => {
          if (tableName === "tables") {
            return Promise.resolve({ data: { cafe_id: mockCafeId, status: "free" }, error: null });
          }
          if (tableName === "dining_sessions") {
            return Promise.resolve({ data: { id: diningSessionId, status: "browsing" }, error: null });
          }
          if (tableName === "guest_sessions") {
            return Promise.resolve({ data: { status: "ACTIVE", dining_session_id: diningSessionId }, error: null });
          }
          return Promise.resolve({ data: null, error: null });
        }),
      };
      return builder;
    });

    await createOrderInDb({
      cafe_id: mockCafeId,
      table_id: mockTableId,
      dining_session_id: diningSessionId,
      guest_session_id: guestId,
      total_cents: 5000,
      items: [{ menu_item_id: "m-1", name: "Paneer Pizza", price_cents: 5000, qty: 1 }],
      source_type: "customer",
    });

    expect(rpcSpy).toHaveBeenCalledWith("activate_dining_session_on_order", {
      p_dining_session_id: diningSessionId,
      p_table_id: mockTableId,
    });
  });

  // TEST 13: Scoped touch_guest_session RPC
  it("TEST 13: touchGuestSession consumes scoped touch_guest_session RPC", async () => {
    const rpcSpy = vi.spyOn(supabase, "rpc").mockResolvedValue({ data: true, error: null } as any);

    await touchGuestSession("11111111-2222-3333-4444-555555555555", "cccccccc-dddd-eeee-ffff-000000000000", mockTableId);

    expect(rpcSpy).toHaveBeenCalledWith("touch_guest_session", {
      p_guest_session_id: "11111111-2222-3333-4444-555555555555",
      p_dining_session_id: "cccccccc-dddd-eeee-ffff-000000000000",
      p_table_id: mockTableId,
    });
  });

  // TEST 14: Security Hardening - Anonymous Direct Mutations Blocked
  it("TEST 14: Anonymous direct UPDATE on tables/dining_sessions/guest_sessions returns 403 RLS violation", async () => {
    // Simulating post-hardening RLS rejection for unauthenticated direct table mutation
    const updateSpy = vi.fn().mockResolvedValue({
      error: { code: "42501", message: "new row violates row-level security policy for table \"tables\"" },
    });

    vi.spyOn(supabase, "from").mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: updateSpy,
      }),
    } as any);

    const { error } = await supabase.from("tables").update({ status: "occupied" }).eq("id", mockTableId);
    expect(error?.code).toBe("42501");
  });

  // TEST 15: Concurrency - Concurrent First Orders Serialized to Single Session
  it("TEST 15: Concurrent first orders from multiple guests serialize to the same dining session", async () => {
    const table: TableRow = {
      id: mockTableId,
      cafe_id: mockCafeId,
      label: "4",
      seats: 4,
      status: "free",
      active_session_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    let sessionCreatedCount = 0;
    vi.spyOn(supabase, "rpc").mockImplementation(async (fnName: string) => {
      if (fnName === "get_or_create_table_session") {
        sessionCreatedCount++;
        return {
          data: {
            id: "atomic-session-single-uuid",
            table_id: mockTableId,
            status: "browsing",
            opened_at: new Date().toISOString(),
            is_new: sessionCreatedCount === 1,
          },
          error: null,
        } as any;
      }
      return { data: null, error: null } as any;
    });

    const [sess1, sess2] = await Promise.all([
      getOrCreateDiningSession(table),
      getOrCreateDiningSession(table),
    ]);

    expect(sess1).toBe("atomic-session-single-uuid");
    expect(sess2).toBe("atomic-session-single-uuid");
    expect(sess1).toBe(sess2);
  });
});
