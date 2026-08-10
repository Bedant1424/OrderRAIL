-- Migration: Cheese Corner Fresh Operations Data Cleanup
-- Description: Wipes historical test/demo order data, dining sessions, and event logs for Cheese Corner while preserving all master configuration, tables, menu catalog, and user profiles.
-- Date: 2026-08-10

DO $$
DECLARE
  v_cafe_id UUID;
  v_cafes_count INT;
  v_tables_count INT;
  v_menu_categories_count INT;
  v_menu_items_count INT;
  v_remaining_orders INT;
  v_remaining_sessions INT;
  v_remaining_guests INT;
  v_occupied_tables INT;
BEGIN
  -- 1. Resolve and verify Cheese Corner Cafe ID exactly once
  SELECT COUNT(*), MIN(id) INTO v_cafes_count, v_cafe_id
  FROM public.cafes
  WHERE slug = 'cheesecorner';

  IF v_cafes_count <> 1 OR v_cafe_id IS NULL THEN
    RAISE EXCEPTION 'SAFETY ABORT: Expected exactly 1 cafe for slug cheesecorner, found %', v_cafes_count;
  END IF;

  RAISE NOTICE 'Targeting Cheese Corner Cafe ID: %', v_cafe_id;

  -- 2. Delete dependent timeline and audit events
  DELETE FROM public.order_events
  WHERE order_id IN (SELECT id FROM public.orders WHERE cafe_id = v_cafe_id)
     OR dining_session_id IN (SELECT id FROM public.dining_sessions WHERE table_id IN (SELECT id FROM public.tables WHERE cafe_id = v_cafe_id));

  -- 3. Delete service requests
  DELETE FROM public.service_requests
  WHERE cafe_id = v_cafe_id;

  -- 4. Delete order line items and orders
  DELETE FROM public.order_items
  WHERE order_id IN (SELECT id FROM public.orders WHERE cafe_id = v_cafe_id);

  DELETE FROM public.orders
  WHERE cafe_id = v_cafe_id;

  -- 5. Delete guest sessions and dining sessions
  DELETE FROM public.guest_sessions
  WHERE dining_session_id IN (SELECT id FROM public.dining_sessions WHERE table_id IN (SELECT id FROM public.tables WHERE cafe_id = v_cafe_id));

  DELETE FROM public.dining_sessions
  WHERE table_id IN (SELECT id FROM public.tables WHERE cafe_id = v_cafe_id);

  -- 6. Disassociate active sessions from tables and reset status to 'free'
  UPDATE public.tables
  SET active_session_id = NULL,
      status = 'free'
  WHERE cafe_id = v_cafe_id;

  -- 7. Delete snapshot bills and bill items (if any exist)
  DELETE FROM public.bill_items
  WHERE bill_id IN (SELECT id FROM public.bills WHERE cafe_id = v_cafe_id::text);

  DELETE FROM public.bills
  WHERE cafe_id = v_cafe_id::text;

  -- 8. Delete reviews (if any exist)
  DELETE FROM public.reviews
  WHERE cafe_id = v_cafe_id;

  -- 9. Reset Cheese Corner daily order and invoice counters ONLY
  DELETE FROM public.cafe_daily_order_counters
  WHERE cafe_id = v_cafe_id;

  DELETE FROM public.cafe_invoice_counters
  WHERE cafe_id = v_cafe_id;

  -- 10. POST-EXECUTION SAFETY ASSERTIONS
  SELECT COUNT(*) INTO v_tables_count FROM public.tables WHERE cafe_id = v_cafe_id;
  SELECT COUNT(*) INTO v_menu_categories_count FROM public.menu_categories WHERE cafe_id = v_cafe_id;
  SELECT COUNT(*) INTO v_menu_items_count FROM public.menu_items WHERE cafe_id = v_cafe_id;
  SELECT COUNT(*) INTO v_remaining_orders FROM public.orders WHERE cafe_id = v_cafe_id;
  SELECT COUNT(*) INTO v_remaining_sessions FROM public.dining_sessions WHERE table_id IN (SELECT id FROM public.tables WHERE cafe_id = v_cafe_id);
  SELECT COUNT(*) INTO v_remaining_guests FROM public.guest_sessions WHERE dining_session_id IN (SELECT id FROM public.dining_sessions WHERE table_id IN (SELECT id FROM public.tables WHERE cafe_id = v_cafe_id));
  SELECT COUNT(*) INTO v_occupied_tables FROM public.tables WHERE cafe_id = v_cafe_id AND (active_session_id IS NOT NULL OR status <> 'free');

  RAISE NOTICE 'Preserved Master Records -> Tables: % | Menu Categories: % | Menu Items: %', v_tables_count, v_menu_categories_count, v_menu_items_count;
  RAISE NOTICE 'Remaining Transactional Records -> Orders: % | Sessions: % | Guests: % | Occupied Tables: %', v_remaining_orders, v_remaining_sessions, v_remaining_guests, v_occupied_tables;

  IF v_tables_count <> 5 OR v_menu_categories_count <> 16 OR v_menu_items_count <> 92 THEN
    RAISE EXCEPTION 'SAFETY ABORT: Master configuration data count mismatch!';
  END IF;

  IF v_remaining_orders > 0 OR v_remaining_sessions > 0 OR v_remaining_guests > 0 OR v_occupied_tables > 0 THEN
    RAISE EXCEPTION 'SAFETY ABORT: Transactional cleanup incomplete or table session state not reset!';
  END IF;

END $$;
