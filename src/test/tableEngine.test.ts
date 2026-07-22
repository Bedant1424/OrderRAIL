import { describe, it, expect } from "vitest";
import { validateTableTransition, canOpenTable } from "../lib/counter/tableEngine/tableValidators";
import { filterTables, getTableCounts, getSelectedTable } from "../lib/counter/tableEngine/tableSelectors";
import { createDiningSession, INITIAL_DEFAULT_TABLES } from "../lib/counter/tableEngine/tableActions";
import { TableEntity } from "../lib/counter/tableEngine/tableTypes";

describe("Counter Core Table Engine — Phase 2.1 Unit & Integration Suite", () => {
  describe("1. State Transition Validation (CORE_STATE_MACHINES.md Enforcement)", () => {
    it("should allow valid Table state transitions", () => {
      expect(validateTableTransition("AVAILABLE", "OCCUPIED").valid).toBe(true);
      expect(validateTableTransition("AVAILABLE", "RESERVED").valid).toBe(true);
      expect(validateTableTransition("AVAILABLE", "OUT_OF_SERVICE").valid).toBe(true);
      expect(validateTableTransition("OCCUPIED", "BILL_REQUESTED").valid).toBe(true);
      expect(validateTableTransition("OCCUPIED", "CLEANING").valid).toBe(true);
      expect(validateTableTransition("BILL_REQUESTED", "CLEANING").valid).toBe(true);
      expect(validateTableTransition("CLEANING", "AVAILABLE").valid).toBe(true);
      expect(validateTableTransition("RESERVED", "OCCUPIED").valid).toBe(true);
      expect(validateTableTransition("OUT_OF_SERVICE", "AVAILABLE").valid).toBe(true);
    });

    it("should reject invalid Table state transitions according to Table State Machine", () => {
      const res1 = validateTableTransition("AVAILABLE", "BILL_REQUESTED");
      expect(res1.valid).toBe(false);
      expect(res1.reason).toContain("Invalid transition from AVAILABLE to BILL_REQUESTED");

      const res2 = validateTableTransition("OUT_OF_SERVICE", "OCCUPIED");
      expect(res2.valid).toBe(false);
      expect(res2.reason).toContain("Invalid transition from OUT_OF_SERVICE to OCCUPIED");

      const res3 = validateTableTransition("CLEANING", "BILL_REQUESTED");
      expect(res3.valid).toBe(false);
      expect(res3.reason).toContain("Invalid transition from CLEANING to BILL_REQUESTED");
    });

    it("should evaluate canOpenTable helper correctly", () => {
      expect(canOpenTable("AVAILABLE").valid).toBe(true);
      expect(canOpenTable("RESERVED").valid).toBe(true);

      expect(canOpenTable("OUT_OF_SERVICE").valid).toBe(false);
      expect(canOpenTable("CLEANING").valid).toBe(false);
      expect(canOpenTable("OCCUPIED").valid).toBe(false);
      expect(canOpenTable("BILL_REQUESTED").valid).toBe(false);
    });
  });

  describe("2. Table Filtering & Selectors", () => {
    const mockTables: TableEntity[] = [
      { id: "t-1", label: "T1", seats: 4, status: "AVAILABLE", updatedAt: "" },
      { id: "t-2", label: "T2", seats: 2, status: "OCCUPIED", updatedAt: "" },
      { id: "t-3", label: "T3", seats: 6, status: "BILL_REQUESTED", updatedAt: "" },
      { id: "t-4", label: "T4", seats: 4, status: "CLEANING", updatedAt: "" },
      { id: "t-5", label: "T5", seats: 2, status: "RESERVED", updatedAt: "" },
      { id: "t-6", label: "T6", seats: 8, status: "OUT_OF_SERVICE", updatedAt: "" },
    ];

    it("should calculate exact counts for all 6 table states", () => {
      const counts = getTableCounts(mockTables);
      expect(counts.all).toBe(6);
      expect(counts.available).toBe(1);
      expect(counts.occupied).toBe(1);
      expect(counts.bill_requested).toBe(1);
      expect(counts.cleaning).toBe(1);
      expect(counts.reserved).toBe(1);
      expect(counts.out_of_service).toBe(1);
    });

    it("should filter table list by state accurately", () => {
      const available = filterTables(mockTables, "available");
      expect(available.length).toBe(1);
      expect(available[0].id).toBe("t-1");

      const occupied = filterTables(mockTables, "occupied");
      expect(occupied.length).toBe(1);
      expect(occupied[0].id).toBe("t-2");
    });

    it("should search table list by label string", () => {
      const results = filterTables(mockTables, "all", "T3");
      expect(results.length).toBe(1);
      expect(results[0].id).toBe("t-3");
    });

    it("should select table entity by ID", () => {
      const selected = getSelectedTable(mockTables, "t-4");
      expect(selected?.id).toBe("t-4");
      expect(selected?.status).toBe("CLEANING");

      expect(getSelectedTable(mockTables, null)).toBeNull();
    });
  });

  describe("3. Dining Session Creation & Restoration", () => {
    it("should generate a new DiningSession for an AVAILABLE table", () => {
      const session = createDiningSession("t-12", "Table 12", 4);
      expect(session.tableId).toBe("t-12");
      expect(session.tableLabel).toBe("Table 12");
      expect(session.guestCount).toBe(4);
      expect(session.status).toBe("OPEN");
      expect(session.sessionCode).toMatch(/^s-\d{4}$/);
    });

    it("should preserve active session when reopening OCCUPIED seed table", () => {
      const table2 = INITIAL_DEFAULT_TABLES.find((t) => t.id === "t-2");
      expect(table2?.status).toBe("OCCUPIED");
      expect(table2?.activeSession?.id).toBe("s-102");
      expect(table2?.activeSession?.totalAmount).toBe(28.5);
    });
  });
});
