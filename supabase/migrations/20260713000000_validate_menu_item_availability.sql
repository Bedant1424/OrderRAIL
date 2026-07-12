-- Validate menu item availability before inserting into order_items
CREATE OR REPLACE FUNCTION public.fn_validate_order_item_availability()
RETURNS TRIGGER AS $$
DECLARE
  v_available BOOLEAN;
BEGIN
  SELECT is_available INTO v_available
  FROM public.menu_items
  WHERE id = NEW.menu_item_id;

  IF v_available IS NOT TRUE THEN
    RAISE EXCEPTION 'Item % is currently unavailable and cannot be ordered.', NEW.name;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_validate_order_item_availability ON public.order_items;
CREATE TRIGGER trg_validate_order_item_availability
  BEFORE INSERT ON public.order_items
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_validate_order_item_availability();
