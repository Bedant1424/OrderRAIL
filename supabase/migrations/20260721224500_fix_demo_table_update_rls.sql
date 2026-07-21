-- Migration: Fix Demo Table Update RLS by dropping tables_demo_update_restrict policy
-- Goal: Unblock anonymous table runtime updates required for DiningSession creation while preserving structural table security.

-- 1. Drop both variants of restrictive UPDATE policies on public.tables
DROP POLICY IF EXISTS "tables_demo_update_restrict" ON public.tables;
DROP POLICY IF EXISTS "tables_demo_restrict" ON public.tables;

-- 2. Ensure permissive UPDATE policy exists for public (anon, authenticated) to update runtime table state
DROP POLICY IF EXISTS "tables public update" ON public.tables;
DROP POLICY IF EXISTS "tables_runtime_update" ON public.tables;

CREATE POLICY "tables_runtime_update"
ON public.tables
FOR UPDATE
TO authenticated, anon
USING (true)
WITH CHECK (true);

-- 3. Ensure trigger protecting structural metadata on demo cafe tables remains active and robust
CREATE OR REPLACE FUNCTION public.enforce_demo_table_update_protection()
RETURNS TRIGGER AS $$
BEGIN
  IF public.is_demo_cafe(OLD.cafe_id) OR public.is_demo_cafe(NEW.cafe_id) THEN
    -- Block modifications to structural metadata: id, cafe_id, label, seats, is_active
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
