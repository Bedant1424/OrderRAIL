
CREATE TABLE IF NOT EXISTS public.staff_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cafe_id uuid NOT NULL REFERENCES public.cafes(id) ON DELETE CASCADE,
  email text NOT NULL,
  role public.app_role NOT NULL,
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cafe_id, email, role)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_invites TO authenticated;
GRANT ALL ON public.staff_invites TO service_role;

ALTER TABLE public.staff_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage invites for their cafe"
ON public.staff_invites
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'owner', cafe_id))
WITH CHECK (public.has_role(auth.uid(), 'owner', cafe_id));

DROP FUNCTION IF EXISTS public.assign_role_by_email(uuid, text, public.app_role);

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
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
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

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _email_norm text := lower(NEW.email);
BEGIN
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

  INSERT INTO public.user_roles (user_id, cafe_id, role)
  SELECT NEW.id, si.cafe_id, si.role
    FROM public.staff_invites si
   WHERE lower(si.email) = _email_norm
  ON CONFLICT DO NOTHING;

  DELETE FROM public.staff_invites WHERE lower(email) = _email_norm;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
