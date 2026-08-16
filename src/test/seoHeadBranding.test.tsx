import { describe, it, expect, beforeEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { SeoHead, parseOperatingHours, parseCityFromAddress } from "../components/SeoHead";
import { CafeProvider } from "../lib/cafe";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import fs from "fs";
import path from "path";
import type { Cafe } from "../lib/db";

// Helper to wrap SeoHead with seeded React Query cache for Cafe & Categories
function renderWithCafe(
  cafe: Cafe | null,
  route = "/c/cheesecorner",
  categories: any[] = []
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });

  if (cafe) {
    queryClient.setQueryData(["global-cafe"], cafe);
    if (categories.length > 0) {
      queryClient.setQueryData(["menu_categories", cafe.id], categories);
    }
  }

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>
        <CafeProvider>
          <SeoHead />
        </CafeProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("P1 Helper Functions Audit", () => {
  it("parseOperatingHours handles 12-hour AM/PM and 24-hour formats", () => {
    expect(parseOperatingHours("Open Daily: 11:00 AM – 11:00 PM")).toEqual({ opens: "11:00", closes: "23:00" });
    expect(parseOperatingHours("08:00 AM - 10:00 PM")).toEqual({ opens: "08:00", closes: "22:00" });
    expect(parseOperatingHours("09:30 AM - 09:30 PM")).toEqual({ opens: "09:30", closes: "21:30" });
    expect(parseOperatingHours("07:00 - 21:00")).toEqual({ opens: "07:00", closes: "21:00" });
    expect(parseOperatingHours(null)).toBeNull();
    expect(parseOperatingHours("Invalid string")).toBeNull();
  });

  it("parseCityFromAddress extracts locality correctly without hardcoding", () => {
    expect(parseCityFromAddress("Cheese Corner Café, Shop #4, University Road, Near City Center, Berhampur, Odisha")).toBe("Berhampur");
    expect(parseCityFromAddress("123 MG Road, Indiranagar, Bangalore 560038, Karnataka")).toBe("Bangalore");
    expect(parseCityFromAddress("45 Park Street, Kolkata, West Bengal")).toBe("Kolkata");
    expect(parseCityFromAddress(null)).toBeNull();
  });
});

describe("Milestone 5 — Multi-Cafe SEO Data Isolation & Multi-Tenant Tests", () => {
  beforeEach(() => {
    cleanup();
    document.title = "OrderRail";
    document.head.innerHTML = ""; // Reset DOM head
  });

  const cafeA_CheeseCorner: Cafe = {
    id: "cafe-cheese-corner",
    name: "Cheese Corner",
    slug: "cheesecorner",
    address: "Cheese Corner Café, Shop #4, University Road, Near City Center, Berhampur, Odisha",
    phone: "+91 98765 43210",
    whatsapp: "+91 98765 43210",
    email: "contact@cheesecorner.com",
    tagline: "Where Every Slice & Bite is Packed with Melted Goodness!",
    operating_hours: "Open Daily: 11:00 AM – 11:00 PM",
    logo_url: "menu-images/cheese-corner/logo.png",
    currency: "INR",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    google_maps_review_url: null,
    website: null,
    instagram: "@cheesecorner.cafe",
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
    instagram: "@cafemocha.in",
    staff_can_manage_specials: false,
    is_demo_cafe: false,
    tax_settings: null,
  };

  const categoriesA = [
    { id: "c1", name: "Pizza", sort_order: 1 },
    { id: "c2", name: "Burger", sort_order: 2 },
    { id: "c3", name: "Fries", sort_order: 3 },
  ];

  const categoriesB = [
    { id: "c10", name: "Coffee", sort_order: 1 },
    { id: "c11", name: "Sandwiches", sort_order: 2 },
    { id: "c12", name: "Cold Brew", sort_order: 3 },
    { id: "c13", name: "Desserts", sort_order: 4 },
  ];

  it("1. Cafe A (Cheese Corner) generates correct Cheese Corner metadata & JSON-LD", () => {
    renderWithCafe(cafeA_CheeseCorner, "/c/cheesecorner", categoriesA);

    expect(document.title).toBe("Cheese Corner | Berhampur");

    const desc = document.querySelector("meta[name='description']")?.getAttribute("content");
    expect(desc).toContain("Cheese Corner in Berhampur");
    expect(desc).toContain("Pizza, Burger, Fries");

    const canonical = document.querySelector("link[rel='canonical']")?.getAttribute("href");
    expect(canonical).toContain("/c/cheesecorner");

    const jsonLd = document.getElementById("orderrail-restaurant-jsonld");
    expect(jsonLd).not.toBeNull();
    const parsed = JSON.parse(jsonLd?.textContent || "{}");

    expect(parsed.name).toBe("Cheese Corner");
    expect(parsed.address.addressLocality).toBe("Berhampur");
    expect(parsed.servesCuisine).toEqual(["Pizza", "Burger", "Fries"]);
    expect(parsed.openingHoursSpecification[0]).toEqual({
      "@type": "OpeningHoursSpecification",
      dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
      opens: "11:00",
      closes: "23:00",
    });
  });

  it("2. Cafe B (Cafe Mocha) generates correct Cafe Mocha metadata & JSON-LD", () => {
    renderWithCafe(cafeB_CafeMocha, "/c/cafemocha", categoriesB);

    expect(document.title).toBe("Cafe Mocha | Bangalore");

    const desc = document.querySelector("meta[name='description']")?.getAttribute("content");
    expect(desc).toContain("Cafe Mocha in Bangalore");
    expect(desc).toContain("Coffee, Sandwiches, Cold Brew, Desserts");

    const canonical = document.querySelector("link[rel='canonical']")?.getAttribute("href");
    expect(canonical).toContain("/c/cafemocha");

    const jsonLd = document.getElementById("orderrail-restaurant-jsonld");
    expect(jsonLd).not.toBeNull();
    const parsed = JSON.parse(jsonLd?.textContent || "{}");

    expect(parsed.name).toBe("Cafe Mocha");
    expect(parsed.address.addressLocality).toBe("Bangalore");
    expect(parsed.servesCuisine).toEqual(["Coffee", "Sandwiches", "Cold Brew", "Desserts"]);
    expect(parsed.openingHoursSpecification[0]).toEqual({
      "@type": "OpeningHoursSpecification",
      dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
      opens: "08:00",
      closes: "22:00",
    });
  });

  it("3. CRITICAL ISOLATION ASSERTION: Cafe B contains ZERO Cheese Corner leakage", () => {
    renderWithCafe(cafeB_CafeMocha, "/c/cafemocha", categoriesB);

    const fullHtml = document.head.innerHTML;

    // Document head must NOT contain Cheese Corner specific strings
    expect(fullHtml).not.toContain("Cheese Corner");
    expect(fullHtml).not.toContain("Berhampur");
    expect(fullHtml).not.toContain("cheesecorner");
    expect(fullHtml).not.toContain("Pizza");
    expect(fullHtml).not.toContain("11:00"); // Cheese Corner opening hour
    expect(fullHtml).not.toContain("23:00"); // Cheese Corner closing hour
  });

  it("4. Workstation Partitioning for Cafe B", () => {
    const res1 = renderWithCafe(cafeB_CafeMocha, "/owner/analytics");
    expect(document.title).toBe("Cafe Mocha | Owner Console");
    res1.unmount();

    const res2 = renderWithCafe(cafeB_CafeMocha, "/staff");
    expect(document.title).toBe("Cafe Mocha | Staff");
    res2.unmount();

    const res3 = renderWithCafe(cafeB_CafeMocha, "/counter");
    expect(document.title).toBe("Cafe Mocha | Counter");
    res3.unmount();
  });

  it("5. Sitemap & Robots Infrastructure Verification", () => {
    const robotsPath = path.resolve(__dirname, "../../public/robots.txt");
    const sitemapPath = path.resolve(__dirname, "../../public/sitemap.xml");

    expect(fs.existsSync(robotsPath)).toBe(true);
    expect(fs.existsSync(sitemapPath)).toBe(true);

    const robotsContent = fs.readFileSync(robotsPath, "utf-8");
    const sitemapContent = fs.readFileSync(sitemapPath, "utf-8");

    expect(robotsContent).toContain("Sitemap: https://cheese-corner.vercel.app/sitemap.xml");
    expect(sitemapContent).toContain("https://cheese-corner.vercel.app/c/cheesecorner");
  });
});
