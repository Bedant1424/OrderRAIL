-- Trigger to validate that a table cannot be marked free if there are active orders in the current session
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
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_check_table_can_be_freed
BEFORE UPDATE ON public.tables
FOR EACH ROW
EXECUTE FUNCTION public.check_table_can_be_freed();
