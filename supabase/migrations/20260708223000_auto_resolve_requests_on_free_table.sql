-- Update free_table function to auto-resolve active service requests for the dining session
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

  -- Auto-resolve all open or acknowledged service requests associated with this session
  UPDATE public.service_requests
  SET status = 'resolved',
      updated_at = now()
  WHERE session_id = v_active_session_id
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.free_table(UUID, UUID) TO anon, authenticated;
