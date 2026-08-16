import { describe, it, expect, beforeEach, beforeAll } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import CheeseCornerLandingPage, {
  normalizePhoneLink,
  normalizeInstagramHref,
  normalizeInstagramDisplay,
  getAddressMapsHref,
} from "../branding/cheesecorner/CheeseCornerLandingPage";
import { CafeProvider } from "../lib/cafe";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import type { Cafe } from "../lib/db";

// Mock IntersectionObserver globally for framer-motion animations in jsdom
beforeAll(() => {
  class MockIntersectionObserver implements IntersectionObserver {
    readonly root: Element | Document | null = null;
    readonly rootMargin: string = "0px";
    readonly thresholds: ReadonlyArray<number> = [0];
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords(): IntersectionObserverEntry[] {
      return [];
    }
  }

  (globalThis as any).IntersectionObserver = MockIntersectionObserver;
  if (typeof window !== "undefined") {
    (window as any).IntersectionObserver = MockIntersectionObserver;
  }
});

// Helper to render CheeseCornerLandingPage with custom Cafe Context via React Query global-cafe data
function renderLandingPageWithCafe(cafe: Cafe | null, categories: any[] = []) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });

  queryClient.setQueryData(["global-cafe"], cafe);
  if (cafe) {
    queryClient.setQueryData(["menu_categories", cafe.id], categories);
    queryClient.setQueryData(["menu_items", cafe.id], []);
  }

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/"]}>
        <CafeProvider>
          <CheeseCornerLandingPage />
        </CafeProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("Landing Page Business Details & Location/Hours Tile Audit", () => {
  beforeEach(() => {
    cleanup();
  });

  const cafeA_CheeseCorner: Cafe = {
    id: "cafe-cheese-corner",
    name: "Cheese Corner",
    slug: "cheesecorner",
    address: "Prem Nagar Main Rd, Prem Nagar, Brahmapur, Odisha 760002",
    phone: "+91 9556596091",
    whatsapp: "+91 9556596091",
    email: "contact@cheesecorner.com",
    tagline: "Gourmet Comfort Food",
    operating_hours: "10AM - 11PM",
    logo_url: "menu-images/cheese-corner/logo.png",
    currency: "INR",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    google_maps_review_url: "https://maps.google.com/?q=CheeseCornerBrahmapur",
    website: "https://cheese-corner.vercel.app/",
    instagram: "@cheesecorner_berhampur",
    staff_can_manage_specials: false,
    is_demo_cafe: true,
    tax_settings: null,
  };

  const cafeB_CafeMocha: Cafe = {
    id: "cafe-mocha-bengaluru",
    name: "Cafe Mocha",
    slug: "cafemocha",
    address: "123 MG Road, Indiranagar, Bangalore, Karnataka",
    phone: "+91 80123 45678",
    whatsapp: "+91 80123 45678",
    email: "hello@cafemocha.in",
    tagline: "Artisanal Brews & Gourmet Bites",
    operating_hours: "Open Daily: 08:00 AM – 10:00 PM",
    logo_url: "menu-images/cafe-mocha/logo.png",
    currency: "INR",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    google_maps_review_url: null,
    website: null,
    instagram: "https://www.instagram.com/cafemocha_blr/",
    staff_can_manage_specials: false,
    is_demo_cafe: false,
    tax_settings: null,
  };

  it("Test 1: Dynamic address, phone, Instagram, and operating hours render from active cafe data", () => {
    const { getByText } = renderLandingPageWithCafe(cafeA_CheeseCorner);

    expect(getByText("Prem Nagar Main Rd, Prem Nagar, Brahmapur, Odisha 760002")).not.toBeNull();
    expect(getByText("+91 9556596091")).not.toBeNull();
    expect(getByText("@cheesecorner_berhampur")).not.toBeNull();
    expect(getByText("10AM - 11PM")).not.toBeNull();
  });

  it("Test 2: Address tile uses cafe.google_maps_review_url when present", () => {
    const { container } = renderLandingPageWithCafe(cafeA_CheeseCorner);
    const addressLink = container.querySelector("a[href*='maps.google.com']");

    expect(addressLink).not.toBeNull();
    expect(addressLink?.getAttribute("href")).toBe("https://maps.google.com/?q=CheeseCornerBrahmapur");
    expect(addressLink?.getAttribute("target")).toBe("_blank");
    expect(addressLink?.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("Test 3: Address tile falls back to generated Google Maps search URL when google_maps_review_url is absent", () => {
    const { container } = renderLandingPageWithCafe(cafeB_CafeMocha);
    const addressLink = container.querySelector("a[href*='google.com/maps/search']");

    expect(addressLink).not.toBeNull();
    const expectedQuery = encodeURIComponent("123 MG Road, Indiranagar, Bangalore, Karnataka");
    expect(addressLink?.getAttribute("href")).toContain(expectedQuery);
    expect(addressLink?.getAttribute("target")).toBe("_blank");
    expect(addressLink?.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("Test 4: Phone tile generates correct tel: URL from formatted phone number", () => {
    expect(normalizePhoneLink("+91 9556596091")).toBe("tel:+919556596091");
    expect(normalizePhoneLink("+91 (801) 234-5678")).toBe("tel:+918012345678");

    const { container } = renderLandingPageWithCafe(cafeA_CheeseCorner);
    const phoneLink = container.querySelector("a[href='tel:+919556596091']");

    expect(phoneLink).not.toBeNull();
    expect(phoneLink?.getAttribute("target")).toBeNull(); // tel: should not use target="_blank"
  });

  it("Test 5: Instagram full URL is preserved in href", () => {
    expect(normalizeInstagramHref("https://www.instagram.com/cafemocha_blr/")).toBe("https://www.instagram.com/cafemocha_blr/");

    const { container } = renderLandingPageWithCafe(cafeB_CafeMocha);
    const instaLink = container.querySelector("a[href='https://www.instagram.com/cafemocha_blr/']");

    expect(instaLink).not.toBeNull();
    expect(instaLink?.getAttribute("target")).toBe("_blank");
  });

  it("Test 6: Instagram @handle is normalized to https://instagram.com/handle", () => {
    expect(normalizeInstagramHref("@cheesecorner_berhampur")).toBe("https://instagram.com/cheesecorner_berhampur");
    expect(normalizeInstagramDisplay("@cheesecorner_berhampur")).toBe("@cheesecorner_berhampur");
  });

  it("Test 7: Instagram raw handle is normalized correctly", () => {
    expect(normalizeInstagramHref("cafemocha_blr")).toBe("https://instagram.com/cafemocha_blr");
    expect(normalizeInstagramDisplay("cafemocha_blr")).toBe("@cafemocha_blr");
  });

  it("Test 8: Opening Hours tile remains non-clickable", () => {
    const { getByText } = renderLandingPageWithCafe(cafeA_CheeseCorner);
    const hoursLabel = getByText("Opening Hours");
    const hoursTile = hoursLabel.closest("a");

    expect(hoursTile).toBeNull(); // Opening Hours must NOT be wrapped in <a> tag
  });

  it("Test 9: Missing phone/Instagram/address values do not produce broken hrefs", () => {
    const emptyCafe: Cafe = {
      ...cafeA_CheeseCorner,
      id: "empty-cafe",
      slug: "emptycafe",
      address: null,
      phone: null,
      instagram: null,
      operating_hours: null,
      google_maps_review_url: null,
    };

    const { container } = renderLandingPageWithCafe(emptyCafe);
    const brokenTel = container.querySelector("a[href='tel:undefined']");
    const brokenInsta = container.querySelector("a[href='https://instagram.com/undefined']");

    expect(brokenTel).toBeNull();
    expect(brokenInsta).toBeNull();
  });

  it("Test 10: Multi-cafe isolation: Cafe Mocha displays its own details without Cheese Corner leakage", () => {
    const { container, getByText } = renderLandingPageWithCafe(cafeB_CafeMocha);

    expect(getByText("123 MG Road, Indiranagar, Bangalore, Karnataka")).not.toBeNull();
    expect(getByText("+91 80123 45678")).not.toBeNull();
    expect(getByText("@cafemocha_blr")).not.toBeNull();
    expect(getByText("Open Daily: 08:00 AM – 10:00 PM")).not.toBeNull();

    const fullHtml = container.innerHTML;
    expect(fullHtml).not.toContain("Prem Nagar Main Rd");
    expect(fullHtml).not.toContain("+91 9556596091");
    expect(fullHtml).not.toContain("cheesecorner_berhampur");
    expect(fullHtml).not.toContain("10AM - 11PM");
  });
});
