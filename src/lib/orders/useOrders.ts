import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import {
  fetchCafeOrders,
  updateOrderStatusInDb,
  editOrderInDb,
  cancelOrderInDb,
  subscribeToOrdersChannel,
  type OrderWithItems,
  type EditOrderItemPayload
} from "@/lib/orders/repository";
import type { Order } from "@/lib/db";
import { toast } from "@/components/ui/sonner";
import { isOrderActive } from "@/lib/orders/orderUtils";

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

  // Realtime Subscription
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

  // Edit Order Mutation
  const editOrderMutation = useMutation({
    mutationFn: async (params: {
      orderId: string;
      items: EditOrderItemPayload[];
      notes?: string | null;
      updatedBy?: "customer" | "staff" | "owner";
    }) => {
      await editOrderInDb(params);
    },
    onSuccess: () => {
      toast.success("Order changes saved");
      void queryClient.invalidateQueries({ queryKey: ["shared-orders", cafeId] });
      void queryClient.invalidateQueries({ queryKey: ["staff-orders", cafeId] });
      void queryClient.invalidateQueries({ queryKey: ["owner-orders-page", cafeId] });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Failed to save order changes";
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

  const orders = ordersQ.data ?? [];

  const activeOrders = useMemo(
    () => orders.filter((o) => isOrderActive(o.status)),
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
    editOrder: (params: {
      orderId: string;
      items: EditOrderItemPayload[];
      notes?: string | null;
      updatedBy?: "customer" | "staff" | "owner";
    }) => editOrderMutation.mutateAsync(params),
    cancelOrder: (orderId: string) => cancelMutation.mutateAsync(orderId),
    isUpdating: updateStatusMutation.isPending || editOrderMutation.isPending || cancelMutation.isPending,
  };
}
