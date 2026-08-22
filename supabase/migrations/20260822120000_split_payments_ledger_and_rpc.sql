-- ============================================================================
-- Migration: 20260822120000_split_payments_ledger_and_rpc.sql
-- Description: Authoritative Split & Mixed Payments Ledger and Settlement RPC
--
-- 1. Create public.bill_payments ledger table
-- 2. Configure indexes, RLS, and Realtime publication on public.bill_payments
-- 3. Create public.settle_bill_with_tenders_atomic RPC
-- 4. Update public.get_daily_sales_report to aggregate authoritative tenders
-- 5. Update public.get_owner_analytics_range to aggregate authoritative tenders
-- 6. Update public.get_daily_sales_transactions to return itemized tenders array
-- ============================================================================

-- 1. Create public.bill_payments ledger table
CREATE TABLE IF NOT EXISTS public.bill_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bill_id UUID NOT NULL REFERENCES public.bills(id) ON DELETE CASCADE,
    cafe_id UUID NOT NULL REFERENCES public.cafes(id) ON DELETE CASCADE,
    payment_method TEXT NOT NULL CHECK (payment_method IN ('CASH', 'UPI', 'CARD', 'OTHER')),
    amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
    tendered_amount NUMERIC(10,2),
    change_due NUMERIC(10,2) DEFAULT 0.00,
    transaction_ref TEXT,
    created_by_user_id UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Indexes
CREATE INDEX IF NOT EXISTS idx_bill_payments_bill_id 
ON public.bill_payments (bill_id);

CREATE INDEX IF NOT EXISTS idx_bill_payments_cafe_id 
ON public.bill_payments (cafe_id);

CREATE INDEX IF NOT EXISTS idx_bill_payments_cafe_created 
ON public.bill_payments (cafe_id, created_at);

-- 3. RLS on public.bill_payments
ALTER TABLE public.bill_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bill_payments_select_policy" ON public.bill_payments;
CREATE POLICY "bill_payments_select_policy" ON public.bill_payments
FOR SELECT USING (
    public.has_role(auth.uid(), 'owner', cafe_id) OR
    public.has_role(auth.uid(), 'counter', cafe_id) OR
    public.has_role(auth.uid(), 'staff', cafe_id) OR
    public.is_demo_admin(auth.uid()) OR
    auth.role() = 'service_role'
);

DROP POLICY IF EXISTS "bill_payments_insert_policy" ON public.bill_payments;
CREATE POLICY "bill_payments_insert_policy" ON public.bill_payments
FOR INSERT WITH CHECK (
    public.has_role(auth.uid(), 'owner', cafe_id) OR
    public.has_role(auth.uid(), 'counter', cafe_id) OR
    public.has_role(auth.uid(), 'staff', cafe_id) OR
    public.is_demo_admin(auth.uid()) OR
    auth.role() = 'service_role'
);

GRANT ALL ON public.bill_payments TO authenticated, service_role;

-- 4. Add to Realtime Publication
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'bill_payments'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.bill_payments;
    END IF;
END $$;

-- 5. Atomic Settlement RPC: public.settle_bill_with_tenders_atomic
CREATE OR REPLACE FUNCTION public.settle_bill_with_tenders_atomic(
    p_bill_id UUID,
    p_tenders JSONB,
    p_settled_by UUID DEFAULT NULL,
    p_paid_at TIMESTAMPTZ DEFAULT now()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_bill RECORD;
    v_cafe_id UUID;
    v_target_paid_at TIMESTAMPTZ;
    v_tender_sum NUMERIC(10,2) := 0.00;
    v_elem JSONB;
    v_method TEXT;
    v_amount NUMERIC(10,2);
    v_distinct_methods_count INT;
    v_single_method TEXT;
    v_final_method TEXT;
BEGIN
    -- 1. Row Lock on target bill
    SELECT * INTO v_bill
    FROM public.bills
    WHERE id = p_bill_id
    FOR UPDATE;

    IF v_bill.id IS NULL THEN
        RETURN jsonb_build_object(
            'status', 'NOT_FOUND',
            'message', 'Bill not found.'
        );
    END IF;

    -- Resolve cafe UUID
    IF v_bill.cafe_id IS NOT NULL AND v_bill.cafe_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
        v_cafe_id := v_bill.cafe_id::UUID;
    ELSE
        RAISE EXCEPTION 'INVALID CAFE ID: Bill contains invalid cafe_id %', v_bill.cafe_id;
    END IF;

    -- 2. Authorization Check
    IF NOT (
        public.has_role(auth.uid(), 'owner', v_cafe_id) OR
        public.has_role(auth.uid(), 'counter', v_cafe_id) OR
        public.has_role(auth.uid(), 'staff', v_cafe_id) OR
        public.is_demo_admin(auth.uid()) OR
        auth.role() = 'service_role'
    ) THEN
        RAISE EXCEPTION '403 Forbidden: Insufficient permissions to settle bill %', p_bill_id;
    END IF;

    -- 3. Idempotency Check: If already PAID, preserve state and return
    IF v_bill.payment_status = 'PAID' THEN
        RETURN jsonb_build_object(
            'status', 'ALREADY_PAID',
            'bill_id', p_bill_id,
            'payment_method', v_bill.payment_method,
            'paid_at', v_bill.paid_at,
            'grand_total', v_bill.grand_total
        );
    END IF;

    -- 4. Validate Tenders Array
    IF p_tenders IS NULL OR jsonb_typeof(p_tenders) != 'array' OR jsonb_array_length(p_tenders) = 0 THEN
        RAISE EXCEPTION 'VALIDATION ERROR: Tenders array must be a non-empty array.';
    END IF;

    -- 5. Validate Every Tender Element & Calculate Sum
    FOR v_elem IN SELECT * FROM jsonb_array_elements(p_tenders)
    LOOP
        v_method := UPPER(COALESCE(v_elem->>'method', ''));
        IF v_method NOT IN ('CASH', 'UPI', 'CARD', 'OTHER') THEN
            RAISE EXCEPTION 'VALIDATION ERROR: Invalid payment tender method %', v_method;
        END IF;

        IF (v_elem->>'amount') IS NULL THEN
            RAISE EXCEPTION 'VALIDATION ERROR: Tender amount is missing.';
        END IF;

        v_amount := (v_elem->>'amount')::NUMERIC(10,2);
        IF v_amount <= 0.00 THEN
            RAISE EXCEPTION 'VALIDATION ERROR: Tender amount must be greater than zero. Received: %', v_amount;
        END IF;

        v_tender_sum := v_tender_sum + v_amount;
    END LOOP;

    -- 6. Strict Exact Numeric Check: SUM(tenders.amount) == bills.grand_total
    IF v_tender_sum <> v_bill.grand_total::NUMERIC(10,2) THEN
        RAISE EXCEPTION 'TENDER_SUM_MISMATCH: Sum of tenders (%) does not equal bill grand total (%).', v_tender_sum, v_bill.grand_total;
    END IF;

    v_target_paid_at := COALESCE(p_paid_at, now());

    -- 7. Insert Rows into public.bill_payments
    INSERT INTO public.bill_payments (
        bill_id,
        cafe_id,
        payment_method,
        amount,
        tendered_amount,
        change_due,
        transaction_ref,
        created_by_user_id,
        created_at
    )
    SELECT
        p_bill_id,
        v_cafe_id,
        UPPER(elem->>'method'),
        (elem->>'amount')::NUMERIC(10,2),
        COALESCE((elem->>'tendered_amount')::NUMERIC(10,2), (elem->>'amount')::NUMERIC(10,2)),
        COALESCE((elem->>'change_due')::NUMERIC(10,2), 0.00),
        elem->>'transaction_ref',
        COALESCE(p_settled_by, auth.uid()),
        v_target_paid_at
    FROM jsonb_array_elements(p_tenders) elem;

    -- 8. Determine Final payment_method on public.bills
    SELECT COUNT(DISTINCT UPPER(elem->>'method')), MIN(UPPER(elem->>'method'))
    INTO v_distinct_methods_count, v_single_method
    FROM jsonb_array_elements(p_tenders) elem;

    IF v_distinct_methods_count > 1 THEN
        v_final_method := 'MIXED';
    ELSE
        v_final_method := v_single_method;
    END IF;

    -- 9. Update public.bills to Finalized PAID State
    UPDATE public.bills
    SET
        payment_status = 'PAID',
        payment_method = v_final_method,
        paid_at = v_target_paid_at,
        closed_at = v_target_paid_at
    WHERE id = p_bill_id;

    RETURN jsonb_build_object(
        'status', 'SUCCESS',
        'bill_id', p_bill_id,
        'payment_method', v_final_method,
        'grand_total', v_bill.grand_total,
        'paid_at', v_target_paid_at,
        'tenders_count', jsonb_array_length(p_tenders)
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.settle_bill_with_tenders_atomic(UUID, JSONB, UUID, TIMESTAMPTZ) TO authenticated, service_role;

-- 6. Update public.get_daily_sales_report to aggregate authoritative tenders
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

    -- 4. Aggregate Authoritative Tender Breakdown
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

    -- 5. Aggregate active unsettled order pipeline and cancellations for the business date
    SELECT
        COALESCE(COUNT(*) FILTER (WHERE status NOT IN ('cancelled', 'served')), 0) AS unsettled_orders_count,
        COALESCE(SUM(total_cents) FILTER (WHERE status NOT IN ('cancelled', 'served')), 0) AS unsettled_pipeline_cents,
        COALESCE(COUNT(*) FILTER (WHERE status = 'cancelled'), 0) AS cancelled_orders_count
    INTO v_pipeline
    FROM public.orders
    WHERE cafe_id = p_cafe_id
      AND business_date = v_target_date;

    -- 6. Construct and return authoritative financial summary
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
        'pipeline', jsonb_build_object(
            'unsettled_orders_count', v_pipeline.unsettled_orders_count,
            'unsettled_pipeline_cents', v_pipeline.unsettled_pipeline_cents,
            'cancelled_orders_count', v_pipeline.cancelled_orders_count
        )
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_daily_sales_report(UUID, DATE) TO authenticated, service_role, anon;

-- 7. Update public.get_owner_analytics_range to aggregate authoritative tenders
CREATE OR REPLACE FUNCTION public.get_owner_analytics_range(
    p_cafe_id UUID,
    p_range_days INT DEFAULT 7,
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_current_biz_date DATE;
    v_start_date DATE;
    v_end_date DATE;
    v_range_days INT;
    v_financials RECORD;
    v_today_financials RECORD;
    v_tenders_payments RECORD;
    v_tenders_legacy RECORD;
    v_today_tenders_payments RECORD;
    v_today_tenders_legacy RECORD;
    v_by_day JSONB;
    v_top_items JSONB;
    v_operational RECORD;
BEGIN
    -- 1. Authorization check
    IF NOT (
        public.has_role(auth.uid(), 'owner', p_cafe_id) OR
        public.is_demo_admin(auth.uid()) OR
        auth.role() = 'service_role'
    ) THEN
        RAISE EXCEPTION '403 Forbidden: Insufficient permissions to view owner analytics for cafe %', p_cafe_id;
    END IF;

    -- 2. Determine authoritative business dates
    v_current_biz_date := public.get_cafe_business_date(p_cafe_id, now());

    IF p_start_date IS NOT NULL AND p_end_date IS NOT NULL THEN
        v_start_date := p_start_date;
        v_end_date := p_end_date;
        v_range_days := (v_end_date - v_start_date) + 1;
    ELSE
        v_range_days := COALESCE(p_range_days, 7);
        v_end_date := v_current_biz_date;
        v_start_date := v_end_date - (v_range_days - 1);
    END IF;

    -- 3. Aggregate Range Financials from Finalized PAID Bills
    SELECT
        COALESCE(COUNT(*), 0) AS paid_bills_count,
        COALESCE(SUM(b.grand_total), 0.00) AS net_collected,
        COALESCE(SUM(b.subtotal), 0.00) AS gross_subtotal,
        COALESCE(SUM(b.discount), 0.00) AS total_discounts,
        COALESCE(SUM(b.service_charge), 0.00) AS total_service_charge,
        COALESCE(SUM(b.cgst), 0.00) AS cgst,
        COALESCE(SUM(b.sgst), 0.00) AS sgst,
        COALESCE(SUM(b.cgst + b.sgst), 0.00) AS total_tax,
        COALESCE(SUM(b.round_off), 0.00) AS total_round_off,
        COALESCE(SUM(b.total_items), 0) AS total_items_sold
    INTO v_financials
    FROM public.bills b
    WHERE b.cafe_id = p_cafe_id::TEXT
      AND b.business_date >= v_start_date
      AND b.business_date <= v_end_date
      AND b.payment_status = 'PAID';

    -- 4. Aggregate Current Business Date Financials (Today)
    SELECT
        COALESCE(COUNT(*), 0) AS paid_bills_count,
        COALESCE(SUM(b.grand_total), 0.00) AS net_collected,
        COALESCE(SUM(b.subtotal), 0.00) AS gross_subtotal,
        COALESCE(SUM(b.discount), 0.00) AS total_discounts,
        COALESCE(SUM(b.service_charge), 0.00) AS total_service_charge,
        COALESCE(SUM(b.cgst), 0.00) AS cgst,
        COALESCE(SUM(b.sgst), 0.00) AS sgst,
        COALESCE(SUM(b.cgst + b.sgst), 0.00) AS total_tax,
        COALESCE(SUM(b.round_off), 0.00) AS total_round_off,
        COALESCE(SUM(b.total_items), 0) AS total_items_sold
    INTO v_today_financials
    FROM public.bills b
    WHERE b.cafe_id = p_cafe_id::TEXT
      AND b.business_date = v_current_biz_date
      AND b.payment_status = 'PAID';

    -- 5. Aggregate Range Tender Breakdown (Payments + Legacy Fallback)
    SELECT
        COALESCE(SUM(bp.amount) FILTER (WHERE UPPER(bp.payment_method) = 'CASH'), 0.00) AS cash,
        COALESCE(SUM(bp.amount) FILTER (WHERE UPPER(bp.payment_method) = 'UPI'), 0.00) AS upi,
        COALESCE(SUM(bp.amount) FILTER (WHERE UPPER(bp.payment_method) = 'CARD'), 0.00) AS card,
        COALESCE(SUM(bp.amount) FILTER (WHERE UPPER(bp.payment_method) NOT IN ('CASH', 'UPI', 'CARD')), 0.00) AS other
    INTO v_tenders_payments
    FROM public.bill_payments bp
    JOIN public.bills b ON b.id = bp.bill_id
    WHERE b.cafe_id = p_cafe_id::TEXT
      AND b.business_date >= v_start_date
      AND b.business_date <= v_end_date
      AND b.payment_status = 'PAID';

    SELECT
        COALESCE(SUM(b.grand_total) FILTER (WHERE UPPER(b.payment_method) = 'CASH'), 0.00) AS cash,
        COALESCE(SUM(b.grand_total) FILTER (WHERE UPPER(b.payment_method) = 'UPI'), 0.00) AS upi,
        COALESCE(SUM(b.grand_total) FILTER (WHERE UPPER(b.payment_method) = 'CARD'), 0.00) AS card,
        COALESCE(SUM(b.grand_total) FILTER (WHERE UPPER(b.payment_method) NOT IN ('CASH', 'UPI', 'CARD')), 0.00) AS other
    INTO v_tenders_legacy
    FROM public.bills b
    WHERE b.cafe_id = p_cafe_id::TEXT
      AND b.business_date >= v_start_date
      AND b.business_date <= v_end_date
      AND b.payment_status = 'PAID'
      AND NOT EXISTS (
          SELECT 1 FROM public.bill_payments bp WHERE bp.bill_id = b.id
      );

    -- 6. Aggregate Today Tender Breakdown
    SELECT
        COALESCE(SUM(bp.amount) FILTER (WHERE UPPER(bp.payment_method) = 'CASH'), 0.00) AS cash,
        COALESCE(SUM(bp.amount) FILTER (WHERE UPPER(bp.payment_method) = 'UPI'), 0.00) AS upi,
        COALESCE(SUM(bp.amount) FILTER (WHERE UPPER(bp.payment_method) = 'CARD'), 0.00) AS card,
        COALESCE(SUM(bp.amount) FILTER (WHERE UPPER(bp.payment_method) NOT IN ('CASH', 'UPI', 'CARD')), 0.00) AS other
    INTO v_today_tenders_payments
    FROM public.bill_payments bp
    JOIN public.bills b ON b.id = bp.bill_id
    WHERE b.cafe_id = p_cafe_id::TEXT
      AND b.business_date = v_current_biz_date
      AND b.payment_status = 'PAID';

    SELECT
        COALESCE(SUM(b.grand_total) FILTER (WHERE UPPER(b.payment_method) = 'CASH'), 0.00) AS cash,
        COALESCE(SUM(b.grand_total) FILTER (WHERE UPPER(b.payment_method) = 'UPI'), 0.00) AS upi,
        COALESCE(SUM(b.grand_total) FILTER (WHERE UPPER(b.payment_method) = 'CARD'), 0.00) AS card,
        COALESCE(SUM(b.grand_total) FILTER (WHERE UPPER(b.payment_method) NOT IN ('CASH', 'UPI', 'CARD')), 0.00) AS other
    INTO v_today_tenders_legacy
    FROM public.bills b
    WHERE b.cafe_id = p_cafe_id::TEXT
      AND b.business_date = v_current_biz_date
      AND b.payment_status = 'PAID'
      AND NOT EXISTS (
          SELECT 1 FROM public.bill_payments bp WHERE bp.bill_id = b.id
      );

    -- 7. Generate Continuous Daily Time Series (by_day)
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

    -- 8. Aggregate Top Items from bill_items of PAID bills in the range
    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'name', item_summary.item_name,
                'qty', item_summary.total_qty,
                'revenue', item_summary.total_rev::NUMERIC(10,2),
                'percentage', CASE 
                    WHEN max_item.max_qty > 0 
                    THEN ROUND((item_summary.total_qty::NUMERIC / max_item.max_qty::NUMERIC) * 100) 
                    ELSE 0 
                END
            )
            ORDER BY item_summary.total_qty DESC, item_summary.total_rev DESC
        ),
        '[]'::jsonb
    ) INTO v_top_items
    FROM (
        SELECT
            bi.item_name,
            SUM(bi.quantity) AS total_qty,
            SUM(bi.line_total) AS total_rev
        FROM public.bill_items bi
        JOIN public.bills b ON b.id = bi.bill_id
        WHERE b.cafe_id = p_cafe_id::TEXT
          AND b.business_date >= v_start_date
          AND b.business_date <= v_end_date
          AND b.payment_status = 'PAID'
        GROUP BY bi.item_name
        ORDER BY total_qty DESC, total_rev DESC
        LIMIT 6
    ) item_summary
    CROSS JOIN (
        SELECT COALESCE(MAX(sub.total_qty), 1) AS max_qty
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
            LIMIT 1
        ) sub
    ) max_item;

    -- 9. Operational Summary from public.orders
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

    -- 10. Return Consolidated JSONB DTO
    RETURN jsonb_build_object(
        'cafe_id', p_cafe_id,
        'current_business_date', v_current_biz_date,
        'start_business_date', v_start_date,
        'end_business_date', v_end_date,
        'range_days', v_range_days,
        'range_financials', jsonb_build_object(
            'gross_subtotal', v_financials.gross_subtotal,
            'total_discounts', v_financials.total_discounts,
            'total_tax', v_financials.total_tax,
            'cgst', v_financials.cgst,
            'sgst', v_financials.sgst,
            'total_service_charge', v_financials.total_service_charge,
            'total_round_off', v_financials.total_round_off,
            'net_collected', v_financials.net_collected,
            'paid_bills_count', v_financials.paid_bills_count,
            'total_items_sold', v_financials.total_items_sold,
            'average_bill_value', CASE 
                WHEN v_financials.paid_bills_count > 0 
                THEN ROUND((v_financials.net_collected / v_financials.paid_bills_count)::NUMERIC, 2)
                ELSE 0.00 
            END
        ),
        'today_financials', jsonb_build_object(
            'gross_subtotal', v_today_financials.gross_subtotal,
            'total_discounts', v_today_financials.total_discounts,
            'total_tax', v_today_financials.total_tax,
            'cgst', v_today_financials.cgst,
            'sgst', v_today_financials.sgst,
            'total_service_charge', v_today_financials.total_service_charge,
            'total_round_off', v_today_financials.total_round_off,
            'net_collected', v_today_financials.net_collected,
            'paid_bills_count', v_today_financials.paid_bills_count,
            'total_items_sold', v_today_financials.total_items_sold,
            'average_bill_value', CASE 
                WHEN v_today_financials.paid_bills_count > 0 
                THEN ROUND((v_today_financials.net_collected / v_today_financials.paid_bills_count)::NUMERIC, 2)
                ELSE 0.00 
            END
        ),
        'tenders', jsonb_build_object(
            'cash', v_tenders_payments.cash + v_tenders_legacy.cash,
            'upi', v_tenders_payments.upi + v_tenders_legacy.upi,
            'card', v_tenders_payments.card + v_tenders_legacy.card,
            'other', v_tenders_payments.other + v_tenders_legacy.other
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
$$;

GRANT EXECUTE ON FUNCTION public.get_owner_analytics_range(UUID, INT, DATE, DATE) TO authenticated, service_role;

-- 8. Update public.get_daily_sales_transactions to return itemized tenders array
CREATE OR REPLACE FUNCTION public.get_daily_sales_transactions(
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
    v_transactions JSONB;
BEGIN
    -- 1. Authorization check
    IF NOT (
        public.has_role(auth.uid(), 'owner', p_cafe_id) OR
        public.has_role(auth.uid(), 'counter', p_cafe_id) OR
        public.has_role(auth.uid(), 'staff', p_cafe_id) OR
        public.is_demo_admin(auth.uid()) OR
        auth.role() = 'service_role'
    ) THEN
        RAISE EXCEPTION '403 Forbidden: Insufficient permissions to view daily sales transactions for cafe %', p_cafe_id;
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
                'items', COALESCE(items_subquery.items, '[]'::jsonb),
                'tenders', CASE
                    WHEN tenders_subquery.tenders IS NOT NULL AND jsonb_array_length(tenders_subquery.tenders) > 0
                    THEN tenders_subquery.tenders
                    ELSE jsonb_build_array(
                        jsonb_build_object(
                            'method', COALESCE(b.payment_method, 'CASH'),
                            'amount', b.grand_total::NUMERIC(10,2)
                        )
                    )
                END
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
                'id', bi.id,
                'item_name', bi.item_name,
                'category_name', bi.category_name,
                'quantity', bi.quantity,
                'unit_price', bi.unit_price::NUMERIC(10,2),
                'discount', bi.discount::NUMERIC(10,2),
                'tax', bi.tax::NUMERIC(10,2),
                'line_total', bi.line_total::NUMERIC(10,2),
                'special_instructions', bi.special_instructions
            )
            ORDER BY bi.id ASC
        ) AS items
        FROM public.bill_items bi
        WHERE bi.bill_id = b.id
    ) items_subquery ON true
    LEFT JOIN LATERAL (
        SELECT jsonb_agg(
            jsonb_build_object(
                'id', bp.id,
                'method', bp.payment_method,
                'amount', bp.amount::NUMERIC(10,2),
                'tendered_amount', bp.tendered_amount::NUMERIC(10,2),
                'change_due', bp.change_due::NUMERIC(10,2),
                'transaction_ref', bp.transaction_ref
            )
            ORDER BY bp.created_at ASC
        ) AS tenders
        FROM public.bill_payments bp
        WHERE bp.bill_id = b.id
    ) tenders_subquery ON true
    WHERE b.cafe_id = p_cafe_id::TEXT
      AND b.business_date = v_target_date
      AND b.payment_status = 'PAID';

    RETURN jsonb_build_object(
        'business_date', v_target_date,
        'cafe_id', p_cafe_id,
        'transactions', v_transactions
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_daily_sales_transactions(UUID, DATE) TO authenticated, service_role, anon;
