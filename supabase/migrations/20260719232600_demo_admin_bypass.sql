-- 1. Create is_demo_admin helper function in database
CREATE OR REPLACE FUNCTION public.is_demo_admin(user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT user_id = 'c261a4be-a1eb-42d4-8623-a81ef0100921'::uuid;
$$;

-- 2. Redefine assign_role_by_email function to bypass demo block for Demo Admin
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

  -- Block role assignments/invitations for the demo cafe, unless the actor is the demo admin
  IF public.is_demo_cafe(_cafe_id) AND NOT public.is_demo_admin(auth.uid()) THEN
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

-- 3. Drop existing RLS write-restrictive policies
DROP POLICY IF EXISTS "cafes_demo_insert_restrict" ON public.cafes;
DROP POLICY IF EXISTS "cafes_demo_update_restrict" ON public.cafes;
DROP POLICY IF EXISTS "cafes_demo_delete_restrict" ON public.cafes;

DROP POLICY IF EXISTS "menu_categories_demo_insert_restrict" ON public.menu_categories;
DROP POLICY IF EXISTS "menu_categories_demo_update_restrict" ON public.menu_categories;
DROP POLICY IF EXISTS "menu_categories_demo_delete_restrict" ON public.menu_categories;

DROP POLICY IF EXISTS "menu_items_demo_insert_restrict" ON public.menu_items;
DROP POLICY IF EXISTS "menu_items_demo_update_restrict" ON public.menu_items;
DROP POLICY IF EXISTS "menu_items_demo_delete_restrict" ON public.menu_items;

DROP POLICY IF EXISTS "tables_demo_insert_restrict" ON public.tables;
DROP POLICY IF EXISTS "tables_demo_update_restrict" ON public.tables;
DROP POLICY IF EXISTS "tables_demo_delete_restrict" ON public.tables;

DROP POLICY IF EXISTS "user_roles_demo_insert_restrict" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_demo_update_restrict" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_demo_delete_restrict" ON public.user_roles;

DROP POLICY IF EXISTS "staff_invites_demo_insert_restrict" ON public.staff_invites;
DROP POLICY IF EXISTS "staff_invites_demo_update_restrict" ON public.staff_invites;
DROP POLICY IF EXISTS "staff_invites_demo_delete_restrict" ON public.staff_invites;

DROP POLICY IF EXISTS "profiles_demo_insert_restrict" ON public.profiles;
DROP POLICY IF EXISTS "profiles_demo_update_restrict" ON public.profiles;
DROP POLICY IF EXISTS "profiles_demo_delete_restrict" ON public.profiles;

DROP POLICY IF EXISTS "storage_objects_demo_insert_restrict" ON storage.objects;
DROP POLICY IF EXISTS "storage_objects_demo_update_restrict" ON storage.objects;
DROP POLICY IF EXISTS "storage_objects_demo_delete_restrict" ON storage.objects;

-- 4. Recreate RLS write-restrictive policies with Demo Admin bypass

-- cafes
CREATE POLICY "cafes_demo_insert_restrict" ON public.cafes AS RESTRICTIVE FOR INSERT TO authenticated, anon WITH CHECK (NOT public.is_demo_cafe(id) OR public.is_demo_admin(auth.uid()));
CREATE POLICY "cafes_demo_update_restrict" ON public.cafes AS RESTRICTIVE FOR UPDATE TO authenticated, anon USING (NOT public.is_demo_cafe(id) OR public.is_demo_admin(auth.uid())) WITH CHECK (NOT public.is_demo_cafe(id) OR public.is_demo_admin(auth.uid()));
CREATE POLICY "cafes_demo_delete_restrict" ON public.cafes AS RESTRICTIVE FOR DELETE TO authenticated, anon USING (NOT public.is_demo_cafe(id) OR public.is_demo_admin(auth.uid()));

-- menu_categories
CREATE POLICY "menu_categories_demo_insert_restrict" ON public.menu_categories AS RESTRICTIVE FOR INSERT TO authenticated, anon WITH CHECK (NOT public.is_demo_cafe(cafe_id) OR public.is_demo_admin(auth.uid()));
CREATE POLICY "menu_categories_demo_update_restrict" ON public.menu_categories AS RESTRICTIVE FOR UPDATE TO authenticated, anon USING (NOT public.is_demo_cafe(cafe_id) OR public.is_demo_admin(auth.uid())) WITH CHECK (NOT public.is_demo_cafe(cafe_id) OR public.is_demo_admin(auth.uid()));
CREATE POLICY "menu_categories_demo_delete_restrict" ON public.menu_categories AS RESTRICTIVE FOR DELETE TO authenticated, anon USING (NOT public.is_demo_cafe(cafe_id) OR public.is_demo_admin(auth.uid()));

-- menu_items
CREATE POLICY "menu_items_demo_insert_restrict" ON public.menu_items AS RESTRICTIVE FOR INSERT TO authenticated, anon WITH CHECK (NOT public.is_demo_cafe(cafe_id) OR public.is_demo_admin(auth.uid()));
CREATE POLICY "menu_items_demo_update_restrict" ON public.menu_items AS RESTRICTIVE FOR UPDATE TO authenticated, anon USING (NOT public.is_demo_cafe(cafe_id) OR public.is_demo_admin(auth.uid())) WITH CHECK (NOT public.is_demo_cafe(cafe_id) OR public.is_demo_admin(auth.uid()));
CREATE POLICY "menu_items_demo_delete_restrict" ON public.menu_items AS RESTRICTIVE FOR DELETE TO authenticated, anon USING (NOT public.is_demo_cafe(cafe_id) OR public.is_demo_admin(auth.uid()));

-- tables
CREATE POLICY "tables_demo_insert_restrict" ON public.tables AS RESTRICTIVE FOR INSERT TO authenticated, anon WITH CHECK (NOT public.is_demo_cafe(cafe_id) OR public.is_demo_admin(auth.uid()));
CREATE POLICY "tables_demo_update_restrict" ON public.tables AS RESTRICTIVE FOR UPDATE TO authenticated, anon USING (NOT public.is_demo_cafe(cafe_id) OR public.is_demo_admin(auth.uid())) WITH CHECK (NOT public.is_demo_cafe(cafe_id) OR public.is_demo_admin(auth.uid()));
CREATE POLICY "tables_demo_delete_restrict" ON public.tables AS RESTRICTIVE FOR DELETE TO authenticated, anon USING (NOT public.is_demo_cafe(cafe_id) OR public.is_demo_admin(auth.uid()));

-- user_roles
CREATE POLICY "user_roles_demo_insert_restrict" ON public.user_roles AS RESTRICTIVE FOR INSERT TO authenticated, anon WITH CHECK (NOT public.is_demo_cafe(cafe_id) OR public.is_demo_admin(auth.uid()));
CREATE POLICY "user_roles_demo_update_restrict" ON public.user_roles AS RESTRICTIVE FOR UPDATE TO authenticated, anon USING (NOT public.is_demo_cafe(cafe_id) OR public.is_demo_admin(auth.uid())) WITH CHECK (NOT public.is_demo_cafe(cafe_id) OR public.is_demo_admin(auth.uid()));
CREATE POLICY "user_roles_demo_delete_restrict" ON public.user_roles AS RESTRICTIVE FOR DELETE TO authenticated, anon USING (NOT public.is_demo_cafe(cafe_id) OR public.is_demo_admin(auth.uid()));

-- staff_invites
CREATE POLICY "staff_invites_demo_insert_restrict" ON public.staff_invites AS RESTRICTIVE FOR INSERT TO authenticated, anon WITH CHECK (NOT public.is_demo_cafe(cafe_id) OR public.is_demo_admin(auth.uid()));
CREATE POLICY "staff_invites_demo_update_restrict" ON public.staff_invites AS RESTRICTIVE FOR UPDATE TO authenticated, anon USING (NOT public.is_demo_cafe(cafe_id) OR public.is_demo_admin(auth.uid())) WITH CHECK (NOT public.is_demo_cafe(cafe_id) OR public.is_demo_admin(auth.uid()));
CREATE POLICY "staff_invites_demo_delete_restrict" ON public.staff_invites AS RESTRICTIVE FOR DELETE TO authenticated, anon USING (NOT public.is_demo_cafe(cafe_id) OR public.is_demo_admin(auth.uid()));

-- profiles
CREATE POLICY "profiles_demo_insert_restrict" ON public.profiles AS RESTRICTIVE FOR INSERT TO authenticated, anon WITH CHECK (
  public.is_demo_admin(auth.uid())
  OR NOT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = id
      AND public.is_demo_cafe(ur.cafe_id)
  )
);
CREATE POLICY "profiles_demo_update_restrict" ON public.profiles AS RESTRICTIVE FOR UPDATE TO authenticated, anon USING (
  public.is_demo_admin(auth.uid())
  OR NOT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = id
      AND public.is_demo_cafe(ur.cafe_id)
  )
) WITH CHECK (
  public.is_demo_admin(auth.uid())
  OR NOT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = id
      AND public.is_demo_cafe(ur.cafe_id)
  )
);
CREATE POLICY "profiles_demo_delete_restrict" ON public.profiles AS RESTRICTIVE FOR DELETE TO authenticated, anon USING (
  public.is_demo_admin(auth.uid())
  OR NOT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = id
      AND public.is_demo_cafe(ur.cafe_id)
  )
);

-- storage.objects
CREATE POLICY "storage_objects_demo_insert_restrict" ON storage.objects AS RESTRICTIVE FOR INSERT TO authenticated, anon WITH CHECK (
  public.is_demo_admin(auth.uid())
  OR bucket_id <> 'menu-images'
  OR NOT (
    split_part(name, '/', 1) ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    AND public.is_demo_cafe((split_part(name, '/', 1))::uuid)
  )
);
CREATE POLICY "storage_objects_demo_update_restrict" ON storage.objects AS RESTRICTIVE FOR UPDATE TO authenticated, anon USING (
  public.is_demo_admin(auth.uid())
  OR bucket_id <> 'menu-images'
  OR NOT (
    split_part(name, '/', 1) ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    AND public.is_demo_cafe((split_part(name, '/', 1))::uuid)
  )
) WITH CHECK (
  public.is_demo_admin(auth.uid())
  OR bucket_id <> 'menu-images'
  OR NOT (
    split_part(name, '/', 1) ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    AND public.is_demo_cafe((split_part(name, '/', 1))::uuid)
  )
);
CREATE POLICY "storage_objects_demo_delete_restrict" ON storage.objects AS RESTRICTIVE FOR DELETE TO authenticated, anon USING (
  public.is_demo_admin(auth.uid())
  OR bucket_id <> 'menu-images'
  OR NOT (
    split_part(name, '/', 1) ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    AND public.is_demo_cafe((split_part(name, '/', 1))::uuid)
  )
);
