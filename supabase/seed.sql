-- Bootstrap process for OrderRail
-- Checks if the default cafe exists, and if not, inserts it.
-- Subsequently provisions 10 default tables for the cafe.

DO $$
DECLARE
  _cafe_id UUID;
BEGIN
  -- Insert cafe if not exists
  IF NOT EXISTS (SELECT 1 FROM public.cafes WHERE slug = 'orderrail') THEN
    INSERT INTO public.cafes (name, slug, currency)
    VALUES ('OrderRail', 'orderrail', 'INR');
  END IF;

  -- Get the cafe ID
  SELECT id INTO _cafe_id FROM public.cafes WHERE slug = 'orderrail' LIMIT 1;

  -- Seed tables 1 through 10
  FOR i IN 1..10 LOOP
    IF NOT EXISTS (SELECT 1 FROM public.tables WHERE cafe_id = _cafe_id AND label = i::text) THEN
      INSERT INTO public.tables (cafe_id, label, seats)
      VALUES (_cafe_id, i::text, 4);
    END IF;
  END LOOP;
END $$;
