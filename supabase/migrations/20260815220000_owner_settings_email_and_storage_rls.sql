-- Migration: Owner Settings Email Field & Storage RLS Authorization Fix
-- 1. Add email column to cafes table
ALTER TABLE public.cafes ADD COLUMN IF NOT EXISTS email TEXT;

-- 2. Refine storage.objects RLS policies for menu-images bucket to ensure robust, cafe-scoped owner & staff uploads
DROP POLICY IF EXISTS "menu-images owner insert" ON storage.objects;
DROP POLICY IF EXISTS "menu-images owner update" ON storage.objects;
DROP POLICY IF EXISTS "menu-images owner delete" ON storage.objects;
DROP POLICY IF EXISTS "menu-images cafe user insert" ON storage.objects;
DROP POLICY IF EXISTS "menu-images cafe user update" ON storage.objects;
DROP POLICY IF EXISTS "menu-images cafe user delete" ON storage.objects;

CREATE POLICY "menu-images cafe user insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'menu-images'
  AND split_part(name, '/', 1) ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
  AND (
    public.has_role(auth.uid(), 'owner', (split_part(name, '/', 1))::uuid)
    OR public.has_role(auth.uid(), 'staff', (split_part(name, '/', 1))::uuid)
    OR public.has_role(auth.uid(), 'counter', (split_part(name, '/', 1))::uuid)
    OR public.is_demo_admin(auth.uid())
  )
);

CREATE POLICY "menu-images cafe user update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'menu-images'
  AND split_part(name, '/', 1) ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
  AND (
    public.has_role(auth.uid(), 'owner', (split_part(name, '/', 1))::uuid)
    OR public.has_role(auth.uid(), 'staff', (split_part(name, '/', 1))::uuid)
    OR public.has_role(auth.uid(), 'counter', (split_part(name, '/', 1))::uuid)
    OR public.is_demo_admin(auth.uid())
  )
)
WITH CHECK (
  bucket_id = 'menu-images'
  AND split_part(name, '/', 1) ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
  AND (
    public.has_role(auth.uid(), 'owner', (split_part(name, '/', 1))::uuid)
    OR public.has_role(auth.uid(), 'staff', (split_part(name, '/', 1))::uuid)
    OR public.has_role(auth.uid(), 'counter', (split_part(name, '/', 1))::uuid)
    OR public.is_demo_admin(auth.uid())
  )
);

CREATE POLICY "menu-images cafe user delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'menu-images'
  AND split_part(name, '/', 1) ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
  AND (
    public.has_role(auth.uid(), 'owner', (split_part(name, '/', 1))::uuid)
    OR public.has_role(auth.uid(), 'staff', (split_part(name, '/', 1))::uuid)
    OR public.has_role(auth.uid(), 'counter', (split_part(name, '/', 1))::uuid)
    OR public.is_demo_admin(auth.uid())
  )
);
