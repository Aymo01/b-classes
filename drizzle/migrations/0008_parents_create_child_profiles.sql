-- B-Classes: parents create accounts for their children.
-- Children never sign in. A child profile has no login and is managed only by its parent.

-- 1. Allow a profile row that has no login (the child).
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_class ref ON ref.oid = con.confrelid
    JOIN pg_namespace n ON n.oid = ref.relnamespace
    WHERE rel.relname = 'profiles'
      AND con.contype = 'f'
      AND n.nspname = 'auth'
  LOOP
    EXECUTE format('ALTER TABLE public.profiles DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

-- 2. Record which parent manages each child profile.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS managed_by_parent uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- 3. Parents can read the child profiles they manage.
DROP POLICY IF EXISTS "parents read managed children" ON public.profiles;
CREATE POLICY "parents read managed children"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (managed_by_parent = auth.uid());

-- 4. Create a child: profile + parent link, in one step. Only parents can call it.
CREATE OR REPLACE FUNCTION public.create_child_profile(_display_name text, _grade int)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id uuid := gen_random_uuid();
BEGIN
  IF NOT public.has_role(_role => 'parent', _user_id => auth.uid()) THEN
    RAISE EXCEPTION 'only parents can create child accounts';
  END IF;

  IF _display_name IS NULL OR length(trim(_display_name)) = 0 THEN
    RAISE EXCEPTION 'child name is required';
  END IF;

  IF _grade IS NULL OR _grade < 1 OR _grade > 12 THEN
    RAISE EXCEPTION 'grade must be between 1 and 12';
  END IF;

  INSERT INTO public.profiles (id, display_name, grade, managed_by_parent)
  VALUES (new_id, trim(_display_name), _grade, auth.uid());

  INSERT INTO public.parent_links (parent_id, student_id)
  VALUES (auth.uid(), new_id);

  RETURN new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_child_profile(text, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_child_profile(text, int) TO authenticated;
