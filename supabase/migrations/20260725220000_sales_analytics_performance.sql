-- Migration: 20260725220000_sales_analytics_performance.sql
-- Description: Performance indices and SQL aggregation functions for OrderRail Analytics & Reporting Engine

-- 1. Performance Indices
CREATE INDEX IF NOT EXISTS idx_bills_cafe_date_status 
ON bills(cafe_id, created_at, payment_status);

CREATE INDEX IF NOT EXISTS idx_bills_cafe_payment_method 
ON bills(cafe_id, payment_method);

CREATE INDEX IF NOT EXISTS idx_bill_items_bill_id 
ON bill_items(bill_id);

CREATE INDEX IF NOT EXISTS idx_bill_items_name 
ON bill_items(item_name);

-- 2. SQL RPC: Executive Sales Overview & Financial Summary
CREATE OR REPLACE FUNCTION get_sales_overview_rpc(
  p_cafe_id TEXT,
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ
)
RETURNS TABLE (
  gross_sales NUMERIC,
  net_sales NUMERIC,
  total_discounts NUMERIC,
  total_service_charges NUMERIC,
  total_cgst NUMERIC,
  total_sgst NUMERIC,
  total_round_off NUMERIC,
  total_bills BIGINT,
  paid_bills BIGINT,
  pending_bills BIGINT,
  cancelled_bills BIGINT,
  refunded_bills BIGINT,
  total_items_sold BIGINT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(b.subtotal), 0) AS gross_sales,
    COALESCE(SUM(CASE WHEN b.payment_status = 'PAID' THEN b.grand_total ELSE 0 END), 0) AS net_sales,
    COALESCE(SUM(b.discount), 0) AS total_discounts,
    COALESCE(SUM(b.service_charge), 0) AS total_service_charges,
    COALESCE(SUM(b.cgst), 0) AS total_cgst,
    COALESCE(SUM(b.sgst), 0) AS total_sgst,
    COALESCE(SUM(b.round_off), 0) AS total_round_off,
    COUNT(*)::BIGINT AS total_bills,
    COUNT(CASE WHEN b.payment_status = 'PAID' THEN 1 END)::BIGINT AS paid_bills,
    COUNT(CASE WHEN b.payment_status = 'PENDING' THEN 1 END)::BIGINT AS pending_bills,
    COUNT(CASE WHEN b.payment_status = 'CANCELLED' THEN 1 END)::BIGINT AS cancelled_bills,
    COUNT(CASE WHEN b.payment_status = 'REFUNDED' THEN 1 END)::BIGINT AS refunded_bills,
    COALESCE(SUM(b.total_items), 0)::BIGINT AS total_items_sold
  FROM bills b
  WHERE b.cafe_id = p_cafe_id
    AND b.created_at >= p_start_date
    AND b.created_at <= p_end_date;
END;
$$;

-- 3. SQL RPC: Menu Item Sales Performance Aggregation
CREATE OR REPLACE FUNCTION get_menu_performance_rpc(
  p_cafe_id TEXT,
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ,
  p_limit INT DEFAULT 20
)
RETURNS TABLE (
  item_name TEXT,
  total_qty BIGINT,
  total_revenue NUMERIC,
  avg_unit_price NUMERIC
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    bi.item_name,
    SUM(bi.quantity)::BIGINT AS total_qty,
    SUM(bi.line_total) AS total_revenue,
    AVG(bi.unit_price) AS avg_unit_price
  FROM bill_items bi
  JOIN bills b ON bi.bill_id = b.id
  WHERE b.cafe_id = p_cafe_id
    AND b.payment_status = 'PAID'
    AND b.created_at >= p_start_date
    AND b.created_at <= p_end_date
  GROUP BY bi.item_name
  ORDER BY total_revenue DESC
  LIMIT p_limit;
END;
$$;
