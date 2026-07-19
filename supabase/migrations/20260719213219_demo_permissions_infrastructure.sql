-- Reusable database infrastructure for demo-aware policies.
-- Checks whether a given cafe_id represents the public demo cafe.
CREATE OR REPLACE FUNCTION public.is_demo_cafe(_cafe_id uuid)
RETURNS boolean
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.cafes 
    WHERE id = _cafe_id AND slug = 'orderrail'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_demo_cafe(uuid) TO authenticated, anon;
