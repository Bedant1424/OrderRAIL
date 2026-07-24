import { TableEntity, TableFilterType } from "./tableTypes";
import { sortTablesNatural } from "@/lib/tables/naturalTableSort";

export function filterTables(
  tables: TableEntity[],
  filter: TableFilterType,
  searchQuery: string = ""
): TableEntity[] {
  let result = tables;

  if (filter !== "all") {
    const targetStatus = filter.toUpperCase();
    result = result.filter((t) => t.status === targetStatus);
  }

  if (searchQuery.trim()) {
    const query = searchQuery.toLowerCase().trim();
    result = result.filter(
      (t) =>
        t.label.toLowerCase().includes(query) ||
        t.id.toLowerCase().includes(query) ||
        (t.activeSession?.sessionCode ?? "").toLowerCase().includes(query)
    );
  }

  return sortTablesNatural(result);
}

export function getTableCounts(tables: TableEntity[]) {
  const counts = {
    all: tables.length,
    available: 0,
    occupied: 0,
    bill_requested: 0,
    cleaning: 0,
    reserved: 0,
    out_of_service: 0,
  };

  for (const t of tables) {
    if (t.status === "AVAILABLE") counts.available++;
    else if (t.status === "OCCUPIED") counts.occupied++;
    else if (t.status === "BILL_REQUESTED") counts.bill_requested++;
    else if (t.status === "CLEANING") counts.cleaning++;
    else if (t.status === "RESERVED") counts.reserved++;
    else if (t.status === "OUT_OF_SERVICE") counts.out_of_service++;
  }

  return counts;
}

export function getSelectedTable(
  tables: TableEntity[],
  selectedId: string | null
): TableEntity | null {
  if (!selectedId) return null;
  return tables.find((t) => t.id === selectedId) ?? null;
}
