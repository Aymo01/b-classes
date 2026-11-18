-- B-Classes: students enroll with a teacher; teachers see only their own students.
-- PENDING: written for review, NOT applied to any live database.
--
-- How to run: Lovable > Cloud > Database > SQL editor. Paste this whole file and press Run.
-- Safe to run more than once. Run supabase/messaging-conversations.sql AFTER this file: its
-- conversation policy checks enrollments.

CREATE TABLE IF NOT EXISTS public.enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  teacher_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, teacher_id),
  CHECK (student_id <> teacher_id)
);
CREATE INDEX IF NOT EXISTS enrollments_teacher_idx ON public.enrollments (teacher_id);

GRANT SELECT, INSERT, DELETE ON public.enrollments TO authenticated;
GRANT ALL ON public.enrollments TO service_role;
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;

-- A student sees their own enrolments; a teacher sees the students enrolled with them;
-- a parent sees their linked children's.
DROP POLICY IF EXISTS "read own enrollments" ON public.enrollments;
CREATE POLICY "read own enrollments" ON public.enrollments FOR SELECT TO authenticated
  USING (
    student_id = auth.uid()
    OR teacher_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.parent_links l WHERE l.parent_id = auth.uid() AND l.student_id = enrollments.student_id)
  );

-- A student enrolls themself, and only with someone who holds the teacher role.
DROP POLICY IF EXISTS "student enrolls self" ON public.enrollments;
CREATE POLICY "student enrolls self" ON public.enrollments FOR INSERT TO authenticated
  WITH CHECK (
    student_id = auth.uid()
    AND public.has_role(_role => 'student', _user_id => auth.uid())
    AND public.has_role(_role => 'teacher', _user_id => teacher_id)
  );

-- A student leaves; the teacher cannot remove them here.
DROP POLICY IF EXISTS "student leaves" ON public.enrollments;
CREATE POLICY "student leaves" ON public.enrollments FOR DELETE TO authenticated
  USING (student_id = auth.uid());

-- Teachers listed for students to choose from. profiles is private to its owner, so this exposes
-- only the id and display name of accounts that hold the teacher role.
CREATE OR REPLACE FUNCTION public.list_teachers()
RETURNS TABLE (id uuid, display_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.display_name
  FROM public.profiles p
  WHERE public.has_role(_role => 'teacher', _user_id => p.id)
  ORDER BY p.display_name NULLS LAST;
$$;
REVOKE ALL ON FUNCTION public.list_teachers() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_teachers() TO authenticated;

-- A student can read the profile of a teacher they are enrolled with (to show the name).
-- (Adds access only. Existing policies are unchanged. Teachers already read all profiles.)
DROP POLICY IF EXISTS "students read enrolled teachers" ON public.profiles;
CREATE POLICY "students read enrolled teachers" ON public.profiles FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.enrollments e WHERE e.student_id = auth.uid() AND e.teacher_id = profiles.id));
