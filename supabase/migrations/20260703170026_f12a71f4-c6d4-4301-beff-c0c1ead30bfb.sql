
-- Demo helper: allow signed-in users to claim staff/owner role for the demo cafe (slug='orderrail').
CREATE OR REPLACE FUNCTION public.claim_demo_role(_role app_role)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _cafe_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF _role NOT IN ('staff','owner') THEN
    RAISE EXCEPTION 'Invalid role';
  END IF;
  SELECT id INTO _cafe_id FROM public.cafes WHERE slug = 'orderrail' LIMIT 1;
  IF _cafe_id IS NULL THEN
    RAISE EXCEPTION 'Demo cafe not found';
  END IF;
  INSERT INTO public.user_roles (user_id, cafe_id, role)
  VALUES (auth.uid(), _cafe_id, _role)
  ON CONFLICT DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_demo_role(app_role) TO authenticated;
