-- Create helper RPC for testing to update order status bypassing RLS
CREATE OR REPLACE FUNCTION public.test_update_order_status(p_order_id UUID, p_status TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE public.orders SET status = p_status::public.order_status WHERE id = p_order_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.test_update_order_status(UUID, TEXT) TO anon, authenticated;

-- Create helper RPC to simulate staff edit bypassing RLS
CREATE OR REPLACE FUNCTION public.test_simulate_staff_edit(p_order_id UUID, p_items JSONB, p_total INT)
RETURNS VOID AS $$
BEGIN
  -- Delete old items
  DELETE FROM public.order_items WHERE order_id = p_order_id;
  -- Insert new items
  INSERT INTO public.order_items (order_id, menu_item_id, name, price_cents, qty)
  SELECT p_order_id, (item->>'menu_item_id')::UUID, item->>'name', (item->>'price_cents')::INT, (item->>'qty')::INT
  FROM jsonb_array_elements(p_items) AS item;
  -- Update order
  UPDATE public.orders SET total_cents = p_total WHERE id = p_order_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.test_simulate_staff_edit(UUID, JSONB, INT) TO anon, authenticated;
