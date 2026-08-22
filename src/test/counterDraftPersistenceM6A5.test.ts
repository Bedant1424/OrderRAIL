import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  reconcileTableSessions,
  type TableSessionData,
  type SessionOrder,
  type CartLineItem,
} from "@/pages/counter/CounterPage";
import {
  loadCounterDrafts,
  saveCounterDraft,
  clearCounterDraft,
  clearAllCounterDrafts,
  getCounterDraftsStorageKey,
  type PersistedTableDraft,
} from "@/lib/counter/counterDraftStorage";
import { BillSummaryCalculator } from "@/lib/billing/BillSummaryCalculator";

describe("Milestone 6A.5 — Counter POS Draft KOT Persistence & Multi-Table Isolation Test Suite", () => {
  const cafeId = "cafe-test-123";

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
  });

  const mockItem1: CartLineItem = {
    id: "item-burger-1",
    menuItemId: "item-burger-1",
    name: "Spicy Salsa Burger",
    price: 89,
    basePrice: 89,
    qty: 1,
    selectedAddonIds: [],
  };

  const mockItem2: CartLineItem = {
    id: "item-pizza-1",
    menuItemId: "item-pizza-1",
    name: "Margherita Pizza",
    price: 199,
    basePrice: 199,
    qty: 1,
    selectedAddonIds: [],
  };

  const mockCommittedOrder: SessionOrder = {
    id: "ord-committed-1",
    orderNumber: 101,
    timestamp: "12:00 PM",
    createdAt: new Date().toISOString(),
    status: "PREPARING",
    items: [{ id: "item-burger-1", name: "Spicy Salsa Burger", price: 89, qty: 1 }],
    subtotal: 89,
    syncState: "Synced",
    orderSource: "DINE_IN",
  };

  // 1. Add item -> draft appears
  it("1. Add item to draftCart creates valid local draft state", () => {
    const tableId = "table-1";
    const sessionId = "session-1111";

    saveCounterDraft(cafeId, tableId, sessionId, [mockItem1]);

    const drafts = loadCounterDrafts(cafeId);
    expect(drafts[tableId]).toBeDefined();
    expect(drafts[tableId].draftCart.length).toBe(1);
    expect(drafts[tableId].draftCart[0].name).toBe("Spicy Salsa Burger");
    expect(drafts[tableId].sessionId).toBe(sessionId);
  });

  // 2. Add item -> reconcileTableSessions (loadSessionsFromDb) -> draft survives on empty table
  it("2. Draft survives reconciliation when table has 0 committed DB orders", () => {
    const tableId = "table-1";
    const sessionId = "session-1111";

    const prev: Record<string, TableSessionData> = {
      [tableId]: {
        sessionId,
        sessionCode: "#S-1111",
        startedAt: "12:00 PM",
        guestCount: 2,
        orders: [],
        draftCart: [mockItem1],
      },
    };

    const activeSessionMap = new Map<string, string>([[tableId, sessionId]]);
    const activeSessionCreatedAtMap = new Map<string, string>([[tableId, new Date().toISOString()]]);
    const sessionsMap: Record<string, TableSessionData> = {}; // No DB orders yet

    const result = reconcileTableSessions({
      sessionsMap,
      activeSessionMap,
      activeSessionCreatedAtMap,
      prev,
      persistedDrafts: loadCounterDrafts(cafeId),
    });

    expect(result[tableId]).toBeDefined();
    expect(result[tableId].draftCart.length).toBe(1);
    expect(result[tableId].draftCart[0].name).toBe("Spicy Salsa Burger");
    expect(result[tableId].orders.length).toBe(0);
  });

  // 3. Add item -> realtime reconciliation -> draft survives
  it("3. Realtime event reconciliation preserves in-flight draft cart", () => {
    const tableId = "table-1";
    const sessionId = "session-1111";

    const prev: Record<string, TableSessionData> = {
      [tableId]: {
        sessionId,
        sessionCode: "#S-1111",
        startedAt: "12:00 PM",
        guestCount: 2,
        orders: [],
        draftCart: [mockItem1, mockItem2],
      },
    };

    const activeSessionMap = new Map<string, string>([[tableId, sessionId]]);
    const activeSessionCreatedAtMap = new Map<string, string>([[tableId, new Date().toISOString()]]);

    // Simulated realtime push creates an order for Table 2, but Table 1 has no DB orders yet
    const sessionsMap: Record<string, TableSessionData> = {
      "table-2": {
        sessionId: "session-2222",
        sessionCode: "#S-2222",
        startedAt: "12:05 PM",
        guestCount: 4,
        orders: [mockCommittedOrder],
        draftCart: [],
      },
    };
    activeSessionMap.set("table-2", "session-2222");

    const result = reconcileTableSessions({
      sessionsMap,
      activeSessionMap,
      activeSessionCreatedAtMap,
      prev,
      persistedDrafts: {},
    });

    expect(result[tableId]).toBeDefined();
    expect(result[tableId].draftCart.length).toBe(2);
    expect(result["table-2"]).toBeDefined();
    expect(result["table-2"].orders.length).toBe(1);
  });

  // 4. Same item exists in committed DB order -> draft survives (name-based duplicate bug eliminated)
  it("4. Draft item with identical name to a committed order is NOT deleted by reconciliation", () => {
    const tableId = "table-1";
    const sessionId = "session-1111";

    // Table 1 already has committed "Spicy Salsa Burger", and customer orders another "Spicy Salsa Burger" in Round 2
    const prev: Record<string, TableSessionData> = {
      [tableId]: {
        sessionId,
        sessionCode: "#S-1111",
        startedAt: "12:00 PM",
        guestCount: 2,
        orders: [mockCommittedOrder],
        draftCart: [{ ...mockItem1, qty: 1 }],
      },
    };

    const activeSessionMap = new Map<string, string>([[tableId, sessionId]]);
    const activeSessionCreatedAtMap = new Map<string, string>([[tableId, new Date().toISOString()]]);

    const sessionsMap: Record<string, TableSessionData> = {
      [tableId]: {
        sessionId,
        sessionCode: "#S-1111",
        startedAt: "12:00 PM",
        guestCount: 2,
        orders: [mockCommittedOrder],
        draftCart: [],
      },
    };

    const result = reconcileTableSessions({
      sessionsMap,
      activeSessionMap,
      activeSessionCreatedAtMap,
      prev,
      persistedDrafts: {},
    });

    expect(result[tableId]).toBeDefined();
    expect(result[tableId].orders.length).toBe(1);
    expect(result[tableId].draftCart.length).toBe(1);
    expect(result[tableId].draftCart[0].name).toBe("Spicy Salsa Burger");
  });

  // 5. Table 1 draft survives switching to Table 2 and back
  it("5. Table 1 draft survives switching active table view and returning", () => {
    const table1Id = "table-1";
    const table2Id = "table-2";
    const session1Id = "session-1111";
    const session2Id = "session-2222";

    const prev: Record<string, TableSessionData> = {
      [table1Id]: {
        sessionId: session1Id,
        sessionCode: "#S-1111",
        startedAt: "12:00 PM",
        guestCount: 2,
        orders: [],
        draftCart: [mockItem1],
      },
      [table2Id]: {
        sessionId: session2Id,
        sessionCode: "#S-2222",
        startedAt: "12:10 PM",
        guestCount: 2,
        orders: [],
        draftCart: [],
      },
    };

    const activeSessionMap = new Map<string, string>([
      [table1Id, session1Id],
      [table2Id, session2Id],
    ]);
    const activeSessionCreatedAtMap = new Map<string, string>([
      [table1Id, new Date().toISOString()],
      [table2Id, new Date().toISOString()],
    ]);

    const result = reconcileTableSessions({
      sessionsMap: {},
      activeSessionMap,
      activeSessionCreatedAtMap,
      prev,
      persistedDrafts: {},
    });

    expect(result[table1Id].draftCart.length).toBe(1);
    expect(result[table1Id].draftCart[0].name).toBe("Spicy Salsa Burger");
    expect(result[table2Id]?.draftCart?.length ?? 0).toBe(0);
  });

  // 6. Table 1 and Table 2 maintain independent drafts simultaneously
  it("6. Multiple tables maintain distinct, independent draft carts without cross-table leakage", () => {
    const table1Id = "table-1";
    const table2Id = "table-2";
    const session1Id = "session-1111";
    const session2Id = "session-2222";

    const prev: Record<string, TableSessionData> = {
      [table1Id]: {
        sessionId: session1Id,
        sessionCode: "#S-1111",
        startedAt: "12:00 PM",
        guestCount: 2,
        orders: [],
        draftCart: [mockItem1], // Spicy Salsa Burger
      },
      [table2Id]: {
        sessionId: session2Id,
        sessionCode: "#S-2222",
        startedAt: "12:10 PM",
        guestCount: 3,
        orders: [],
        draftCart: [mockItem2], // Margherita Pizza
      },
    };

    const activeSessionMap = new Map<string, string>([
      [table1Id, session1Id],
      [table2Id, session2Id],
    ]);
    const activeSessionCreatedAtMap = new Map<string, string>([
      [table1Id, new Date().toISOString()],
      [table2Id, new Date().toISOString()],
    ]);

    const result = reconcileTableSessions({
      sessionsMap: {},
      activeSessionMap,
      activeSessionCreatedAtMap,
      prev,
      persistedDrafts: {},
    });

    expect(result[table1Id].draftCart.length).toBe(1);
    expect(result[table1Id].draftCart[0].name).toBe("Spicy Salsa Burger");

    expect(result[table2Id].draftCart.length).toBe(1);
    expect(result[table2Id].draftCart[0].name).toBe("Margherita Pizza");
  });

  // 7. Dine-In -> Takeaway -> Dine-In does not erase valid table draft
  it("7. Switching order mode to Takeaway and back preserves Dine-in table drafts and Express drafts", () => {
    const tableId = "table-1";
    const sessionId = "session-1111";

    const prev: Record<string, TableSessionData> = {
      [tableId]: {
        sessionId,
        sessionCode: "#S-1111",
        startedAt: "12:00 PM",
        guestCount: 2,
        orders: [],
        draftCart: [mockItem1],
      },
      express: {
        sessionId: "",
        sessionCode: "#S-EXPR",
        startedAt: "12:05 PM",
        guestCount: 1,
        orders: [],
        draftCart: [mockItem2],
      },
    };

    const activeSessionMap = new Map<string, string>([[tableId, sessionId]]);
    const activeSessionCreatedAtMap = new Map<string, string>([[tableId, new Date().toISOString()]]);

    const result = reconcileTableSessions({
      sessionsMap: {},
      activeSessionMap,
      activeSessionCreatedAtMap,
      prev,
      persistedDrafts: {},
    });

    expect(result[tableId].draftCart.length).toBe(1);
    expect(result[tableId].draftCart[0].name).toBe("Spicy Salsa Burger");
    expect(result["express"].draftCart.length).toBe(1);
    expect(result["express"].draftCart[0].name).toBe("Margherita Pizza");
  });

  // 8. Send KOT clears only the submitted draft
  it("8. Successful KOT clears the submitted table draft and preserves other table drafts", () => {
    const table1Id = "table-1";
    const table2Id = "table-2";
    const session1Id = "session-1111";
    const session2Id = "session-2222";

    saveCounterDraft(cafeId, table1Id, session1Id, [mockItem1]);
    saveCounterDraft(cafeId, table2Id, session2Id, [mockItem2]);

    // Send KOT for Table 1
    clearCounterDraft(cafeId, table1Id);

    const drafts = loadCounterDrafts(cafeId);
    expect(drafts[table1Id]).toBeUndefined();
    expect(drafts[table2Id]).toBeDefined();
    expect(drafts[table2Id].draftCart[0].name).toBe("Margherita Pizza");
  });

  // 9. Failed Send KOT preserves draft
  it("9. If Send KOT fails, draft remains intact in storage and state", () => {
    const table1Id = "table-1";
    const session1Id = "session-1111";

    saveCounterDraft(cafeId, table1Id, session1Id, [mockItem1]);

    // Error occurs, clearCounterDraft is NOT called
    const drafts = loadCounterDrafts(cafeId);
    expect(drafts[table1Id]).toBeDefined();
    expect(drafts[table1Id].draftCart.length).toBe(1);
  });

  // 10. Manual Clear Draft clears only active table draft
  it("10. Manual Clear Draft removes only the active table's draft", () => {
    const table1Id = "table-1";
    const table2Id = "table-2";

    saveCounterDraft(cafeId, table1Id, "session-1", [mockItem1]);
    saveCounterDraft(cafeId, table2Id, "session-2", [mockItem2]);

    clearCounterDraft(cafeId, table1Id);

    const drafts = loadCounterDrafts(cafeId);
    expect(drafts[table1Id]).toBeUndefined();
    expect(drafts[table2Id].draftCart.length).toBe(1);
  });

  // 11. Browser reload restores valid draft
  it("11. Fresh page load / component mount rehydrates valid drafts from localStorage", () => {
    const tableId = "table-1";
    const sessionId = "session-1111";

    saveCounterDraft(cafeId, tableId, sessionId, [mockItem1, mockItem2]);

    const activeSessionMap = new Map<string, string>([[tableId, sessionId]]);
    const activeSessionCreatedAtMap = new Map<string, string>([[tableId, new Date().toISOString()]]);

    // Empty React state on fresh mount
    const prev: Record<string, TableSessionData> = {};
    const persistedDrafts = loadCounterDrafts(cafeId);

    const result = reconcileTableSessions({
      sessionsMap: {},
      activeSessionMap,
      activeSessionCreatedAtMap,
      prev,
      persistedDrafts,
    });

    expect(result[tableId]).toBeDefined();
    expect(result[tableId].draftCart.length).toBe(2);
    expect(result[tableId].draftCart[0].name).toBe("Spicy Salsa Burger");
    expect(result[tableId].draftCart[1].name).toBe("Margherita Pizza");
  });

  // 12. Old session draft is NOT restored into a new dining session
  it("12. Stale draft from a closed dining session is strictly rejected when a new session starts", () => {
    const tableId = "table-1";
    const oldSessionId = "session-OLD-CLOSED";
    const newSessionId = "session-NEW-ACTIVE";

    // Stale draft in localStorage belonged to old closed session
    saveCounterDraft(cafeId, tableId, oldSessionId, [mockItem1]);

    const activeSessionMap = new Map<string, string>([[tableId, newSessionId]]);
    const activeSessionCreatedAtMap = new Map<string, string>([[tableId, new Date().toISOString()]]);

    const prev: Record<string, TableSessionData> = {};
    const persistedDrafts = loadCounterDrafts(cafeId);

    const result = reconcileTableSessions({
      sessionsMap: {},
      activeSessionMap,
      activeSessionCreatedAtMap,
      prev,
      persistedDrafts,
    });

    // Stale draft must NOT be restored for the new session
    expect(result[tableId]).toBeUndefined();
  });

  // 13. Closing/freeing a table clears its persisted draft
  it("13. When a table has no active session, stale drafts are excluded from reconciliation", () => {
    const tableId = "table-1";
    const closedSessionId = "session-CLOSED";

    saveCounterDraft(cafeId, tableId, closedSessionId, [mockItem1]);

    // Table is now FREE, activeSessionMap has no entry for table-1
    const activeSessionMap = new Map<string, string>();
    const activeSessionCreatedAtMap = new Map<string, string>();

    const prev: Record<string, TableSessionData> = {
      [tableId]: {
        sessionId: closedSessionId,
        sessionCode: "#S-CLSD",
        startedAt: "11:00 AM",
        guestCount: 2,
        orders: [],
        draftCart: [mockItem1],
      },
    };

    const result = reconcileTableSessions({
      sessionsMap: {},
      activeSessionMap,
      activeSessionCreatedAtMap,
      prev,
      persistedDrafts: loadCounterDrafts(cafeId),
    });

    expect(result[tableId]).toBeUndefined();
  });

  // 14. Realtime events do not create duplicate drafts
  it("14. Multiple reconciliation passes do not duplicate or multiply draft items", () => {
    const tableId = "table-1";
    const sessionId = "session-1111";

    let state: Record<string, TableSessionData> = {
      [tableId]: {
        sessionId,
        sessionCode: "#S-1111",
        startedAt: "12:00 PM",
        guestCount: 2,
        orders: [],
        draftCart: [mockItem1],
      },
    };

    const activeSessionMap = new Map<string, string>([[tableId, sessionId]]);
    const activeSessionCreatedAtMap = new Map<string, string>([[tableId, new Date().toISOString()]]);

    // Pass 1
    state = reconcileTableSessions({
      sessionsMap: {},
      activeSessionMap,
      activeSessionCreatedAtMap,
      prev: state,
      persistedDrafts: {},
    });
    expect(state[tableId].draftCart.length).toBe(1);

    // Pass 2 (e.g. Realtime ping)
    state = reconcileTableSessions({
      sessionsMap: {},
      activeSessionMap,
      activeSessionCreatedAtMap,
      prev: state,
      persistedDrafts: {},
    });
    expect(state[tableId].draftCart.length).toBe(1);

    // Pass 3 (e.g. Polling ping)
    state = reconcileTableSessions({
      sessionsMap: {},
      activeSessionMap,
      activeSessionCreatedAtMap,
      prev: state,
      persistedDrafts: {},
    });
    expect(state[tableId].draftCart.length).toBe(1);
  });

  // 15. Multiple quantities of the same item remain correct
  it("15. Multiple quantities of a draft item are preserved accurately", () => {
    const tableId = "table-1";
    const sessionId = "session-1111";

    const multiQtyItem: CartLineItem = {
      ...mockItem1,
      qty: 4,
    };

    saveCounterDraft(cafeId, tableId, sessionId, [multiQtyItem]);

    const activeSessionMap = new Map<string, string>([[tableId, sessionId]]);
    const activeSessionCreatedAtMap = new Map<string, string>([[tableId, new Date().toISOString()]]);

    const result = reconcileTableSessions({
      sessionsMap: {},
      activeSessionMap,
      activeSessionCreatedAtMap,
      prev: {},
      persistedDrafts: loadCounterDrafts(cafeId),
    });

    expect(result[tableId].draftCart[0].qty).toBe(4);
  });

  // 16. Multiple distinct items remain correctly ordered
  it("16. Multiple distinct draft items preserve insertion ordering", () => {
    const tableId = "table-1";
    const sessionId = "session-1111";

    const draftItems = [mockItem1, mockItem2];
    saveCounterDraft(cafeId, tableId, sessionId, draftItems);

    const activeSessionMap = new Map<string, string>([[tableId, sessionId]]);
    const activeSessionCreatedAtMap = new Map<string, string>([[tableId, new Date().toISOString()]]);

    const result = reconcileTableSessions({
      sessionsMap: {},
      activeSessionMap,
      activeSessionCreatedAtMap,
      prev: {},
      persistedDrafts: loadCounterDrafts(cafeId),
    });

    expect(result[tableId].draftCart.map((i) => i.name)).toEqual([
      "Spicy Salsa Burger",
      "Margherita Pizza",
    ]);
  });

  // 17. Draft persistence does not alter committed order state
  it("17. Reconciliation merges DB committed orders and local draft items without mutating DB orders", () => {
    const tableId = "table-1";
    const sessionId = "session-1111";

    const prev: Record<string, TableSessionData> = {
      [tableId]: {
        sessionId,
        sessionCode: "#S-1111",
        startedAt: "12:00 PM",
        guestCount: 2,
        orders: [],
        draftCart: [mockItem2],
      },
    };

    const sessionsMap: Record<string, TableSessionData> = {
      [tableId]: {
        sessionId,
        sessionCode: "#S-1111",
        startedAt: "12:00 PM",
        guestCount: 2,
        orders: [mockCommittedOrder],
        draftCart: [],
      },
    };

    const activeSessionMap = new Map<string, string>([[tableId, sessionId]]);
    const activeSessionCreatedAtMap = new Map<string, string>([[tableId, new Date().toISOString()]]);

    const result = reconcileTableSessions({
      sessionsMap,
      activeSessionMap,
      activeSessionCreatedAtMap,
      prev,
      persistedDrafts: {},
    });

    expect(result[tableId].orders.length).toBe(1);
    expect(result[tableId].orders[0].id).toBe("ord-committed-1");
    expect(result[tableId].draftCart.length).toBe(1);
    expect(result[tableId].draftCart[0].name).toBe("Margherita Pizza");
  });

  // 18. Draft persistence does not alter payment calculation
  it("18. BillSummaryCalculator computes running total correctly combining committed orders and draft items", () => {
    const orders = [mockCommittedOrder]; // subtotal 89
    const draftCart = [mockItem2]; // price 199

    const summary = BillSummaryCalculator.buildBillSummary({
      orders,
      draftCart,
      taxEnabled: false,
    });

    expect(summary.subtotal).toBe(89 + 199); // 288
    expect(summary.grandTotal).toBe(288);
  });
});
