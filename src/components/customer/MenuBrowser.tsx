import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { supabase, type MenuCategory, type MenuItem } from "@/lib/db";
import { MenuItemCard } from "@/components/customer/MenuItemCard";
import { cn } from "@/lib/utils";

export function MenuBrowser({ cafeId, currency }: { cafeId: string; currency: string }) {
  const [query, setQuery] = useState("");
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  const { data: categories = [] } = useQuery({
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

  const { data: items = [] } = useQuery({
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
    if (!q) return items;
    return items.filter(
      (i) =>
        i.name.toLowerCase().includes(q) ||
        (i.description ?? "").toLowerCase().includes(q),
    );
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

  const scrollToCat = (id: string) => {
    const el = sectionRefs.current[id];
    if (el) {
      const y = el.getBoundingClientRect().top + window.scrollY - 128;
      window.scrollTo({ top: y, behavior: "smooth" });
    }
  };

  return (
    <div className="pb-[calc(10.3125rem+env(safe-area-inset-bottom))]">
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
              onClick={() => scrollToCat(c.id)}
              className={cn(
                "shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                activeCat === c.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-muted",
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
        {!categories.length && (
          <p className="text-center text-muted-foreground">Menu is being prepared…</p>
        )}
      </div>
    </div>
  );
}
