-- Trigger function to log order item status changes to order_events
CREATE OR REPLACE FUNCTION public.fn_log_order_item_events()
RETURNS TRIGGER AS $$
DECLARE
  v_dining_session_id UUID;
  v_actor TEXT;
  v_event_type TEXT;
  v_title TEXT;
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    SELECT dining_session_id INTO v_dining_session_id
    FROM public.orders
    WHERE id = NEW.order_id;

    IF v_dining_session_id IS NOT NULL THEN
      IF NEW.status = 'preparing' THEN
        v_event_type := 'item_preparing';
        v_title := NEW.qty || 'x ' || NEW.name || ' status changed to Preparing';
        v_actor := 'staff';
      ELSIF NEW.status = 'ready' THEN
        v_event_type := 'item_ready';
        v_title := NEW.qty || 'x ' || NEW.name || ' is Ready';
        v_actor := 'staff';
      ELSIF NEW.status = 'served' THEN
        v_event_type := 'item_served';
        v_title := NEW.qty || 'x ' || NEW.name || ' Served';
        v_actor := 'staff';
      END IF;

      IF v_event_type IS NOT NULL THEN
        -- Prevent duplicate identical events for the same order_item
        IF NOT EXISTS (
          SELECT 1 FROM public.order_events
          WHERE order_id = NEW.order_id
            AND event_type = v_event_type
            AND metadata->>'order_item_id' = NEW.id::text
            AND created_at >= NOW() - INTERVAL '1 second'
        ) THEN
          INSERT INTO public.order_events (
            dining_session_id, 
            order_id, 
            event_type, 
            title, 
            actor,
            metadata
          )
          VALUES (
            v_dining_session_id,
            NEW.order_id,
            v_event_type,
            v_title,
            v_actor,
            jsonb_build_object('order_item_id', NEW.id, 'item_name', NEW.name, 'qty', NEW.qty)
          );
        END IF;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE TRIGGER trigger_log_order_item_events
AFTER UPDATE OF status ON public.order_items
FOR EACH ROW
EXECUTE FUNCTION public.fn_log_order_item_events();
