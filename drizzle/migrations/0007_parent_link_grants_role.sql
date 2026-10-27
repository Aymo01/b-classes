CREATE OR REPLACE FUNCTION public.link_parent_by_code(_code text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE student uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not signed in'; END IF;
  SELECT id INTO student FROM public.profiles WHERE invite_code = lower(trim(_code));
  IF student IS NULL OR student = auth.uid() THEN RAISE EXCEPTION 'code not found'; END IF;
  INSERT INTO public.user_roles(user_id, role) VALUES (auth.uid(), 'parent') ON CONFLICT DO NOTHING;
  INSERT INTO public.parent_links (parent_id, student_id) VALUES (auth.uid(), student)
  ON CONFLICT (parent_id, student_id) DO NOTHING;
  RETURN student;
END $$;