-- Sprint 3B.1 Migration: Secure Database Foundation & Hardened Invites Infrastructure

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Harden staff_invites table
ALTER TABLE public.staff_invites
  ADD COLUMN IF NOT EXISTS token_hash TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ;

-- Backfill existing pending invitations with secure tokens if missing
UPDATE public.staff_invites
   SET token_hash = encode(extensions.gen_random_bytes(24), 'hex')
 WHERE token_hash IS NULL;

-- 2. Database Indexes
CREATE INDEX IF NOT EXISTS idx_user_roles_uid_cafe ON public.user_roles(user_id, cafe_id);
CREATE INDEX IF NOT EXISTS idx_staff_invites_email ON public.staff_invites(lower(email));
CREATE INDEX IF NOT EXISTS idx_staff_invites_token ON public.staff_invites(token_hash);
CREATE INDEX IF NOT EXISTS idx_orders_cafe_session ON public.orders(cafe_id, session_id);

-- 3. Audit Logs Foundation Table
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cafe_id UUID REFERENCES public.cafes(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  target_email TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_logs_owner_read" ON public.audit_logs;
CREATE POLICY "audit_logs_owner_read" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'owner', cafe_id) 
    OR public.is_demo_admin(auth.uid())
  );

-- 4. Restaurant Bootstrap RPC (First-owner provisioning)
CREATE OR REPLACE FUNCTION public.bootstrap_restaurant(
  _name TEXT,
  _slug TEXT,
  _owner_email TEXT,
  _currency TEXT DEFAULT 'USD'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _cafe_id UUID;
  _token_hash TEXT;
  _expires_at TIMESTAMPTZ := now() + interval '7 days';
  _owner_email_norm TEXT := lower(trim(_owner_email));
BEGIN
  -- Validate unique slug
  IF EXISTS (SELECT 1 FROM public.cafes WHERE lower(slug) = lower(trim(_slug))) THEN
    RAISE EXCEPTION 'Restaurant slug already exists: %', _slug;
  END IF;

  -- 1. Create Cafe Record
  INSERT INTO public.cafes (name, slug, currency)
  VALUES (trim(_name), lower(trim(_slug)), UPPER(trim(_currency)))
  RETURNING id INTO _cafe_id;

  -- 2. Generate Owner Invitation Token
  _token_hash := encode(extensions.gen_random_bytes(24), 'hex');

  INSERT INTO public.staff_invites (cafe_id, email, role, token_hash, expires_at)
  VALUES (_cafe_id, _owner_email_norm, 'owner', _token_hash, _expires_at);

  -- 3. Audit Log
  INSERT INTO public.audit_logs (cafe_id, actor_id, event_type, target_email, metadata)
  VALUES (
    _cafe_id,
    auth.uid(),
    'BOOTSTRAP_OWNER_CREATED',
    _owner_email_norm,
    jsonb_build_object('slug', lower(trim(_slug)), 'role', 'owner')
  );

  RETURN jsonb_build_object(
    'cafe_id', _cafe_id,
    'slug', lower(trim(_slug)),
    'token_hash', _token_hash,
    'expires_at', _expires_at
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.bootstrap_restaurant(text, text, text, text) TO service_role;

-- 5. Updated assign_role_by_email RPC with secure token generation & audit logging
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
  -- Authenticate actor
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Block role assignments for public demo cafe unless Demo Admin
  IF public.is_demo_cafe(_cafe_id) AND NOT public.is_demo_admin(auth.uid()) THEN
    RAISE EXCEPTION 'This action is disabled in the public demo.';
  END IF;

  IF NOT public.has_role(auth.uid(), 'owner', _cafe_id) THEN
    RAISE EXCEPTION 'Only cafe owners can assign roles';
  END IF;
  IF _role NOT IN ('staff','owner') THEN
    RAISE EXCEPTION 'Invalid role';
  END IF;

  -- Check if user already exists
  SELECT id INTO _target FROM auth.users WHERE lower(email) = _email_norm LIMIT 1;

  IF _target IS NULL THEN
    _token_hash := encode(extensions.gen_random_bytes(24), 'hex');

    INSERT INTO public.staff_invites (cafe_id, email, role, token_hash, expires_at, invited_by)
    VALUES (_cafe_id, _email_norm, _role, _token_hash, _expires_at, auth.uid())
    ON CONFLICT (cafe_id, email, role) DO UPDATE
      SET token_hash = EXCLUDED.token_hash,
          expires_at = EXCLUDED.expires_at,
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

  -- User exists -> direct role binding
  INSERT INTO public.user_roles (user_id, cafe_id, role)
  VALUES (_target, _cafe_id, _role)
  ON CONFLICT DO NOTHING;

  DELETE FROM public.staff_invites
   WHERE cafe_id = _cafe_id AND lower(email) = _email_norm AND role = _role;

  -- Audit Log
  INSERT INTO public.audit_logs (cafe_id, actor_id, event_type, target_email, metadata)
  VALUES (
    _cafe_id,
    auth.uid(),
    'ROLE_ASSIGNED',
    _email_norm,
    jsonb_build_object('role', _role, 'target_uid', _target)
  );

  RETURN 'assigned';
END;
$$;

-- 6. RPC: Accept Staff Invite via Token Hash
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
     AND accepted_at IS NULL;

  IF _invite.id IS NULL THEN
    RAISE EXCEPTION 'Invalid or already redeemed invitation token.';
  END IF;

  IF _invite.expires_at < now() THEN
    RAISE EXCEPTION 'This invitation token has expired.';
  END IF;

  IF lower(_invite.email) <> _user_email THEN
    RAISE EXCEPTION 'This invitation is issued to %, but you are signed in as %.', _invite.email, _user_email;
  END IF;

  -- Bind Role
  INSERT INTO public.user_roles (user_id, cafe_id, role)
  VALUES (_user_id, _invite.cafe_id, _invite.role)
  ON CONFLICT DO NOTHING;

  -- Mark Accepted
  UPDATE public.staff_invites
     SET accepted_at = now()
   WHERE id = _invite.id;

  -- Audit Log
  INSERT INTO public.audit_logs (cafe_id, actor_id, event_type, target_email, metadata)
  VALUES (
    _invite.cafe_id,
    _user_id,
    'INVITE_ACCEPTED',
    _user_email,
    jsonb_build_object('role', _invite.role, 'token_hash', _token_hash)
  );

  RETURN jsonb_build_object(
    'status', 'success',
    'cafe_id', _invite.cafe_id,
    'role', _invite.role
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_staff_invite(text) TO authenticated;

-- 7. Update handle_new_user() trigger for automated invitation processing
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
  -- Upsert Profile
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

  -- Claim Valid Non-Expired Invites
  FOR _inv IN 
    SELECT * FROM public.staff_invites 
     WHERE lower(email) = _email_norm 
       AND accepted_at IS NULL 
       AND expires_at > now()
  LOOP
    INSERT INTO public.user_roles (user_id, cafe_id, role)
    VALUES (NEW.id, _inv.cafe_id, _inv.role)
    ON CONFLICT DO NOTHING;

    UPDATE public.staff_invites
       SET accepted_at = now()
     WHERE id = _inv.id;

    INSERT INTO public.audit_logs (cafe_id, actor_id, event_type, target_email, metadata)
    VALUES (
      _inv.cafe_id,
      NEW.id,
      'INVITE_ACCEPTED',
      _email_norm,
      jsonb_build_object('role', _inv.role, 'auto_claimed', true)
    );
  END LOOP;

  RETURN NEW;
END;
$$;
