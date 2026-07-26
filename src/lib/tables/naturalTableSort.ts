/**
 * Shared Natural Table Sorting Utility.
 * Enforces stable, permanent restaurant ordering across all table UI lists, dropdowns, and grids
 * (e.g. "Table 1", "Table 2", "Table 10", "A1", "A2", "A10", "1", "2", "10").
 * 
 * Table position MUST NEVER change because of operational state (status, orders, session start/end, cleaning).
 */

export function compareTableLabels(labelA: string = "", labelB: string = ""): number {
  return labelA.localeCompare(labelB, undefined, { numeric: true, sensitivity: "base" });
}

export function sortTablesNatural<T>(
  tables: T[],
  getLabel: (item: T) => string = (item: any) => item?.label ?? item?.name ?? String(item ?? "")
): T[] {
  return [...tables].sort((a: any, b: any) => {
    // 1. Permanent configured order priority: table_number / display_order / sort_order / position
    const numA = typeof a?.table_number === "number" ? a.table_number :
                 typeof a?.table_no === "number" ? a.table_no :
                 typeof a?.display_order === "number" ? a.display_order :
                 typeof a?.sort_order === "number" ? a.sort_order :
                 typeof a?.position === "number" ? a.position : null;

    const numB = typeof b?.table_number === "number" ? b.table_number :
                 typeof b?.table_no === "number" ? b.table_no :
                 typeof b?.display_order === "number" ? b.display_order :
                 typeof b?.sort_order === "number" ? b.sort_order :
                 typeof b?.position === "number" ? b.position : null;

    if (numA !== null && numB !== null && numA !== numB) {
      return numA - numB;
    }

    // 2. Alphanumeric natural label comparison fallback (e.g. T1, T2, T10)
    return compareTableLabels(getLabel(a), getLabel(b));
  });
}
