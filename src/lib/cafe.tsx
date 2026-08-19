import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase, type Cafe } from "./db";
import { APP_CONFIG } from "@/config/app";

interface CafeContextType {
  cafe: Cafe | null;
  cafeId: string | undefined;
  isLoading: boolean;
  error: Error | null;
  refreshCafe: () => Promise<void>;
}

const CafeCtx = createContext<CafeContextType | null>(null);

export function CafeProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();

  const { data: cafe, isLoading, error, refetch } = useQuery<Cafe | null, Error>({
    queryKey: ["global-cafe"],
    queryFn: async () => {
      const { data, error: err } = await supabase
        .from("cafes")
        .select("*")
        .eq("slug", APP_CONFIG.cafeSlug)
        .maybeSingle();
      if (err) throw err;
      return data as Cafe | null;
    },
    staleTime: 300_000, // Cache for 5 minutes
  });

  const refreshCafe = async () => {
    await refetch();
    void qc.invalidateQueries({ queryKey: ["global-cafe"] });
  };

  // Realtime synchronization for public cafe operating status and schedule changes
  useEffect(() => {
    if (!cafe?.id) return;
    const channel = supabase
      .channel(`global-cafe-realtime-${cafe.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "cafes",
          filter: `id=eq.${cafe.id}`,
        },
        () => {
          void qc.invalidateQueries({ queryKey: ["global-cafe"] });
          void qc.invalidateQueries({ queryKey: ["table-cafe", cafe.id] });
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [cafe?.id, qc]);

  const value = useMemo<CafeContextType>(() => ({
    cafe: cafe ?? null,
    cafeId: cafe?.id,
    isLoading,
    error,
    refreshCafe,
  }), [cafe, isLoading, error]);

  return <CafeCtx.Provider value={value}>{children}</CafeCtx.Provider>;
}

export function useCafe() {
  const ctx = useContext(CafeCtx);
  if (!ctx) {
    throw new Error("useCafe must be used within a CafeProvider");
  }
  return {
    cafe: ctx.cafe,
    cafeId: ctx.cafeId,
    loading: ctx.isLoading,
    isLoading: ctx.isLoading,
    error: ctx.error,
    refreshCafe: ctx.refreshCafe,
  };
}
