-- Migration: Allow Runtime Table State Updates for Demo Cafe while protecting structural metadata

-- 1. Drop the blanket FOR ALL restrictive policy on public.tables
DROP POLICY IF EXISTS "tables_demo_restrict" ON public.tables;

-- 2. Create restrictive policy blocking INSERT on demo cafe tables
CREATE POLICY "tables_demo_restrict_insert"
ON public.tables
AS RESTRICTIVE
FOR INSERT
TO authenticated, anon
WITH CHECK (NOT public.is_demo_cafe(cafe_id));

-- 3. Create restrictive policy blocking DELETE on demo cafe tables
CREATE POLICY "tables_demo_restrict_delete"
ON public.tables
AS RESTRICTIVE
FOR DELETE
TO authenticated, anon
USING (NOT public.is_demo_cafe(cafe_id));

-- 4. Create trigger to block structural metadata changes on demo cafe tables during UPDATE
CREATE OR REPLACE FUNCTION public.enforce_demo_table_update_protection()
RETURNS TRIGGER AS $$
BEGIN
  IF public.is_demo_cafe(OLD.cafe_id) OR public.is_demo_cafe(NEW.cafe_id) THEN
    -- Block modifications to structural metadata: cafe_id, label, seats, is_active, id
    IF NEW.id IS DISTINCT FROM OLD.id OR
       NEW.cafe_id IS DISTINCT FROM OLD.cafe_id OR
       NEW.label IS DISTINCT FROM OLD.label OR
       NEW.seats IS DISTINCT FROM OLD.seats OR
       NEW.is_active IS DISTINCT FROM OLD.is_active THEN
      RAISE EXCEPTION 'Modifying table structural metadata is disabled in the public demo.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_enforce_demo_table_update_protection ON public.tables;
CREATE TRIGGER trg_enforce_demo_table_update_protection
  BEFORE UPDATE ON public.tables
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_demo_table_update_protection();
