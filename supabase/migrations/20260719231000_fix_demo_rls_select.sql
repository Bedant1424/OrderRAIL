-- Drop old FOR ALL restrictive policies that mistakenly blocked SELECT queries on the demo cafe
DROP POLICY IF EXISTS "cafes_demo_restrict" ON public.cafes;
DROP POLICY IF EXISTS "menu_categories_demo_restrict" ON public.menu_categories;
DROP POLICY IF EXISTS "menu_items_demo_restrict" ON public.menu_items;
DROP POLICY IF EXISTS "tables_demo_restrict" ON public.tables;
DROP POLICY IF EXISTS "user_roles_demo_restrict" ON public.user_roles;
DROP POLICY IF EXISTS "staff_invites_demo_restrict" ON public.staff_invites;
DROP POLICY IF EXISTS "profiles_demo_restrict" ON public.profiles;
DROP POLICY IF EXISTS "storage_objects_demo_restrict" ON storage.objects;

-- Re-create AS RESTRICTIVE policies for write transactions only (INSERT, UPDATE, DELETE)

-- cafes
CREATE POLICY "cafes_demo_insert_restrict" ON public.cafes AS RESTRICTIVE FOR INSERT TO authenticated, anon WITH CHECK (NOT public.is_demo_cafe(id));
CREATE POLICY "cafes_demo_update_restrict" ON public.cafes AS RESTRICTIVE FOR UPDATE TO authenticated, anon USING (NOT public.is_demo_cafe(id)) WITH CHECK (NOT public.is_demo_cafe(id));
CREATE POLICY "cafes_demo_delete_restrict" ON public.cafes AS RESTRICTIVE FOR DELETE TO authenticated, anon USING (NOT public.is_demo_cafe(id));

-- menu_categories
CREATE POLICY "menu_categories_demo_insert_restrict" ON public.menu_categories AS RESTRICTIVE FOR INSERT TO authenticated, anon WITH CHECK (NOT public.is_demo_cafe(cafe_id));
CREATE POLICY "menu_categories_demo_update_restrict" ON public.menu_categories AS RESTRICTIVE FOR UPDATE TO authenticated, anon USING (NOT public.is_demo_cafe(cafe_id)) WITH CHECK (NOT public.is_demo_cafe(cafe_id));
CREATE POLICY "menu_categories_demo_delete_restrict" ON public.menu_categories AS RESTRICTIVE FOR DELETE TO authenticated, anon USING (NOT public.is_demo_cafe(cafe_id));

-- menu_items
CREATE POLICY "menu_items_demo_insert_restrict" ON public.menu_items AS RESTRICTIVE FOR INSERT TO authenticated, anon WITH CHECK (NOT public.is_demo_cafe(cafe_id));
CREATE POLICY "menu_items_demo_update_restrict" ON public.menu_items AS RESTRICTIVE FOR UPDATE TO authenticated, anon USING (NOT public.is_demo_cafe(cafe_id)) WITH CHECK (NOT public.is_demo_cafe(cafe_id));
CREATE POLICY "menu_items_demo_delete_restrict" ON public.menu_items AS RESTRICTIVE FOR DELETE TO authenticated, anon USING (NOT public.is_demo_cafe(cafe_id));

-- tables
CREATE POLICY "tables_demo_insert_restrict" ON public.tables AS RESTRICTIVE FOR INSERT TO authenticated, anon WITH CHECK (NOT public.is_demo_cafe(cafe_id));
CREATE POLICY "tables_demo_update_restrict" ON public.tables AS RESTRICTIVE FOR UPDATE TO authenticated, anon USING (NOT public.is_demo_cafe(cafe_id)) WITH CHECK (NOT public.is_demo_cafe(cafe_id));
CREATE POLICY "tables_demo_delete_restrict" ON public.tables AS RESTRICTIVE FOR DELETE TO authenticated, anon USING (NOT public.is_demo_cafe(cafe_id));

-- user_roles
CREATE POLICY "user_roles_demo_insert_restrict" ON public.user_roles AS RESTRICTIVE FOR INSERT TO authenticated, anon WITH CHECK (NOT public.is_demo_cafe(cafe_id));
CREATE POLICY "user_roles_demo_update_restrict" ON public.user_roles AS RESTRICTIVE FOR UPDATE TO authenticated, anon USING (NOT public.is_demo_cafe(cafe_id)) WITH CHECK (NOT public.is_demo_cafe(cafe_id));
CREATE POLICY "user_roles_demo_delete_restrict" ON public.user_roles AS RESTRICTIVE FOR DELETE TO authenticated, anon USING (NOT public.is_demo_cafe(cafe_id));

-- staff_invites
CREATE POLICY "staff_invites_demo_insert_restrict" ON public.staff_invites AS RESTRICTIVE FOR INSERT TO authenticated, anon WITH CHECK (NOT public.is_demo_cafe(cafe_id));
CREATE POLICY "staff_invites_demo_update_restrict" ON public.staff_invites AS RESTRICTIVE FOR UPDATE TO authenticated, anon USING (NOT public.is_demo_cafe(cafe_id)) WITH CHECK (NOT public.is_demo_cafe(cafe_id));
CREATE POLICY "staff_invites_demo_delete_restrict" ON public.staff_invites AS RESTRICTIVE FOR DELETE TO authenticated, anon USING (NOT public.is_demo_cafe(cafe_id));

-- profiles
CREATE POLICY "profiles_demo_insert_restrict" ON public.profiles AS RESTRICTIVE FOR INSERT TO authenticated, anon WITH CHECK (
  NOT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = id
      AND public.is_demo_cafe(ur.cafe_id)
  )
);
CREATE POLICY "profiles_demo_update_restrict" ON public.profiles AS RESTRICTIVE FOR UPDATE TO authenticated, anon USING (
  NOT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = id
      AND public.is_demo_cafe(ur.cafe_id)
  )
) WITH CHECK (
  NOT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = id
      AND public.is_demo_cafe(ur.cafe_id)
  )
);
CREATE POLICY "profiles_demo_delete_restrict" ON public.profiles AS RESTRICTIVE FOR DELETE TO authenticated, anon USING (
  NOT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = id
      AND public.is_demo_cafe(ur.cafe_id)
  )
);

-- storage.objects
CREATE POLICY "storage_objects_demo_insert_restrict" ON storage.objects AS RESTRICTIVE FOR INSERT TO authenticated, anon WITH CHECK (
  bucket_id <> 'menu-images'
  OR NOT (
    split_part(name, '/', 1) ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    AND public.is_demo_cafe((split_part(name, '/', 1))::uuid)
  )
);
CREATE POLICY "storage_objects_demo_update_restrict" ON storage.objects AS RESTRICTIVE FOR UPDATE TO authenticated, anon USING (
  bucket_id <> 'menu-images'
  OR NOT (
    split_part(name, '/', 1) ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    AND public.is_demo_cafe((split_part(name, '/', 1))::uuid)
  )
) WITH CHECK (
  bucket_id <> 'menu-images'
  OR NOT (
    split_part(name, '/', 1) ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    AND public.is_demo_cafe((split_part(name, '/', 1))::uuid)
  )
);
CREATE POLICY "storage_objects_demo_delete_restrict" ON storage.objects AS RESTRICTIVE FOR DELETE TO authenticated, anon USING (
  bucket_id <> 'menu-images'
  OR NOT (
    split_part(name, '/', 1) ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    AND public.is_demo_cafe((split_part(name, '/', 1))::uuid)
  )
);
