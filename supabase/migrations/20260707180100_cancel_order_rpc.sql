-- Allow customers to cancel their own order before staff has started preparing it
CREATE OR REPLACE FUNCTION public.cancel_order(p_order_id UUID, p_session_id TEXT)
RETURNS VOID AS $$
DECLARE
  v_status public.order_status;
  v_session_id TEXT;
BEGIN
  SELECT status, session_id INTO v_status, v_session_id
  FROM public.orders
  WHERE id = p_order_id;

  IF v_session_id IS NULL THEN
    RAISE EXCEPTION 'Order not found.';
  END IF;

  IF v_session_id IS DISTINCT FROM p_session_id THEN
    RAISE EXCEPTION 'This order does not belong to your session.';
  END IF;

  IF v_status IS DISTINCT FROM 'pending' THEN
    RAISE EXCEPTION 'This order can no longer be cancelled — preparation has already started.';
  END IF;

  UPDATE public.orders
  SET status = 'cancelled'
  WHERE id = p_order_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.cancel_order(UUID, TEXT) TO anon, authenticated;
