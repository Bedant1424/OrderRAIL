import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { supabase, type MenuCategory, type MenuItem } from "@/lib/db";
import { MenuItemCard } from "@/components/customer/MenuItemCard";
import { cn } from "@/lib/utils";
import { useCart } from "@/lib/cart";
import { BOTTOM_NAV_HEIGHT, FLOATING_CART_GAP, FLOATING_CART_HEIGHT } from "@/lib/constants";
import { toast } from "@/components/ui/sonner";

export function MenuBrowser({ cafeId, currency }: { cafeId: string; currency: string }) {
  const { count, lines, setQty } = useCart();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  // Real-time synchronization for menu items availability
  useEffect(() => {
    if (!cafeId) return;
    const channel = supabase
      .channel(`menu-items-realtime-${cafeId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "menu_items",
          filter: `cafe_id=eq.${cafeId}`,
        },
        () => {
          void queryClient.invalidateQueries({ queryKey: ["menu_items", cafeId] });
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [cafeId, queryClient]);

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

  // Remove unavailable items from cart
  useEffect(() => {
    if (loadingItems || items.length === 0) return;
    const availableIds = new Set(items.map((i) => i.id));
    for (const line of lines) {
      if (!availableIds.has(line.item.id)) {
        setQty(line.item.id, 0);
        toast.error(`"${line.item.name}" is no longer available and was removed from your cart.`);
      }
    }
  }, [items, loadingItems, lines, setQty]);

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
      const headerEl = document.querySelector("header");
      const categoryBarEl = document.getElementById(`chip-${id}`)?.closest(".sticky");
      const headerHeight = headerEl?.getBoundingClientRect().height || 56;
      const catBarHeight = categoryBarEl?.getBoundingClientRect().height || 52;
      const totalOffset = headerHeight + catBarHeight + 12; // 12px breathing room

      const y = el.getBoundingClientRect().top + window.scrollY - totalOffset;
      window.scrollTo({ top: y, behavior: "smooth" });
    }
  };

  const bottomPadding = count > 0
    ? `calc(${BOTTOM_NAV_HEIGHT} + ${FLOATING_CART_GAP} + ${FLOATING_CART_HEIGHT} + ${FLOATING_CART_GAP} + env(safe-area-inset-bottom))`
    : `calc(${BOTTOM_NAV_HEIGHT} + 1.5rem + env(safe-area-inset-bottom))`;

  return (
    <div style={{ paddingBottom: bottomPadding }}>
      {/* Menu Header Banner */}
      <div className="px-4 pt-3 pb-1">
        <h1 className="font-display text-2xl font-black text-cc-text tracking-tight">Our Menu</h1>
        <p className="text-xs text-cc-text-muted font-medium">Freshly prepared & served to your table</p>
      </div>

      {/* Search Input */}
      <div className="px-4 pt-2">
        <label className="relative block">
          <span className="sr-only">Search menu</span>
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-cc-text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search delicious dishes..."
            className="w-full rounded-full border border-cc-border bg-cc-surface py-2.5 pl-11 pr-4 text-sm text-cc-text placeholder:text-cc-text-muted outline-none shadow-xs transition focus:border-cc-primary focus:ring-2 focus:ring-cc-primary/20"
          />
        </label>
      </div>

      {/* Sticky category bar */}
      <div className="sticky top-14 z-20 mt-3 border-b border-cc-border bg-cc-background/95 backdrop-blur-md">
        <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 py-2.5">
          {categories.map((c) => (
            <button
              key={c.id}
              id={`chip-${c.id}`}
              onClick={() => scrollToCat(c.id)}
              className={cn(
                "shrink-0 rounded-full px-4 py-1.5 text-xs font-bold transition-all active:scale-95 focus-visible:outline-none min-h-[36px] flex items-center justify-center shadow-xs",
                activeCat === c.id
                  ? "bg-cc-primary text-white border border-cc-primary shadow-xs"
                  : "bg-cc-surface text-cc-text-muted border border-cc-border hover:bg-cc-surface/80 hover:text-cc-text",
              )}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      {/* Category Sections */}
      <div className="space-y-8 px-4 pt-5">
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
              <h2 className="mb-3 font-display text-xl font-extrabold text-cc-text tracking-tight">{c.name}</h2>
              <div className="space-y-3">
                {list.map((it) => (
                  <MenuItemCard key={it.id} item={it} currency={currency} />
                ))}
                {!list.length && (
                  <p className="text-xs text-cc-text-muted italic py-2">No dishes in this category yet.</p>
                )}
              </div>
            </section>
          );
        })}
        {(loadingCats || loadingItems) ? (
          <div className="flex flex-col items-center justify-center p-12 gap-3 text-cc-text-muted">
            <div className="h-7 w-7 animate-spin rounded-full border-2 border-cc-primary/20 border-t-cc-primary" />
            <span className="text-xs font-medium">Preparing menu…</span>
          </div>
        ) : !categories.length && (
          <p className="text-center text-xs text-cc-text-muted py-12">Menu is being prepared…</p>
        )}
      </div>
    </div>
  );
}
