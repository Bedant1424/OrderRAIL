-- Decouple Demo Protection from Cafe Slug

-- 1. Add explicit is_demo_cafe boolean column to cafes table
ALTER TABLE public.cafes
  ADD COLUMN IF NOT EXISTS is_demo_cafe BOOLEAN NOT NULL DEFAULT FALSE;

-- Ensure production cafes are explicitly NOT demo cafes by default
UPDATE public.cafes
   SET is_demo_cafe = FALSE;

-- 2. Redesign is_demo_cafe function to check explicit is_demo_cafe column instead of hardcoded slug
CREATE OR REPLACE FUNCTION public.is_demo_cafe(_cafe_id uuid)
RETURNS boolean
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  IF _cafe_id IS NULL THEN
    RETURN FALSE;
  END IF;

  RETURN EXISTS (
    SELECT 1 
      FROM public.cafes 
     WHERE id = _cafe_id 
       AND is_demo_cafe = TRUE
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_demo_cafe(uuid) TO authenticated, anon;

-- 3. Redesign claim_demo_role function to query explicit is_demo_cafe column
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
  SELECT id INTO _cafe_id FROM public.cafes WHERE is_demo_cafe = TRUE LIMIT 1;
  IF _cafe_id IS NULL THEN
    RAISE EXCEPTION 'Demo cafe not found';
  END IF;
  INSERT INTO public.user_roles (user_id, cafe_id, role)
  VALUES (auth.uid(), _cafe_id, _role)
  ON CONFLICT DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_demo_role(app_role) TO authenticated;
