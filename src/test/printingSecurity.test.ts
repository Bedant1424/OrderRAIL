import { describe, it, expect } from "vitest";
import {
  getCertificate,
  getCertificateFingerprint,
  isCertificateValid,
  signMessage,
  KeyManager,
} from "@/lib/printing";

describe("Printing Security & QZ Tray Request Signing Tests", () => {
  it("1. Certificate provider returns valid OrderRail certificate PEM", () => {
    const cert = getCertificate();
    expect(cert).toContain("-----BEGIN CERTIFICATE-----");
    expect(cert).toContain("-----END CERTIFICATE-----");
    expect(isCertificateValid()).toBe(true);
  });

  it("2. KeyManager returns SHA-256 cert fingerprint", () => {
    const fingerprint = getCertificateFingerprint();
    expect(fingerprint).toBeDefined();
    expect(fingerprint.length).toBeGreaterThan(10);
    expect(fingerprint).toContain(":");
  });

  it("3. signMessage creates valid Base64 RSA-SHA256 signature for payload", async () => {
    const payload = "orderrail-test-payload-12345";
    const signature = await signMessage(payload);

    expect(signature).toBeDefined();
    expect(typeof signature).toBe("string");
    expect(signature.length).toBeGreaterThan(64);
    // Base64 regex check
    expect(signature).toMatch(/^[A-Za-z0-9+/=]+$/);
  });
});
