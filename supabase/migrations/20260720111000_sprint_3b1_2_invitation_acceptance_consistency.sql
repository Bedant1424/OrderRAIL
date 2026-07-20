-- Sprint 3B.1.2 Migration: Invitation Acceptance Consistency
-- Enforces explicit invitation acceptance for ALL users (both new and existing accounts)

-- Update assign_role_by_email to enforce single consistent flow:
-- Invitation Created -> Explicit Acceptance (via token/signup) -> Role Assigned
CREATE OR REPLACE FUNCTION public.assign_role_by_email(_cafe_id uuid, _email text, _role public.app_role)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
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

  -- 5. Generate Secure Cryptographic Token
  _token_hash := encode(extensions.gen_random_bytes(24), 'hex');

  -- 6. Unified Invitation Model: Upsert pending invite for ALL users (existing or new)
  -- Requires explicit token acceptance before any role is bound to user_roles
  INSERT INTO public.staff_invites (cafe_id, email, role, token_hash, expires_at, invited_by)
  VALUES (_cafe_id, _email_norm, _role, _token_hash, _expires_at, auth.uid())
  ON CONFLICT (cafe_id, email, role) DO UPDATE
    SET token_hash = EXCLUDED.token_hash,
        expires_at = EXCLUDED.expires_at,
        revoked_at = NULL, -- Clear any prior revocation on resend
        accepted_at = NULL, -- Reset acceptance for re-invites
        created_at = now();

  -- 7. Audit Log Entry
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
