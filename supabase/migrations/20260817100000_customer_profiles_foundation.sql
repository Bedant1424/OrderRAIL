-- Migration: Customer Profiles & History Foundation Architecture
-- Creates canonical public.customers table, FK links on bills and orders, indices, RLS, and SECURITY DEFINER RPCs.

CREATE TABLE IF NOT EXISTS public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cafe_id UUID NOT NULL REFERENCES public.cafes(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  normalized_phone TEXT NOT NULL,
  name TEXT,
  visit_count INTEGER NOT NULL DEFAULT 0,
  total_spend_cents BIGINT NOT NULL DEFAULT 0,
  first_visit_at TIMESTAMPTZ,
  last_visit_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT customers_cafe_normalized_phone_unique UNIQUE (cafe_id, normalized_phone)
);

-- Add customer foreign keys & metadata fields to bills and orders tables
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS customer_name TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS customer_phone TEXT;

-- Indices for rapid querying & performance
CREATE INDEX IF NOT EXISTS idx_customers_cafe_id ON public.customers(cafe_id);
CREATE INDEX IF NOT EXISTS idx_customers_cafe_norm_phone ON public.customers(cafe_id, normalized_phone);
CREATE INDEX IF NOT EXISTS idx_bills_customer_id ON public.bills(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON public.orders(customer_id);

-- Enable RLS on customers
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- RLS: Owner & Staff read/write policy (Anonymous QR customer clients cannot select customer profiles)
CREATE POLICY "customers_staff_owner_select" ON public.customers
  FOR SELECT
  USING (
    auth.role() = 'authenticated' OR
    public.has_role(auth.uid(), 'staff', cafe_id) OR
    public.has_role(auth.uid(), 'owner', cafe_id) OR
    public.has_role(auth.uid(), 'counter', cafe_id)
  );

CREATE POLICY "customers_staff_owner_all" ON public.customers
  FOR ALL
  USING (
    auth.role() = 'authenticated' OR
    public.has_role(auth.uid(), 'staff', cafe_id) OR
    public.has_role(auth.uid(), 'owner', cafe_id) OR
    public.has_role(auth.uid(), 'counter', cafe_id)
  )
  WITH CHECK (
    auth.role() = 'authenticated' OR
    public.has_role(auth.uid(), 'staff', cafe_id) OR
    public.has_role(auth.uid(), 'owner', cafe_id) OR
    public.has_role(auth.uid(), 'counter', cafe_id)
  );

-- Atomic RPC: Resolve or create customer profile by (cafe_id, normalized_phone)
CREATE OR REPLACE FUNCTION public.resolve_or_create_customer(
  p_cafe_id UUID,
  p_phone TEXT,
  p_normalized_phone TEXT,
  p_name TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_id UUID;
  v_existing_name TEXT;
  v_clean_name TEXT;
  v_clean_phone TEXT;
BEGIN
  IF p_cafe_id IS NULL OR p_normalized_phone IS NULL OR trim(p_normalized_phone) = '' THEN
    RETURN NULL;
  END IF;

  v_clean_phone := trim(p_phone);
  v_clean_name := NULLIF(trim(p_name), '');

  -- Lock existing customer row if present to prevent concurrent duplicate creation
  SELECT id, name INTO v_customer_id, v_existing_name
  FROM public.customers
  WHERE cafe_id = p_cafe_id AND normalized_phone = trim(p_normalized_phone)
  FOR UPDATE;

  IF v_customer_id IS NOT NULL THEN
    -- Update name if new non-empty name is provided AND existing name is NULL or empty
    IF v_clean_name IS NOT NULL AND (v_existing_name IS NULL OR trim(v_existing_name) = '') THEN
      UPDATE public.customers
      SET name = v_clean_name, updated_at = now()
      WHERE id = v_customer_id;
    END IF;
    RETURN v_customer_id;
  END IF;

  -- Insert new customer profile with ON CONFLICT safety
  INSERT INTO public.customers (
    cafe_id,
    phone,
    normalized_phone,
    name,
    created_at,
    updated_at
  )
  VALUES (
    p_cafe_id,
    v_clean_phone,
    trim(p_normalized_phone),
    v_clean_name,
    now(),
    now()
  )
  ON CONFLICT (cafe_id, normalized_phone) DO UPDATE
  SET updated_at = now()
  RETURNING id INTO v_customer_id;

  RETURN v_customer_id;
END;
$$;

-- Atomic RPC: Increment customer visit & settled spend metrics
CREATE OR REPLACE FUNCTION public.record_customer_settlement(
  p_customer_id UUID,
  p_amount_cents BIGINT,
  p_visit_at TIMESTAMPTZ DEFAULT now()
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_effective_time TIMESTAMPTZ;
BEGIN
  IF p_customer_id IS NULL THEN
    RETURN;
  END IF;

  v_effective_time := COALESCE(p_visit_at, now());

  UPDATE public.customers
  SET
    visit_count = visit_count + 1,
    total_spend_cents = total_spend_cents + GREATEST(0, p_amount_cents),
    first_visit_at = LEAST(COALESCE(first_visit_at, v_effective_time), v_effective_time),
    last_visit_at = GREATEST(COALESCE(last_visit_at, v_effective_time), v_effective_time),
    updated_at = now()
  WHERE id = p_customer_id;
END;
$$;
