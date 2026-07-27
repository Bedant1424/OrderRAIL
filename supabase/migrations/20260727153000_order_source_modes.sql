-- Sprint 9.2.5.0 — Unified Order Source Modes Schema Migration

-- 1. Create Order Source Enum
DO $$ BEGIN
  CREATE TYPE public.order_source_enum AS ENUM ('DINE_IN', 'TAKEAWAY', 'SWIGGY', 'ZOMATO');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 2. Update Orders Table (Make Table & Session Nullable for Takeaway/Delivery, add Order Source)
ALTER TABLE public.orders 
  ALTER COLUMN table_id DROP NOT NULL,
  ALTER COLUMN dining_session_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS order_source public.order_source_enum DEFAULT 'DINE_IN',
  ADD COLUMN IF NOT EXISTS external_order_ref VARCHAR NULL;

-- 3. Update Bills Table
ALTER TABLE public.bills 
  ALTER COLUMN table_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS order_source public.order_source_enum DEFAULT 'DINE_IN',
  ADD COLUMN IF NOT EXISTS external_order_ref VARCHAR NULL;

-- 4. Indexing for Order Source Filtering
CREATE INDEX IF NOT EXISTS idx_orders_order_source ON public.orders (order_source, created_at DESC);
