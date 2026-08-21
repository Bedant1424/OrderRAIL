-- ============================================================================
-- Migration: 20260821220000_daily_sales_transactions_rpc.sql
-- Description: Add authoritative transaction-level daily sales RPC for Counter POS
-- Milestone: 2C.2
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_daily_sales_transactions(
    p_cafe_id UUID,
    p_business_date DATE DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_target_date DATE;
    v_transactions JSONB;
BEGIN
    -- 1. Strict Security & Authorization Check
    IF NOT (
        public.has_role(auth.uid(), 'owner', p_cafe_id) OR
        public.has_role(auth.uid(), 'counter', p_cafe_id) OR
        public.has_role(auth.uid(), 'staff', p_cafe_id) OR
        public.is_demo_admin(auth.uid()) OR
        auth.role() = 'service_role'
    ) THEN
        RAISE EXCEPTION 'UNAUTHORIZED: Insufficient permissions to access daily transactions.';
    END IF;

    -- 2. Determine authoritative business date if omitted
    IF p_business_date IS NULL THEN
        v_target_date := public.get_cafe_business_date(p_cafe_id, now());
    ELSE
        v_target_date := p_business_date;
    END IF;

    -- 3. Query finalized PAID bills for the authoritative business date
    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'bill_id', b.id,
                'bill_number', b.bill_number,
                'table_label', COALESCE(t.label, b.table_id, 'Quick Serve'),
                'order_source', COALESCE(b.order_source::text, 'DINE_IN'),
                'customer_name', b.customer_name,
                'customer_phone', b.customer_phone,
                'cashier_id', COALESCE(b.cashier_id, 'Counter'),
                'payment_method', COALESCE(b.payment_method, 'CASH'),
                'subtotal', b.subtotal::NUMERIC(10,2),
                'discount', b.discount::NUMERIC(10,2),
                'cgst', b.cgst::NUMERIC(10,2),
                'sgst', b.sgst::NUMERIC(10,2),
                'service_charge', b.service_charge::NUMERIC(10,2),
                'round_off', b.round_off::NUMERIC(10,2),
                'grand_total', b.grand_total::NUMERIC(10,2),
                'total_items', b.total_items,
                'paid_at', b.paid_at,
                'business_date', b.business_date,
                'items', COALESCE(items_subquery.items, '[]'::jsonb)
            )
            ORDER BY b.paid_at DESC, b.bill_number DESC
        ),
        '[]'::jsonb
    ) INTO v_transactions
    FROM public.bills b
    LEFT JOIN public.tables t ON (t.id::text = b.table_id)
    LEFT JOIN LATERAL (
        SELECT jsonb_agg(
            jsonb_build_object(
                'item_name', bi.item_name,
                'quantity', bi.quantity,
                'line_total', bi.line_total::NUMERIC(10,2)
            )
            ORDER BY bi.id ASC
        ) AS items
        FROM public.bill_items bi
        WHERE bi.bill_id = b.id
    ) items_subquery ON TRUE
    WHERE b.cafe_id = p_cafe_id::TEXT
      AND b.business_date = v_target_date
      AND b.payment_status = 'PAID';

    RETURN jsonb_build_object(
        'business_date', v_target_date,
        'cafe_id', p_cafe_id,
        'transactions', v_transactions
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

-- Grant execution permissions
GRANT EXECUTE ON FUNCTION public.get_daily_sales_transactions(UUID, DATE) TO authenticated, service_role, anon;
