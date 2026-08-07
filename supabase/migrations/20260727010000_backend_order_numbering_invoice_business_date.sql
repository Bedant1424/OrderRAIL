-- Migration: Sprint 9.2.2.8 — Backend Order Numbering, Invoice Numbering & Business Date

-- 1. Add business_date_cutoff_hour to cafes table (0 = midnight, 4 = 4:00 AM cutoff for late night operation)
ALTER TABLE public.cafes ADD COLUMN IF NOT EXISTS business_date_cutoff_hour INTEGER NOT NULL DEFAULT 0;

-- 2. Add business_date, daily_order_number, and invoice_number columns to orders table
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS business_date DATE;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS daily_order_number INTEGER;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS invoice_number TEXT;

-- 3. Create per-cafe daily order counter table (resets per cafe and business date)
CREATE TABLE IF NOT EXISTS public.cafe_daily_order_counters (
    cafe_id UUID NOT NULL REFERENCES public.cafes(id) ON DELETE CASCADE,
    business_date DATE NOT NULL,
    counter INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (cafe_id, business_date)
);

-- 4. Create per-cafe invoice counter table (globally unique per cafe, never resets)
CREATE TABLE IF NOT EXISTS public.cafe_invoice_counters (
    cafe_id UUID PRIMARY KEY REFERENCES public.cafes(id) ON DELETE CASCADE,
    counter INTEGER NOT NULL DEFAULT 0
);

-- 5. Helper function to compute business date considering cafe cutoff hour
CREATE OR REPLACE FUNCTION public.get_cafe_business_date(
    p_cafe_id UUID,
    p_timestamp TIMESTAMPTZ DEFAULT now()
)
RETURNS DATE AS $$
DECLARE
    v_cutoff_hour INTEGER := 0;
    v_local_ts TIMESTAMP;
BEGIN
    SELECT COALESCE(business_date_cutoff_hour, 0) INTO v_cutoff_hour
    FROM public.cafes
    WHERE id = p_cafe_id;

    -- Adjust timestamp by subtracting cutoff hours before extracting date
    v_local_ts := (p_timestamp AT TIME ZONE 'Asia/Kolkata') - (v_cutoff_hour || ' hours')::INTERVAL;
    RETURN v_local_ts::DATE;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

-- 6. Trigger function to assign business_date and daily_order_number on order creation
CREATE OR REPLACE FUNCTION public.assign_backend_order_number_and_business_date()
RETURNS TRIGGER AS $$
DECLARE
    v_biz_date DATE;
    v_next_daily_num INTEGER;
BEGIN
    -- Determine business date if not explicitly set
    IF NEW.business_date IS NULL THEN
        v_biz_date := public.get_cafe_business_date(NEW.cafe_id, COALESCE(NEW.created_at, now()));
        NEW.business_date := v_biz_date;
    ELSE
        v_biz_date := NEW.business_date;
    END IF;

    -- Atomic sequential daily order numbering per cafe and business date
    IF NEW.daily_order_number IS NULL THEN
        INSERT INTO public.cafe_daily_order_counters (cafe_id, business_date, counter)
        VALUES (NEW.cafe_id, v_biz_date, 1)
        ON CONFLICT (cafe_id, business_date)
        DO UPDATE SET counter = public.cafe_daily_order_counters.counter + 1
        RETURNING counter INTO v_next_daily_num;

        NEW.daily_order_number := v_next_daily_num;
        NEW.order_number := v_next_daily_num;
    ELSE
        NEW.order_number := NEW.daily_order_number;
    END IF;

    -- Automatically assign invoice_number if order is created directly in paid or served status
    IF (NEW.status::text = 'paid' OR NEW.status::text = 'served') AND NEW.invoice_number IS NULL THEN
        INSERT INTO public.cafe_invoice_counters (cafe_id, counter)
        VALUES (NEW.cafe_id, 1)
        ON CONFLICT (cafe_id)
        DO UPDATE SET counter = public.cafe_invoice_counters.counter + 1
        RETURNING counter INTO v_next_daily_num;

        NEW.invoice_number := 'INV-' || LPAD(v_next_daily_num::text, 6, '0');
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create BEFORE INSERT trigger
DROP TRIGGER IF EXISTS trigger_assign_backend_order_number ON public.orders;
CREATE TRIGGER trigger_assign_backend_order_number
BEFORE INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.assign_backend_order_number_and_business_date();

-- 7. Trigger function to assign immutable invoice_number upon payment completion
CREATE OR REPLACE FUNCTION public.assign_invoice_number_on_payment()
RETURNS TRIGGER AS $$
DECLARE
    v_next_inv_num INTEGER;
BEGIN
    IF (NEW.status::text = 'paid' OR NEW.status::text = 'served') AND NEW.invoice_number IS NULL THEN
        INSERT INTO public.cafe_invoice_counters (cafe_id, counter)
        VALUES (NEW.cafe_id, 1)
        ON CONFLICT (cafe_id)
        DO UPDATE SET counter = public.cafe_invoice_counters.counter + 1
        RETURNING counter INTO v_next_inv_num;

        NEW.invoice_number := 'INV-' || LPAD(v_next_inv_num::text, 6, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create BEFORE UPDATE trigger
DROP TRIGGER IF EXISTS trigger_assign_invoice_number_on_payment ON public.orders;
CREATE TRIGGER trigger_assign_invoice_number_on_payment
BEFORE UPDATE ON public.orders
FOR EACH ROW
WHEN ((NEW.status::text = 'paid' OR NEW.status::text = 'served') AND OLD.invoice_number IS NULL)
EXECUTE FUNCTION public.assign_invoice_number_on_payment();

-- 8. Backfill historical orders
DO $$
DECLARE
    r RECORD;
    v_biz_date DATE;
    v_daily_counter INTEGER;
    v_inv_counter INTEGER;
BEGIN
    FOR r IN 
        SELECT id, cafe_id, created_at, status, order_number 
        FROM public.orders 
        ORDER BY created_at ASC, id ASC
    LOOP
        v_biz_date := public.get_cafe_business_date(r.cafe_id, COALESCE(r.created_at, now()));

        INSERT INTO public.cafe_daily_order_counters (cafe_id, business_date, counter)
        VALUES (r.cafe_id, v_biz_date, 1)
        ON CONFLICT (cafe_id, business_date)
        DO UPDATE SET counter = public.cafe_daily_order_counters.counter + 1
        RETURNING counter INTO v_daily_counter;

        UPDATE public.orders 
        SET business_date = v_biz_date,
            daily_order_number = v_daily_counter,
            order_number = v_daily_counter
        WHERE id = r.id;

        IF r.status::text = 'paid' OR r.status::text = 'served' THEN
            INSERT INTO public.cafe_invoice_counters (cafe_id, counter)
            VALUES (r.cafe_id, 1)
            ON CONFLICT (cafe_id)
            DO UPDATE SET counter = public.cafe_invoice_counters.counter + 1
            RETURNING counter INTO v_inv_counter;

            UPDATE public.orders
            SET invoice_number = 'INV-' || LPAD(v_inv_counter::text, 6, '0')
            WHERE id = r.id AND invoice_number IS NULL;
        END IF;
    END LOOP;
END $$;
