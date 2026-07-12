import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { supabase, type MenuCategory, type MenuItem } from "@/lib/db";
import { MenuItemCard } from "@/components/customer/MenuItemCard";
import { cn } from "@/lib/utils";
import { useCart } from "@/lib/cart";
import { BOTTOM_NAV_HEIGHT, FLOATING_CART_GAP, FLOATING_CART_HEIGHT } from "@/lib/constants";

export function MenuBrowser({ cafeId, currency }: { cafeId: string; currency: string }) {
  const { count } = useCart();
  const [query, setQuery] = useState("");
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  const { data: categories = [], isLoading: loadingCats } = useQuery({
    queryKey: ["menu_categories", cafeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("menu_categories")
        .select("*")
        .eq("cafe_id", cafeId)
        .order("sort_order");
      if (error) throw error;
      return data as MenuCategory[];
    },
  });

  const { data: items = [], isLoading: loadingItems } = useQuery({
    queryKey: ["menu_items", cafeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("menu_items")
        .select("*")
        .eq("cafe_id", cafeId)
        .eq("is_available", true)
        .order("sort_order");
      if (error) throw error;
      return data as MenuItem[];
    },
  });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((i) => {
      if (!q) return true;
      return (
        i.name.toLowerCase().includes(q) ||
        (i.description ?? "").toLowerCase().includes(q)
      );
    });
  }, [items, query]);

  const grouped = useMemo(() => {
    const map = new Map<string, MenuItem[]>();
    for (const c of categories) map.set(c.id, []);
    for (const it of filtered) {
      if (!it.category_id) continue;
      map.get(it.category_id)?.push(it);
    }
    return map;
  }, [categories, filtered]);

  // Track active category on scroll
  useEffect(() => {
    if (!categories.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActiveCat(visible.target.id.replace("cat-", ""));
      },
      { rootMargin: "-140px 0px -60% 0px", threshold: 0 },
    );
    Object.values(sectionRefs.current).forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, [categories, filtered]);

  // Search transient back navigation logic
  useEffect(() => {
    if (!query) return;

    const state = { isSearching: true };
    window.history.pushState(state, "");

    const handlePopState = () => {
      setQuery("");
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
      if (window.history.state?.isSearching) {
        window.history.back();
      }
    };
  }, [query ? true : false]);

  // Category chips auto-scroll centering (only if not fully visible)
  useEffect(() => {
    if (!activeCat) return;
    const activeChip = document.getElementById(`chip-${activeCat}`);
    const container = activeChip?.parentElement;
    if (activeChip && container) {
      const chipRect = activeChip.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();

      // Only scroll if the active chip is partially or fully out of the container view
      const isVisible = (
        chipRect.left >= containerRect.left &&
        chipRect.right <= containerRect.right
      );

      if (!isVisible) {
        activeChip.scrollIntoView({
          behavior: "smooth",
          inline: "center",
          block: "nearest"
        });
      }
    }
  }, [activeCat]);

  const scrollToCat = (id: string) => {
    const el = sectionRefs.current[id];
    if (el) {
      const y = el.getBoundingClientRect().top + window.scrollY - 128;
      window.scrollTo({ top: y, behavior: "smooth" });
    }
  };

  const bottomPadding = count > 0
    ? `calc(${BOTTOM_NAV_HEIGHT} + ${FLOATING_CART_GAP} + ${FLOATING_CART_HEIGHT} + ${FLOATING_CART_GAP} + env(safe-area-inset-bottom))`
    : `calc(${BOTTOM_NAV_HEIGHT} + 1.5rem + env(safe-area-inset-bottom))`;

  return (
    <div style={{ paddingBottom: bottomPadding }}>
      {/* Search */}
      <div className="px-4 pt-2">
        <label className="relative block">
          <span className="sr-only">Search menu</span>
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search the menu"
            className="w-full rounded-full border border-border bg-card py-3 pl-11 pr-4 text-sm outline-none ring-ring/60 transition focus:ring-2"
          />
        </label>
      </div>

      {/* Sticky category bar */}
      <div className="sticky top-14 z-20 mt-4 border-b border-border/60 bg-background/85 backdrop-blur">
        <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 py-3">
          {categories.map((c) => (
            <button
              key={c.id}
              id={`chip-${c.id}`}
              onClick={() => scrollToCat(c.id)}
              className={cn(
                "shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 shadow-sm",
                activeCat === c.id
                  ? "btn-primary-action font-semibold"
                  : "bg-secondary/70 text-secondary-foreground hover:bg-secondary hover:text-foreground",
              )}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      {/* Sections */}
      <div className="space-y-8 px-4 pt-6">
        {categories.map((c) => {
          const list = grouped.get(c.id) ?? [];
          if (!list.length && query) return null;
          return (
            <section
              key={c.id}
              id={`cat-${c.id}`}
              ref={(el) => {
                sectionRefs.current[c.id] = el;
              }}
              className="scroll-mt-32"
            >
              <h2 className="mb-3 font-display text-2xl font-semibold">{c.name}</h2>
              <div className="space-y-3">
                {list.map((it) => (
                  <MenuItemCard key={it.id} item={it} currency={currency} />
                ))}
                {!list.length && (
                  <p className="text-sm text-muted-foreground">No items in this category.</p>
                )}
              </div>
            </section>
          );
        })}
        {(loadingCats || loadingItems) ? (
          <div className="flex flex-col items-center justify-center p-12 gap-3 text-muted-foreground">
            <div className="h-7 w-7 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
            <span className="text-sm font-medium">Loading menu…</span>
          </div>
        ) : !categories.length && (
          <p className="text-center text-muted-foreground">Menu is being prepared…</p>
        )}
      </div>
    </div>
  );
}
