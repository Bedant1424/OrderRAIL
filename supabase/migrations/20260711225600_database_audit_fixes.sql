-- RC1 Phase G: Database Audit Fixes
-- 1. Create missing indexes for foreign keys and query optimization to prevent sequential scans
-- 2. Restrict search_path for SECURITY DEFINER and trigger functions to prevent privilege escalation

-- ==========================================
-- Performance Indexes
-- ==========================================

-- profiles
CREATE INDEX IF NOT EXISTS idx_profiles_cafe_id ON public.profiles(cafe_id);

-- user_roles
CREATE INDEX IF NOT EXISTS idx_user_roles_cafe_id ON public.user_roles(cafe_id);

-- tables
CREATE INDEX IF NOT EXISTS idx_tables_cafe_id ON public.tables(cafe_id);

-- menu_categories
CREATE INDEX IF NOT EXISTS idx_menu_categories_cafe_id ON public.menu_categories(cafe_id);

-- menu_items
CREATE INDEX IF NOT EXISTS idx_menu_items_cafe_id ON public.menu_items(cafe_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_category_id ON public.menu_items(category_id);

-- dining_sessions
CREATE INDEX IF NOT EXISTS idx_dining_sessions_table_id ON public.dining_sessions(table_id);

-- orders
CREATE INDEX IF NOT EXISTS idx_orders_cafe_id ON public.orders(cafe_id);
CREATE INDEX IF NOT EXISTS idx_orders_table_id ON public.orders(table_id);
CREATE INDEX IF NOT EXISTS idx_orders_dining_session_id ON public.orders(dining_session_id);
CREATE INDEX IF NOT EXISTS idx_orders_session_id ON public.orders(session_id);

-- order_items
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_menu_item_id ON public.order_items(menu_item_id);

-- service_requests
CREATE INDEX IF NOT EXISTS idx_service_requests_cafe_id ON public.service_requests(cafe_id);
CREATE INDEX IF NOT EXISTS idx_service_requests_table_id ON public.service_requests(table_id);
CREATE INDEX IF NOT EXISTS idx_service_requests_dining_session_id ON public.service_requests(dining_session_id);

-- order_events
CREATE INDEX IF NOT EXISTS idx_order_events_dining_session_id ON public.order_events(dining_session_id);
CREATE INDEX IF NOT EXISTS idx_order_events_order_id ON public.order_events(order_id);
CREATE INDEX IF NOT EXISTS idx_order_events_service_request_id ON public.order_events(service_request_id);
CREATE INDEX IF NOT EXISTS idx_order_events_timeline ON public.order_events(dining_session_id, created_at DESC);

-- ==========================================
-- Security search_path hardening
-- ==========================================

-- cleanup_expired_browsing_sessions
CREATE OR REPLACE FUNCTION public.cleanup_expired_browsing_sessions()
RETURNS VOID AS $$
BEGIN
  -- Set table's active_session_id to NULL if its active session is browsing and older than 15 minutes
  UPDATE public.tables
  SET active_session_id = NULL,
      status = 'free'
  WHERE active_session_id IN (
    SELECT id FROM public.dining_sessions
    WHERE status = 'browsing'
      AND opened_at < now() - INTERVAL '15 minutes'
  );

  -- Close those browsing sessions
  UPDATE public.dining_sessions
  SET status = 'closed',
      closed_at = now()
  WHERE status = 'browsing'
    AND opened_at < now() - INTERVAL '15 minutes';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- free_table
CREATE OR REPLACE FUNCTION public.free_table(p_table_id UUID, p_staff_id UUID DEFAULT NULL)
RETURNS VOID AS $$
DECLARE
  v_active_session_id UUID;
  v_total_amount INT;
BEGIN
  -- Get active session
  SELECT active_session_id INTO v_active_session_id
  FROM public.tables
  WHERE id = p_table_id;

  IF v_active_session_id IS NULL THEN
    RAISE EXCEPTION 'Table is not currently occupied.';
  END IF;

  -- Check for active orders
  IF EXISTS (
    SELECT 1 FROM public.orders
    WHERE dining_session_id = v_active_session_id
      AND status IN ('pending', 'preparing', 'ready')
  ) THEN
    RAISE EXCEPTION 'Cannot mark table free: there are active orders in the current dining session.';
  END IF;

  -- Calculate total amount
  SELECT COALESCE(SUM(total_cents), 0) INTO v_total_amount
  FROM public.orders
  WHERE dining_session_id = v_active_session_id;

  -- Auto-resolve all open or acknowledged service requests associated with this dining session
  UPDATE public.service_requests
  SET status = 'resolved',
      updated_at = now()
  WHERE dining_session_id = v_active_session_id
    AND status IN ('open', 'acknowledged');

  -- Close the dining session
  UPDATE public.dining_sessions
  SET status = 'closed',
      closed_at = now(),
      closed_by_staff_id = p_staff_id,
      total_amount = v_total_amount
  WHERE id = v_active_session_id;

  -- Mark table free
  UPDATE public.tables
  SET active_session_id = NULL,
      status = 'free'
  WHERE id = p_table_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- check_table_can_be_freed
CREATE OR REPLACE FUNCTION public.check_table_can_be_freed()
RETURNS TRIGGER AS $$
BEGIN
  -- If active_session_id is transitioning to NULL (marking table free)
  IF OLD.active_session_id IS NOT NULL AND NEW.active_session_id IS NULL THEN
    -- Check if there are active orders for this session
    IF EXISTS (
      SELECT 1 FROM public.orders
      WHERE dining_session_id = OLD.active_session_id
        AND status IN ('pending', 'preparing', 'ready')
    ) THEN
      RAISE EXCEPTION 'Cannot mark table free: there are active orders in the current dining session.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;
