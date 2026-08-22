-- ============================================================================
-- Migration: 20260822130000_daily_sales_hourly_aggregation.sql
-- Description: Authoritative Hourly Sales Aggregation in Daily Sales Report
--
-- Updates public.get_daily_sales_report(p_cafe_id, p_business_date) to embed
-- a dense 24-element hourly breakdown (0..23) with authoritative revenue,
-- paid bills, items sold, and tender allocations (Cash, UPI, Card, Other).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_daily_sales_report(
    p_cafe_id UUID,
    p_business_date DATE DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_target_date DATE;
    v_report RECORD;
    v_tenders_from_payments RECORD;
    v_tenders_legacy RECORD;
    v_pipeline RECORD;
    v_hourly_data JSONB;
BEGIN
    -- 1. Authorization check
    IF NOT (
        public.has_role(auth.uid(), 'owner', p_cafe_id) OR
        public.has_role(auth.uid(), 'counter', p_cafe_id) OR
        public.has_role(auth.uid(), 'staff', p_cafe_id) OR
        public.is_demo_admin(auth.uid()) OR
        auth.role() = 'service_role'
    ) THEN
        RAISE EXCEPTION '403 Forbidden: Insufficient permissions to view daily sales for cafe %', p_cafe_id;
    END IF;

    -- 2. Determine target business date
    IF p_business_date IS NULL THEN
        v_target_date := public.get_cafe_business_date(p_cafe_id, now());
    ELSE
        v_target_date := p_business_date;
    END IF;

    -- 3. Aggregate realized paid sales for the target business date
    SELECT
        COALESCE(COUNT(*), 0) AS paid_bills_count,
        COALESCE(SUM(grand_total), 0.00) AS net_collected,
        COALESCE(SUM(subtotal), 0.00) AS gross_subtotal,
        COALESCE(SUM(discount), 0.00) AS total_discounts,
        COALESCE(SUM(service_charge), 0.00) AS total_service_charge,
        COALESCE(SUM(cgst), 0.00) AS total_cgst,
        COALESCE(SUM(sgst), 0.00) AS total_sgst,
        COALESCE(SUM(cgst + sgst), 0.00) AS total_tax,
        COALESCE(SUM(round_off), 0.00) AS total_round_off,
        COALESCE(SUM(total_items), 0) AS total_items_sold
    INTO v_report
    FROM public.bills
    WHERE cafe_id = p_cafe_id::TEXT
      AND business_date = v_target_date
      AND payment_status = 'PAID';

    -- 4. Aggregate Authoritative Whole-Day Tender Breakdown
    -- 4a. From public.bill_payments for structured bills
    SELECT
        COALESCE(SUM(bp.amount) FILTER (WHERE UPPER(bp.payment_method) = 'CASH'), 0.00) AS cash_collected,
        COALESCE(SUM(bp.amount) FILTER (WHERE UPPER(bp.payment_method) = 'UPI'), 0.00) AS upi_collected,
        COALESCE(SUM(bp.amount) FILTER (WHERE UPPER(bp.payment_method) = 'CARD'), 0.00) AS card_collected,
        COALESCE(SUM(bp.amount) FILTER (WHERE UPPER(bp.payment_method) NOT IN ('CASH', 'UPI', 'CARD')), 0.00) AS other_collected
    INTO v_tenders_from_payments
    FROM public.bill_payments bp
    JOIN public.bills b ON b.id = bp.bill_id
    WHERE b.cafe_id = p_cafe_id::TEXT
      AND b.business_date = v_target_date
      AND b.payment_status = 'PAID';

    -- 4b. Fallback to public.bills for legacy bills without bill_payments rows (Zero double-counting)
    SELECT
        COALESCE(SUM(b.grand_total) FILTER (WHERE UPPER(b.payment_method) = 'CASH'), 0.00) AS cash_collected,
        COALESCE(SUM(b.grand_total) FILTER (WHERE UPPER(b.payment_method) = 'UPI'), 0.00) AS upi_collected,
        COALESCE(SUM(b.grand_total) FILTER (WHERE UPPER(b.payment_method) = 'CARD'), 0.00) AS card_collected,
        COALESCE(SUM(b.grand_total) FILTER (WHERE UPPER(b.payment_method) NOT IN ('CASH', 'UPI', 'CARD')), 0.00) AS other_collected
    INTO v_tenders_legacy
    FROM public.bills b
    WHERE b.cafe_id = p_cafe_id::TEXT
      AND b.business_date = v_target_date
      AND b.payment_status = 'PAID'
      AND NOT EXISTS (
          SELECT 1 FROM public.bill_payments bp WHERE bp.bill_id = b.id
      );

    -- 5. Aggregate Authoritative Dense 24-Bucket Hourly Breakdown (Asia/Kolkata timezone)
    WITH hours_series AS (
        SELECT 
            s.h AS hour_num,
            CASE 
                WHEN s.h = 0 THEN '12 AM'
                WHEN s.h < 12 THEN s.h || ' AM'
                WHEN s.h = 12 THEN '12 PM'
                ELSE (s.h - 12) || ' PM'
            END AS hour_label
        FROM generate_series(0, 23) AS s(h)
    ),
    bill_hourly_base AS (
        SELECT
            b.id AS bill_id,
            b.grand_total,
            b.total_items,
            b.payment_method,
            EXTRACT(HOUR FROM (b.paid_at AT TIME ZONE 'Asia/Kolkata'))::INTEGER AS hour_num
        FROM public.bills b
        WHERE b.cafe_id = p_cafe_id::TEXT
          AND b.business_date = v_target_date
          AND b.payment_status = 'PAID'
    ),
    bills_aggregated AS (
        SELECT
            hour_num,
            COALESCE(SUM(grand_total), 0.00) AS revenue,
            COALESCE(COUNT(*), 0) AS paid_bills,
            COALESCE(SUM(total_items), 0) AS items_sold
        FROM bill_hourly_base
        GROUP BY hour_num
    ),
    payments_hourly AS (
        SELECT
            EXTRACT(HOUR FROM (b.paid_at AT TIME ZONE 'Asia/Kolkata'))::INTEGER AS hour_num,
            COALESCE(SUM(bp.amount) FILTER (WHERE UPPER(bp.payment_method) = 'CASH'), 0.00) AS cash,
            COALESCE(SUM(bp.amount) FILTER (WHERE UPPER(bp.payment_method) = 'UPI'), 0.00) AS upi,
            COALESCE(SUM(bp.amount) FILTER (WHERE UPPER(bp.payment_method) = 'CARD'), 0.00) AS card,
            COALESCE(SUM(bp.amount) FILTER (WHERE UPPER(bp.payment_method) NOT IN ('CASH', 'UPI', 'CARD')), 0.00) AS other
        FROM public.bill_payments bp
        JOIN public.bills b ON b.id = bp.bill_id
        WHERE b.cafe_id = p_cafe_id::TEXT
          AND b.business_date = v_target_date
          AND b.payment_status = 'PAID'
        GROUP BY hour_num
    ),
    legacy_hourly AS (
        SELECT
            EXTRACT(HOUR FROM (b.paid_at AT TIME ZONE 'Asia/Kolkata'))::INTEGER AS hour_num,
            COALESCE(SUM(b.grand_total) FILTER (WHERE UPPER(b.payment_method) = 'CASH'), 0.00) AS cash,
            COALESCE(SUM(b.grand_total) FILTER (WHERE UPPER(b.payment_method) = 'UPI'), 0.00) AS upi,
            COALESCE(SUM(b.grand_total) FILTER (WHERE UPPER(b.payment_method) = 'CARD'), 0.00) AS card,
            COALESCE(SUM(b.grand_total) FILTER (WHERE UPPER(b.payment_method) NOT IN ('CASH', 'UPI', 'CARD')), 0.00) AS other
        FROM public.bills b
        WHERE b.cafe_id = p_cafe_id::TEXT
          AND b.business_date = v_target_date
          AND b.payment_status = 'PAID'
          AND NOT EXISTS (
              SELECT 1 FROM public.bill_payments bp WHERE bp.bill_id = b.id
          )
        GROUP BY hour_num
    )
    SELECT jsonb_agg(
        jsonb_build_object(
            'hour', hs.hour_num,
            'label', hs.hour_label,
            'revenue', COALESCE(ba.revenue, 0.00),
            'paid_bills', COALESCE(ba.paid_bills, 0),
            'items_sold', COALESCE(ba.items_sold, 0),
            'cash', COALESCE(ph.cash, 0.00) + COALESCE(lh.cash, 0.00),
            'upi', COALESCE(ph.upi, 0.00) + COALESCE(lh.upi, 0.00),
            'card', COALESCE(ph.card, 0.00) + COALESCE(lh.card, 0.00),
            'other', COALESCE(ph.other, 0.00) + COALESCE(lh.other, 0.00)
        ) ORDER BY hs.hour_num ASC
    ) INTO v_hourly_data
    FROM hours_series hs
    LEFT JOIN bills_aggregated ba ON ba.hour_num = hs.hour_num
    LEFT JOIN payments_hourly ph ON ph.hour_num = hs.hour_num
    LEFT JOIN legacy_hourly lh ON lh.hour_num = hs.hour_num;

    -- 6. Aggregate active unsettled order pipeline and cancellations for the business date
    SELECT
        COALESCE(COUNT(*) FILTER (WHERE status NOT IN ('cancelled', 'served')), 0) AS unsettled_orders_count,
        COALESCE(SUM(total_cents) FILTER (WHERE status NOT IN ('cancelled', 'served')), 0) AS unsettled_pipeline_cents,
        COALESCE(COUNT(*) FILTER (WHERE status = 'cancelled'), 0) AS cancelled_orders_count
    INTO v_pipeline
    FROM public.orders
    WHERE cafe_id = p_cafe_id
      AND business_date = v_target_date;

    -- 7. Construct and return authoritative financial summary with dense 24-bucket hourly array
    RETURN jsonb_build_object(
        'business_date', v_target_date,
        'cafe_id', p_cafe_id,
        'net_collected', v_report.net_collected,
        'paid_bills_count', v_report.paid_bills_count,
        'gross_subtotal', v_report.gross_subtotal,
        'total_discounts', v_report.total_discounts,
        'total_tax', v_report.total_tax,
        'cgst', v_report.total_cgst,
        'sgst', v_report.total_sgst,
        'total_service_charge', v_report.total_service_charge,
        'total_round_off', v_report.total_round_off,
        'total_items_sold', v_report.total_items_sold,
        'average_bill_value', CASE 
            WHEN v_report.paid_bills_count > 0 
            THEN ROUND((v_report.net_collected / v_report.paid_bills_count)::NUMERIC, 2)
            ELSE 0.00 
        END,
        'tenders', jsonb_build_object(
            'cash', v_tenders_from_payments.cash_collected + v_tenders_legacy.cash_collected,
            'upi', v_tenders_from_payments.upi_collected + v_tenders_legacy.upi_collected,
            'card', v_tenders_from_payments.card_collected + v_tenders_legacy.card_collected,
            'other', v_tenders_from_payments.other_collected + v_tenders_legacy.other_collected
        ),
        'hourly', COALESCE(v_hourly_data, '[]'::jsonb),
        'pipeline', jsonb_build_object(
            'unsettled_orders_count', v_pipeline.unsettled_orders_count,
            'unsettled_pipeline_cents', v_pipeline.unsettled_pipeline_cents,
            'cancelled_orders_count', v_pipeline.cancelled_orders_count
        )
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_daily_sales_report(UUID, DATE) TO authenticated, service_role, anon;
