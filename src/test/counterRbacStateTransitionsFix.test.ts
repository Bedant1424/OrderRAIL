import { describe, it, expect, vi, beforeEach } from "vitest";
import { updateOrderStatusInDb, type OrderWithItems } from "@/lib/orders/repository";
import { markTableFreeInDb, diagnoseStaleSessions } from "@/lib/tables/tableRepository";
import { supabase } from "@/lib/db";

/**
 * Sprint 9.3 — Counter RBAC Authorization & Failed State Transitions Verification Suite
 */

describe("Counter RBAC Authorization & State Transitions Fix Suite", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("1. updateOrderStatusInDb permits role 'counter' when Supabase returns updated row", async () => {
    const updateSpy = vi.spyOn(supabase, "from").mockReturnValue({
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockResolvedValue({
        data: [{ id: "order-counter-1" }],
        error: null,
      }),
    } as any);

    await expect(updateOrderStatusInDb("order-counter-1", "preparing", "counter")).resolves.not.toThrow();
    expect(updateSpy).toHaveBeenCalledWith("orders");
  });

  it("2. updateOrderStatusInDb permits role 'staff'", async () => {
    vi.spyOn(supabase, "from").mockReturnValue({
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockResolvedValue({
        data: [{ id: "order-staff-1" }],
        error: null,
      }),
    } as any);

    await expect(updateOrderStatusInDb("order-staff-1", "preparing", "staff")).resolves.not.toThrow();
  });

  it("3. updateOrderStatusInDb permits role 'owner'", async () => {
    vi.spyOn(supabase, "from").mockReturnValue({
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockResolvedValue({
        data: [{ id: "order-owner-1" }],
        error: null,
      }),
    } as any);

    await expect(updateOrderStatusInDb("order-owner-1", "served", "owner")).resolves.not.toThrow();
  });

  it("4. updateOrderStatusInDb rejects when 0 rows are returned (e.g. RLS filter or unauthenticated)", async () => {
    vi.spyOn(supabase, "from").mockReturnValue({
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockResolvedValue({
        data: [],
        error: null,
      }),
    } as any);

    await expect(updateOrderStatusInDb("order-anon-1", "preparing", "customer")).rejects.toThrow(
      "Failed to update order status: Order 'order-anon-1' was not found or updated in the database."
    );
  });

  it("5. markTableFreeInDb halts execution when direct table release fails", async () => {
    // Mock orders update to succeed
    vi.spyOn(supabase, "from").mockImplementation((table: string) => {
      if (table === "orders") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          neq: vi.fn().mockResolvedValue({ data: [], error: null }),
          update: vi.fn().mockReturnThis(),
        } as any;
      }
      if (table === "tables") {
        return {
          update: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({
            error: { message: "Cannot mark table free: there are active orders in the current dining session." },
          }),
        } as any;
      }
      return {} as any;
    });

    await expect(markTableFreeInDb("table-1", "sess-1")).rejects.toThrow(
      "Failed to set table free: Cannot mark table free: there are active orders in the current dining session."
    );
  });

  it("6. diagnoseStaleSessions accurately scans tables and sessions without mutating database data", async () => {
    vi.spyOn(supabase, "from").mockImplementation((table: string) => {
      if (table === "tables") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({
            data: [
              { id: "t-1", label: "Table 1", status: "occupied", active_session_id: "sess-closed-1" },
            ],
            error: null,
          }),
        } as any;
      }
      if (table === "dining_sessions") {
        return {
          select: vi.fn().mockReturnThis(),
          in: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({
            data: [{ id: "sess-closed-1", table_id: "t-1", status: "closed" }],
            error: null,
          }),
        } as any;
      }
      if (table === "orders") {
        return {
          select: vi.fn().mockReturnThis(),
          in: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          not: vi.fn().mockResolvedValue({ data: [], error: null }),
        } as any;
      }
      return {} as any;
    });

    const diag = await diagnoseStaleSessions("cafe-123");
    expect(diag.tablesWithClosedActiveSession).toHaveLength(1);
    expect(diag.tablesWithClosedActiveSession[0].tableId).toBe("t-1");
    expect(diag.closedSessionsReferencedByTable).toHaveLength(1);
  });
});
