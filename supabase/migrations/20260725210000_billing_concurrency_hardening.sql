-- Migration: Billing Integrity & Concurrency Hardening
-- Enforces 1 bill per dining session, financial check constraints, and atomic RPC transaction safety.

-- 1. Unique constraint: One bill per dining session
ALTER TABLE public.bills DROP CONSTRAINT IF EXISTS bills_session_id_unique;
ALTER TABLE public.bills ADD CONSTRAINT bills_session_id_unique UNIQUE (session_id);

-- 2. Check constraints on bills table
ALTER TABLE public.bills DROP CONSTRAINT IF EXISTS chk_bills_payment_status;
ALTER TABLE public.bills ADD CONSTRAINT chk_bills_payment_status
  CHECK (payment_status IN ('PENDING', 'PAID', 'PARTIALLY_PAID', 'CANCELLED', 'REFUNDED'));

ALTER TABLE public.bills DROP CONSTRAINT IF EXISTS chk_bills_payment_method;
ALTER TABLE public.bills ADD CONSTRAINT chk_bills_payment_method
  CHECK (payment_method IN ('CASH', 'CARD', 'UPI', 'MIXED'));

ALTER TABLE public.bills DROP CONSTRAINT IF EXISTS chk_bills_non_negative_totals;
ALTER TABLE public.bills ADD CONSTRAINT chk_bills_non_negative_totals
  CHECK (subtotal >= 0 AND grand_total >= 0 AND total_items >= 0);

-- 3. Check constraints on bill_items table
ALTER TABLE public.bill_items DROP CONSTRAINT IF EXISTS chk_bill_items_quantity;
ALTER TABLE public.bill_items ADD CONSTRAINT chk_bill_items_quantity
  CHECK (quantity > 0 AND unit_price >= 0 AND line_total >= 0);

-- 4. Atomic RPC: generate_bill_atomic
-- Performs bill creation and item snapshot creation in a single database transaction
CREATE OR REPLACE FUNCTION public.generate_bill_atomic(
  p_bill JSONB,
  p_items JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_bill_id UUID;
  v_session_id TEXT;
  v_existing_bill_id UUID;
BEGIN
  v_session_id := p_bill->>'session_id';

  -- Check if bill already exists for session (Idempotency)
  SELECT id INTO v_existing_bill_id
  FROM public.bills
  WHERE session_id = v_session_id;

  IF v_existing_bill_id IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'EXISTS', 'bill_id', v_existing_bill_id);
  END IF;

  -- Insert bill
  INSERT INTO public.bills (
    id, bill_number, cafe_id, session_id, table_id, cashier_id,
    customer_name, customer_phone, order_type, payment_status, payment_method,
    subtotal, discount, service_charge, cgst, sgst, round_off, grand_total,
    total_items, notes, created_at
  ) VALUES (
    (p_bill->>'id')::UUID,
    (p_bill->>'bill_number')::INTEGER,
    p_bill->>'cafe_id',
    v_session_id,
    p_bill->>'table_id',
    p_bill->>'cashier_id',
    p_bill->>'customer_name',
    p_bill->>'customer_phone',
    COALESCE(p_bill->>'order_type', 'DINE_IN'),
    COALESCE(p_bill->>'payment_status', 'PENDING'),
    COALESCE(p_bill->>'payment_method', 'CASH'),
    (p_bill->>'subtotal')::NUMERIC,
    (p_bill->>'discount')::NUMERIC,
    (p_bill->>'service_charge')::NUMERIC,
    (p_bill->>'cgst')::NUMERIC,
    (p_bill->>'sgst')::NUMERIC,
    (p_bill->>'round_off')::NUMERIC,
    (p_bill->>'grand_total')::NUMERIC,
    (p_bill->>'total_items')::INTEGER,
    p_bill->>'notes',
    COALESCE((p_bill->>'created_at')::TIMESTAMPTZ, now())
  ) RETURNING id INTO v_bill_id;

  -- Insert bill items
  IF p_items IS NOT NULL AND jsonb_array_length(p_items) > 0 THEN
    INSERT INTO public.bill_items (
      bill_id, menu_item_id, item_name, category_name, quantity,
      unit_price, discount, tax, line_total, special_instructions
    )
    SELECT
      v_bill_id,
      elem->>'menu_item_id',
      elem->>'item_name',
      COALESCE(elem->>'category_name', 'General'),
      (elem->>'quantity')::INTEGER,
      (elem->>'unit_price')::NUMERIC,
      COALESCE((elem->>'discount')::NUMERIC, 0.00),
      COALESCE((elem->>'tax')::NUMERIC, 0.00),
      (elem->>'line_total')::NUMERIC,
      elem->>'special_instructions'
    FROM jsonb_array_elements(p_items) AS elem;
  END IF;

  RETURN jsonb_build_object('status', 'CREATED', 'bill_id', v_bill_id);
END;
$$;

-- 5. Atomic RPC: mark_bill_paid_atomic
CREATE OR REPLACE FUNCTION public.mark_bill_paid_atomic(
  p_bill_id UUID,
  p_payment_method TEXT,
  p_paid_at TIMESTAMPTZ DEFAULT now()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_status TEXT;
  v_current_method TEXT;
  v_paid_at TIMESTAMPTZ;
BEGIN
  SELECT payment_status, payment_method, paid_at
  INTO v_current_status, v_current_method, v_paid_at
  FROM public.bills
  WHERE id = p_bill_id;

  IF v_current_status IS NULL THEN
    RETURN jsonb_build_object('status', 'NOT_FOUND');
  END IF;

  -- Idempotency check: If already paid, preserve original status and return
  IF v_current_status = 'PAID' THEN
    RETURN jsonb_build_object('status', 'ALREADY_PAID', 'payment_method', v_current_method, 'paid_at', v_paid_at);
  END IF;

  UPDATE public.bills
  SET
    payment_status = 'PAID',
    payment_method = p_payment_method,
    paid_at = COALESCE(p_paid_at, now()),
    closed_at = COALESCE(p_paid_at, now())
  WHERE id = p_bill_id;

  RETURN jsonb_build_object('status', 'UPDATED');
END;
$$;
