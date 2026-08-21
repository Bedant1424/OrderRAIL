import { describe, it, expect } from "vitest";
import {
  KotBuilder,
  type KotBuilderPayload,
  type KotAmendmentBuilderPayload,
  type KotCancelBuilderPayload,
} from "../lib/printing/kotBuilder";
import { ESC_POS } from "../lib/printing/constants";

describe("Milestone 1B Refinement: Compact KOT Amendment & Cancellation Tests", () => {
  const baseRestaurant = "Cheese Corner Cafe";

  // --- A. Normal KOT regression ---
  it("A. Normal KOT regression: standard initial KOT untouched", () => {
    const payload: KotBuilderPayload = {
      restaurantName: "Cheese Corner",
      orderNumber: 101,
      kotNumber: 101,
      tableLabel: "Table 4",
      timestamp: "02:00 PM",
      items: [
        { name: "Burger", qty: 1 },
        { name: "Mojito", qty: 1 },
        { name: "Ice Cream", qty: 1 },
      ],
    };

    const res = KotBuilder.build(payload, 58);
    expect(res.text).toContain("KOT #: 101");
    expect(res.text).not.toContain("101-M");
    expect(res.text).not.toContain("101-R");
    expect(res.text).toContain("1x   Burger");
    expect(res.text).toContain("1x   Mojito");
    expect(res.text).toContain("1x   Ice Cream");
    expect(res.text).toContain("TOTAL ITEMS: 3");
  });

  // --- B. Compact ADD amendment ---
  it("B. Compact ADD amendment: prints ADD 1x Mojito and ADD 1x Ice Cream", () => {
    const payload: KotAmendmentBuilderPayload = {
      restaurantName: baseRestaurant,
      orderNumber: 101,
      revision: 1, // M1
      tableLabel: "Table 4",
      delta: {
        added: [
          { name: "Mojito", qty: 1 },
          { name: "Ice Cream", qty: 1 },
        ],
      },
    };

    const res = KotBuilder.buildAmendmentKot(payload, 58);
    expect(res.text).toContain("KOT #101-M1");
    expect(res.text).toContain("MODIFIED");
    expect(res.text).toContain("TABLE 4");
    expect(res.text).toContain("ADD 1x Mojito");
    expect(res.text).toContain("ADD 1x Ice Cream");

    // Must NOT contain verbose headers
    expect(res.text).not.toContain("ADDED ITEMS");
    expect(res.text).not.toContain("TOTAL CHANGES");
  });

  // --- C. Compact REMOVE amendment ---
  it("C. Compact REMOVE amendment: prints REMOVE 1x Fries", () => {
    const payload: KotAmendmentBuilderPayload = {
      orderNumber: 101,
      revision: 1,
      tableLabel: "Table 4",
      delta: {
        removed: [{ name: "Fries", qty: 1 }],
      },
    };

    const res = KotBuilder.buildAmendmentKot(payload, 58);
    expect(res.text).toContain("KOT #101-M1");
    expect(res.text).toContain("REMOVE 1x Fries");
    expect(res.text).not.toContain("REMOVED ITEMS");
  });

  // --- D. Quantity increase (1 -> 3 renders ADD 2x Burger) ---
  it("D. Quantity increase: 1x Burger -> 3x Burger renders ADD 2x Burger", () => {
    const payload: KotAmendmentBuilderPayload = {
      orderNumber: 102,
      revision: 2, // M2
      tableLabel: "Table 2",
      delta: {
        modified: [{ name: "Burger", old_qty: 1, new_qty: 3 }],
      },
    };

    const res = KotBuilder.buildAmendmentKot(payload, 58);
    expect(res.text).toContain("KOT #102-M2");
    expect(res.text).toContain("ADD 2x Burger");
    expect(res.text).not.toContain("Qty : 1 -> 3");
  });

  // --- E. Quantity decrease (3 -> 1 renders REMOVE 2x Fries) ---
  it("E. Quantity decrease: 3x Fries -> 1x Fries renders REMOVE 2x Fries", () => {
    const payload: KotAmendmentBuilderPayload = {
      orderNumber: 103,
      revision: 1,
      tableLabel: "Table 7",
      delta: {
        modified: [{ name: "Fries", old_qty: 3, new_qty: 1 }],
      },
    };

    const res = KotBuilder.buildAmendmentKot(payload, 58);
    expect(res.text).toContain("KOT #103-M1");
    expect(res.text).toContain("REMOVE 2x Fries");
    expect(res.text).not.toContain("Qty : 3 -> 1");
  });

  // --- F. Note modification (MOD <item> with indented note on next line) ---
  it("F. Note modification: renders MOD Paneer Pizza with indented note on next line", () => {
    const payload: KotAmendmentBuilderPayload = {
      orderNumber: 104,
      revision: 1,
      tableLabel: "Table 5",
      delta: {
        modified: [
          {
            name: "Paneer Pizza",
            old_qty: 1,
            new_qty: 1,
            old_note: "Normal",
            new_note: "Extra oregano, no chilly flakes",
          },
        ],
      },
    };

    const res = KotBuilder.buildAmendmentKot(payload, 58);
    expect(res.text).toContain("MOD Paneer Pizza");
    // Must NOT have inline "(Note: ...)"
    expect(res.text).not.toContain('MOD Paneer Pizza (Note: "Extra oregano, no chilly flakes")');
    // Must have indented note on new line
    expect(res.text).toContain("  Note: Extra oregano, no chilly");
    expect(res.text).toContain("        flakes");
  });

  // --- G, H, I, J, L, M. Long note wrapping & indentation (58mm) ---
  it("G-M. Long note wrapping: strict word boundaries, 8-space indent, max 32 cols", () => {
    const noteText = "Extra oregano, no chilly flakes and make sure it is properly cooked";
    const noteLines = KotBuilder.formatNoteLines(noteText, 58);

    // Rule 1: Note starts on new line with "  Note: " prefix (8 chars)
    expect(noteLines[0].startsWith("  Note: ")).toBe(true);

    // Rule 2: Continuation lines start with 8 spaces
    for (let i = 1; i < noteLines.length; i++) {
      expect(noteLines[i].startsWith("        ")).toBe(true);
    }

    // Rule 3: No line exceeds 32 printable characters
    for (const line of noteLines) {
      expect(line.length).toBeLessThanOrEqual(32);
    }

    // Rule 4: No words split across lines
    const combined = noteLines.map((l) => l.trim().replace(/^Note:\s*/, "")).join(" ");
    expect(combined).toBe(noteText);
  });

  // --- K. 80mm note wrapping ---
  it("K. 80mm note wrapping: uses 48-column printable width budget", () => {
    const noteText = "Extra oregano, no chilly flakes and make sure it is properly cooked and delivered hot";
    const noteLines = KotBuilder.formatNoteLines(noteText, 48);

    expect(noteLines[0].startsWith("  Note: ")).toBe(true);
    for (const line of noteLines) {
      expect(line.length).toBeLessThanOrEqual(48);
    }
  });

  // --- N. Empty note handling ---
  it("N. Empty note handling: returns empty array without corrupting layout", () => {
    expect(KotBuilder.formatNoteLines("", 32)).toEqual([]);
    expect(KotBuilder.formatNoteLines("   ", 32)).toEqual([]);
  });

  // --- O. Very long note and edge case token handling ---
  it("O. Very long single token (e.g. 35 chars without spaces) is safely wrapped without buffer overflow", () => {
    const longToken = "SupercalifragilisticexpialidociousNoteText";
    const noteLines = KotBuilder.formatNoteLines(longToken, 32);

    expect(noteLines.length).toBeGreaterThan(1);
    for (const line of noteLines) {
      expect(line.length).toBeLessThanOrEqual(32);
    }
  });

  // --- P, Q, R, S. Cancelled KOT ---
  it("P-S. Cancelled KOT: retains original KOT #, has STOP PREPARATION, omits long reason sentence", () => {
    const payload: KotCancelBuilderPayload = {
      restaurantName: baseRestaurant,
      kotNumber: 105,
      orderNumber: 105,
      tableLabel: "Table 4",
      reason: "Table cancelled by customer after 20 minutes wait",
      cancelledItems: [
        { name: "Burger", qty: 2 },
        { name: "Fries", qty: 1 },
      ],
    };

    const res = KotBuilder.buildCancelKot(payload, 58);

    // Q: Original KOT number preserved
    expect(res.text).toContain("KOT #105");
    expect(res.text).not.toContain("105-C1");
    expect(res.text).not.toContain("105-M");

    // R: STOP PREPARATION banner
    expect(res.text).toContain("*** CANCELLED ***");
    expect(res.text).toContain("TABLE 4");
    expect(res.text).toContain("STOP PREPARATION");
    expect(res.text).toContain("2x   Burger");
    expect(res.text).toContain("1x   Fries");

    // S: Long reason sentence is NOT printed on ticket
    expect(res.text).not.toContain("Table cancelled by customer");
    expect(res.text).not.toContain("Reason:");

    // ESC/POS command check
    expect(res.escpos).toContain("KOT #105");
    expect(res.escpos).toContain("STOP PREPARATION");
    expect(res.escpos).toContain(ESC_POS.FEED_AND_CUT);
  });

  // --- T, U. Sequential Reprints (R1, R2) ---
  it("T, U. Sequential Reprints: formats KOT #101-R1 and KOT #101-R2 with ** REPRINT ** banner", () => {
    const payloadR1: KotBuilderPayload = {
      restaurantName: baseRestaurant,
      orderNumber: 101,
      kotNumber: 101,
      tableLabel: "Table 4",
      isReprint: true,
      reprintNumber: 1,
      items: [{ name: "Cheese Burger", qty: 2 }],
    };

    const resR1 = KotBuilder.build(payloadR1, 58);
    expect(resR1.text).toContain("KOT #: 101-R1");
    expect(resR1.text).toContain("** REPRINT **");
    expect(resR1.text).toContain("2x   Cheese Burger");

    const payloadR2: KotBuilderPayload = {
      ...payloadR1,
      reprintNumber: 2,
    };
    const resR2 = KotBuilder.build(payloadR2, 58);
    expect(resR2.text).toContain("KOT #: 101-R2");
  });

  // --- Offline Reprint ---
  it("Offline Reprint: formats KOT #101-R with OFFLINE REPRINT banner when offline", () => {
    const payloadOffline: KotBuilderPayload = {
      restaurantName: baseRestaurant,
      orderNumber: 101,
      kotNumber: 101,
      tableLabel: "Table 4",
      isOfflineReprint: true,
      items: [{ name: "Cheese Burger", qty: 2 }],
    };

    const res = KotBuilder.build(payloadOffline, 58);
    expect(res.text).toContain("KOT #: 101-R");
    expect(res.text).toContain("OFFLINE REPRINT");
    expect(res.text).not.toContain("101-R1");
  });

  // --- V. Existing standard KOT with item notes remains clean ---
  it("V. Existing standard KOT with item notes formats note on indented line", () => {
    const payload: KotBuilderPayload = {
      restaurantName: baseRestaurant,
      orderNumber: 101,
      kotNumber: 101,
      tableLabel: "Table 4",
      items: [
        { name: "Veg Burger", qty: 1, notes: "No onions, extra mayo" },
      ],
    };

    const res = KotBuilder.build(payload, 58);
    expect(res.text).toContain("1x   Veg Burger");
    expect(res.text).toContain("  Note: No onions, extra mayo");
  });
});
