
-- =========================================
-- Menu categories: owner full CRUD
-- =========================================
CREATE POLICY "menu_categories owner manage"
ON public.menu_categories FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'owner', cafe_id))
WITH CHECK (public.has_role(auth.uid(), 'owner', cafe_id));

-- =========================================
-- Menu items: owner full CRUD; owners can also read unavailable items
-- =========================================
CREATE POLICY "menu_items owner read all"
ON public.menu_items FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'owner', cafe_id) OR public.has_role(auth.uid(), 'staff', cafe_id));

CREATE POLICY "menu_items owner manage"
ON public.menu_items FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'owner', cafe_id))
WITH CHECK (public.has_role(auth.uid(), 'owner', cafe_id));

-- =========================================
-- Tables: owner full CRUD; staff/owner read all incl inactive
-- =========================================
CREATE POLICY "tables staff read all"
ON public.tables FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'owner', cafe_id) OR public.has_role(auth.uid(), 'staff', cafe_id));

CREATE POLICY "tables owner manage"
ON public.tables FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'owner', cafe_id))
WITH CHECK (public.has_role(auth.uid(), 'owner', cafe_id));

-- =========================================
-- Cafes: owner can update their own cafe details
-- =========================================
CREATE POLICY "cafes owner update"
ON public.cafes FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'owner', id))
WITH CHECK (public.has_role(auth.uid(), 'owner', id));

-- =========================================
-- user_roles: owners can see and manage roles for their cafe
-- =========================================
CREATE POLICY "user_roles owner read"
ON public.user_roles FOR SELECT TO authenticated
USING (cafe_id IS NOT NULL AND public.has_role(auth.uid(), 'owner', cafe_id));

CREATE POLICY "user_roles owner insert"
ON public.user_roles FOR INSERT TO authenticated
WITH CHECK (cafe_id IS NOT NULL AND public.has_role(auth.uid(), 'owner', cafe_id));

CREATE POLICY "user_roles owner delete"
ON public.user_roles FOR DELETE TO authenticated
USING (cafe_id IS NOT NULL AND public.has_role(auth.uid(), 'owner', cafe_id));

-- =========================================
-- Owner helper: assign role by email (only for existing accounts)
-- =========================================
CREATE OR REPLACE FUNCTION public.assign_role_by_email(_cafe_id uuid, _email text, _role app_role)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _target uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.has_role(auth.uid(), 'owner', _cafe_id) THEN
    RAISE EXCEPTION 'Only cafe owners can assign roles';
  END IF;
  IF _role NOT IN ('staff','owner') THEN
    RAISE EXCEPTION 'Invalid role';
  END IF;
  SELECT id INTO _target FROM auth.users WHERE lower(email) = lower(_email) LIMIT 1;
  IF _target IS NULL THEN
    RAISE EXCEPTION 'No account exists for %. Ask them to sign up first.', _email;
  END IF;
  INSERT INTO public.user_roles (user_id, cafe_id, role)
  VALUES (_target, _cafe_id, _role)
  ON CONFLICT DO NOTHING;
END;
$$;
REVOKE ALL ON FUNCTION public.assign_role_by_email(uuid, text, app_role) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.assign_role_by_email(uuid, text, app_role) TO authenticated;

-- Helper: profile lookup for role list (owners can read profile of roles in their cafe)
CREATE POLICY "profiles owner read cafe members"
ON public.profiles FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.user_roles ur
  WHERE ur.user_id = profiles.id
    AND ur.cafe_id IS NOT NULL
    AND public.has_role(auth.uid(), 'owner', ur.cafe_id)
));

-- =========================================
-- Storage RLS on menu-images bucket
-- =========================================
-- Public read (needed for customer PWA to display images from private bucket via signed/public URL)
CREATE POLICY "menu-images public read"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'menu-images');

-- Staff & owner of ANY cafe can upload/update/delete their own path.
-- Convention: path is "<cafe_id>/<filename>"
CREATE POLICY "menu-images owner insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'menu-images'
  AND public.has_role(auth.uid(), 'owner', (split_part(name, '/', 1))::uuid)
);

CREATE POLICY "menu-images owner update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'menu-images'
  AND public.has_role(auth.uid(), 'owner', (split_part(name, '/', 1))::uuid)
);

CREATE POLICY "menu-images owner delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'menu-images'
  AND public.has_role(auth.uid(), 'owner', (split_part(name, '/', 1))::uuid)
);

-- =========================================
-- Realtime publication for admin sync
-- =========================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.menu_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.menu_categories;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tables;
ALTER PUBLICATION supabase_realtime ADD TABLE public.reviews;
