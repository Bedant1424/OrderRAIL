-- Trigger to automatically populate prep_station and base_prep_time_minutes on insert to order_items
CREATE OR REPLACE FUNCTION public.fn_populate_order_item_details()
RETURNS TRIGGER AS $$
DECLARE
  v_station public.prep_station;
  v_prep_time INT;
BEGIN
  IF NEW.menu_item_id IS NOT NULL THEN
    SELECT station, base_prep_time_minutes
    INTO v_station, v_prep_time
    FROM public.menu_items
    WHERE id = NEW.menu_item_id;

    IF v_station IS NOT NULL THEN
      NEW.prep_station := v_station;
    END IF;
    IF v_prep_time IS NOT NULL THEN
      NEW.base_prep_time_minutes := v_prep_time;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trigger_populate_order_item_details
BEFORE INSERT ON public.order_items
FOR EACH ROW
EXECUTE FUNCTION public.fn_populate_order_item_details();
