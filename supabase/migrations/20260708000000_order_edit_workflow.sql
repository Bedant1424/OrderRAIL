-- Add columns to orders table to support edit workflow and optimistic concurrency checks
ALTER TABLE public.orders ADD COLUMN version INTEGER DEFAULT 1 NOT NULL;
ALTER TABLE public.orders ADD COLUMN last_updated_by TEXT DEFAULT 'customer' NOT NULL;
ALTER TABLE public.orders ADD COLUMN last_reviewed_version INTEGER DEFAULT 1 NOT NULL;
ALTER TABLE public.orders ADD COLUMN previous_items JSONB DEFAULT NULL;

-- Atomic transaction RPC function to update an order with concurrency check
CREATE OR REPLACE FUNCTION public.update_order(
  p_order_id UUID,
  p_session_id TEXT,
  p_expected_version INTEGER,
  p_note TEXT,
  p_total_cents INTEGER,
  p_items JSONB
)
RETURNS VOID AS $$
DECLARE
  v_status public.order_status;
  v_session_id TEXT;
  v_current_version INTEGER;
  v_prev_items JSONB;
  v_item JSONB;
BEGIN
  -- Lock row and get status / version
  SELECT status, session_id, version INTO v_status, v_session_id, v_current_version
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF v_session_id IS NULL THEN
    RAISE EXCEPTION 'Order not found.';
  END IF;

  IF v_session_id IS DISTINCT FROM p_session_id THEN
    RAISE EXCEPTION 'This order does not belong to your session.';
  END IF;

  IF v_status IS DISTINCT FROM 'pending' THEN
    RAISE EXCEPTION 'This order can no longer be updated — preparation has already started.';
  END IF;

  IF v_current_version IS DISTINCT FROM p_expected_version THEN
    RAISE EXCEPTION 'This order has been updated by another action. Your changes couldn''t be applied.';
  END IF;

  -- Snapshot current items before deleting them
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'menu_item_id', menu_item_id,
    'name', name,
    'price_cents', price_cents,
    'qty', qty
  )), '[]'::JSONB) INTO v_prev_items
  FROM public.order_items
  WHERE order_id = p_order_id;

  -- Update order record
  UPDATE public.orders
  SET 
    total_cents = p_total_cents,
    note = p_note,
    version = v_current_version + 1,
    last_updated_by = 'customer',
    previous_items = v_prev_items,
    updated_at = NOW()
  WHERE id = p_order_id;

  -- Replace order items
  DELETE FROM public.order_items
  WHERE order_id = p_order_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    INSERT INTO public.order_items (order_id, menu_item_id, name, price_cents, qty)
    VALUES (
      p_order_id, 
      (v_item->>'menu_item_id')::UUID, 
      v_item->>'name', 
      (v_item->>'price_cents')::INTEGER, 
      (v_item->>'qty')::INTEGER
    );
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.update_order(UUID, TEXT, INTEGER, TEXT, INTEGER, JSONB) TO anon, authenticated;

-- RPC function to review changes and catch up staff dashboard reviewed version
CREATE OR REPLACE FUNCTION public.review_order_changes(p_order_id UUID, p_version INTEGER)
RETURNS VOID AS $$
BEGIN
  UPDATE public.orders
  SET last_reviewed_version = p_version
  WHERE id = p_order_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.review_order_changes(UUID, INTEGER) TO anon, authenticated;
