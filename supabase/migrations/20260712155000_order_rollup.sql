-- Trigger to roll up item statuses to order status
CREATE OR REPLACE FUNCTION public.rollup_order_status()
RETURNS TRIGGER AS $$
DECLARE
  v_order_id UUID;
  v_total_count INT;
  v_cancelled_count INT;
  v_served_count INT;
  v_current_order_status public.order_status;
  v_new_order_status public.order_status;
BEGIN
  -- Get the order_id
  IF TG_OP = 'DELETE' THEN
    v_order_id := OLD.order_id;
  ELSE
    v_order_id := NEW.order_id;
  END IF;

  -- Count statuses
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'cancelled'),
    COUNT(*) FILTER (WHERE status = 'served')
  INTO 
    v_total_count,
    v_cancelled_count,
    v_served_count
  FROM public.order_items
  WHERE order_id = v_order_id;

  -- Get current order status
  SELECT status INTO v_current_order_status
  FROM public.orders
  WHERE id = v_order_id;

  -- Roll-up logic
  IF v_total_count = 0 THEN
    v_new_order_status := v_current_order_status;
  ELSIF v_cancelled_count = v_total_count THEN
    v_new_order_status := 'cancelled'::public.order_status;
  ELSIF v_served_count = (v_total_count - v_cancelled_count) THEN
    v_new_order_status := 'served'::public.order_status;
  ELSE
    -- Otherwise, order remains active. If it was served or cancelled, and now has active items,
    -- transition it back to preparing or pending. Otherwise, do not override its state.
    IF v_current_order_status = 'served' OR v_current_order_status = 'cancelled' THEN
      v_new_order_status := 'preparing'::public.order_status;
    ELSE
      v_new_order_status := v_current_order_status;
    END IF;
  END IF;

  -- Prevent duplicate updates
  IF v_new_order_status IS DISTINCT FROM v_current_order_status THEN
    UPDATE public.orders
    SET 
      status = v_new_order_status,
      updated_at = NOW(),
      last_updated_by = 'system'
    WHERE id = v_order_id;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trigger_rollup_order_status
AFTER INSERT OR UPDATE OF status OR DELETE ON public.order_items
FOR EACH ROW
EXECUTE FUNCTION public.rollup_order_status();

-- Trigger to cascade parent order status changes down to items (backward compatibility for direct order updates)
CREATE OR REPLACE FUNCTION public.cascade_order_status_to_items()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'served' THEN
    UPDATE public.order_items
    SET 
      status = 'served'::public.order_item_status,
      served_at = COALESCE(served_at, NOW()),
      ready_at = COALESCE(ready_at, NOW()),
      prep_started_at = COALESCE(prep_started_at, NOW())
    WHERE order_id = NEW.id AND status != 'served' AND status != 'cancelled';
  ELSIF NEW.status = 'cancelled' THEN
    UPDATE public.order_items
    SET status = 'cancelled'::public.order_item_status
    WHERE order_id = NEW.id AND status != 'cancelled';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trigger_cascade_order_status
AFTER UPDATE OF status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.cascade_order_status_to_items();
