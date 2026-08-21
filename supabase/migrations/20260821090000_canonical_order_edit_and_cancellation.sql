-- Migration: 20260821090000_canonical_order_edit_and_cancellation.sql
-- Description: Milestone 1A — Database Foundation for Canonical Order Edit & Cancellation.
-- Enforces atomic order editing, authoritative menu item pricing, optimistic concurrency locking,
-- order audit events, and pending bill consistency for Counter and Staff consoles.

-- 1. Update order_events actor constraint to support 'counter' and 'owner'
ALTER TABLE public.order_events DROP CONSTRAINT IF EXISTS order_events_actor_check;
ALTER TABLE public.order_events ADD CONSTRAINT order_events_actor_check
  CHECK (actor IN ('customer', 'staff', 'counter', 'owner', 'system'));

-- 2. Atomic Order Edit RPC function
CREATE OR REPLACE FUNCTION public.edit_order_atomic(
  p_order_id UUID,
  p_items JSONB,
  p_note TEXT,
  p_actor TEXT,
  p_expected_version INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_session RECORD;
  v_current_version INTEGER;
  v_cafe_id UUID;
  v_dining_session_id UUID;
  v_order_status public.order_status;
  v_prev_items JSONB;
  v_item JSONB;
  v_menu_item RECORD;
  v_item_price INTEGER;
  v_new_total_cents INTEGER := 0;
  v_prev_subtotal_cents INTEGER := 0;
  v_delta_added JSONB := '[]'::jsonb;
  v_delta_removed JSONB := '[]'::jsonb;
  v_delta_modified JSONB := '[]'::jsonb;
  v_old_item RECORD;
  v_existing_ids UUID[] := ARRAY[]::UUID[];
  v_requires_amendment_kot BOOLEAN := false;
  v_paid_bill_exists BOOLEAN := false;
  v_pending_bill RECORD;
  v_calc_res RECORD;
BEGIN
  -- 1. Validate actor parameter
  IF p_actor NOT IN ('counter', 'staff', 'owner') THEN
    RAISE EXCEPTION 'Invalid actor "%". Allowed values: counter, staff, owner', p_actor;
  END IF;

  -- 2. Lock order row FOR UPDATE
  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF v_order.id IS NULL THEN
    RAISE EXCEPTION 'Order not found with ID: %', p_order_id;
  END IF;

  v_cafe_id := v_order.cafe_id;
  v_dining_session_id := v_order.dining_session_id;
  v_current_version := v_order.version;
  v_order_status := v_order.status;
  v_prev_subtotal_cents := v_order.total_cents;

  -- 3. Authorization check (Server-Side Role & Cafe Isolation)
  IF NOT (
    public.has_role(auth.uid(), 'owner', v_cafe_id) OR
    public.has_role(auth.uid(), 'counter', v_cafe_id) OR
    public.has_role(auth.uid(), 'staff', v_cafe_id) OR
    public.is_demo_admin(auth.uid())
  ) THEN
    RAISE EXCEPTION '403 Forbidden: Insufficient permissions to modify orders for this cafe.';
  END IF;

  -- 4. Check if dining session is closed
  IF v_dining_session_id IS NOT NULL THEN
    SELECT * INTO v_session
    FROM public.dining_sessions
    WHERE id = v_dining_session_id;

    IF v_session.status = 'closed' THEN
      RAISE EXCEPTION 'Cannot edit order: Dining session is already closed.';
    END IF;
  END IF;

  -- 5. Check if order or session has a PAID bill
  IF v_dining_session_id IS NOT NULL THEN
    SELECT EXISTS(
      SELECT 1 FROM public.bills
      WHERE (session_id = v_dining_session_id::text OR session_id = v_order.session_id)
        AND payment_status = 'PAID'
    ) INTO v_paid_bill_exists;
  ELSE
    SELECT EXISTS(
      SELECT 1 FROM public.bills
      WHERE session_id = v_order.session_id
        AND payment_status = 'PAID'
    ) INTO v_paid_bill_exists;
  END IF;

  IF v_paid_bill_exists OR v_order_status::text = 'paid' THEN
    RAISE EXCEPTION 'Cannot edit order: Order has already been paid and is immutable.';
  END IF;

  IF v_order_status = 'cancelled' THEN
    RAISE EXCEPTION 'Cannot edit order: Order is cancelled.';
  END IF;

  -- 6. Optimistic concurrency check
  IF v_current_version IS DISTINCT FROM p_expected_version THEN
    RAISE EXCEPTION 'CONFLICT: Order has been updated by another operator (expected version %, current version %). Please refresh and try again.', p_expected_version, v_current_version;
  END IF;

  -- 7. Validate items payload
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Cannot edit order: Item list cannot be empty.';
  END IF;

  -- Snapshot previous items before modifications
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', id,
    'menu_item_id', menu_item_id,
    'name', name,
    'price_cents', price_cents,
    'qty', qty,
    'note', note
  )), '[]'::jsonb) INTO v_prev_items
  FROM public.order_items
  WHERE order_id = p_order_id;

  -- 8. Validate items and enforce Authoritative Pricing
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    IF (v_item->>'qty')::INTEGER <= 0 THEN
      RAISE EXCEPTION 'Invalid item quantity: % for item "%"', v_item->>'qty', v_item->>'name';
    END IF;

    IF v_item->>'menu_item_id' IS NULL OR (v_item->>'menu_item_id') = '' THEN
      RAISE EXCEPTION 'menu_item_id is required for all order items.';
    END IF;

    -- Verify menu item exists and belongs to this cafe
    SELECT * INTO v_menu_item
    FROM public.menu_items
    WHERE id = (v_item->>'menu_item_id')::UUID AND cafe_id = v_cafe_id;

    IF v_menu_item.id IS NULL THEN
      RAISE EXCEPTION 'Menu item % not found or does not belong to this cafe.', v_item->>'menu_item_id';
    END IF;

    -- Check if item already exists in this order (preserves historical price)
    SELECT * INTO v_old_item
    FROM public.order_items
    WHERE order_id = p_order_id
      AND (
        (v_item->>'id' IS NOT NULL AND id = (v_item->>'id')::UUID) OR
        (menu_item_id = v_menu_item.id)
      )
    LIMIT 1;

    IF v_old_item.id IS NOT NULL THEN
      v_item_price := v_old_item.price_cents;
      v_existing_ids := array_append(v_existing_ids, v_old_item.id);

      -- Check for modified delta
      IF v_old_item.qty != (v_item->>'qty')::INTEGER OR COALESCE(v_old_item.note, '') != COALESCE(v_item->>'note', '') THEN
        v_delta_modified := v_delta_modified || jsonb_build_object(
          'menu_item_id', v_menu_item.id,
          'name', v_old_item.name,
          'old_qty', v_old_item.qty,
          'new_qty', (v_item->>'qty')::INTEGER,
          'old_note', v_old_item.note,
          'new_note', v_item->>'note',
          'price_cents', v_item_price
        );
      END IF;

      -- Update existing item
      UPDATE public.order_items
      SET 
        qty = (v_item->>'qty')::INTEGER,
        note = v_item->>'note',
        price_cents = v_item_price
      WHERE id = v_old_item.id;

    ELSE
      -- Authoritative price from public.menu_items for new items
      v_item_price := v_menu_item.price_cents;

      -- Add to delta added
      v_delta_added := v_delta_added || jsonb_build_object(
        'menu_item_id', v_menu_item.id,
        'name', v_menu_item.name,
        'qty', (v_item->>'qty')::INTEGER,
        'note', v_item->>'note',
        'price_cents', v_item_price
      );

      -- Insert new item
      INSERT INTO public.order_items (
        order_id,
        menu_item_id,
        name,
        price_cents,
        qty,
        note,
        prep_station,
        base_prep_time_minutes
      ) VALUES (
        p_order_id,
        v_menu_item.id,
        v_menu_item.name,
        v_item_price,
        (v_item->>'qty')::INTEGER,
        v_item->>'note',
        COALESCE(v_menu_item.prep_station, 'kitchen'::public.prep_station),
        COALESCE(v_menu_item.base_prep_time_minutes, 5)
      );
    END IF;

    v_new_total_cents := v_new_total_cents + (v_item_price * (v_item->>'qty')::INTEGER);
  END LOOP;

  -- Capture removed items
  FOR v_old_item IN 
    SELECT * FROM public.order_items 
    WHERE order_id = p_order_id AND id != ALL(v_existing_ids)
  LOOP
    v_delta_removed := v_delta_removed || jsonb_build_object(
      'menu_item_id', v_old_item.menu_item_id,
      'name', v_old_item.name,
      'qty', v_old_item.qty,
      'note', v_old_item.note,
      'price_cents', v_old_item.price_cents
    );
  END LOOP;

  -- Delete removed items
  DELETE FROM public.order_items
  WHERE order_id = p_order_id AND id != ALL(v_existing_ids);

  -- 9. Update orders row
  UPDATE public.orders
  SET
    total_cents = v_new_total_cents,
    note = p_note,
    version = v_current_version + 1,
    last_updated_by = p_actor,
    previous_items = v_prev_items,
    updated_at = now()
  WHERE id = p_order_id;

  -- 10. Determine if Amendment KOT is required
  v_requires_amendment_kot := (v_order_status IN ('preparing', 'ready', 'served'));

  -- 11. Handle Pending Bill if one exists for the session
  IF v_dining_session_id IS NOT NULL THEN
    SELECT * INTO v_pending_bill
    FROM public.bills
    WHERE (session_id = v_dining_session_id::text OR session_id = v_order.session_id)
      AND payment_status = 'PENDING'
    FOR UPDATE;

    IF v_pending_bill.id IS NOT NULL THEN
      -- Re-aggregate active items across all non-cancelled orders of this session
      DELETE FROM public.bill_items WHERE bill_id = v_pending_bill.id;

      INSERT INTO public.bill_items (
        bill_id, menu_item_id, item_name, category_name, quantity,
        unit_price, discount, tax, line_total, special_instructions
      )
      SELECT
        v_pending_bill.id,
        oi.menu_item_id::text,
        oi.name,
        COALESCE(mc.name, 'General'),
        SUM(oi.qty)::INTEGER,
        (oi.price_cents::NUMERIC / 100.0),
        0.00,
        0.00,
        (SUM(oi.qty * oi.price_cents)::NUMERIC / 100.0),
        string_agg(DISTINCT oi.note, '; ')
      FROM public.orders o
      JOIN public.order_items oi ON oi.order_id = o.id
      LEFT JOIN public.menu_items mi ON mi.id = oi.menu_item_id
      LEFT JOIN public.menu_categories mc ON mc.id = mi.category_id
      WHERE (o.dining_session_id = v_dining_session_id OR o.session_id = v_order.session_id)
        AND o.status != 'cancelled'
      GROUP BY oi.menu_item_id, oi.name, mc.name, oi.price_cents;

      -- Update bill header subtotal and totals
      SELECT 
        COALESCE(SUM(line_total), 0),
        COALESCE(SUM(quantity), 0)
      INTO v_calc_res
      FROM public.bill_items
      WHERE bill_id = v_pending_bill.id;

      UPDATE public.bills
      SET
        subtotal = v_calc_res.sum,
        total_items = v_calc_res.coalesce,
        grand_total = v_calc_res.sum - COALESCE(discount, 0) + COALESCE(service_charge, 0) + COALESCE(cgst, 0) + COALESCE(sgst, 0) + COALESCE(round_off, 0)
      WHERE id = v_pending_bill.id;
    END IF;
  END IF;

  -- 12. Record Audit Event
  INSERT INTO public.order_events (
    dining_session_id,
    order_id,
    event_type,
    title,
    actor,
    metadata
  ) VALUES (
    COALESCE(v_dining_session_id, gen_random_uuid()),
    p_order_id,
    'order_modified_' || p_actor,
    'Order modified by ' || p_actor || ' (Order #' || v_order.order_number || ')',
    p_actor,
    jsonb_build_object(
      'delta_items', jsonb_build_object('added', v_delta_added, 'removed', v_delta_removed, 'modified', v_delta_modified),
      'previous_subtotal', v_prev_subtotal_cents,
      'new_subtotal', v_new_total_cents,
      'previous_version', v_current_version,
      'new_version', v_current_version + 1,
      'actor', p_actor
    )
  );

  -- 13. Return JSON result
  RETURN jsonb_build_object(
    'success', true,
    'order_id', p_order_id,
    'previous_version', v_current_version,
    'new_version', v_current_version + 1,
    'previous_subtotal', v_prev_subtotal_cents,
    'new_subtotal', v_new_total_cents,
    'delta', jsonb_build_object('added', v_delta_added, 'removed', v_delta_removed, 'modified', v_delta_modified),
    'requires_amendment_kot', v_requires_amendment_kot
  );
END;
$$;

-- 3. Atomic Order Cancellation RPC function
CREATE OR REPLACE FUNCTION public.cancel_order_atomic(
  p_order_id UUID,
  p_reason TEXT,
  p_actor TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_session RECORD;
  v_cafe_id UUID;
  v_dining_session_id UUID;
  v_order_status public.order_status;
  v_paid_bill_exists BOOLEAN := false;
  v_requires_cancel_kot BOOLEAN := false;
  v_pending_bill RECORD;
  v_calc_res RECORD;
BEGIN
  -- 1. Validate actor parameter
  IF p_actor NOT IN ('counter', 'staff', 'owner') THEN
    RAISE EXCEPTION 'Invalid actor "%". Allowed values: counter, staff, owner', p_actor;
  END IF;

  -- 2. Lock order row FOR UPDATE
  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF v_order.id IS NULL THEN
    RAISE EXCEPTION 'Order not found with ID: %', p_order_id;
  END IF;

  v_cafe_id := v_order.cafe_id;
  v_dining_session_id := v_order.dining_session_id;
  v_order_status := v_order.status;

  -- 3. Authorization check
  IF NOT (
    public.has_role(auth.uid(), 'owner', v_cafe_id) OR
    public.has_role(auth.uid(), 'counter', v_cafe_id) OR
    public.has_role(auth.uid(), 'staff', v_cafe_id) OR
    public.is_demo_admin(auth.uid())
  ) THEN
    RAISE EXCEPTION '403 Forbidden: Insufficient permissions to cancel orders for this cafe.';
  END IF;

  -- 4. Check if dining session is closed
  IF v_dining_session_id IS NOT NULL THEN
    SELECT * INTO v_session
    FROM public.dining_sessions
    WHERE id = v_dining_session_id;

    IF v_session.status = 'closed' THEN
      RAISE EXCEPTION 'Cannot cancel order: Dining session is already closed.';
    END IF;
  END IF;

  -- 5. Check if order or session has a PAID bill
  IF v_dining_session_id IS NOT NULL THEN
    SELECT EXISTS(
      SELECT 1 FROM public.bills
      WHERE (session_id = v_dining_session_id::text OR session_id = v_order.session_id)
        AND payment_status = 'PAID'
    ) INTO v_paid_bill_exists;
  ELSE
    SELECT EXISTS(
      SELECT 1 FROM public.bills
      WHERE session_id = v_order.session_id
        AND payment_status = 'PAID'
    ) INTO v_paid_bill_exists;
  END IF;

  IF v_paid_bill_exists OR v_order_status::text = 'paid' THEN
    RAISE EXCEPTION 'Cannot cancel order: Order has already been paid and is immutable.';
  END IF;

  IF v_order_status = 'cancelled' THEN
    RETURN jsonb_build_object(
      'success', true,
      'order_id', p_order_id,
      'requires_cancel_kot', false,
      'status', 'cancelled',
      'already_cancelled', true
    );
  END IF;

  -- 6. Determine if Cancel KOT is required (only if order reached kitchen in preparing or ready status)
  v_requires_cancel_kot := (v_order_status IN ('preparing', 'ready'));

  -- 7. Update orders row
  UPDATE public.orders
  SET
    status = 'cancelled',
    last_updated_by = p_actor,
    updated_at = now()
  WHERE id = p_order_id;

  -- 8. Cascade status to items
  UPDATE public.order_items
  SET status = 'cancelled'
  WHERE order_id = p_order_id AND status != 'cancelled';

  -- 9. Handle Pending Bill if one exists for the session
  IF v_dining_session_id IS NOT NULL THEN
    SELECT * INTO v_pending_bill
    FROM public.bills
    WHERE (session_id = v_dining_session_id::text OR session_id = v_order.session_id)
      AND payment_status = 'PENDING'
    FOR UPDATE;

    IF v_pending_bill.id IS NOT NULL THEN
      -- Re-aggregate remaining active items
      DELETE FROM public.bill_items WHERE bill_id = v_pending_bill.id;

      INSERT INTO public.bill_items (
        bill_id, menu_item_id, item_name, category_name, quantity,
        unit_price, discount, tax, line_total, special_instructions
      )
      SELECT
        v_pending_bill.id,
        oi.menu_item_id::text,
        oi.name,
        COALESCE(mc.name, 'General'),
        SUM(oi.qty)::INTEGER,
        (oi.price_cents::NUMERIC / 100.0),
        0.00,
        0.00,
        (SUM(oi.qty * oi.price_cents)::NUMERIC / 100.0),
        string_agg(DISTINCT oi.note, '; ')
      FROM public.orders o
      JOIN public.order_items oi ON oi.order_id = o.id
      LEFT JOIN public.menu_items mi ON mi.id = oi.menu_item_id
      LEFT JOIN public.menu_categories mc ON mc.id = mi.category_id
      WHERE (o.dining_session_id = v_dining_session_id OR o.session_id = v_order.session_id)
        AND o.status != 'cancelled'
      GROUP BY oi.menu_item_id, oi.name, mc.name, oi.price_cents;

      -- Update bill header
      SELECT 
        COALESCE(SUM(line_total), 0),
        COALESCE(SUM(quantity), 0)
      INTO v_calc_res
      FROM public.bill_items
      WHERE bill_id = v_pending_bill.id;

      UPDATE public.bills
      SET
        subtotal = v_calc_res.sum,
        total_items = v_calc_res.coalesce,
        grand_total = v_calc_res.sum - COALESCE(discount, 0) + COALESCE(service_charge, 0) + COALESCE(cgst, 0) + COALESCE(sgst, 0) + COALESCE(round_off, 0)
      WHERE id = v_pending_bill.id;
    END IF;
  END IF;

  -- 10. Record Order Event
  INSERT INTO public.order_events (
    dining_session_id,
    order_id,
    event_type,
    title,
    actor,
    metadata
  ) VALUES (
    COALESCE(v_dining_session_id, gen_random_uuid()),
    p_order_id,
    'cancelled_' || p_actor,
    'Order cancelled by ' || p_actor || ' (Order #' || v_order.order_number || ')',
    p_actor,
    jsonb_build_object(
      'reason', COALESCE(p_reason, 'Cancelled by operator'),
      'cancelled_at', now(),
      'actor', p_actor
    )
  );

  -- 11. Return result
  RETURN jsonb_build_object(
    'success', true,
    'order_id', p_order_id,
    'requires_cancel_kot', v_requires_cancel_kot,
    'status', 'cancelled'
  );
END;
$$;

-- 4. Restrict execution privileges to authenticated users
GRANT EXECUTE ON FUNCTION public.edit_order_atomic(UUID, JSONB, TEXT, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_order_atomic(UUID, TEXT, TEXT) TO authenticated;
