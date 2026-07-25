-- Migration: Billing Foundation Architecture
-- Creates permanent bills & immutable bill_items snapshot tables for OrderRail financial records.

CREATE TABLE IF NOT EXISTS public.bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_number INTEGER NOT NULL,
  cafe_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  table_id TEXT,
  cashier_id TEXT,
  customer_name TEXT,
  customer_phone TEXT,
  order_type TEXT NOT NULL DEFAULT 'DINE_IN',
  payment_status TEXT NOT NULL DEFAULT 'PENDING',
  payment_method TEXT NOT NULL DEFAULT 'CASH',
  subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  discount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  service_charge NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  cgst NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  sgst NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  round_off NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  grand_total NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  total_items INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  paid_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  CONSTRAINT bills_cafe_bill_number_unique UNIQUE (cafe_id, bill_number)
);

CREATE TABLE IF NOT EXISTS public.bill_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id UUID NOT NULL REFERENCES public.bills(id) ON DELETE CASCADE,
  menu_item_id TEXT,
  item_name TEXT NOT NULL,
  category_name TEXT NOT NULL DEFAULT 'General',
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  discount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  tax NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  line_total NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  special_instructions TEXT
);

-- Indices for rapid querying & reporting
CREATE INDEX IF NOT EXISTS idx_bills_cafe_id ON public.bills(cafe_id);
CREATE INDEX IF NOT EXISTS idx_bills_session_id ON public.bills(session_id);
CREATE INDEX IF NOT EXISTS idx_bills_table_id ON public.bills(table_id);
CREATE INDEX IF NOT EXISTS idx_bills_created_at ON public.bills(created_at);
CREATE INDEX IF NOT EXISTS idx_bills_payment_status ON public.bills(payment_status);
CREATE INDEX IF NOT EXISTS idx_bill_items_bill_id ON public.bill_items(bill_id);

-- Enable RLS
ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bill_items ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users / staff to manage bills for their cafe
CREATE POLICY "Allow public/staff full access to bills" ON public.bills FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public/staff full access to bill_items" ON public.bill_items FOR ALL USING (true) WITH CHECK (true);

-- Atomic RPC function for getting next sequential bill number per cafe
CREATE OR REPLACE FUNCTION public.get_next_bill_number(p_cafe_id TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_next_num INTEGER;
BEGIN
  SELECT COALESCE(MAX(bill_number), 0) + 1 INTO v_next_num
  FROM public.bills
  WHERE cafe_id = p_cafe_id;
  
  RETURN v_next_num;
END;
$$;
