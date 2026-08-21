-- ============================================================================
-- Migration: 20260822000000_owner_analytics_range_rpc.sql
-- Description: Add Authoritative Owner Analytics Multi-Day Range RPC
-- Milestone: 2C.3
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_owner_analytics_range(
    p_cafe_id UUID,
    p_range_days INT DEFAULT 7,
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_current_date DATE;
    v_start_date DATE;
    v_end_date DATE;
    v_range_fin RECORD;
    v_today_fin RECORD;
    v_tenders RECORD;
    v_operational RECORD;
    v_by_day JSONB;
    v_top_items JSONB;
    v_max_item_qty INT;
BEGIN
    -- 1. Security & RBAC Enforcement (Owner, Demo Admin, or Service Role)
    IF NOT (
        public.has_role(auth.uid(), 'owner', p_cafe_id) OR
        public.is_demo_admin(auth.uid()) OR
        auth.role() = 'service_role'
    ) THEN
        RAISE EXCEPTION 'UNAUTHORIZED: Insufficient permissions to access owner analytics for cafe %', p_cafe_id;
    END IF;

    -- 2. Resolve Authoritative Business Dates
    v_current_date := public.get_cafe_business_date(p_cafe_id, now());

    IF p_end_date IS NOT NULL THEN
        v_end_date := p_end_date;
    ELSE
        v_end_date := v_current_date;
    END IF;

    IF p_start_date IS NOT NULL THEN
        v_start_date := p_start_date;
    ELSE
        v_start_date := v_end_date - (COALESCE(p_range_days, 7) - 1);
    END IF;

    IF v_start_date > v_end_date THEN
        v_start_date := v_end_date;
    END IF;

    -- 3. Aggregate Range Financials from Finalized PAID Bills
    SELECT
        COALESCE(SUM(b.subtotal), 0.00) AS gross_subtotal,
        COALESCE(SUM(b.discount), 0.00) AS total_discounts,
        COALESCE(SUM(b.cgst), 0.00) AS total_cgst,
        COALESCE(SUM(b.sgst), 0.00) AS total_sgst,
        COALESCE(SUM(b.cgst + b.sgst), 0.00) AS total_tax,
        COALESCE(SUM(b.service_charge), 0.00) AS total_service_charge,
        COALESCE(SUM(b.round_off), 0.00) AS total_round_off,
        COALESCE(SUM(b.grand_total), 0.00) AS net_collected,
        COALESCE(COUNT(*), 0) AS paid_bills_count,
        COALESCE(SUM(b.total_items), 0) AS total_items_sold
    INTO v_range_fin
    FROM public.bills b
    WHERE b.cafe_id = p_cafe_id::TEXT
      AND b.business_date >= v_start_date
      AND b.business_date <= v_end_date
      AND b.payment_status = 'PAID';

    -- 4. Aggregate Current/Today Financials from Finalized PAID Bills
    SELECT
        COALESCE(SUM(b.subtotal), 0.00) AS gross_subtotal,
        COALESCE(SUM(b.discount), 0.00) AS total_discounts,
        COALESCE(SUM(b.cgst), 0.00) AS total_cgst,
        COALESCE(SUM(b.sgst), 0.00) AS total_sgst,
        COALESCE(SUM(b.cgst + b.sgst), 0.00) AS total_tax,
        COALESCE(SUM(b.service_charge), 0.00) AS total_service_charge,
        COALESCE(SUM(b.round_off), 0.00) AS total_round_off,
        COALESCE(SUM(b.grand_total), 0.00) AS net_collected,
        COALESCE(COUNT(*), 0) AS paid_bills_count,
        COALESCE(SUM(b.total_items), 0) AS total_items_sold
    INTO v_today_fin
    FROM public.bills b
    WHERE b.cafe_id = p_cafe_id::TEXT
      AND b.business_date = v_current_date
      AND b.payment_status = 'PAID';

    -- 5. Aggregate Range Tender Breakdown from Finalized PAID Bills
    SELECT
        COALESCE(SUM(b.grand_total) FILTER (WHERE UPPER(b.payment_method) = 'CASH'), 0.00) AS cash,
        COALESCE(SUM(b.grand_total) FILTER (WHERE UPPER(b.payment_method) = 'UPI'), 0.00) AS upi,
        COALESCE(SUM(b.grand_total) FILTER (WHERE UPPER(b.payment_method) = 'CARD'), 0.00) AS card,
        COALESCE(SUM(b.grand_total) FILTER (WHERE UPPER(b.payment_method) NOT IN ('CASH', 'UPI', 'CARD')), 0.00) AS other
    INTO v_tenders
    FROM public.bills b
    WHERE b.cafe_id = p_cafe_id::TEXT
      AND b.business_date >= v_start_date
      AND b.business_date <= v_end_date
      AND b.payment_status = 'PAID';

    -- 6. Generate Continuous Daily Time Series (by_day)
    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'business_date', d.dt::DATE,
                'day', to_char(d.dt, 'Mon DD'),
                'revenue', COALESCE(agg.daily_net, 0.00)::NUMERIC(10,2),
                'gross_subtotal', COALESCE(agg.daily_gross, 0.00)::NUMERIC(10,2),
                'paid_bills', COALESCE(agg.daily_bills, 0),
                'items_sold', COALESCE(agg.daily_items, 0)
            )
            ORDER BY d.dt ASC
        ),
        '[]'::jsonb
    ) INTO v_by_day
    FROM generate_series(v_start_date::timestamp, v_end_date::timestamp, '1 day'::interval) d(dt)
    LEFT JOIN (
        SELECT
            b.business_date,
            SUM(b.grand_total) AS daily_net,
            SUM(b.subtotal) AS daily_gross,
            COUNT(*) AS daily_bills,
            SUM(b.total_items) AS daily_items
        FROM public.bills b
        WHERE b.cafe_id = p_cafe_id::TEXT
          AND b.business_date >= v_start_date
          AND b.business_date <= v_end_date
          AND b.payment_status = 'PAID'
        GROUP BY b.business_date
    ) agg ON agg.business_date = d.dt::DATE;

    -- 7. Aggregate Top Selling Items from Finalized PAID Bill Items
    SELECT COALESCE(MAX(item_sub.total_qty), 1)
    INTO v_max_item_qty
    FROM (
        SELECT SUM(bi.quantity) AS total_qty
        FROM public.bill_items bi
        JOIN public.bills b ON b.id = bi.bill_id
        WHERE b.cafe_id = p_cafe_id::TEXT
          AND b.business_date >= v_start_date
          AND b.business_date <= v_end_date
          AND b.payment_status = 'PAID'
        GROUP BY bi.item_name
        ORDER BY total_qty DESC
        LIMIT 6
    ) item_sub;

    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'name', item_summary.item_name,
                'qty', item_summary.total_qty,
                'revenue', item_summary.total_revenue::NUMERIC(10,2),
                'percentage', CASE
                    WHEN v_max_item_qty > 0 THEN ROUND((item_summary.total_qty::NUMERIC / v_max_item_qty::NUMERIC) * 100)
                    ELSE 0
                END
            )
            ORDER BY item_summary.total_qty DESC, item_summary.total_revenue DESC
        ),
        '[]'::jsonb
    ) INTO v_top_items
    FROM (
        SELECT
            bi.item_name,
            SUM(bi.quantity) AS total_qty,
            SUM(bi.line_total) AS total_revenue
        FROM public.bill_items bi
        JOIN public.bills b ON b.id = bi.bill_id
        WHERE b.cafe_id = p_cafe_id::TEXT
          AND b.business_date >= v_start_date
          AND b.business_date <= v_end_date
          AND b.payment_status = 'PAID'
        GROUP BY bi.item_name
        ORDER BY total_qty DESC, total_revenue DESC
        LIMIT 6
    ) item_summary;

    -- 8. Aggregate Operational Pipeline & Order Counts (Non-financial)
    SELECT
        COALESCE(COUNT(*), 0) AS total_orders_placed,
        COALESCE(COUNT(*) FILTER (WHERE status = 'cancelled'), 0) AS cancelled_orders_count,
        COALESCE(COUNT(*) FILTER (WHERE status NOT IN ('cancelled', 'served')), 0) AS unsettled_orders_count,
        COALESCE(SUM(total_cents) FILTER (WHERE status NOT IN ('cancelled', 'served')), 0) AS unsettled_pipeline_cents
    INTO v_operational
    FROM public.orders
    WHERE cafe_id = p_cafe_id
      AND business_date >= v_start_date
      AND business_date <= v_end_date;

    -- 9. Construct Final Authoritative Payload
    RETURN jsonb_build_object(
        'cafe_id', p_cafe_id,
        'current_business_date', v_current_date,
        'start_business_date', v_start_date,
        'end_business_date', v_end_date,
        'range_days', (v_end_date - v_start_date + 1),
        'range_financials', jsonb_build_object(
            'gross_subtotal', v_range_fin.gross_subtotal::NUMERIC(10,2),
            'total_discounts', v_range_fin.total_discounts::NUMERIC(10,2),
            'total_tax', v_range_fin.total_tax::NUMERIC(10,2),
            'cgst', v_range_fin.total_cgst::NUMERIC(10,2),
            'sgst', v_range_fin.total_sgst::NUMERIC(10,2),
            'total_service_charge', v_range_fin.total_service_charge::NUMERIC(10,2),
            'total_round_off', v_range_fin.total_round_off::NUMERIC(10,2),
            'net_collected', v_range_fin.net_collected::NUMERIC(10,2),
            'paid_bills_count', v_range_fin.paid_bills_count,
            'total_items_sold', v_range_fin.total_items_sold,
            'average_bill_value', CASE 
                WHEN v_range_fin.paid_bills_count > 0 
                THEN ROUND(v_range_fin.net_collected / v_range_fin.paid_bills_count, 2)::NUMERIC(10,2)
                ELSE 0.00 
            END
        ),
        'today_financials', jsonb_build_object(
            'gross_subtotal', v_today_fin.gross_subtotal::NUMERIC(10,2),
            'total_discounts', v_today_fin.total_discounts::NUMERIC(10,2),
            'total_tax', v_today_fin.total_tax::NUMERIC(10,2),
            'cgst', v_today_fin.total_cgst::NUMERIC(10,2),
            'sgst', v_today_fin.total_sgst::NUMERIC(10,2),
            'total_service_charge', v_today_fin.total_service_charge::NUMERIC(10,2),
            'total_round_off', v_today_fin.total_round_off::NUMERIC(10,2),
            'net_collected', v_today_fin.net_collected::NUMERIC(10,2),
            'paid_bills_count', v_today_fin.paid_bills_count,
            'total_items_sold', v_today_fin.total_items_sold,
            'average_bill_value', CASE 
                WHEN v_today_fin.paid_bills_count > 0 
                THEN ROUND(v_today_fin.net_collected / v_today_fin.paid_bills_count, 2)::NUMERIC(10,2)
                ELSE 0.00 
            END
        ),
        'tenders', jsonb_build_object(
            'cash', v_tenders.cash::NUMERIC(10,2),
            'upi', v_tenders.upi::NUMERIC(10,2),
            'card', v_tenders.card::NUMERIC(10,2),
            'other', v_tenders.other::NUMERIC(10,2)
        ),
        'by_day', v_by_day,
        'top_items', v_top_items,
        'operational_summary', jsonb_build_object(
            'total_orders_placed', v_operational.total_orders_placed,
            'cancelled_orders_count', v_operational.cancelled_orders_count,
            'unsettled_orders_count', v_operational.unsettled_orders_count,
            'unsettled_pipeline_cents', v_operational.unsettled_pipeline_cents
        )
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

-- Execution permissions
GRANT EXECUTE ON FUNCTION public.get_owner_analytics_range(UUID, INT, DATE, DATE) TO authenticated, service_role;
