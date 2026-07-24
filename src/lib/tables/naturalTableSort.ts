/**
 * Shared Natural Table Sorting Utility.
 * Enforces natural alphanumeric sorting across all table UI lists, dropdowns, and grids
 * (e.g. "Table 1", "Table 2", "Table 10", "A1", "A2", "A10", "1", "2", "10").
 */

export function compareTableLabels(labelA: string = "", labelB: string = ""): number {
  return labelA.localeCompare(labelB, undefined, { numeric: true, sensitivity: "base" });
}

export function sortTablesNatural<T>(
  tables: T[],
  getLabel: (item: T) => string = (item: any) => item?.label ?? item?.name ?? String(item ?? "")
): T[] {
  return [...tables].sort((a, b) => compareTableLabels(getLabel(a), getLabel(b)));
}
