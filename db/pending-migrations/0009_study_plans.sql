-- Study plans (step I). PENDING: written for review, not applied to any live database.

CREATE TABLE public.study_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'خطتي الأسبوعية',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.study_plan_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.study_plans(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  lesson_id uuid REFERENCES public.lessons(id) ON DELETE SET NULL,
  due_date date,
  done boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX study_plan_items_plan_idx ON public.study_plan_items (plan_id, created_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.study_plans, public.study_plan_items TO authenticated;
GRANT ALL ON public.study_plans, public.study_plan_items TO service_role;

ALTER TABLE public.study_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_plan_items ENABLE ROW LEVEL SECURITY;

-- Students manage their own plan.
CREATE POLICY "students manage own plan" ON public.study_plans FOR ALL TO authenticated
  USING (student_id = auth.uid())
  WITH CHECK (student_id = auth.uid());

-- Linked parents can read, never change.
CREATE POLICY "parents read linked plans" ON public.study_plans FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.parent_links pl
    WHERE pl.parent_id = auth.uid() AND pl.student_id = study_plans.student_id
  ));

-- Students manage items in their own plan.
CREATE POLICY "students manage own plan items" ON public.study_plan_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.study_plans p WHERE p.id = plan_id AND p.student_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.study_plans p WHERE p.id = plan_id AND p.student_id = auth.uid()));

CREATE POLICY "parents read linked plan items" ON public.study_plan_items FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.study_plans p
    JOIN public.parent_links pl ON pl.student_id = p.student_id
    WHERE p.id = plan_id AND pl.parent_id = auth.uid()
  ));
