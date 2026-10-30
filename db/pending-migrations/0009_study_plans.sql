-- 0009: study plans. NOT APPLIED. Depends on profiles, parent_links and lessons (live database).

create table if not exists public.study_plans (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null unique references public.profiles(id) on delete cascade,
  title text not null default 'خطتي الأسبوعية',
  created_at timestamptz not null default now()
);

create table if not exists public.study_plan_items (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.study_plans(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  lesson_id uuid references public.lessons(id) on delete set null,
  due_date date,
  done boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.study_plans enable row level security;
alter table public.study_plan_items enable row level security;

-- Students own their plan. Linked parents can read it, never change it.
create policy "student owns plan" on public.study_plans for all to authenticated
  using (student_id = auth.uid()) with check (student_id = auth.uid());
create policy "parent reads linked plan" on public.study_plans for select to authenticated
  using (exists (select 1 from public.parent_links pl where pl.student_id = study_plans.student_id and pl.parent_id = auth.uid()));

create policy "student owns plan items" on public.study_plan_items for all to authenticated
  using (exists (select 1 from public.study_plans p where p.id = plan_id and p.student_id = auth.uid()))
  with check (exists (select 1 from public.study_plans p where p.id = plan_id and p.student_id = auth.uid()));
create policy "parent reads linked plan items" on public.study_plan_items for select to authenticated
  using (exists (select 1 from public.study_plans p join public.parent_links pl on pl.student_id = p.student_id
                 where p.id = plan_id and pl.parent_id = auth.uid()));

grant select, insert, update, delete on public.study_plans, public.study_plan_items to authenticated;
