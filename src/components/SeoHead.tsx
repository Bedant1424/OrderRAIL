import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useCafe } from "@/lib/cafe";
import { supabase, type MenuCategory } from "@/lib/db";
import { resolveImageUrlSync } from "@/lib/useImageUrl";
import { CHEESE_CORNER_CONFIG } from "@/branding/cheesecorner/config";
import { APP_CONFIG } from "@/config/app";
import { getOpeningHoursSpecification } from "@/lib/billing/operationsSettings";

/** Helper to set or create a <meta> element in document.head */
function setMetaTag(attributeName: "name" | "property", attributeValue: string, content: string) {
  let element = document.querySelector(`meta[${attributeName}="${attributeValue}"]`);
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attributeName, attributeValue);
    document.head.appendChild(element);
  }
  element.setAttribute("content", content);
}

/** Helper to set or create a <link rel="canonical"> element in document.head */
function setCanonicalUrl(url: string) {
  let link: HTMLLinkElement | null = document.querySelector("link[rel='canonical']");
  if (!link) {
    link = document.createElement("link");
    link.rel = "canonical";
    document.head.appendChild(link);
  }
  link.setAttribute("href", url);
}

/** Helper to set or remove a <script type="application/ld+json"> element in document.head */
function setJsonLd(id: string, data: object | null) {
  let scriptElement = document.getElementById(id) as HTMLScriptElement | null;
  if (!data) {
    if (scriptElement) {
      scriptElement.remove();
    }
    return;
  }
  if (!scriptElement) {
    scriptElement = document.createElement("script");
    scriptElement.id = id;
    scriptElement.type = "application/ld+json";
    document.head.appendChild(scriptElement);
  }
  scriptElement.textContent = JSON.stringify(data, null, 2);
}

/**
 * Safely parses operating hours string into 24-hour HH:MM format for Schema.org openingHoursSpecification.
 * Supports "11:00 AM – 11:00 PM", "10:00 AM - 10:00 PM", or "11:00 - 23:00".
 */
export function parseOperatingHours(rawHours: string | null | undefined): { opens: string; closes: string } | null {
  if (!rawHours || typeof rawHours !== "string") return null;

  // Match 12-hour AM/PM format e.g. "11:00 AM – 11:00 PM"
  const amPmRegex = /(\d{1,2}):(\d{2})\s*(AM|PM)\s*[\u2013\u2014\-to]+\s*(\d{1,2}):(\d{2})\s*(AM|PM)/i;
  const amPmMatch = rawHours.match(amPmRegex);

  if (amPmMatch) {
    let [_, h1Str, m1Str, p1, h2Str, m2Str, p2] = amPmMatch;
    let h1 = parseInt(h1Str, 10);
    let h2 = parseInt(h2Str, 10);

    if (p1.toUpperCase() === "PM" && h1 < 12) h1 += 12;
    if (p1.toUpperCase() === "AM" && h1 === 12) h1 = 0;
    if (p2.toUpperCase() === "PM" && h2 < 12) h2 += 12;
    if (p2.toUpperCase() === "AM" && h2 === 12) h2 = 0;

    const opens = `${String(h1).padStart(2, "0")}:${m1Str}`;
    const closes = `${String(h2).padStart(2, "0")}:${m2Str}`;
    return { opens, closes };
  }

  // Match 24-hour format e.g. "11:00 - 23:00"
  const militaryRegex = /(\d{2}):(\d{2})\s*[\u2013\u2014\-to]+\s*(\d{2}):(\d{2})/;
  const militaryMatch = rawHours.match(militaryRegex);
  if (militaryMatch) {
    return {
      opens: `${militaryMatch[1]}:${militaryMatch[2]}`,
      closes: `${militaryMatch[3]}:${militaryMatch[4]}`,
    };
  }

  return null;
}

/**
 * Safely parses city/locality from address string without hardcoding cities.
 */
export function parseCityFromAddress(address: string | null | undefined): string | null {
  if (!address || typeof address !== "string") return null;

  const parts = address.split(",").map((s) => s.trim()).filter(Boolean);
  if (parts.length >= 2) {
    // Return second to last component if more than 2 components (e.g. "Street, City, State" -> "City")
    const candidate = parts.length >= 3 ? parts[parts.length - 2] : parts[parts.length - 1];
    // Strip zip code numbers if attached
    return candidate.replace(/\b\d{5,6}\b/g, "").trim();
  }
  return parts[0] || null;
}

/**
 * Dynamic Browser Title, Meta Tags, Open Graph, Favicon & Schema.org JSON-LD Manager for OrderRail.
 * Completely multi-cafe data-isolated. Uses read-only TanStack Query for categories without WebSocket side-effects.
 */
export function SeoHead() {
  const location = useLocation();
  const { cafe } = useCafe();

  // Read-only TanStack query for menu categories (no Supabase Realtime channel side-effects)
  const { data: categories = [] } = useQuery<MenuCategory[]>({
    queryKey: ["menu_categories", cafe?.id],
    enabled: !!cafe?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("menu_categories")
        .select("*")
        .eq("cafe_id", cafe!.id)
        .order("sort_order");

      if (error) throw error;
      return (data || []) as MenuCategory[];
    },
    staleTime: 300_000,
  });

  useEffect(() => {
    const path = location.pathname;
    const isCheeseCornerSlug = cafe?.slug === "cheesecorner" || (!cafe && APP_CONFIG.cafeSlug === "cheesecorner");
    
    // Resolve dynamic cafe name
    const cafeName = cafe?.name || (isCheeseCornerSlug ? CHEESE_CORNER_CONFIG.name : "OrderRail Cafe");
    
    // Resolve dynamic address & city locality
    const fullAddress = cafe?.address || (isCheeseCornerSlug ? CHEESE_CORNER_CONFIG.contact.address : null);
    const cityLabel = parseCityFromAddress(fullAddress);

    // Resolve dynamic menu categories
    let categoryNames: string[] = categories.map((c) => c.name).filter(Boolean);
    if (categoryNames.length === 0 && isCheeseCornerSlug) {
      categoryNames = CHEESE_CORNER_CONFIG.categories.map((c) => c.name);
    }

    // Resolve dynamic logo & favicon
    const resolvedLogoPath = resolveImageUrlSync(cafe?.logo_url);
    const rawCafeLogo = resolvedLogoPath || (isCheeseCornerSlug ? CHEESE_CORNER_CONFIG.logoUrl : "/favicon.svg");
    const origin = typeof window !== "undefined" ? window.location.origin : "https://cheese-corner.vercel.app";
    const absoluteLogoUrl = rawCafeLogo.startsWith("http") ? rawCafeLogo : `${origin}${rawCafeLogo.startsWith("/") ? "" : "/"}${rawCafeLogo}`;

    // Dynamic title construction
    let title = cityLabel ? `${cafeName} | ${cityLabel}` : cafeName;
    let description = "";
    let faviconUrl = "/favicon.svg";
    let imageUrl = "/favicon.svg";
    let isCustomerRoute = false;

    if (path.startsWith("/owner")) {
      title = `${cafeName} | Owner Console`;
      description = `${cafeName} Owner Management Dashboard & Analytics`;
      faviconUrl = "/favicon.svg";
      imageUrl = `${origin}/favicon.svg`;
    } else if (path.startsWith("/staff/login")) {
      title = `${cafeName} | Staff Login`;
      description = `${cafeName} Staff Workstation Login`;
      faviconUrl = "/favicon.svg";
      imageUrl = `${origin}/favicon.svg`;
    } else if (path.startsWith("/staff")) {
      title = `${cafeName} | Staff`;
      description = `${cafeName} Staff Live Orders & Kitchen Display System`;
      faviconUrl = "/favicon.svg";
      imageUrl = `${origin}/favicon.svg`;
    } else if (path.startsWith("/counter")) {
      title = `${cafeName} | Counter`;
      description = `${cafeName} Counter POS Billing & Receipt Printing Workstation`;
      faviconUrl = "/favicon.svg";
      imageUrl = `${origin}/favicon.svg`;
    } else if (path.startsWith("/design-system")) {
      title = "Living Design System | OrderRail";
      description = "OrderRail UI Component & Design System Specification";
      faviconUrl = "/favicon.svg";
      imageUrl = `${origin}/favicon.svg`;
    } else if (path === "/" || path.startsWith("/c/") || path.startsWith("/t/")) {
      // Customer public routes
      isCustomerRoute = true;
      title = cityLabel ? `${cafeName} | ${cityLabel}` : cafeName;

      if (categoryNames.length > 0) {
        const catList = categoryNames.slice(0, 4).join(", ");
        description = cityLabel
          ? `${cafeName} in ${cityLabel}. Explore our ${catList} menu and order online.`
          : `${cafeName}. Explore our ${catList} menu and order online.`;
      } else if (cafe?.tagline) {
        description = cityLabel ? `${cafeName} in ${cityLabel} — ${cafe.tagline}` : `${cafeName} — ${cafe.tagline}`;
      } else if (isCheeseCornerSlug && CHEESE_CORNER_CONFIG.tagline) {
        description = cityLabel ? `${cafeName} in ${cityLabel} — ${CHEESE_CORNER_CONFIG.tagline}` : `${cafeName} — ${CHEESE_CORNER_CONFIG.tagline}`;
      } else {
        description = cityLabel ? `${cafeName} in ${cityLabel}. View menu and order online.` : `${cafeName}. View menu and order online.`;
      }

      faviconUrl = rawCafeLogo;
      imageUrl = absoluteLogoUrl;
    }

    // Dynamic Canonical URL calculation using active cafe slug
    const activeSlug = cafe?.slug || (isCheeseCornerSlug ? "cheesecorner" : "orderrail");
    const currentCanonicalUrl = `${origin}${path === "/" ? `/c/${activeSlug}` : path}`;

    // 1. Update Document Title
    document.title = title;

    // 2. Update Dynamic Favicon Link Element
    let faviconElement: HTMLLinkElement | null = document.querySelector("link[rel*='icon']");
    if (!faviconElement) {
      faviconElement = document.createElement("link");
      faviconElement.rel = "icon";
      document.head.appendChild(faviconElement);
    }
    if (faviconElement.getAttribute("href") !== faviconUrl) {
      faviconElement.setAttribute("href", faviconUrl);
    }

    // 3. Update Standard Meta Tags & Canonical
    setMetaTag("name", "description", description);
    setCanonicalUrl(currentCanonicalUrl);

    // 4. Update Open Graph Meta Tags
    setMetaTag("property", "og:title", title);
    setMetaTag("property", "og:description", description);
    setMetaTag("property", "og:image", imageUrl);
    setMetaTag("property", "og:url", currentCanonicalUrl);
    setMetaTag("property", "og:type", "website");
    setMetaTag("property", "og:site_name", cafeName);

    // 5. Update Twitter Card Meta Tags
    setMetaTag("name", "twitter:card", "summary_large_image");
    setMetaTag("name", "twitter:title", title);
    setMetaTag("name", "twitter:description", description);
    setMetaTag("name", "twitter:image", imageUrl);

    // 6. Dynamic Schema.org Restaurant JSON-LD for Customer Routes
    if (isCustomerRoute) {
      let openingSpecs = cafe?.weekly_schedule
        ? getOpeningHoursSpecification(cafe.weekly_schedule as any)
        : [];

      if (openingSpecs.length === 0) {
        const parsedHours = parseOperatingHours(cafe?.operating_hours || (isCheeseCornerSlug ? CHEESE_CORNER_CONFIG.contact.hours : null));
        if (parsedHours) {
          openingSpecs = [
            {
              "@type": "OpeningHoursSpecification",
              dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
              opens: parsedHours.opens,
              closes: parsedHours.closes,
            },
          ];
        }
      }

      const addressObj: any = {
        "@type": "PostalAddress",
        streetAddress: fullAddress || undefined,
        addressCountry: "IN",
      };
      if (cityLabel) {
        addressObj.addressLocality = cityLabel;
      }

      const restaurantSchema: any = {
        "@context": "https://schema.org",
        "@type": "Restaurant",
        "@id": `${origin}/c/${activeSlug}#restaurant`,
        name: cafeName,
        image: absoluteLogoUrl,
        logo: absoluteLogoUrl,
        url: currentCanonicalUrl,
        telephone: cafe?.phone || (isCheeseCornerSlug ? CHEESE_CORNER_CONFIG.contact.phone : undefined),
        priceRange: "₹₹",
        address: addressObj,
      };

      if (categoryNames.length > 0) {
        restaurantSchema.servesCuisine = categoryNames.slice(0, 6);
      }

      if (openingSpecs.length > 0) {
        restaurantSchema.openingHoursSpecification = openingSpecs;
      }

      if (cafe?.instagram) {
        restaurantSchema.sameAs = [`https://instagram.com/${cafe.instagram.replace("@", "")}`];
      } else if (isCheeseCornerSlug && CHEESE_CORNER_CONFIG.contact.instagram) {
        restaurantSchema.sameAs = [`https://instagram.com/${CHEESE_CORNER_CONFIG.contact.instagram.replace("@", "")}`];
      }

      setJsonLd("orderrail-restaurant-jsonld", restaurantSchema);
    } else {
      setJsonLd("orderrail-restaurant-jsonld", null);
    }
  }, [location.pathname, cafe, categories]);

  return null;
}
