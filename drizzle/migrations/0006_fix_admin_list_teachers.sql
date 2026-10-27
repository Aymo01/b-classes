CREATE OR REPLACE FUNCTION public.admin_list_teachers()
RETURNS TABLE(email text, has_account boolean, added_at timestamptz) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN QUERY
  SELECT a.email, EXISTS(SELECT 1 FROM auth.users u WHERE lower(u.email)=a.email), a.created_at FROM public.teacher_allowlist a
  UNION ALL
  SELECT lower(u.email)::text, true, u.created_at FROM public.user_roles r JOIN auth.users u ON u.id = r.user_id
   WHERE r.role='teacher' AND lower(u.email) NOT IN (SELECT t.email FROM public.teacher_allowlist t);
END $$;