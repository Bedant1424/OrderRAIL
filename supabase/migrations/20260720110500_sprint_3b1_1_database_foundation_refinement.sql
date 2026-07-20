-- Sprint 3B.1.1 Migration: Database Foundation Refinement (Immutable Invites & Canonical Role Binding)

-- 1. Add revoked_at to staff_invites to ensure invitations are never physically deleted
ALTER TABLE public.staff_invites
  ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ;

-- Index for querying active non-expired, non-revoked pending invites
CREATE INDEX IF NOT EXISTS idx_staff_invites_active_pending 
  ON public.staff_invites(lower(email)) 
  WHERE accepted_at IS NULL AND revoked_at IS NULL;

-- 2. Canonical Internal Role Assignment Helper (Single Source of Role Binding)
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

-- 3. Revoke Staff Invite RPC (Immutable Cancellation)
CREATE OR REPLACE FUNCTION public.revoke_staff_invite(_invite_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _invite RECORD;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO _invite FROM public.staff_invites WHERE id = _invite_id;
  IF _invite.id IS NULL THEN
    RAISE EXCEPTION 'Invitation not found';
  END IF;

  -- Check owner authorization or demo admin
  IF public.is_demo_cafe(_invite.cafe_id) AND NOT public.is_demo_admin(auth.uid()) THEN
    RAISE EXCEPTION 'This action is disabled in the public demo.';
  END IF;

  IF NOT public.has_role(auth.uid(), 'owner', _invite.cafe_id) AND NOT public.is_demo_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only cafe owners can revoke invitations';
  END IF;

  IF _invite.accepted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot revoke an invitation that has already been accepted';
  END IF;

  -- Immutable Soft Revocation
  UPDATE public.staff_invites
     SET revoked_at = now()
   WHERE id = _invite_id;

  -- Audit Log
  INSERT INTO public.audit_logs (cafe_id, actor_id, event_type, target_email, metadata)
  VALUES (
    _invite.cafe_id,
    auth.uid(),
    'INVITE_REVOKED',
    lower(_invite.email),
    jsonb_build_object('invite_id', _invite_id, 'role', _invite.role)
  );

  RETURN jsonb_build_object('status', 'success', 'invite_id', _invite_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.revoke_staff_invite(UUID) TO authenticated;

-- 4. Update assign_role_by_email to use bind_staff_role_internal and never physically delete invites
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
  _existing_invite RECORD;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

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
    _token_hash := encode(extensions.gen_random_bytes(24), 'hex');

    -- Upsert invitation record without physical deletion
    INSERT INTO public.staff_invites (cafe_id, email, role, token_hash, expires_at, invited_by)
    VALUES (_cafe_id, _email_norm, _role, _token_hash, _expires_at, auth.uid())
    ON CONFLICT (cafe_id, email, role) DO UPDATE
      SET token_hash = EXCLUDED.token_hash,
          expires_at = EXCLUDED.expires_at,
          revoked_at = NULL, -- Reset revocation if re-invited
          created_at = now();

    -- Audit Log
    INSERT INTO public.audit_logs (cafe_id, actor_id, event_type, target_email, metadata)
    VALUES (
      _cafe_id,
      auth.uid(),
      'INVITE_CREATED',
      _email_norm,
      jsonb_build_object('role', _role, 'token_hash', _token_hash)
    );

    RETURN 'invited';
  END IF;

  -- User exists -> Delegate role binding to canonical helper
  SELECT id INTO _existing_invite FROM public.staff_invites 
   WHERE cafe_id = _cafe_id AND lower(email) = _email_norm AND role = _role AND accepted_at IS NULL LIMIT 1;

  PERFORM public.bind_staff_role_internal(_target, _cafe_id, _role, _existing_invite.id, 'ROLE_ASSIGNED');

  RETURN 'assigned';
END;
$$;

-- 5. Update accept_staff_invite to use canonical bind_staff_role_internal
CREATE OR REPLACE FUNCTION public.accept_staff_invite(_token_hash TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _invite RECORD;
  _user_id UUID := auth.uid();
  _user_email TEXT := lower(auth.jwt()->>'email');
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO _invite
    FROM public.staff_invites
   WHERE token_hash = _token_hash
     AND accepted_at IS NULL
     AND revoked_at IS NULL;

  IF _invite.id IS NULL THEN
    RAISE EXCEPTION 'Invalid, revoked, or already redeemed invitation token.';
  END IF;

  IF _invite.expires_at < now() THEN
    RAISE EXCEPTION 'This invitation token has expired.';
  END IF;

  IF lower(_invite.email) <> _user_email THEN
    RAISE EXCEPTION 'This invitation is issued to %, but you are signed in as %.', _invite.email, _user_email;
  END IF;

  -- Delegate to canonical role binding helper
  PERFORM public.bind_staff_role_internal(_user_id, _invite.cafe_id, _invite.role, _invite.id, 'INVITE_ACCEPTED');

  RETURN jsonb_build_object(
    'status', 'success',
    'cafe_id', _invite.cafe_id,
    'role', _invite.role
  );
END;
$$;

-- 6. Update handle_new_user trigger to delegate to canonical bind_staff_role_internal
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _email_norm text := lower(NEW.email);
  _inv RECORD;
BEGIN
  -- Profile Initialization Ownership
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'display_name',
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      split_part(NEW.email,'@',1)
    )
  )
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        display_name = COALESCE(public.profiles.display_name, EXCLUDED.display_name);

  -- Claim Valid Pending Invitations via Canonical Helper
  FOR _inv IN 
    SELECT * FROM public.staff_invites 
     WHERE lower(email) = _email_norm 
       AND accepted_at IS NULL 
       AND revoked_at IS NULL
       AND expires_at > now()
  LOOP
    PERFORM public.bind_staff_role_internal(NEW.id, _inv.cafe_id, _inv.role, _inv.id, 'INVITE_ACCEPTED');
  END LOOP;

  RETURN NEW;
END;
$$;
