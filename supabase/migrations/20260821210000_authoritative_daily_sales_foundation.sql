-- ============================================================================
-- Migration: 20260821210000_authoritative_daily_sales_foundation.sql
-- Description: Authoritative Daily Sales Database Foundation for Counter POS
--
-- 1. Add business_date DATE column to public.bills
-- 2. Add trigger to assign/recalculate business_date from paid_at or created_at
-- 3. Backfill business_date for existing bills
-- 4. Create composite index on (cafe_id, business_date, payment_status)
-- 5. Add public.bills to supabase_realtime publication
-- 6. Add trigger to enforce immutability on finalized financial bills
-- 7. Create authoritative get_daily_sales_report(p_cafe_id, p_business_date) RPC
-- ============================================================================

-- 1. Add business_date to public.bills
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS business_date DATE;

-- 2. Trigger function to assign business_date on public.bills
CREATE OR REPLACE FUNCTION public.assign_bill_business_date()
RETURNS TRIGGER AS $$
DECLARE
    v_target_ts TIMESTAMPTZ;
    v_biz_date DATE;
BEGIN
    -- Derive target timestamp:
    -- If status is PAID or paid_at is provided, business_date is derived from paid_at
    -- Otherwise, business_date is derived from created_at for pending draft tracking
    IF (NEW.payment_status = 'PAID' OR NEW.paid_at IS NOT NULL) THEN
        v_target_ts := COALESCE(NEW.paid_at, NEW.created_at, now());
    ELSE
        v_target_ts := COALESCE(NEW.created_at, now());
    END IF;

    -- Calculate business date safely handling text cafe_id
    IF NEW.cafe_id IS NOT NULL AND NEW.cafe_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
        v_biz_date := public.get_cafe_business_date(NEW.cafe_id::UUID, v_target_ts);
    ELSE
        -- Fallback for non-UUID / demo / mock cafe_ids (Asia/Kolkata timezone standard)
        v_biz_date := ((v_target_ts AT TIME ZONE 'Asia/Kolkata'))::DATE;
    END IF;

    NEW.business_date := v_biz_date;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_assign_bill_business_date ON public.bills;
CREATE TRIGGER trg_assign_bill_business_date
BEFORE INSERT OR UPDATE OF payment_status, paid_at, created_at, cafe_id ON public.bills
FOR EACH ROW EXECUTE FUNCTION public.assign_bill_business_date();

-- 3. Backfill business_date for existing bills
UPDATE public.bills
SET business_date = CASE
    WHEN cafe_id IS NOT NULL AND cafe_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
        public.get_cafe_business_date(cafe_id::UUID, COALESCE(paid_at, created_at, now()))
    ELSE
        ((COALESCE(paid_at, created_at, now()) AT TIME ZONE 'Asia/Kolkata'))::DATE
END
WHERE business_date IS NULL;

-- 4. Create high-performance composite index for Daily Sales queries
CREATE INDEX IF NOT EXISTS idx_bills_daily_sales_report
ON public.bills (cafe_id, business_date, payment_status);

-- 5. Add public.bills to supabase_realtime publication
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'bills'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.bills;
    END IF;
END $$;

-- 6. Trigger to enforce immutability on finalized financial bills
CREATE OR REPLACE FUNCTION public.protect_finalized_bill_records()
RETURNS TRIGGER AS $$
DECLARE
    v_current_biz_date DATE;
BEGIN
    -- Service role / administrative maintenance bypass
    IF auth.role() = 'service_role' THEN
        RETURN COALESCE(NEW, OLD);
    END IF;

    -- Only enforce protections once a bill was marked PAID
    IF OLD.payment_status = 'PAID' THEN
        -- Rule 1: PAID bills can never be deleted
        IF TG_OP = 'DELETE' THEN
            RAISE EXCEPTION 'IMMUTABILITY VIOLATION: Finalized paid bills cannot be deleted.';
        END IF;

        -- Resolve current business date for this cafe
        IF OLD.cafe_id IS NOT NULL AND OLD.cafe_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
            v_current_biz_date := public.get_cafe_business_date(OLD.cafe_id::UUID, now());
        ELSE
            v_current_biz_date := ((now() AT TIME ZONE 'Asia/Kolkata'))::DATE;
        END IF;

        -- Rule 2: Past business date bills cannot be updated at all
        IF OLD.business_date < v_current_biz_date THEN
            RAISE EXCEPTION 'IMMUTABILITY VIOLATION: Closed bills from past business dates cannot be modified.';
        END IF;

        -- Rule 3: Same-day PAID bills - forbid mutating financial terms or payment state
        IF NEW.payment_status != 'PAID' OR
           NEW.grand_total != OLD.grand_total OR
           NEW.subtotal != OLD.subtotal OR
           NEW.discount != OLD.discount OR
           NEW.cgst != OLD.cgst OR
           NEW.sgst != OLD.sgst OR
           NEW.service_charge != OLD.service_charge OR
           NEW.round_off != OLD.round_off OR
           NEW.payment_method != OLD.payment_method OR
           NEW.paid_at != OLD.paid_at OR
           NEW.cafe_id != OLD.cafe_id
        THEN
            RAISE EXCEPTION 'IMMUTABILITY VIOLATION: Financial terms and payment status of a paid bill cannot be modified.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_protect_finalized_bills ON public.bills;
CREATE TRIGGER trg_protect_finalized_bills
BEFORE UPDATE OR DELETE ON public.bills
FOR EACH ROW EXECUTE FUNCTION public.protect_finalized_bill_records();

-- 7. Authoritative get_daily_sales_report RPC
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
    v_tenders RECORD;
    v_pipeline RECORD;
BEGIN
    -- 1. Enforce RBAC tenant isolation
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

    -- 4. Aggregate tender breakdown for realized sales
    SELECT
        COALESCE(SUM(grand_total) FILTER (WHERE UPPER(payment_method) = 'CASH'), 0.00) AS cash_collected,
        COALESCE(SUM(grand_total) FILTER (WHERE UPPER(payment_method) = 'UPI'), 0.00) AS upi_collected,
        COALESCE(SUM(grand_total) FILTER (WHERE UPPER(payment_method) = 'CARD'), 0.00) AS card_collected,
        COALESCE(SUM(grand_total) FILTER (WHERE UPPER(payment_method) NOT IN ('CASH', 'UPI', 'CARD')), 0.00) AS other_collected
    INTO v_tenders
    FROM public.bills
    WHERE cafe_id = p_cafe_id::TEXT
      AND business_date = v_target_date
      AND payment_status = 'PAID';

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
        'gross_subtotal', v_report.gross_subtotal,
        'total_discounts', v_report.total_discounts,
        'total_tax', v_report.total_tax,
        'cgst', v_report.total_cgst,
        'sgst', v_report.total_sgst,
        'total_service_charge', v_report.total_service_charge,
        'total_round_off', v_report.total_round_off,
        'paid_bills_count', v_report.paid_bills_count,
        'total_items_sold', v_report.total_items_sold,
        'average_bill_value', CASE WHEN v_report.paid_bills_count > 0 THEN ROUND(v_report.net_collected / v_report.paid_bills_count, 2) ELSE 0.00 END,
        'tenders', jsonb_build_object(
            'cash', v_tenders.cash_collected,
            'upi', v_tenders.upi_collected,
            'card', v_tenders.card_collected,
            'other', v_tenders.other_collected
        ),
        'pipeline', jsonb_build_object(
            'unsettled_orders_count', v_pipeline.unsettled_orders_count,
            'unsettled_pipeline_cents', v_pipeline.unsettled_pipeline_cents,
            'cancelled_orders_count', v_pipeline.cancelled_orders_count
        )
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_daily_sales_report(UUID, DATE) TO authenticated;
