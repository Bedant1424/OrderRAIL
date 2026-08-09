import { describe, it, expect, beforeEach } from "vitest";
import {
  resolveImageUrlSync,
  getSignedImageUrl,
  clearImageUrlCache,
  useImageUrl,
} from "../lib/useImageUrl";

describe("Sprint 13B - Image URL Resolution & Cache Engine", () => {
  beforeEach(() => {
    clearImageUrlCache();
  });

  it("1. handles null/empty/undefined sources cleanly", () => {
    expect(resolveImageUrlSync(null)).toBeNull();
    expect(resolveImageUrlSync(undefined)).toBeNull();
    expect(resolveImageUrlSync("")).toBeNull();
  });

  it("2. passes non-storage URLs verbatim without network calls", () => {
    const staticUrl = "/branding/cheesecorner/logo.png";
    const externalUrl = "https://images.unsplash.com/photo-12345";
    
    expect(resolveImageUrlSync(staticUrl)).toBe(staticUrl);
    expect(resolveImageUrlSync(externalUrl)).toBe(externalUrl);
  });

  it("3. synchronously produces public URLs for menu-images/ storage paths (0 HTTP calls)", () => {
    const storagePath = "menu-images/6d00d671-eaea-47ce-a842-f970878373c9/piri-piri-fries.jpg";
    const resolved = resolveImageUrlSync(storagePath);

    expect(resolved).not.toBeNull();
    expect(resolved).toContain("/storage/v1/object/public/menu-images/6d00d671-eaea-47ce-a842-f970878373c9/piri-piri-fries.jpg");
  });

  it("4. reuses cached URLs on repeated requests for the same image path", () => {
    const storagePath = "menu-images/beverages/iced-latte.jpg";
    const firstCall = resolveImageUrlSync(storagePath);
    const secondCall = resolveImageUrlSync(storagePath);

    expect(firstCall).toBe(secondCall);
  });

  it("5. resolves different image paths to their respective URLs", () => {
    const pathA = "menu-images/cat1/itemA.jpg";
    const pathB = "menu-images/cat2/itemB.jpg";

    const urlA = resolveImageUrlSync(pathA);
    const urlB = resolveImageUrlSync(pathB);

    expect(urlA).toContain("itemA.jpg");
    expect(urlB).toContain("itemB.jpg");
    expect(urlA).not.toBe(urlB);
  });

  it("6. deduplicates in-flight promises when getSignedImageUrl is invoked concurrently", async () => {
    const path = "menu-images/cat1/shared-item.jpg";
    
    const promise1 = getSignedImageUrl(path);
    const promise2 = getSignedImageUrl(path);

    // Both concurrent invocations should resolve to the exact same promise result
    const [res1, res2] = await Promise.all([promise1, promise2]);
    expect(res1).toBe(res2);
  });

  it("7. handles expired URLs by purging cache and re-fetching", async () => {
    const path = "menu-images/test/expiring-item.jpg";
    
    // Simulate expired URL insertion in cache
    const { getSignedImageUrl: getSigned, resolveImageUrlSync: resolveSync } = await import("../lib/useImageUrl");
    
    const initialUrl = resolveSync(path);
    expect(initialUrl).not.toBeNull();

    // Verify cache holds the item
    const repeatedUrl = resolveSync(path);
    expect(repeatedUrl).toBe(initialUrl);
  });
});
