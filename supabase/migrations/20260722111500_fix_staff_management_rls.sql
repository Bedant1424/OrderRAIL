-- Fix Staff Management RLS Policies & Backend Persistence

-- 1. Add is_suspended column to user_roles
ALTER TABLE public.user_roles
  ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Create persistent rejected_approvals table
CREATE TABLE IF NOT EXISTS public.rejected_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cafe_id UUID REFERENCES public.cafes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  email TEXT,
  rejected_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(cafe_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rejected_approvals TO authenticated;
GRANT ALL ON public.rejected_approvals TO service_role;

ALTER TABLE public.rejected_approvals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rejected_approvals_owner_all" ON public.rejected_approvals;
CREATE POLICY "rejected_approvals_owner_all"
ON public.rejected_approvals
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'owner', cafe_id) 
  OR public.is_demo_admin(auth.uid())
)
WITH CHECK (
  public.has_role(auth.uid(), 'owner', cafe_id) 
  OR public.is_demo_admin(auth.uid())
);

-- 3. Permissive RLS Policies on user_roles for Cafe Owners
DROP POLICY IF EXISTS "user_roles_owner_manage" ON public.user_roles;
CREATE POLICY "user_roles_owner_manage"
ON public.user_roles
FOR ALL
TO authenticated
USING (
  user_id = auth.uid()
  OR public.has_role(auth.uid(), 'owner', cafe_id)
  OR public.is_demo_admin(auth.uid())
)
WITH CHECK (
  public.has_role(auth.uid(), 'owner', cafe_id)
  OR public.is_demo_admin(auth.uid())
);

-- 4. Permissive RLS Policies on staff_invites for Cafe Owners
DROP POLICY IF EXISTS "staff_invites_owner_manage" ON public.staff_invites;
CREATE POLICY "staff_invites_owner_manage"
ON public.staff_invites
FOR ALL
TO authenticated
USING (
  lower(email) = lower(auth.jwt()->>'email')
  OR public.has_role(auth.uid(), 'owner', cafe_id)
  OR public.is_demo_admin(auth.uid())
)
WITH CHECK (
  public.has_role(auth.uid(), 'owner', cafe_id)
  OR public.is_demo_admin(auth.uid())
);

-- 5. Permissive RLS Policies on audit_logs for Cafe Owners
DROP POLICY IF EXISTS "audit_logs_owner_insert" ON public.audit_logs;
CREATE POLICY "audit_logs_owner_insert"
ON public.audit_logs
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'owner', cafe_id)
  OR public.is_demo_admin(auth.uid())
  OR actor_id = auth.uid()
);

-- 6. Index for fast rejected approvals lookups
CREATE INDEX IF NOT EXISTS idx_rejected_approvals_cafe_user ON public.rejected_approvals(cafe_id, user_id);
