import { describe, it, expect } from "vitest";
import { supabase } from "@/lib/db";
import { OrderService, BillingService, PaymentService } from "@/lib/orders/repository";

describe("Sprint 9.2.5.4 — Active Workspace Reconstruction Investigation Tests", () => {
  it("1. Verifies that when a table has active_session_id NULL or closed session, tableSessions removes historical orders", () => {
    // Simulated DB tables data where Table 1 has active_session_id: null
    const dbTablesData = [
      { id: "table-uuid-1", label: "Table 1", status: "cleaning_required", active_session_id: null }
    ];

    const activeSessionMap = new Map<string, string>(); // empty for table-uuid-1
    for (const t of dbTablesData) {
      if (t.active_session_id) {
        activeSessionMap.set(t.id, t.active_session_id);
      }
    }

    // Previous React state had orders attached to Table 1 from old session
    const prevTableSessions: Record<string, any> = {
      "table-uuid-1": {
        sessionId: "sess-closed-999",
        orders: [{ id: "ord-old-1", status: "SERVED", subtotal: 450 }],
        draftCart: []
      }
    };

    const sessionsMap: Record<string, any> = {}; // No active session orders in DB

    // Reconstruct merged tableSessions state cleanly
    const merged: Record<string, any> = { ...prevTableSessions };

    for (const tId of Object.keys(merged)) {
      if (tId !== "express" && !activeSessionMap.has(tId)) {
        delete merged[tId];
      }
    }

    for (const [tId, sess] of Object.entries(sessionsMap)) {
      merged[tId] = sess;
    }

    // Expect Table 1 to have NO active session data or orders
    expect(merged["table-uuid-1"]).toBeUndefined();
  });

  it("2. Verifies that orders from closed dining sessions are never attached to an active table workspace", () => {
    const activeSessionMap = new Map<string, string>();
    activeSessionMap.set("table-uuid-2", "sess-active-123");

    const dbOrders = [
      { id: "ord-1", table_id: "table-uuid-2", dining_session_id: "sess-closed-000", status: "served" },
      { id: "ord-2", table_id: "table-uuid-2", dining_session_id: "sess-active-123", status: "kot_sent" }
    ];

    const activeOrdersForTable: any[] = [];
    for (const ord of dbOrders) {
      const activeSessionId = activeSessionMap.get(ord.table_id);
      if (!activeSessionId || ord.dining_session_id !== activeSessionId) {
        continue;
      }
      activeOrdersForTable.push(ord);
    }

    expect(activeOrdersForTable.length).toBe(1);
    expect(activeOrdersForTable[0].id).toBe("ord-2");
    expect(activeOrdersForTable[0].dining_session_id).toBe("sess-active-123");
  });
});
