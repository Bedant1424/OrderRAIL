-- REDEFINE assign_role_by_email to enforce demo mode protection
CREATE OR REPLACE FUNCTION public.assign_role_by_email(_cafe_id uuid, _email text, _role public.app_role)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _target uuid;
  _email_norm text := lower(trim(_email));
BEGIN
  -- Authenticate actor
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Block role assignments/invitations for the demo cafe
  IF public.is_demo_cafe(_cafe_id) THEN
    RAISE EXCEPTION 'This action is disabled in the public demo.';
  END IF;

  IF NOT public.has_role(auth.uid(), 'owner', _cafe_id) THEN
    RAISE EXCEPTION 'Only cafe owners can assign roles';
  END IF;
  IF _role NOT IN ('staff','owner') THEN
    RAISE EXCEPTION 'Invalid role';
  END IF;

  SELECT id INTO _target FROM auth.users WHERE lower(email) = _email_norm LIMIT 1;

  IF _target IS NULL THEN
    INSERT INTO public.staff_invites (cafe_id, email, role, invited_by)
    VALUES (_cafe_id, _email_norm, _role, auth.uid())
    ON CONFLICT (cafe_id, email, role) DO NOTHING;
    RETURN 'invited';
  END IF;

  INSERT INTO public.user_roles (user_id, cafe_id, role)
  VALUES (_target, _cafe_id, _role)
  ON CONFLICT DO NOTHING;

  DELETE FROM public.staff_invites
   WHERE cafe_id = _cafe_id AND lower(email) = _email_norm AND role = _role;

  RETURN 'assigned';
END;
$$;


-- ========================================================
-- RESTRICTIVE RLS POLICIES FOR DEMO CAFE
-- ========================================================

-- Cafes Table update restriction
CREATE POLICY "cafes_demo_restrict"
ON public.cafes
AS RESTRICTIVE
FOR ALL
TO authenticated, anon
USING (NOT public.is_demo_cafe(id))
WITH CHECK (NOT public.is_demo_cafe(id));

-- Menu Categories Table change restriction
CREATE POLICY "menu_categories_demo_restrict"
ON public.menu_categories
AS RESTRICTIVE
FOR ALL
TO authenticated, anon
USING (NOT public.is_demo_cafe(cafe_id))
WITH CHECK (NOT public.is_demo_cafe(cafe_id));

-- Menu Items Table change restriction
CREATE POLICY "menu_items_demo_restrict"
ON public.menu_items
AS RESTRICTIVE
FOR ALL
TO authenticated, anon
USING (NOT public.is_demo_cafe(cafe_id))
WITH CHECK (NOT public.is_demo_cafe(cafe_id));

-- Tables Table change restriction
CREATE POLICY "tables_demo_restrict"
ON public.tables
AS RESTRICTIVE
FOR ALL
TO authenticated, anon
USING (NOT public.is_demo_cafe(cafe_id))
WITH CHECK (NOT public.is_demo_cafe(cafe_id));

-- User Roles Table change restriction (blocks direct manipulation via REST API)
CREATE POLICY "user_roles_demo_restrict"
ON public.user_roles
AS RESTRICTIVE
FOR ALL
TO authenticated, anon
USING (NOT public.is_demo_cafe(cafe_id))
WITH CHECK (NOT public.is_demo_cafe(cafe_id));

-- Staff Invites Table change restriction
CREATE POLICY "staff_invites_demo_restrict"
ON public.staff_invites
AS RESTRICTIVE
FOR ALL
TO authenticated, anon
USING (NOT public.is_demo_cafe(cafe_id))
WITH CHECK (NOT public.is_demo_cafe(cafe_id));

-- Profiles Table change restriction for demo users
CREATE POLICY "profiles_demo_restrict"
ON public.profiles
AS RESTRICTIVE
FOR ALL
TO authenticated, anon
USING (
  NOT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = id
      AND public.is_demo_cafe(ur.cafe_id)
  )
)
WITH CHECK (
  NOT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = id
      AND public.is_demo_cafe(ur.cafe_id)
  )
);

-- Storage Objects change restriction for demo cafe images
CREATE POLICY "storage_objects_demo_restrict"
ON storage.objects
AS RESTRICTIVE
FOR ALL
TO authenticated, anon
USING (
  bucket_id <> 'menu-images'
  OR NOT (
    split_part(name, '/', 1) ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    AND public.is_demo_cafe((split_part(name, '/', 1))::uuid)
  )
)
WITH CHECK (
  bucket_id <> 'menu-images'
  OR NOT (
    split_part(name, '/', 1) ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    AND public.is_demo_cafe((split_part(name, '/', 1))::uuid)
  )
);
