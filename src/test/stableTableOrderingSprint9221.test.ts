import { describe, it, expect } from "vitest";
import { sortTablesNatural, compareTableLabels } from "@/lib/tables/naturalTableSort";
import { SortingPolicy, type SortableTable } from "@/lib/operations/SortingPolicy";

describe("Sprint 9.2.2.1 — Stable Counter Table Ordering", () => {
  const initialTables: SortableTable[] = [
    { id: "t-1", label: "Table 1", status: "AVAILABLE" },
    { id: "t-2", label: "Table 2", status: "AVAILABLE" },
    { id: "t-3", label: "Table 3", status: "AVAILABLE" },
    { id: "t-4", label: "Table 4", status: "AVAILABLE" },
    { id: "t-5", label: "Table 5", status: "AVAILABLE" },
    { id: "t-6", label: "Table 6", status: "AVAILABLE" },
    { id: "t-7", label: "Table 7", status: "AVAILABLE" },
    { id: "t-10", label: "Table 10", status: "AVAILABLE" },
  ];

  it("verifies natural alphanumeric sorting by table_number / label (T1..T7..T10)", () => {
    // Input in arbitrary unsorted order
    const unsorted: SortableTable[] = [
      { id: "t-10", label: "Table 10", status: "AVAILABLE" },
      { id: "t-5", label: "Table 5", status: "AVAILABLE" },
      { id: "t-1", label: "Table 1", status: "AVAILABLE" },
      { id: "t-7", label: "Table 7", status: "AVAILABLE" },
      { id: "t-2", label: "Table 2", status: "AVAILABLE" },
    ];

    const sorted = sortTablesNatural(unsorted);
    const labels = sorted.map((t) => t.label);
    expect(labels).toEqual(["Table 1", "Table 2", "Table 5", "Table 7", "Table 10"]);
  });

  it("Scenario 1: Receive new order on Table 7 -> position remains unchanged", () => {
    const sortedBefore = sortTablesNatural(initialTables);
    const beforeIds = sortedBefore.map((t) => t.id);

    // Table 7 receives a new order and becomes OCCUPIED
    const updatedTables = sortedBefore.map((t) =>
      t.id === "t-7" ? { ...t, status: "OCCUPIED", sessionStartTimeMs: Date.now() } : t
    );

    const sortedAfter = sortTablesNatural(updatedTables);
    const afterIds = sortedAfter.map((t) => t.id);

    // Positions MUST be identical
    expect(afterIds).toEqual(beforeIds);
    expect(sortedAfter.findIndex((t) => t.id === "t-7")).toBe(6); // 0-indexed pos 6 = Table 7
  });

  it("Scenario 2: Complete Table 5 session -> position remains unchanged", () => {
    const tablesWithActiveT5 = initialTables.map((t) =>
      t.id === "t-5" ? { ...t, status: "OCCUPIED" } : t
    );
    const beforeIds = sortTablesNatural(tablesWithActiveT5).map((t) => t.id);

    // Table 5 session completed and needs cleaning
    const tablesAfterT5Complete = tablesWithActiveT5.map((t) =>
      t.id === "t-5" ? { ...t, status: "CLEANING_REQUIRED" } : t
    );
    const afterIds = sortTablesNatural(tablesAfterT5Complete).map((t) => t.id);

    expect(afterIds).toEqual(beforeIds);
    expect(afterIds[4]).toBe("t-5");
  });

  it("Scenario 3: Realtime update from another device -> position remains unchanged", () => {
    const currentList = sortTablesNatural(initialTables);
    const beforeIds = currentList.map((t) => t.id);

    // Multiple realtime updates: T2 becomes OCCUPIED, T4 requested bill, T6 needs cleaning
    const realtimeUpdatedList = currentList.map((t) => {
      if (t.id === "t-2") return { ...t, status: "OCCUPIED" };
      if (t.id === "t-4") return { ...t, status: "BILL_REQUESTED" };
      if (t.id === "t-6") return { ...t, status: "CLEANING_REQUIRED" };
      return t;
    });

    const sortedRealtime = sortTablesNatural(realtimeUpdatedList);
    const afterIds = sortedRealtime.map((t) => t.id);

    expect(afterIds).toEqual(beforeIds);
  });

  it("Scenario 4: Owner Table Management & Counter Workstation share identical stable ordering", () => {
    const ownerList = sortTablesNatural(initialTables);
    const counterList = SortingPolicy.sortCounterTables(initialTables);

    expect(counterList.map((t) => t.id)).toEqual(ownerList.map((t) => t.id));
  });

  it("verifies numerical table_number priority sorting if present on table objects", () => {
    const tablesWithNum = [
      { id: "a", label: "Vip 2", table_number: 10 },
      { id: "b", label: "Terrace", table_number: 2 },
      { id: "c", label: "Patio", table_number: 5 },
    ];

    const sorted = sortTablesNatural(tablesWithNum);
    expect(sorted.map((t) => t.id)).toEqual(["b", "c", "a"]);
  });
});
