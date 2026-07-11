-- Auto-acknowledge pending changes when an order is completed or cancelled
CREATE OR REPLACE FUNCTION public.fn_auto_acknowledge_order_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF (NEW.status = 'served' OR NEW.status = 'cancelled') AND NEW.last_reviewed_version < NEW.version THEN
    NEW.last_reviewed_version := NEW.version;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_auto_acknowledge_order_changes ON public.orders;
CREATE TRIGGER trg_auto_acknowledge_order_changes
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_auto_acknowledge_order_changes();

-- Update order logging trigger to log specific new event types and titles
CREATE OR REPLACE FUNCTION public.fn_log_order_events()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.dining_session_id IS NOT NULL THEN
      INSERT INTO public.order_events (dining_session_id, order_id, event_type, title, actor)
      VALUES (
        NEW.dining_session_id,
        NEW.id,
        'order_placed',
        'Order placed (Order #' || NEW.order_number || ')',
        'customer'
      );
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.dining_session_id IS NOT NULL THEN
      -- Customer updated order
      IF OLD.version IS DISTINCT FROM NEW.version AND NEW.last_updated_by = 'customer' THEN
        INSERT INTO public.order_events (dining_session_id, order_id, event_type, title, actor)
        VALUES (
          NEW.dining_session_id,
          NEW.id,
          'order_modified_customer',
          'Customer updated order (Order #' || NEW.order_number || ')',
          'customer'
        );
      END IF;

      -- Staff acknowledged changes vs Automatic acknowledgement
      IF OLD.last_reviewed_version IS DISTINCT FROM NEW.last_reviewed_version THEN
        IF NEW.status = 'served' OR NEW.status = 'cancelled' THEN
          INSERT INTO public.order_events (dining_session_id, order_id, event_type, title, actor)
          VALUES (
            NEW.dining_session_id,
            NEW.id,
            'automatic_acknowledgement',
            'Changes automatically acknowledged on completion (Order #' || NEW.order_number || ')',
            'system'
          );
        ELSE
          INSERT INTO public.order_events (dining_session_id, order_id, event_type, title, actor)
          VALUES (
            NEW.dining_session_id,
            NEW.id,
            'staff_acknowledged_changes',
            'Staff acknowledged changes (Order #' || NEW.order_number || ')',
            'staff'
          );
        END IF;
      END IF;

      -- Started preparing
      IF OLD.status = 'pending' AND NEW.status = 'preparing' THEN
        INSERT INTO public.order_events (dining_session_id, order_id, event_type, title, actor)
        VALUES (
          NEW.dining_session_id,
          NEW.id,
          'started_preparing',
          'Started preparing (Order #' || NEW.order_number || ')',
          'staff'
        );
      -- Marked ready
      ELSIF OLD.status = 'preparing' AND NEW.status = 'ready' THEN
        INSERT INTO public.order_events (dining_session_id, order_id, event_type, title, actor)
        VALUES (
          NEW.dining_session_id,
          NEW.id,
          'marked_ready',
          'Marked ready (Order #' || NEW.order_number || ')',
          'staff'
        );
      -- Marked served
      ELSIF OLD.status = 'ready' AND NEW.status = 'served' THEN
        INSERT INTO public.order_events (dining_session_id, order_id, event_type, title, actor)
        VALUES (
          NEW.dining_session_id,
          NEW.id,
          'marked_served',
          'Marked served (Order #' || NEW.order_number || ')',
          'staff'
        );
      -- Cancelled
      ELSIF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'cancelled' THEN
        IF NEW.last_updated_by = 'staff' THEN
          INSERT INTO public.order_events (dining_session_id, order_id, event_type, title, actor)
          VALUES (
            NEW.dining_session_id,
            NEW.id,
            'cancelled_staff',
            'Cancelled by staff (Order #' || NEW.order_number || ')',
            'staff'
          );
        ELSE
          INSERT INTO public.order_events (dining_session_id, order_id, event_type, title, actor)
          VALUES (
            NEW.dining_session_id,
            NEW.id,
            'cancelled_customer',
            'Cancelled by customer (Order #' || NEW.order_number || ')',
            'customer'
          );
        END IF;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
