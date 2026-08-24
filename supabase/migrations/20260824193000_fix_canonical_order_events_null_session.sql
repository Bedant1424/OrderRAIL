-- ============================================================================
-- Migration: 20260824193000_fix_canonical_order_events_null_session.sql
-- Description: Targeted RPC fix for canonical order operations with NULL dining_session_id
--
-- Fixes foreign key violation (23503) on order_events_dining_session_id_fkey by
-- removing synthetic gen_random_uuid() fallback and checking IF dining_session_id IS NOT NULL
-- before inserting to public.order_events across:
-- 1. public.edit_order_atomic
-- 2. public.cancel_order_atomic
-- 3. public.record_initial_kot_fired_atomic
-- 4. public.record_kot_reprint_atomic
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Atomic Order Edit RPC function
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.edit_order_atomic(
  p_order_id UUID,
  p_items JSONB,
  p_reason TEXT,
  p_actor TEXT,
  p_expected_version INTEGER DEFAULT NULL
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
  v_current_version INTEGER;
  v_order_status public.order_status;
  v_item JSONB;
  v_item_id UUID;
  v_menu_item_id UUID;
  v_name TEXT;
  v_price_cents INTEGER;
  v_qty INTEGER;
  v_note TEXT;
  v_new_total_cents INTEGER := 0;
  v_prev_subtotal_cents INTEGER := 0;
  v_paid_bill_exists BOOLEAN := false;
  v_requires_amendment_kot BOOLEAN := false;
  v_amendment_number INTEGER := NULL;
  v_amendment_code TEXT := NULL;
  v_existing_items JSONB;
  v_delta_added JSONB := '[]'::jsonb;
  v_delta_removed JSONB := '[]'::jsonb;
  v_delta_modified JSONB := '[]'::jsonb;
  v_pending_bill RECORD;
  v_calc_res RECORD;
BEGIN
  -- 1. Validate actor parameter
  IF p_actor NOT IN ('counter', 'staff', 'owner') THEN
    RAISE EXCEPTION 'Invalid actor "%". Allowed values: counter, staff, owner', p_actor;
  END IF;

  -- 2. Lock order row FOR UPDATE to prevent race conditions
  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF v_order.id IS NULL THEN
    RAISE EXCEPTION 'Order not found with ID: %', p_order_id;
  END IF;

  v_cafe_id := v_order.cafe_id;
  v_dining_session_id := v_order.dining_session_id;
  v_current_version := COALESCE(v_order.version, 1);
  v_order_status := v_order.status;

  -- 3. Authorization check
  IF NOT (
    public.has_role(auth.uid(), 'owner', v_cafe_id) OR
    public.has_role(auth.uid(), 'counter', v_cafe_id) OR
    public.has_role(auth.uid(), 'staff', v_cafe_id) OR
    public.is_demo_admin(auth.uid())
  ) THEN
    RAISE EXCEPTION '403 Forbidden: Insufficient permissions to edit orders for this cafe.';
  END IF;

  -- 4. Optimistic concurrency control check
  IF p_expected_version IS NOT NULL AND v_current_version != p_expected_version THEN
    RAISE EXCEPTION 'Concurrency conflict: Order version is % but expected %. Please refresh and retry.',
      v_current_version, p_expected_version;
  END IF;

  -- 5. Status validations
  IF v_order_status = 'cancelled' THEN
    RAISE EXCEPTION 'Cannot edit order: Order is already cancelled.';
  END IF;

  IF v_order_status = 'served' THEN
    RAISE EXCEPTION 'Cannot edit order: Order is already served.';
  END IF;

  -- 6. Check if dining session is closed
  IF v_dining_session_id IS NOT NULL THEN
    SELECT * INTO v_session
    FROM public.dining_sessions
    WHERE id = v_dining_session_id;

    IF v_session.status = 'closed' THEN
      RAISE EXCEPTION 'Cannot edit order: Dining session is already closed.';
    END IF;
  END IF;

  -- 7. Check if order or session has a PAID bill
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

  -- Capture previous subtotal
  SELECT COALESCE(SUM(price_cents * qty), 0) INTO v_prev_subtotal_cents
  FROM public.order_items
  WHERE order_id = p_order_id AND status != 'cancelled';

  -- 8. Compute Delta against existing items
  SELECT jsonb_agg(jsonb_build_object(
    'id', id,
    'menu_item_id', menu_item_id,
    'name', name,
    'price_cents', price_cents,
    'qty', qty,
    'note', note,
    'status', status
  )) INTO v_existing_items
  FROM public.order_items
  WHERE order_id = p_order_id AND status != 'cancelled';

  v_existing_items := COALESCE(v_existing_items, '[]'::jsonb);

  -- 9. Replace / Upsert order items
  DELETE FROM public.order_items WHERE order_id = p_order_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_item_id := COALESCE((v_item->>'id')::UUID, gen_random_uuid());
    v_menu_item_id := (v_item->>'menu_item_id')::UUID;
    v_name := v_item->>'name';
    v_price_cents := (v_item->>'price_cents')::INTEGER;
    v_qty := (v_item->>'qty')::INTEGER;
    v_note := v_item->>'note';

    IF v_qty > 0 THEN
      INSERT INTO public.order_items (
        id,
        order_id,
        menu_item_id,
        name,
        price_cents,
        qty,
        note,
        status
      ) VALUES (
        v_item_id,
        p_order_id,
        v_menu_item_id,
        v_name,
        v_price_cents,
        v_qty,
        v_note,
        'pending'
      );

      v_new_total_cents := v_new_total_cents + (v_price_cents * v_qty);
    END IF;
  END LOOP;

  -- 10. Update parent order record
  IF v_order.kot_fired_at IS NOT NULL THEN
    v_requires_amendment_kot := true;
    v_amendment_number := COALESCE(v_order.amendment_count, 0) + 1;
    v_amendment_code := 'M' || v_amendment_number;

    UPDATE public.orders
    SET
      version = v_current_version + 1,
      total_cents = v_new_total_cents,
      last_updated_by = p_actor,
      last_reviewed_version = v_current_version + 1,
      amendment_count = v_amendment_number,
      updated_at = now()
    WHERE id = p_order_id;
  ELSE
    v_requires_amendment_kot := false;
    v_amendment_number := NULL;
    v_amendment_code := NULL;

    UPDATE public.orders
    SET
      version = v_current_version + 1,
      total_cents = v_new_total_cents,
      last_updated_by = p_actor,
      last_reviewed_version = v_current_version + 1,
      updated_at = now()
    WHERE id = p_order_id;
  END IF;

  -- 11. Handle Pending Bill Recalculation if one exists
  IF v_dining_session_id IS NOT NULL THEN
    SELECT * INTO v_pending_bill
    FROM public.bills
    WHERE (session_id = v_dining_session_id::text OR session_id = v_order.session_id)
      AND payment_status = 'PENDING'
    FOR UPDATE;

    IF v_pending_bill.id IS NOT NULL THEN
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

  -- 12. Record Order Event (only for table orders associated with a dining session)
  IF v_dining_session_id IS NOT NULL THEN
    INSERT INTO public.order_events (
      dining_session_id,
      order_id,
      event_type,
      title,
      actor,
      metadata
    ) VALUES (
      v_dining_session_id,
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
        'initial_kot_version', v_order.initial_kot_version,
        'amendment_number', v_amendment_number,
        'amendment_code', v_amendment_code,
        'actor', p_actor
      )
    );
  END IF;

  -- 13. Return JSON result
  RETURN jsonb_build_object(
    'success', true,
    'order_id', p_order_id,
    'previous_version', v_current_version,
    'new_version', v_current_version + 1,
    'initial_kot_version', v_order.initial_kot_version,
    'previous_subtotal', v_prev_subtotal_cents,
    'new_subtotal', v_new_total_cents,
    'delta', jsonb_build_object('added', v_delta_added, 'removed', v_delta_removed, 'modified', v_delta_modified),
    'requires_amendment_kot', v_requires_amendment_kot,
    'amendment_number', v_amendment_number,
    'amendment_code', v_amendment_code
  );
END;
$$;


-- ----------------------------------------------------------------------------
-- 2. Atomic Order Cancellation RPC function
-- ----------------------------------------------------------------------------
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

  -- 6. Determine if Cancel KOT is required (only if initial KOT was fired and not already served)
  v_requires_cancel_kot := (v_order.kot_fired_at IS NOT NULL AND v_order_status != 'served');

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

  -- 10. Record Order Event (only for table orders associated with a dining session)
  IF v_dining_session_id IS NOT NULL THEN
    INSERT INTO public.order_events (
      dining_session_id,
      order_id,
      event_type,
      title,
      actor,
      metadata
    ) VALUES (
      v_dining_session_id,
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
  END IF;

  -- 11. Return result
  RETURN jsonb_build_object(
    'success', true,
    'order_id', p_order_id,
    'requires_cancel_kot', v_requires_cancel_kot,
    'status', 'cancelled'
  );
END;
$$;


-- ----------------------------------------------------------------------------
-- 3. Atomic Record Initial KOT Fired RPC function (Idempotent)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_initial_kot_fired_atomic(
  p_order_id UUID,
  p_actor TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_cafe_id UUID;
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

  -- 3. Authorization check
  IF NOT (
    public.has_role(auth.uid(), 'owner', v_cafe_id) OR
    public.has_role(auth.uid(), 'counter', v_cafe_id) OR
    public.has_role(auth.uid(), 'staff', v_cafe_id) OR
    public.is_demo_admin(auth.uid())
  ) THEN
    RAISE EXCEPTION '403 Forbidden: Insufficient permissions to record KOT for this cafe.';
  END IF;

  -- 4. Idempotency check: If already fired, return existing state
  IF v_order.kot_fired_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_fired', true,
      'order_id', p_order_id,
      'order_number', v_order.order_number,
      'initial_kot_version', v_order.initial_kot_version,
      'kot_fired_at', v_order.kot_fired_at
    );
  END IF;

  -- 5. Mark initial KOT fired at current version
  UPDATE public.orders
  SET
    kot_fired_at = now(),
    initial_kot_version = version,
    last_updated_by = p_actor,
    updated_at = now()
  WHERE id = p_order_id;

  -- 6. Insert audit event into order_events (only if dining_session_id is non-null)
  IF v_order.dining_session_id IS NOT NULL THEN
    INSERT INTO public.order_events (
      dining_session_id,
      order_id,
      event_type,
      title,
      actor,
      metadata
    ) VALUES (
      v_order.dining_session_id,
      p_order_id,
      'kot_fired',
      'Initial KOT fired (Order #' || v_order.order_number || ')',
      p_actor,
      jsonb_build_object(
        'order_number', v_order.order_number,
        'initial_kot_version', v_order.version,
        'fired_at', now(),
        'actor', p_actor
      )
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'already_fired', false,
    'order_id', p_order_id,
    'order_number', v_order.order_number,
    'initial_kot_version', v_order.version,
    'kot_fired_at', now()
  );
END;
$$;


-- ----------------------------------------------------------------------------
-- 4. Atomic KOT Reprint Sequential Allocation RPC function
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_kot_reprint_atomic(
  p_order_id UUID,
  p_actor TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_cafe_id UUID;
  v_reprint_count INTEGER;
BEGIN
  -- 1. Validate actor parameter
  IF p_actor NOT IN ('counter', 'staff', 'owner') THEN
    RAISE EXCEPTION 'Invalid actor "%". Allowed values: counter, staff, owner', p_actor;
  END IF;

  -- 2. Lock parent order row FOR UPDATE to serialize concurrent reprint requests
  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF v_order.id IS NULL THEN
    RAISE EXCEPTION 'Order not found with ID: %', p_order_id;
  END IF;

  v_cafe_id := v_order.cafe_id;

  -- 3. Authorization check
  IF NOT (
    public.has_role(auth.uid(), 'owner', v_cafe_id) OR
    public.has_role(auth.uid(), 'counter', v_cafe_id) OR
    public.has_role(auth.uid(), 'staff', v_cafe_id) OR
    public.is_demo_admin(auth.uid())
  ) THEN
    RAISE EXCEPTION '403 Forbidden: Insufficient permissions to reprint KOT for this cafe.';
  END IF;

  -- 4. Count existing reprint events inside the locked transaction
  SELECT COUNT(*) INTO v_reprint_count
  FROM public.order_events
  WHERE order_id = p_order_id AND event_type = 'kot_reprinted';

  v_reprint_count := v_reprint_count + 1;

  -- 5. Atomically insert reprint audit event (only if dining_session_id is non-null)
  IF v_order.dining_session_id IS NOT NULL THEN
    INSERT INTO public.order_events (
      dining_session_id,
      order_id,
      event_type,
      title,
      actor,
      metadata
    ) VALUES (
      v_order.dining_session_id,
      p_order_id,
      'kot_reprinted',
      'KOT reprinted (#' || v_order.order_number || '-R' || v_reprint_count || ')',
      p_actor,
      jsonb_build_object(
        'reprint_number', v_reprint_count,
        'reprint_code', 'R' || v_reprint_count,
        'order_number', v_order.order_number,
        'reprinted_at', now(),
        'actor', p_actor
      )
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'order_id', p_order_id,
    'order_number', v_order.order_number,
    'reprint_number', v_reprint_count,
    'reprint_code', 'R' || v_reprint_count
  );
END;
$$;


-- ----------------------------------------------------------------------------
-- 5. Restrict execution privileges to authenticated users
-- ----------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.edit_order_atomic(UUID, JSONB, TEXT, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_order_atomic(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_initial_kot_fired_atomic(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_kot_reprint_atomic(UUID, TEXT) TO authenticated;
