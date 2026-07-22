-- Staff Lifecycle Refactor: Dedicated Former Staff Table & Invitation Override Logic

-- 1. Create public.former_staff table for former employees
CREATE TABLE IF NOT EXISTS public.former_staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cafe_id UUID REFERENCES public.cafes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  email TEXT NOT NULL,
  role public.app_role NOT NULL,
  removed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(cafe_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.former_staff TO authenticated;
GRANT ALL ON public.former_staff TO service_role;

ALTER TABLE public.former_staff ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "former_staff_owner_all" ON public.former_staff;
CREATE POLICY "former_staff_owner_all"
ON public.former_staff
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

-- Demo protection restrictive policies on former_staff
DROP POLICY IF EXISTS "former_staff_demo_insert_restrict" ON public.former_staff;
CREATE POLICY "former_staff_demo_insert_restrict" ON public.former_staff AS RESTRICTIVE FOR INSERT TO authenticated, anon WITH CHECK (NOT public.is_demo_cafe(cafe_id) OR public.is_demo_admin(auth.uid()));

DROP POLICY IF EXISTS "former_staff_demo_update_restrict" ON public.former_staff;
CREATE POLICY "former_staff_demo_update_restrict" ON public.former_staff AS RESTRICTIVE FOR UPDATE TO authenticated, anon USING (NOT public.is_demo_cafe(cafe_id) OR public.is_demo_admin(auth.uid())) WITH CHECK (NOT public.is_demo_cafe(cafe_id) OR public.is_demo_admin(auth.uid()));

DROP POLICY IF EXISTS "former_staff_demo_delete_restrict" ON public.former_staff;
CREATE POLICY "former_staff_demo_delete_restrict" ON public.former_staff AS RESTRICTIVE FOR DELETE TO authenticated, anon USING (NOT public.is_demo_cafe(cafe_id) OR public.is_demo_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_former_staff_cafe_user ON public.former_staff(cafe_id, user_id);

-- 2. Update bind_staff_role_internal to clear rejected_approvals and former_staff on role binding
CREATE OR REPLACE FUNCTION public.bind_staff_role_internal(
  _user_id UUID,
  _cafe_id UUID,
  _role public.app_role,
  _invite_id UUID DEFAULT NULL,
  _event_type TEXT DEFAULT 'ROLE_ASSIGNED'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_email TEXT;
BEGIN
  -- Resolve user email
  SELECT email INTO _user_email FROM public.profiles WHERE id = _user_id;
  IF _user_email IS NULL THEN
    SELECT email INTO _user_email FROM auth.users WHERE id = _user_id;
  END IF;

  -- Canonical Role Binding
  INSERT INTO public.user_roles (user_id, cafe_id, role)
  VALUES (_user_id, _cafe_id, _role)
  ON CONFLICT (user_id, cafe_id, role) DO NOTHING;

  -- Clear any prior rejected_approvals or former_staff state (Role Assignment / Invitation Override)
  DELETE FROM public.rejected_approvals WHERE cafe_id = _cafe_id AND user_id = _user_id;
  DELETE FROM public.former_staff WHERE cafe_id = _cafe_id AND user_id = _user_id;

  -- Mark Invite Accepted if linked to an invite (Immutable Update, NO physical delete)
  IF _invite_id IS NOT NULL THEN
    UPDATE public.staff_invites
       SET accepted_at = COALESCE(accepted_at, now())
     WHERE id = _invite_id;
  END IF;

  -- Canonical Audit Log Entry
  INSERT INTO public.audit_logs (cafe_id, actor_id, event_type, target_email, metadata)
  VALUES (
    _cafe_id,
    _user_id,
    _event_type,
    lower(_user_email),
    jsonb_build_object(
      'role', _role,
      'invite_id', _invite_id,
      'bound_at', now()
    )
  );
END;
$$;

-- 3. Redefine assign_role_by_email to enforce Invitation Override across former_staff and rejected_approvals
CREATE OR REPLACE FUNCTION public.assign_role_by_email(_cafe_id uuid, _email text, _role public.app_role)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _target uuid;
  _email_norm text := lower(trim(_email));
  _token_hash text;
  _expires_at timestamptz := now() + interval '7 days';
BEGIN
  -- 1. Authenticate actor
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 2. Enforce Demo mode restrictions
  IF public.is_demo_cafe(_cafe_id) AND NOT public.is_demo_admin(auth.uid()) THEN
    RAISE EXCEPTION 'This action is disabled in the public demo.';
  END IF;

  -- 3. Owner Authorization Check
  IF NOT public.has_role(auth.uid(), 'owner', _cafe_id) THEN
    RAISE EXCEPTION 'Only cafe owners can assign roles';
  END IF;

  -- 4. Role Validation
  IF _role NOT IN ('staff','owner') THEN
    RAISE EXCEPTION 'Invalid role';
  END IF;

  -- 5. Resolve target user if registered
  SELECT id INTO _target FROM auth.users WHERE lower(email) = _email_norm LIMIT 1;

  -- 6. INVITATION OVERRIDE: Clear any existing rejection or former employee state for this cafe & email/user
  DELETE FROM public.rejected_approvals 
   WHERE cafe_id = _cafe_id AND (lower(email) = _email_norm OR (_target IS NOT NULL AND user_id = _target));

  DELETE FROM public.former_staff 
   WHERE cafe_id = _cafe_id AND (lower(email) = _email_norm OR (_target IS NOT NULL AND user_id = _target));

  -- 7. Generate Secure Cryptographic Token & Upsert pending invite for ALL users (existing or new)
  _token_hash := encode(extensions.gen_random_bytes(24), 'hex');

  INSERT INTO public.staff_invites (cafe_id, email, role, token_hash, expires_at, invited_by)
  VALUES (_cafe_id, _email_norm, _role, _token_hash, _expires_at, auth.uid())
  ON CONFLICT (cafe_id, email, role) DO UPDATE
    SET token_hash = EXCLUDED.token_hash,
        expires_at = EXCLUDED.expires_at,
        revoked_at = NULL, -- Clear any prior revocation on resend
        accepted_at = NULL, -- Reset acceptance for re-invites
        created_at = now();

  -- 8. Audit Log Entry
  INSERT INTO public.audit_logs (cafe_id, actor_id, event_type, target_email, metadata)
  VALUES (
    _cafe_id,
    auth.uid(),
    'INVITE_CREATED',
    _email_norm,
    jsonb_build_object('role', _role, 'token_hash', _token_hash)
  );

  RETURN 'invited';
END;
$$;
