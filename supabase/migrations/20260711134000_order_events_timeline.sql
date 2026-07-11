-- Create order_events table to track complete order history timeline
CREATE TABLE IF NOT EXISTS public.order_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dining_session_id UUID NOT NULL REFERENCES public.dining_sessions(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  service_request_id UUID REFERENCES public.service_requests(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  title TEXT NOT NULL,
  actor TEXT NOT NULL CHECK (actor IN ('customer', 'staff', 'system')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.order_events ENABLE ROW LEVEL SECURITY;

-- Allow public read and write access
CREATE POLICY "order_events public read" ON public.order_events FOR SELECT USING (true);
CREATE POLICY "order_events public insert" ON public.order_events FOR INSERT WITH CHECK (true);
CREATE POLICY "order_events public update" ON public.order_events FOR UPDATE USING (true);
CREATE POLICY "order_events public delete" ON public.order_events FOR DELETE USING (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_events TO anon, authenticated;
GRANT ALL ON public.order_events TO service_role;

-- Log trigger function for dining_sessions
CREATE OR REPLACE FUNCTION public.fn_log_dining_session_events()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.order_events (dining_session_id, event_type, title, actor)
    VALUES (NEW.id, 'dining_session_started', 'Dining session started', 'customer');
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'closed' THEN
      INSERT INTO public.order_events (dining_session_id, event_type, title, actor)
      VALUES (NEW.id, 'dining_session_ended', 'Dining session ended', 'staff');
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Log trigger function for orders
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
      -- Customer modified order
      IF OLD.version IS DISTINCT FROM NEW.version AND NEW.last_updated_by = 'customer' THEN
        INSERT INTO public.order_events (dining_session_id, order_id, event_type, title, actor)
        VALUES (
          NEW.dining_session_id,
          NEW.id,
          'order_modified_customer',
          'Customer modified order (Order #' || NEW.order_number || ')',
          'customer'
        );
      END IF;

      -- Staff acknowledged changes
      IF OLD.last_reviewed_version IS DISTINCT FROM NEW.last_reviewed_version THEN
        INSERT INTO public.order_events (dining_session_id, order_id, event_type, title, actor)
        VALUES (
          NEW.dining_session_id,
          NEW.id,
          'staff_acknowledged_changes',
          'Staff acknowledged changes (Order #' || NEW.order_number || ')',
          'staff'
        );
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

-- Log trigger function for service_requests
CREATE OR REPLACE FUNCTION public.fn_log_service_request_events()
RETURNS TRIGGER AS $$
DECLARE
  v_req_label TEXT;
BEGIN
  v_req_label := CASE NEW.type
    WHEN 'water' THEN 'Needs water'
    WHEN 'waiter' THEN 'Call waiter'
    WHEN 'bill' THEN 'Requests bill'
    WHEN 'help' THEN 'Needs help'
    ELSE NEW.type
  END;

  IF TG_OP = 'INSERT' THEN
    IF NEW.dining_session_id IS NOT NULL THEN
      INSERT INTO public.order_events (dining_session_id, service_request_id, event_type, title, actor)
      VALUES (
        NEW.dining_session_id,
        NEW.id,
        'service_request_created',
        'Service request created: ' || v_req_label,
        'customer'
      );
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.dining_session_id IS NOT NULL THEN
      IF OLD.status = 'open' AND NEW.status = 'acknowledged' THEN
        INSERT INTO public.order_events (dining_session_id, service_request_id, event_type, title, actor)
        VALUES (
          NEW.dining_session_id,
          NEW.id,
          'service_request_acknowledged',
          'Service request acknowledged: ' || v_req_label,
          'staff'
        );
      ELSIF OLD.status IN ('open', 'acknowledged') AND NEW.status = 'resolved' THEN
        INSERT INTO public.order_events (dining_session_id, service_request_id, event_type, title, actor)
        VALUES (
          NEW.dining_session_id,
          NEW.id,
          'service_request_resolved',
          'Service request resolved: ' || v_req_label,
          'staff'
        );
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Set up triggers
DROP TRIGGER IF EXISTS trg_log_dining_session_events ON public.dining_sessions;
CREATE TRIGGER trg_log_dining_session_events
  AFTER INSERT OR UPDATE ON public.dining_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_log_dining_session_events();

DROP TRIGGER IF EXISTS trg_log_order_events ON public.orders;
CREATE TRIGGER trg_log_order_events
  AFTER INSERT OR UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_log_order_events();

DROP TRIGGER IF EXISTS trg_log_service_request_events ON public.service_requests;
CREATE TRIGGER trg_log_service_request_events
  AFTER INSERT OR UPDATE ON public.service_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_log_service_request_events();

-- Enable realtime for order_events
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_events;

-- Update cancel_order to explicitly set last_updated_by = 'customer'
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
  SET status = 'cancelled',
      last_updated_by = 'customer'
  WHERE id = p_order_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.cancel_order(UUID, TEXT) TO anon, authenticated;
