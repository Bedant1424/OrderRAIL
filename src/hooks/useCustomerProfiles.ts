import { useQuery } from "@tanstack/react-query";
import { fetchCafeCustomerProfiles, aggregateCustomerProfiles, type CustomerProfile } from "@/lib/customers/customerService";
import { useOrders } from "@/lib/orders/useOrders";
import { useMemo } from "react";
import { normalizePhoneNumber } from "@/lib/customers/phoneNormalization";

export function useCustomerProfiles(cafeId?: string | null) {
  const { orders = [], isLoading: isOrdersLoading } = useOrders({ cafeId });

  const { data: dbProfiles = [], isLoading: isDbLoading, refetch } = useQuery({
    queryKey: ["customer-profiles", cafeId],
    enabled: !!cafeId,
    queryFn: () => fetchCafeCustomerProfiles(cafeId!),
    refetchInterval: 10000,
  });

  // Combine DB profiles with any legacy order aggregations
  const allProfiles = useMemo(() => {
    const legacyProfiles = aggregateCustomerProfiles(orders, { excludeWalkins: true });

    if (dbProfiles.length === 0) {
      return legacyProfiles;
    }

    const mergedMap = new Map<string, CustomerProfile>();

    // Add canonical DB profiles first
    for (const p of dbProfiles) {
      const key = p.normalizedPhone ? `phone:${p.normalizedPhone}` : p.id;
      mergedMap.set(key, { ...p });
    }

    // Merge legacy order profiles if not already present in DB profiles
    for (const leg of legacyProfiles) {
      const normPhone = normalizePhoneNumber(leg.phone);
      const key = normPhone ? `phone:${normPhone}` : leg.id;

      if (!mergedMap.has(key)) {
        mergedMap.set(key, leg);
      } else {
        const existing = mergedMap.get(key)!;
        // Merge orders if missing
        const existingOrderIds = new Set(existing.orders.map((o) => o.id));
        for (const o of leg.orders) {
          if (!existingOrderIds.has(o.id)) {
            existing.orders.push(o);
          }
        }
      }
    }

    return Array.from(mergedMap.values()).sort((a, b) => b.lifetimeSpendCents - a.lifetimeSpendCents);
  }, [dbProfiles, orders]);

  return {
    customerProfiles: allProfiles,
    isLoading: isOrdersLoading || isDbLoading,
    refetch,
  };
}
