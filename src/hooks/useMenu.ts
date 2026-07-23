import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase, type MenuCategory, type MenuItem } from "@/lib/db";

export interface ProductionMenuItem extends MenuItem {
  categoryName?: string;
}

export function useMenu(cafeId?: string | null) {
  const queryClient = useQueryClient();

  // Real-time synchronization for menu updates across Counter, Staff, Owner, Customer
  useEffect(() => {
    if (!cafeId) return;

    const itemsChannel = supabase
      .channel(`realtime-menu-items-${cafeId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "menu_items", filter: `cafe_id=eq.${cafeId}` },
        () => {
          void queryClient.invalidateQueries({ queryKey: ["menu_items", cafeId] });
        }
      )
      .subscribe();

    const catChannel = supabase
      .channel(`realtime-menu-cats-${cafeId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "menu_categories", filter: `cafe_id=eq.${cafeId}` },
        () => {
          void queryClient.invalidateQueries({ queryKey: ["menu_categories", cafeId] });
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(itemsChannel);
      void supabase.removeChannel(catChannel);
    };
  }, [cafeId, queryClient]);

  // Query Categories
  const categoriesQuery = useQuery({
    queryKey: ["menu_categories", cafeId],
    enabled: !!cafeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("menu_categories")
        .select("*")
        .eq("cafe_id", cafeId!)
        .order("sort_order");

      if (error) throw error;
      return (data || []) as MenuCategory[];
    },
  });

  // Query Items
  const itemsQuery = useQuery({
    queryKey: ["menu_items", cafeId],
    enabled: !!cafeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("menu_items")
        .select("*")
        .eq("cafe_id", cafeId!)
        .order("sort_order");

      if (error) throw error;
      return (data || []) as MenuItem[];
    },
  });

  const categories = categoriesQuery.data ?? [];
  const items = itemsQuery.data ?? [];

  const categoryMap = new Map(categories.map((c) => [c.id, c.name]));

  const enrichedItems: ProductionMenuItem[] = items.map((item) => ({
    ...item,
    categoryName: item.category_id ? categoryMap.get(item.category_id) || "General" : "General",
  }));

  return {
    categories,
    items: enrichedItems,
    rawItems: items,
    isLoading: categoriesQuery.isLoading || itemsQuery.isLoading,
    error: categoriesQuery.error || itemsQuery.error,
    refetch: () => {
      void categoriesQuery.refetch();
      void itemsQuery.refetch();
    },
  };
}
