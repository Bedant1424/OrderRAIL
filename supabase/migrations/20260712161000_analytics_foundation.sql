-- Trigger to automatically track preparation metrics and calculate durations
CREATE OR REPLACE FUNCTION public.fn_track_order_item_metrics()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    IF NEW.status = 'preparing' THEN
      NEW.prep_started_at := COALESCE(NEW.prep_started_at, NOW());
    ELSIF NEW.status = 'ready' THEN
      NEW.ready_at := COALESCE(NEW.ready_at, NOW());
      IF NEW.prep_started_at IS NOT NULL THEN
        NEW.actual_duration_minutes := ROUND(EXTRACT(EPOCH FROM (NEW.ready_at - NEW.prep_started_at)) / 60.0);
      ELSE
        NEW.actual_duration_minutes := 0;
      END IF;
    ELSIF NEW.status = 'served' THEN
      NEW.served_at := COALESCE(NEW.served_at, NOW());
      IF NEW.prep_started_at IS NULL THEN
        NEW.prep_started_at := NEW.served_at;
      END IF;
      IF NEW.ready_at IS NULL THEN
        NEW.ready_at := NEW.served_at;
        NEW.actual_duration_minutes := ROUND(EXTRACT(EPOCH FROM (NEW.ready_at - NEW.prep_started_at)) / 60.0);
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trigger_track_order_item_metrics
BEFORE UPDATE OF status ON public.order_items
FOR EACH ROW
EXECUTE FUNCTION public.fn_track_order_item_metrics();
