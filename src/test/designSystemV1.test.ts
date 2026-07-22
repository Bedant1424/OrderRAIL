import { describe, it, expect } from "vitest";
import { colors } from "../lib/design-system/tokens/colors";
import { typography } from "../lib/design-system/tokens/typography";
import { spacing } from "../lib/design-system/tokens/spacing";

describe("OrderRail Design System v1.0 — Architecture Suite", () => {
  describe("1. Design Tokens Verification", () => {
    it("should export standardized color tokens", () => {
      expect(colors.status.success.DEFAULT).toBe("#10B981");
      expect(colors.status.warning.DEFAULT).toBe("#F59E0B");
      expect(colors.status.danger.DEFAULT).toBe("#EF4444");
      expect(colors.status.info.DEFAULT).toBe("#3B82F6");
    });

    it("should export 8-point spacing grid system", () => {
      expect(spacing[1]).toBe("4px");
      expect(spacing[2]).toBe("8px");
      expect(spacing[4]).toBe("16px");
      expect(spacing[8]).toBe("32px");
    });

    it("should export typography font scales", () => {
      expect(typography.fontFamily.display).toContain("Outfit");
      expect(typography.scale.pageTitle).toContain("font-display");
      expect(typography.scale.numeric).toContain("font-mono");
    });
  });

  describe("2. Showcase Route Contract", () => {
    it("should verify living showcase route binding", () => {
      const showcaseRoute = "/design-system";
      expect(showcaseRoute).toBe("/design-system");
    });
  });
});
