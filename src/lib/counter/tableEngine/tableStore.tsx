import React, { createContext, useContext, useState, useMemo, useCallback, useEffect } from "react";
import { supabase } from "@/lib/db";
import {
  TableEntity,
  TableState,
  TableFilterType,
  TransitionResult,
  DiningSessionModel,
} from "./tableTypes";
import { validateTableTransition, canOpenTable } from "./tableValidators";
import { filterTables, getTableCounts, getSelectedTable } from "./tableSelectors";
import { INITIAL_DEFAULT_TABLES, createDiningSession } from "./tableActions";

export interface TableEngineContextType {
  tables: TableEntity[];
  selectedTableId: string | null;
  previousSelectedTableId: string | null;
  filter: TableFilterType;
  searchQuery: string;
  
  // Derived Selectors
  filteredTables: TableEntity[];
  selectedTable: TableEntity | null;
  counts: Record<string, number>;

  // Selection Actions
  selectTable: (id: string | null) => void;
  clearSelection: () => void;
  restorePreviousSelection: () => void;
  setFilter: (filter: TableFilterType) => void;
  setSearchQuery: (query: string) => void;

  // Table State Engine Transitions
  openTable: (tableId: string, guestCount?: number) => TransitionResult;
  requestBill: (tableId: string) => TransitionResult;
  markCleaning: (tableId: string) => TransitionResult;
  releaseTable: (tableId: string) => TransitionResult;
  reserveTable: (tableId: string) => TransitionResult;
  markOutOfService: (tableId: string) => TransitionResult;
  restoreAvailable: (tableId: string) => TransitionResult;
  
  // Keyboard Navigation Helper
  navigateGrid: (direction: "up" | "down" | "left" | "right") => void;
}

const TableEngineContext = createContext<TableEngineContextType | null>(null);

export function TableEngineProvider({ children }: { children: React.ReactNode }) {
  const [tables, setTables] = useState<TableEntity[]>(INITIAL_DEFAULT_TABLES);
  const [selectedTableId, setSelectedTableId] = useState<string | null>("t-4");
  const [previousSelectedTableId, setPreviousSelectedTableId] = useState<string | null>(null);
  const [filter, setFilter] = useState<TableFilterType>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Load tables from Supabase database and subscribe to Realtime updates
  useEffect(() => {
    async function loadTablesFromDb() {
      const { data, error } = await supabase
        .from("tables")
        .select("*")
        .order("label", { numeric: true, sensitivity: "base" });

      if (!error && data && data.length > 0) {
        const mapped: TableEntity[] = data.map((t) => ({
          id: t.id,
          label: t.label.startsWith("Table") ? t.label : `Table ${t.label}`,
          status: t.status === "occupied" ? "OCCUPIED" : t.status === "cleaning" ? "CLEANING" : t.status === "reserved" ? "RESERVED" : "AVAILABLE",
          seats: t.seats || 4,
          currentSessionId: t.active_session_id || undefined,
        }));
        setTables(mapped);
        setSelectedTableId((currentId) => {
          if (!currentId || !mapped.some((t) => t.id === currentId)) {
            return mapped[0].id;
          }
          return currentId;
        });
      }
    }

    void loadTablesFromDb();

    // Supabase Realtime Channel for live table state updates across Customer, Counter, Staff & Owner
    const channel = supabase
      .channel("tables-db-sync-channel")
      .on("postgres_changes", { event: "*", schema: "public", table: "tables" }, () => {
        void loadTablesFromDb();
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  // Selectors
  const filteredTables = useMemo(
    () => filterTables(tables, filter, searchQuery),
    [tables, filter, searchQuery]
  );

  const selectedTable = useMemo(
    () => getSelectedTable(tables, selectedTableId),
    [tables, selectedTableId]
  );

  const counts = useMemo(() => getTableCounts(tables), [tables]);

  // Selection handlers
  const selectTable = useCallback(
    (id: string | null) => {
      if (id !== selectedTableId) {
        setPreviousSelectedTableId(selectedTableId);
        setSelectedTableId(id);
      }
    },
    [selectedTableId]
  );

  const clearSelection = useCallback(() => {
    setPreviousSelectedTableId(selectedTableId);
    setSelectedTableId(null);
  }, [selectedTableId]);

  const restorePreviousSelection = useCallback(() => {
    if (previousSelectedTableId) {
      const exists = tables.some((t) => t.id === previousSelectedTableId);
      if (exists) {
        setSelectedTableId(previousSelectedTableId);
      }
    }
  }, [previousSelectedTableId, tables]);

  // Core State Engine Mutation (Updates local state & persists to Supabase DB)
  const mutateTableState = useCallback(
    (
      tableId: string,
      targetStatus: TableState,
      sessionPayload?: DiningSessionModel | null
    ): TransitionResult => {
      const currentTable = tables.find((t) => t.id === tableId);
      if (!currentTable) {
        return { success: false, error: "Table not found." };
      }

      // Check transition validity
      const validation = validateTableTransition(currentTable.status, targetStatus);
      if (!validation.valid) {
        return { success: false, error: validation.reason };
      }

      let updatedSession = currentTable.activeSession ?? null;
      let activeSessionId = currentTable.activeSessionId ?? null;

      if (sessionPayload !== undefined) {
        updatedSession = sessionPayload;
        activeSessionId = sessionPayload ? sessionPayload.id : null;
      } else if (targetStatus === "AVAILABLE" || targetStatus === "CLEANING" || targetStatus === "OUT_OF_SERVICE") {
        updatedSession = null;
        activeSessionId = null;
      }

      const updatedTable: TableEntity = {
        ...currentTable,
        status: targetStatus,
        activeSessionId,
        activeSession: updatedSession,
        updatedAt: new Date().toISOString(),
      };

      setTables((prev) => prev.map((t) => (t.id === tableId ? updatedTable : t)));

      // Persist table status mutation to Supabase Database
      const dbStatusMap: Record<TableState, string> = {
        AVAILABLE: "free",
        OCCUPIED: "occupied",
        BILL_REQUESTED: "occupied",
        CLEANING: "cleaning",
        RESERVED: "reserved",
        OUT_OF_SERVICE: "free",
      };

      void (async () => {
        try {
          await supabase
            .from("tables")
            .update({ status: dbStatusMap[targetStatus] })
            .eq("id", tableId);
        } catch (e) {
          console.warn("[mutateTableState] Could not sync table status to DB:", e);
        }
      })();

      return {
        success: true,
        table: updatedTable,
        session: updatedSession,
      };
    },
    [tables]
  );

  // Business Action Handlers
  const openTable = useCallback(
    (tableId: string, guestCount: number = 2): TransitionResult => {
      const currentTable = tables.find((t) => t.id === tableId);
      if (!currentTable) return { success: false, error: "Table not found." };

      const canOpen = canOpenTable(currentTable.status);
      if (!canOpen) {
        return {
          success: false,
          error: `Table ${currentTable.label} cannot be opened from state ${currentTable.status}.`,
        };
      }

      let session = currentTable.activeSession;
      if (!session) {
        session = createDiningSession(currentTable.id, currentTable.label, guestCount);
      }

      const result = mutateTableState(tableId, "OCCUPIED", session);
      if (result.success) {
        selectTable(tableId);
      }
      return result;
    },
    [tables, mutateTableState, selectTable]
  );

  const requestBill = useCallback(
    (tableId: string): TransitionResult => {
      const currentTable = tables.find((t) => t.id === tableId);
      if (!currentTable) return { success: false, error: "Table not found." };

      if (!currentTable.activeSession) {
        return { success: false, error: "Cannot request bill for a table without an active session." };
      }

      const updatedSession: DiningSessionModel = {
        ...currentTable.activeSession,
        status: "BILLING",
      };

      return mutateTableState(tableId, "BILL_REQUESTED", updatedSession);
    },
    [tables, mutateTableState]
  );

  const markCleaning = useCallback(
    (tableId: string): TransitionResult => {
      return mutateTableState(tableId, "CLEANING", null);
    },
    [mutateTableState]
  );

  const releaseTable = useCallback(
    (tableId: string): TransitionResult => {
      return mutateTableState(tableId, "AVAILABLE", null);
    },
    [mutateTableState]
  );

  const reserveTable = useCallback(
    (tableId: string): TransitionResult => {
      return mutateTableState(tableId, "RESERVED", null);
    },
    [mutateTableState]
  );

  const markOutOfService = useCallback(
    (tableId: string): TransitionResult => {
      return mutateTableState(tableId, "OUT_OF_SERVICE", null);
    },
    [mutateTableState]
  );

  const restoreAvailable = useCallback(
    (tableId: string): TransitionResult => {
      return mutateTableState(tableId, "AVAILABLE", null);
    },
    [mutateTableState]
  );

  // Keyboard navigation across grid items
  const navigateGrid = useCallback(
    (direction: "up" | "down" | "left" | "right") => {
      const list = filteredTables;
      if (list.length === 0) return;

      const currentIndex = list.findIndex((t) => t.id === selectedTableId);
      let nextIndex = 0;

      if (currentIndex === -1) {
        nextIndex = 0;
      } else {
        const columns = 2;
        if (direction === "left") {
          nextIndex = Math.max(0, currentIndex - 1);
        } else if (direction === "right") {
          nextIndex = Math.min(list.length - 1, currentIndex + 1);
        } else if (direction === "up") {
          nextIndex = Math.max(0, currentIndex - columns);
        } else if (direction === "down") {
          nextIndex = Math.min(list.length - 1, currentIndex + columns);
        }
      }

      const target = list[nextIndex];
      if (target) {
        selectTable(target.id);
      }
    },
    [filteredTables, selectedTableId, selectTable]
  );

  return (
    <TableEngineContext.Provider
      value={{
        tables,
        selectedTableId,
        previousSelectedTableId,
        filter,
        searchQuery,
        filteredTables,
        selectedTable,
        counts,
        selectTable,
        clearSelection,
        restorePreviousSelection,
        setFilter,
        setSearchQuery,
        openTable,
        requestBill,
        markCleaning,
        releaseTable,
        reserveTable,
        markOutOfService,
        restoreAvailable,
        navigateGrid,
      }}
    >
      {children}
    </TableEngineContext.Provider>
  );
}

export function useTableEngine() {
  const context = useContext(TableEngineContext);
  if (!context) {
    throw new Error("useTableEngine must be used within a TableEngineProvider");
  }
  return context;
}
