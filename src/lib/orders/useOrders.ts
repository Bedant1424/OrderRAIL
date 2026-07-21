import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import {
  fetchCafeOrders,
  updateOrderStatusInDb,
  cancelOrderInDb,
  subscribeToOrdersChannel,
  type OrderWithItems
} from "@/lib/orders/repository";
import type { Order } from "@/lib/db";
import { toast } from "@/components/ui/sonner";

export interface UseOrdersOptions {
  cafeId?: string | null;
  dateRange?: "today" | "7d" | "30d" | "all";
}

export function useOrders({ cafeId, dateRange = "all" }: UseOrdersOptions) {
  const queryClient = useQueryClient();

  const sinceDate = useMemo(() => {
    if (dateRange === "today") {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      return d.toISOString();
    }
    if (dateRange === "7d") {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      return d.toISOString();
    }
    if (dateRange === "30d") {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      return d.toISOString();
    }
    return null;
  }, [dateRange]);

  // Unified Query Key across Owner & Staff
  const queryKey = useMemo(() => ["shared-orders", cafeId, dateRange], [cafeId, dateRange]);

  // Main Query
  const ordersQ = useQuery({
    queryKey,
    enabled: !!cafeId,
    queryFn: () => fetchCafeOrders(cafeId!, sinceDate),
    refetchInterval: 10000,
  });

  // Realtime Subscription (Phase 5)
  useEffect(() => {
    if (!cafeId) return;

    const unsubscribe = subscribeToOrdersChannel(cafeId, () => {
      // Invalidate all shared-orders queries for this cafe
      void queryClient.invalidateQueries({ queryKey: ["shared-orders", cafeId] });
      void queryClient.invalidateQueries({ queryKey: ["staff-orders", cafeId] });
      void queryClient.invalidateQueries({ queryKey: ["owner-orders-page", cafeId] });
    });

    return () => {
      unsubscribe();
    };
  }, [cafeId, queryClient]);

  // Status Mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ orderId, nextStatus }: { orderId: string; nextStatus: Order["status"] }) => {
      await updateOrderStatusInDb(orderId, nextStatus);
    },
    onSuccess: (_, variables) => {
      toast.success(`Order updated to ${variables.nextStatus}`);
      void queryClient.invalidateQueries({ queryKey: ["shared-orders", cafeId] });
      void queryClient.invalidateQueries({ queryKey: ["staff-orders", cafeId] });
      void queryClient.invalidateQueries({ queryKey: ["owner-orders-page", cafeId] });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Failed to update order status";
      toast.error(msg);
    }
  });

  // Cancel Mutation
  const cancelMutation = useMutation({
    mutationFn: async (orderId: string) => {
      await cancelOrderInDb(orderId);
    },
    onSuccess: () => {
      toast.success("Order cancelled");
      void queryClient.invalidateQueries({ queryKey: ["shared-orders", cafeId] });
      void queryClient.invalidateQueries({ queryKey: ["staff-orders", cafeId] });
      void queryClient.invalidateQueries({ queryKey: ["owner-orders-page", cafeId] });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Failed to cancel order";
      toast.error(msg);
    }
  });

  // Edit Mutation
  const editMutation = useMutation({
    mutationFn: async (params: {
      orderId: string;
      items: Parameters<typeof editOrderInDb>[0]["items"];
      notes?: string | null;
      updatedBy?: string;
    }) => {
      await editOrderInDb(params);
    },
    onSuccess: () => {
      toast.success("Order updated successfully");
      void queryClient.invalidateQueries({ queryKey: ["shared-orders", cafeId] });
      void queryClient.invalidateQueries({ queryKey: ["staff-orders", cafeId] });
      void queryClient.invalidateQueries({ queryKey: ["owner-orders-page", cafeId] });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Failed to edit order";
      toast.error(msg);
    }
  });

  const orders = ordersQ.data ?? [];

  const activeOrders = useMemo(
    () => orders.filter((o) => o.status === "pending" || o.status === "preparing" || o.status === "ready"),
    [orders]
  );

  const historyOrders = useMemo(
    () => orders.filter((o) => o.status === "served" || o.status === "cancelled"),
    [orders]
  );

  return {
    orders,
    activeOrders,
    historyOrders,
    isLoading: ordersQ.isLoading,
    isError: ordersQ.isError,
    error: ordersQ.error,
    refetch: ordersQ.refetch,
    updateStatus: (orderId: string, nextStatus: Order["status"]) =>
      updateStatusMutation.mutateAsync({ orderId, nextStatus }),
    cancelOrder: (orderId: string) => cancelMutation.mutateAsync(orderId),
    editOrder: (params: Parameters<typeof editMutation.mutateAsync>[0]) => editMutation.mutateAsync(params),
    isUpdating: updateStatusMutation.isPending || cancelMutation.isPending || editMutation.isPending,
  };
}
