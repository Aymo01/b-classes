CREATE TABLE public.teacher_allowlist (
  email text PRIMARY KEY,
  added_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.teacher_allowlist TO authenticated;
GRANT ALL ON public.teacher_allowlist TO service_role;
ALTER TABLE public.teacher_allowlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage allowlist" ON public.teacher_allowlist FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.admin_add_teacher(_email text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid; _clean text := lower(trim(_email));
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  INSERT INTO public.teacher_allowlist(email, added_by) VALUES (_clean, auth.uid()) ON CONFLICT (email) DO NOTHING;
  SELECT id INTO _uid FROM auth.users WHERE lower(email) = _clean;
  IF _uid IS NOT NULL THEN
    INSERT INTO public.user_roles(user_id, role) VALUES (_uid, 'teacher') ON CONFLICT DO NOTHING;
    RETURN true;
  END IF;
  RETURN false;
END $$;

CREATE OR REPLACE FUNCTION public.admin_remove_teacher(_email text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _clean text := lower(trim(_email));
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  DELETE FROM public.teacher_allowlist WHERE email = _clean;
  DELETE FROM public.user_roles WHERE role = 'teacher' AND user_id IN (SELECT id FROM auth.users WHERE lower(email) = _clean);
END $$;

CREATE OR REPLACE FUNCTION public.admin_list_teachers()
RETURNS TABLE(email text, has_account boolean, added_at timestamptz) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN QUERY
  SELECT a.email, EXISTS(SELECT 1 FROM auth.users u WHERE lower(u.email)=a.email), a.created_at FROM public.teacher_allowlist a
  UNION
  SELECT lower(u.email)::text, true, r.id IS NOT NULL AND false OR true AND now() IS NULL OR now() FROM public.user_roles r JOIN auth.users u ON u.id = r.user_id
   WHERE r.role='teacher' AND lower(u.email) NOT IN (SELECT email FROM public.teacher_allowlist);
END $$;

CREATE OR REPLACE FUNCTION public.grant_allowlisted_teacher()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.teacher_allowlist WHERE email = lower(NEW.email)) THEN
    INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id, 'teacher') ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER on_auth_user_created_teacher AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.grant_allowlisted_teacher();

REVOKE EXECUTE ON FUNCTION public.admin_add_teacher(text), public.admin_remove_teacher(text), public.admin_list_teachers() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.admin_add_teacher(text), public.admin_remove_teacher(text), public.admin_list_teachers() TO authenticated;