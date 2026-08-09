import { describe, it, expect } from "vitest";
import { ARTWORK_LAYOUT, extractTableNumber } from "@/branding/cheesecorner/qrRenderer";

describe("Sprint 12H - QR Artwork Overlay Validation", () => {
  it("uses the correct template native resolution", () => {
    expect(ARTWORK_LAYOUT.template.width).toBe(948);
    expect(ARTWORK_LAYOUT.template.height).toBe(1660);
  });

  it("places table number correctly inside the white pill (Sprint 12I)", () => {
    expect(ARTWORK_LAYOUT.tableNumber.centerX).toBe(475);
    expect(ARTWORK_LAYOUT.tableNumber.centerY).toBe(562);
  });

  it("places QR card inside cream container at measured Sprint 12I position (centerX: 469, centerY: 870)", () => {
    const { centerX, centerY, cardSize, qrSize } = ARTWORK_LAYOUT.qr;

    expect(centerX).toBe(469);
    expect(centerY).toBe(870);
    expect(cardSize).toBe(360);
    expect(qrSize).toBe(300);

    // Calculate top and bottom of white card: centerY +/- (cardSize / 2)
    const cardTop = centerY - cardSize / 2; // 690
    const cardBottom = centerY + cardSize / 2; // 1050

    // Table pill region ends at Y ~603, card starts at Y = 690 (no overlap)
    expect(cardTop).toBeGreaterThan(603);
    expect(cardBottom).toBeLessThan(1100);
  });

  it("correctly extracts table numbers from labels", () => {
    expect(extractTableNumber("Table 1")).toBe("1");
    expect(extractTableNumber("Table 12")).toBe("12");
    expect(extractTableNumber("T-42")).toBe("42");
    expect(extractTableNumber("105")).toBe("105");
  });
});
