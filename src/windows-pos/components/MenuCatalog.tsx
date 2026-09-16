import React, { useState, useMemo } from "react";
import { Search, Plus, Minus, X, AlertCircle, Sparkles } from "lucide-react";
import { useMenu, type ProductionMenuItem } from "@/hooks/useMenu";
import { CounterMenuImage } from "./CounterMenuImage";
import { CounterCacheService } from "../services/counterCacheService";
import type { CounterCartItem } from "../services/counterOrderBuilderService";

export interface MenuCatalogProps {
  cafeId: string;
  cartItems: CounterCartItem[];
  onAddToCart: (item: ProductionMenuItem) => void;
  onUpdateCartQty?: (menuItemId: string, delta: number) => void;
}

export const MenuCatalog: React.FC<MenuCatalogProps> = ({
  cafeId,
  cartItems,
  onAddToCart,
  onUpdateCartQty,
}) => {
  const { categories: fetchedCategories = [], items: fetchedItems = [], isLoading, error } = useMenu(cafeId);

  // Auto-save to cache when live menu items exist
  React.useEffect(() => {
    if (cafeId && fetchedCategories.length > 0 && fetchedItems.length > 0) {
      CounterCacheService.saveMenuCache(cafeId, fetchedCategories, fetchedItems);
    }
  }, [cafeId, fetchedCategories, fetchedItems]);

  // Fallback to cache if network error occurs or offline
  const cachedMenu = useMemo(() => {
    if (cafeId && (error || fetchedItems.length === 0)) {
      return CounterCacheService.loadMenuCache(cafeId);
    }
    return null;
  }, [cafeId, error, fetchedItems.length]);

  const categories = fetchedCategories.length > 0 ? fetchedCategories : cachedMenu?.categories || [];
  const items = fetchedItems.length > 0 ? fetchedItems : cachedMenu?.items || [];

  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Map of cart quantities by menuItemId for instant card lookup
  const cartQtyByItemId = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of cartItems) {
      if (item.menuItemId) {
        map.set(item.menuItemId, (map.get(item.menuItemId) || 0) + item.qty);
      }
    }
    return map;
  }, [cartItems]);

  // Filtered categories with item counts
  const categoryCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const it of items) {
      if (it.category_id) {
        map.set(it.category_id, (map.get(it.category_id) || 0) + 1);
      }
    }
    return map;
  }, [items]);

  // Filtered items based on category and search query
  const filteredItems = useMemo(() => {
    let result = items;

    if (selectedCategoryId !== "ALL") {
      result = result.filter((it) => it.category_id === selectedCategoryId);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (it) =>
          it.name.toLowerCase().includes(q) ||
          (it.description && it.description.toLowerCase().includes(q)) ||
          (it.categoryName && it.categoryName.toLowerCase().includes(q))
      );
    }

    return result;
  }, [items, selectedCategoryId, searchQuery]);

  const formatPrice = (cents: number) => `₹${(cents / 100).toFixed(2)}`;

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-zinc-950 border-r border-zinc-800">
      {/* Search Bar & Category Navigation */}
      <div className="p-3 border-b border-zinc-800 bg-zinc-900/60 space-y-2.5 shrink-0">
        {/* Search Input */}
        <div className="relative">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search menu items or categories (e.g. Cheese Pizza, Fries, Shake)..."
            className="w-full pl-9 pr-8 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-orange-500/60 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-2.5 text-zinc-500 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Category Horizontal Scrolling Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 select-none scrollbar-thin scrollbar-thumb-zinc-800">
          <button
            onClick={() => setSelectedCategoryId("ALL")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 border ${
              selectedCategoryId === "ALL"
                ? "bg-orange-500/20 text-orange-300 border-orange-500/40 shadow-sm"
                : "bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-zinc-200 hover:border-zinc-700"
            }`}
          >
            <span>All</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-zinc-800 text-zinc-400">
              {items.length}
            </span>
          </button>

          {categories.map((cat) => {
            const isSelected = selectedCategoryId === cat.id;
            const count = categoryCounts.get(cat.id) || 0;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategoryId(cat.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 border ${
                  isSelected
                    ? "bg-orange-500/20 text-orange-300 border-orange-500/40 shadow-sm"
                    : "bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-zinc-200 hover:border-zinc-700"
                }`}
              >
                <span>{cat.name}</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-zinc-800 text-zinc-400">
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Items Catalog Content */}
      <div className="flex-1 overflow-y-auto p-3.5">
        {isLoading && items.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-zinc-500 text-xs">
            <div className="w-6 h-6 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin mb-2" />
            <span>Loading Cheese Corner menu...</span>
          </div>
        ) : error && items.length === 0 ? (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>Failed to load menu items. Please check network connection.</span>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-zinc-500 text-xs text-center p-6">
            <Sparkles className="w-8 h-8 text-zinc-700 mb-2" />
            <span className="font-semibold text-zinc-400">No matching menu items</span>
            <span className="text-[11px] text-zinc-600 mt-1">
              Try adjusting your search query or selecting a different category tab.
            </span>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5">
            {filteredItems.map((item) => {
              const inCartQty = cartQtyByItemId.get(item.id) || 0;
              const isAvailable = item.is_available !== false;

              return (
                <div
                  key={item.id}
                  onClick={() => {
                    if (isAvailable) {
                      onAddToCart(item);
                    }
                  }}
                  className={`group relative text-left bg-zinc-900/90 border rounded-xl p-2.5 flex flex-col justify-between select-none transition-all ${
                    !isAvailable
                      ? "opacity-50 border-zinc-800/60 cursor-not-allowed"
                      : inCartQty > 0
                      ? "border-orange-500/60 shadow-md shadow-orange-950/20 bg-zinc-900 cursor-pointer hover:border-orange-400"
                      : "border-zinc-800/80 hover:border-zinc-600 hover:bg-zinc-850 cursor-pointer"
                  }`}
                >
                  {/* Top Image + Info Row */}
                  <div>
                    <div className="relative w-full aspect-square rounded-lg overflow-hidden mb-2 bg-zinc-950 flex items-center justify-center">
                      <CounterMenuImage
                        src={item.image_url}
                        alt={item.name}
                        size="md"
                        category={item.categoryName}
                        className="w-full h-full rounded-lg"
                      />

                      {/* In-Cart Counter Pill */}
                      {inCartQty > 0 && (
                        <div className="absolute top-1.5 right-1.5 px-2 py-0.5 rounded-full bg-orange-600 text-white font-mono font-bold text-[10px] shadow-lg shadow-black/40">
                          {inCartQty} in cart
                        </div>
                      )}

                      {/* Sold-out overlay */}
                      {!isAvailable && (
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-[1px] flex items-center justify-center">
                          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
                            Sold Out
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="font-semibold text-xs text-white line-clamp-1 group-hover:text-orange-300 transition-colors">
                      {item.name}
                    </div>
                    {item.description && (
                      <p className="text-[11px] text-zinc-500 line-clamp-1 mt-0.5">
                        {item.description}
                      </p>
                    )}
                  </div>

                  {/* Bottom Price & Add Action */}
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-zinc-800/60">
                    <span className="font-mono text-xs font-bold text-emerald-400">
                      {formatPrice(item.price_cents)}
                    </span>

                    {isAvailable && (
                      <div className="flex items-center gap-1">
                        {inCartQty > 0 && onUpdateCartQty ? (
                          <div
                            className="flex items-center gap-1 bg-zinc-950 border border-zinc-800 rounded-lg p-0.5"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              onClick={() => onUpdateCartQty(item.id, -1)}
                              className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white"
                              title="Decrease"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="font-mono text-xs font-bold text-white px-1">
                              {inCartQty}
                            </span>
                            <button
                              onClick={() => onUpdateCartQty(item.id, 1)}
                              className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white"
                              title="Increase"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <button
                            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-zinc-800 group-hover:bg-orange-600 text-zinc-300 group-hover:text-white text-[11px] font-semibold transition-colors"
                          >
                            <Plus className="w-3 h-3" />
                            <span>Add</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
