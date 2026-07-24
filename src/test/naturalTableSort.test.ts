import { describe, it, expect } from "vitest";
import { compareTableLabels, sortTablesNatural } from "@/lib/tables/naturalTableSort";

describe("Shared Natural Table Sorting Utility", () => {
  it("naturally sorts numeric table labels (1, 2, 3 ... 10, 11)", () => {
    const input = ["10", "2", "1", "11", "3", "20"];
    const sorted = sortTablesNatural(input);
    expect(sorted).toEqual(["1", "2", "3", "10", "11", "20"]);
  });

  it("naturally sorts standard table labels (Table 1, Table 2, Table 10)", () => {
    const input = [
      { label: "Table 10" },
      { label: "Table 2" },
      { label: "Table 1" },
      { label: "Table 20" },
      { label: "Table 3" }
    ];
    const sorted = sortTablesNatural(input);
    expect(sorted.map(t => t.label)).toEqual([
      "Table 1",
      "Table 2",
      "Table 3",
      "Table 10",
      "Table 20"
    ]);
  });

  it("naturally sorts prefix table labels (A1, A2, A10)", () => {
    const input = ["A10", "A2", "A1", "A20", "A3"];
    const sorted = sortTablesNatural(input);
    expect(sorted).toEqual(["A1", "A2", "A3", "A10", "A20"]);
  });

  it("naturally sorts compound prefix table labels (VIP 1, VIP 2, VIP 10)", () => {
    const input = ["VIP 10", "VIP 2", "VIP 1", "VIP 20", "VIP 3"];
    const sorted = sortTablesNatural(input);
    expect(sorted).toEqual(["VIP 1", "VIP 2", "VIP 3", "VIP 10", "VIP 20"]);
  });

  it("correctly compares table labels using compareTableLabels", () => {
    expect(compareTableLabels("Table 1", "Table 2")).toBeLessThan(0);
    expect(compareTableLabels("Table 2", "Table 10")).toBeLessThan(0);
    expect(compareTableLabels("Table 10", "Table 2")).toBeGreaterThan(0);
  });
});
