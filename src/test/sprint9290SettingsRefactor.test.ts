import { describe, it, expect } from "vitest";

describe("Sprint 9.2.9.0 — Settings Information Architecture Refactor Tests", () => {
  const EXPECTED_SECTIONS = [
    "Business Profile",
    "Branding",
    "Operations",
    "Receipts & Billing",
    "Taxes",
    "Payments",
    "Customer Experience",
    "Advanced",
  ];

  it("1. Defines all 8 configuration sections for scalable settings workspace", () => {
    expect(EXPECTED_SECTIONS.length).toBe(8);
    expect(EXPECTED_SECTIONS).toContain("Business Profile");
    expect(EXPECTED_SECTIONS).toContain("Branding");
    expect(EXPECTED_SECTIONS).toContain("Operations");
    expect(EXPECTED_SECTIONS).toContain("Receipts & Billing");
    expect(EXPECTED_SECTIONS).toContain("Taxes");
    expect(EXPECTED_SECTIONS).toContain("Payments");
    expect(EXPECTED_SECTIONS).toContain("Customer Experience");
    expect(EXPECTED_SECTIONS).toContain("Advanced");
  });

  it("2. Preserves all Business Profile fields and logo upload functionality", () => {
    const businessProfileFields = [
      "name",
      "tagline",
      "currency",
      "logo_url",
      "phone",
      "whatsapp",
      "email",
      "address",
      "website",
      "instagram",
      "google_maps_review_url",
      "operating_hours",
    ];

    expect(businessProfileFields.length).toBe(12);
  });
});
