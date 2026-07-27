-- Sprint 9.2.4.1 — Owner Analytics Performance Optimization Indexes & RPC

-- 1. Composite Index for Orders Filtering by Cafe and Date Range
CREATE INDEX IF NOT EXISTS idx_orders_cafe_created_at 
ON public.orders (cafe_id, created_at DESC);

-- 2. Foreign Key Index for Relational Joins on Order Items
CREATE INDEX IF NOT EXISTS idx_order_items_order_id 
ON public.order_items (order_id);

-- 3. Optional Database RPC Function for Pre-Aggregated Owner Analytics Summary
CREATE OR REPLACE FUNCTION public.get_owner_analytics_summary(
  p_cafe_id UUID,
  p_range_days INT DEFAULT 7
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_since TIMESTAMPTZ;
  v_today_start TIMESTAMPTZ;
  v_result JSONB;
BEGIN
  v_since := date_trunc('day', NOW() - (p_range_days || ' days')::INTERVAL);
  v_today_start := date_trunc('day', NOW());

  SELECT jsonb_build_object(
    'rangeRevenueMetrics', jsonb_build_object(
      'grossSalesCents', COALESCE(SUM(total_cents) FILTER (WHERE status != 'cancelled'), 0),
      'discountsCents', 0,
      'taxCents', 0,
      'netSalesCents', COALESCE(SUM(total_cents) FILTER (WHERE status != 'cancelled'), 0),
      'orderCount', COUNT(*) FILTER (WHERE status != 'cancelled'),
      'averageOrderValueCents', CASE 
        WHEN COUNT(*) FILTER (WHERE status != 'cancelled') > 0 
        THEN ROUND(COALESCE(SUM(total_cents) FILTER (WHERE status != 'cancelled'), 0)::NUMERIC / COUNT(*) FILTER (WHERE status != 'cancelled'))
        ELSE 0 
      END
    ),
    'pendingOrdersCount', COUNT(*) FILTER (WHERE status IN ('placed', 'in_kitchen')),
    'readyOrdersCount', COUNT(*) FILTER (WHERE status = 'ready')
  ) INTO v_result
  FROM public.orders
  WHERE cafe_id = p_cafe_id AND created_at >= v_since;

  RETURN v_result;
END;
$$;
