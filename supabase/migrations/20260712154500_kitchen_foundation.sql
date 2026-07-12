-- Create order item status enum
CREATE TYPE public.order_item_status AS ENUM ('pending', 'preparing', 'ready', 'served', 'cancelled');

-- Create preparation station enum
CREATE TYPE public.prep_station AS ENUM ('coffee', 'kitchen', 'other');

-- Add columns to menu_items
ALTER TABLE public.menu_items ADD COLUMN station public.prep_station NOT NULL DEFAULT 'kitchen';
ALTER TABLE public.menu_items ADD COLUMN base_prep_time_minutes INTEGER NOT NULL DEFAULT 5;

-- Add columns to order_items
ALTER TABLE public.order_items ADD COLUMN status public.order_item_status NOT NULL DEFAULT 'pending';
ALTER TABLE public.order_items ADD COLUMN prep_station public.prep_station NOT NULL DEFAULT 'kitchen';
ALTER TABLE public.order_items ADD COLUMN base_prep_time_minutes INTEGER NOT NULL DEFAULT 5;
ALTER TABLE public.order_items ADD COLUMN prep_started_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.order_items ADD COLUMN ready_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.order_items ADD COLUMN served_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.order_items ADD COLUMN predicted_duration_minutes INTEGER;
ALTER TABLE public.order_items ADD COLUMN actual_duration_minutes INTEGER;

-- Add ETA columns to orders
ALTER TABLE public.orders ADD COLUMN eta_timestamp TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.orders ADD COLUMN eta_calculated_at TIMESTAMP WITH TIME ZONE;

-- Backfill status and timestamps for existing order_items from parent orders
UPDATE public.order_items oi
SET 
  status = CASE o.status::text
    WHEN 'served' THEN 'served'::public.order_item_status
    WHEN 'ready' THEN 'ready'::public.order_item_status
    WHEN 'preparing' THEN 'preparing'::public.order_item_status
    WHEN 'cancelled' THEN 'cancelled'::public.order_item_status
    ELSE 'pending'::public.order_item_status
  END,
  prep_started_at = CASE 
    WHEN o.status::text IN ('preparing', 'ready', 'served') THEN o.created_at
    ELSE NULL
  END,
  ready_at = CASE 
    WHEN o.status::text IN ('ready', 'served') THEN o.updated_at
    ELSE NULL
  END,
  served_at = CASE 
    WHEN o.status::text = 'served' THEN o.updated_at
    ELSE NULL
  END
FROM public.orders o
WHERE oi.order_id = o.id;

-- Add performance indexes
CREATE INDEX idx_order_items_status ON public.order_items(status);
CREATE INDEX idx_menu_items_station ON public.menu_items(station);
