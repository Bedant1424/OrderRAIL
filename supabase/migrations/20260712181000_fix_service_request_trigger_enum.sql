-- Fix enum casting issue in fn_log_service_request_events trigger function
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
    ELSE NEW.type::TEXT
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
