-- Bootstrap process for OrderRail
-- Checks if the default cafe exists, and if not, inserts it.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.cafes WHERE slug = 'orderrail') THEN
    INSERT INTO public.cafes (name, slug, currency)
    VALUES ('OrderRail', 'orderrail', 'INR');
  END IF;
END $$;
