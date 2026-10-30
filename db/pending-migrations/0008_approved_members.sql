-- Approved members only. PENDING: written for review, NOT applied to any live database.
--
-- After this migration, signing up no longer grants the student role. A user holds a role only if
--   * their email is an issued teacher school email (teacher_accounts), or
--   * their email is on student_allowlist (with a role and, for students, a grade), or
--   * an admin approved their sign-up, or they hold a role already (user_roles).
-- Everyone else is "pending". Users who signed up under the old rule keep the student role they
-- already have; review them in user_roles if that is not wanted.

-- ---------------------------------------------------------------- tables

CREATE TABLE public.teacher_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_email text NOT NULL UNIQUE CHECK (school_email = lower(school_email)),
  user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  last_sign_in_at timestamptz,
  added_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.student_allowlist (
  email text PRIMARY KEY CHECK (email = lower(email)),
  role public.app_role NOT NULL CHECK (role IN ('student', 'parent')),
  grade int CHECK (grade BETWEEN 1 AND 12),
  added_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  -- A student needs a grade; a parent has none.
  CHECK ((role = 'student' AND grade IS NOT NULL) OR (role = 'parent' AND grade IS NULL))
);

CREATE TABLE public.rejected_signups (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  rejected_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Carry over teachers issued under the old teacher_allowlist (0005).
INSERT INTO public.teacher_accounts (school_email, user_id)
SELECT a.email, u.id
FROM public.teacher_allowlist a
LEFT JOIN auth.users u ON lower(u.email) = a.email
ON CONFLICT (school_email) DO NOTHING;

-- ---------------------------------------------------------------- RLS

ALTER TABLE public.teacher_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_allowlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rejected_signups ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.teacher_accounts, public.student_allowlist, public.rejected_signups TO authenticated;
GRANT ALL ON public.teacher_accounts, public.student_allowlist, public.rejected_signups TO service_role;

-- Admins read the tables directly; every write goes through the admin_* functions below.
CREATE POLICY "admins read teacher accounts" ON public.teacher_accounts FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "teachers read own account" ON public.teacher_accounts FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "admins read allowlist" ON public.student_allowlist FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins read rejected signups" ON public.rejected_signups FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ---------------------------------------------------------------- sign-up

-- Replaces the old trigger function: creates the profile but no longer grants the student role.
-- Roles come only from an issued teacher email or the student allowlist.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _email text := lower(NEW.email);
  _allow public.student_allowlist;
BEGIN
  SELECT * INTO _allow FROM public.student_allowlist WHERE email = _email;

  INSERT INTO public.profiles (id, display_name, grade)
  VALUES (
    NEW.id,
    coalesce(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    _allow.grade
  )
  ON CONFLICT (id) DO NOTHING;

  IF EXISTS (SELECT 1 FROM public.teacher_accounts WHERE school_email = _email) THEN
    UPDATE public.teacher_accounts SET user_id = NEW.id WHERE school_email = _email AND user_id IS NULL;
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'teacher') ON CONFLICT DO NOTHING;
  END IF;

  IF _allow.email IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, _allow.role) ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END $$;

-- The old teacher-only trigger is now covered by handle_new_user.
DROP TRIGGER IF EXISTS on_auth_user_created_teacher ON auth.users;
DROP FUNCTION IF EXISTS public.grant_allowlisted_teacher();

-- ---------------------------------------------------------------- the caller's own access

-- Called by the app on each request. Links a teacher to their account (school email only),
-- records the sign-in at most once an hour, and returns the facts the access policy needs.
CREATE OR REPLACE FUNCTION public.get_my_access_facts()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _email text;
  _t public.teacher_accounts;
  _allow public.student_allowlist;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not signed in'; END IF;
  SELECT lower(email) INTO _email FROM auth.users WHERE id = _uid;

  UPDATE public.teacher_accounts
     SET user_id = _uid,
         last_sign_in_at = CASE
           WHEN last_sign_in_at IS NULL OR last_sign_in_at < now() - interval '1 hour' THEN now()
           ELSE last_sign_in_at END
   WHERE school_email = _email AND (user_id IS NULL OR user_id = _uid)
  RETURNING * INTO _t;
  IF _t.id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (_uid, 'teacher') ON CONFLICT DO NOTHING;
  END IF;

  SELECT * INTO _allow FROM public.student_allowlist WHERE email = _email;
  IF _allow.email IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (_uid, _allow.role) ON CONFLICT DO NOTHING;
    IF _allow.grade IS NOT NULL THEN
      UPDATE public.profiles SET grade = _allow.grade WHERE id = _uid AND grade IS NULL;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'is_admin', public.has_role(_uid, 'admin'),
    'teacher', CASE WHEN _t.id IS NULL THEN NULL ELSE to_jsonb(_t) END,
    'allowlist_role', _allow.role
  );
END $$;

-- ---------------------------------------------------------------- admin functions
-- Each one checks the admin role itself, so a stray grant can never open them up.

-- The old teacher functions are replaced by ones that use teacher_accounts.
DROP FUNCTION IF EXISTS public.admin_list_teachers();

CREATE OR REPLACE FUNCTION public.admin_list_teachers()
RETURNS SETOF public.teacher_accounts LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN QUERY SELECT * FROM public.teacher_accounts ORDER BY created_at DESC;
END $$;

CREATE OR REPLACE FUNCTION public.admin_add_teacher(_email text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _clean text := lower(btrim(_email));
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _clean IS NULL OR _clean !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' THEN RAISE EXCEPTION 'invalid email'; END IF;
  INSERT INTO public.teacher_accounts (school_email, user_id, added_by)
  VALUES (_clean, (SELECT id FROM auth.users WHERE lower(email) = _clean), auth.uid())
  ON CONFLICT (school_email) DO NOTHING;
  -- Someone already signed up with this address: they become a teacher now.
  INSERT INTO public.user_roles (user_id, role)
  SELECT id, 'teacher' FROM auth.users WHERE lower(email) = _clean
  ON CONFLICT DO NOTHING;
END $$;

CREATE OR REPLACE FUNCTION public.admin_remove_teacher(_email text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _clean text := lower(btrim(_email));
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  DELETE FROM public.user_roles
   WHERE role = 'teacher' AND user_id IN (SELECT id FROM auth.users WHERE lower(email) = _clean);
  DELETE FROM public.teacher_accounts WHERE school_email = _clean;
END $$;

CREATE OR REPLACE FUNCTION public.admin_list_allowlist()
RETURNS SETOF public.student_allowlist LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN QUERY SELECT * FROM public.student_allowlist ORDER BY created_at DESC;
END $$;

-- Add or update one allowlist entry. A student needs a grade 1-12; a parent has none.
CREATE OR REPLACE FUNCTION public.admin_set_allowlist(_email text, _role public.app_role, _grade int)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _clean text := lower(btrim(_email)); _uid uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _clean IS NULL OR _clean !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' THEN RAISE EXCEPTION 'invalid email'; END IF;
  IF _role NOT IN ('student', 'parent') THEN RAISE EXCEPTION 'invalid role'; END IF;
  IF _role = 'student' AND (_grade IS NULL OR _grade NOT BETWEEN 1 AND 12) THEN RAISE EXCEPTION 'grade required'; END IF;
  IF _role = 'parent' THEN _grade := NULL; END IF;

  INSERT INTO public.student_allowlist (email, role, grade, added_by)
  VALUES (_clean, _role, _grade, auth.uid())
  ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role, grade = EXCLUDED.grade;

  -- If they already have an account, grant the role and grade now.
  SELECT id INTO _uid FROM auth.users WHERE lower(email) = _clean;
  IF _uid IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (_uid, _role) ON CONFLICT DO NOTHING;
    IF _grade IS NOT NULL THEN UPDATE public.profiles SET grade = _grade WHERE id = _uid; END IF;
    DELETE FROM public.rejected_signups WHERE user_id = _uid;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.admin_remove_allowlist(_email text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _clean text := lower(btrim(_email)); _role public.app_role;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT role INTO _role FROM public.student_allowlist WHERE email = _clean;
  IF _role IS NULL THEN RETURN; END IF;
  DELETE FROM public.user_roles
   WHERE role = _role AND user_id IN (SELECT id FROM auth.users WHERE lower(email) = _clean);
  DELETE FROM public.student_allowlist WHERE email = _clean;
END $$;

-- Sign-ups with no role that nobody has rejected.
CREATE OR REPLACE FUNCTION public.admin_list_pending_signups()
RETURNS TABLE(user_id uuid, email text, created_at timestamptz) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN QUERY
  SELECT u.id, u.email::text, u.created_at
    FROM auth.users u
   WHERE u.email IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = u.id)
     AND NOT EXISTS (SELECT 1 FROM public.rejected_signups j WHERE j.user_id = u.id)
   ORDER BY u.created_at DESC;
END $$;

CREATE OR REPLACE FUNCTION public.admin_approve_signup(_user_id uuid, _role public.app_role, _grade int)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _email text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT lower(email) INTO _email FROM auth.users WHERE id = _user_id;
  IF _email IS NULL THEN RAISE EXCEPTION 'user not found'; END IF;
  -- Recording the allowlist entry keeps the approval if the account is ever recreated.
  PERFORM public.admin_set_allowlist(_email, _role, _grade);
END $$;

CREATE OR REPLACE FUNCTION public.admin_reject_signup(_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _email text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT email INTO _email FROM auth.users WHERE id = _user_id;
  IF _email IS NULL THEN RAISE EXCEPTION 'user not found'; END IF;
  INSERT INTO public.rejected_signups (user_id, email, rejected_by)
  VALUES (_user_id, _email, auth.uid())
  ON CONFLICT (user_id) DO NOTHING;
END $$;

-- ---------------------------------------------------------------- execute rights

REVOKE EXECUTE ON FUNCTION
  public.get_my_access_facts(),
  public.admin_list_teachers(), public.admin_add_teacher(text), public.admin_remove_teacher(text),
  public.admin_list_allowlist(), public.admin_set_allowlist(text, public.app_role, int), public.admin_remove_allowlist(text),
  public.admin_list_pending_signups(), public.admin_approve_signup(uuid, public.app_role, int), public.admin_reject_signup(uuid)
FROM anon, public;

GRANT EXECUTE ON FUNCTION
  public.get_my_access_facts(),
  public.admin_list_teachers(), public.admin_add_teacher(text), public.admin_remove_teacher(text),
  public.admin_list_allowlist(), public.admin_set_allowlist(text, public.app_role, int), public.admin_remove_allowlist(text),
  public.admin_list_pending_signups(), public.admin_approve_signup(uuid, public.app_role, int), public.admin_reject_signup(uuid)
TO authenticated;
