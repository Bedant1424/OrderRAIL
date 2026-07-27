import { describe, it, expect } from "vitest";
import { resetDemoEnvironmentInDb, DEMO_CAFE_ID } from "@/lib/demoReset";

describe("Sprint 9.2.2.10 — Production Stabilization & Demo Environment Cleanup Tests", () => {
  it("1. Demo Reset Safety Check: Rejects non-demo production cafe reset attempts", async () => {
    const prodCafeId = "11111111-2222-3333-4444-555555555555";
    
    await expect(resetDemoEnvironmentInDb(prodCafeId)).rejects.toThrow(
      "PROHIBITED: Demo Reset is restricted to the demo environment"
    );
  });

  it("2. Demo Reset Execution: Resets demo cafe environment safely", { timeout: 15000 }, async () => {
    const result = await resetDemoEnvironmentInDb(DEMO_CAFE_ID);
    expect(result.success).toBe(true);
    expect(result.message).toContain("successfully reset");
  });

  it("3. Verification of Demo Environment ID", () => {
    expect(DEMO_CAFE_ID).toBe("8c418a5a-7cd4-4054-8a88-f412c1762f7d");
  });
});
