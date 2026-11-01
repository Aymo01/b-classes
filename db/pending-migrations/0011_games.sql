-- Games area. NOT applied to any live database.
-- Everything the games area shows (games, branches, subjects, questions, results) lives in these tables.

-- Branches of grades 10-12 (academic, vocational, scientific, ...).
create table public.branches (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  min_grade int not null check (min_grade between 1 and 12),
  max_grade int not null check (max_grade between 1 and 12),
  sort_order int not null default 0
);

alter table public.profiles add column if not exists branch_id uuid references public.branches(id);
alter table public.subjects add column if not exists branch_id uuid references public.branches(id);
alter table public.subjects add column if not exists category text;
alter table public.subjects alter column created_by drop not null;

-- The catalogue. engine picks the play screen, config tunes it. branch_slugs / categories null = no restriction.
create table public.games (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text,
  icon text not null default 'gamepad',
  engine text not null check (engine in ('choice', 'pair', 'order', 'cards', 'ladder', 'map', 'duel', 'crossword')),
  config jsonb not null default '{}'::jsonb,
  min_grade int not null check (min_grade between 1 and 12),
  max_grade int not null check (max_grade between 1 and 12),
  branch_slugs text[],
  categories text[],
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  check (min_grade <= max_grade)
);

-- Play material, written by teachers/admins per subject. No content is shipped with the app.
-- kind: choice {prompt, options[], correct} | pair {left, right} | order {prompt, sequence[]}
--       | card {front, back} | ladder {start, target, words[]}
create table public.game_items (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects(id) on delete cascade,
  kind text not null check (kind in ('choice', 'pair', 'order', 'card', 'ladder')),
  topic text,
  qtype text,
  payload jsonb not null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index game_items_subject_idx on public.game_items (subject_id, kind);

-- One row per play. Mirrors quiz_attempts (score / total / submitted time) so results read the same way.
create table public.game_sessions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  game_id uuid not null references public.games(id) on delete cascade,
  subject_id uuid references public.subjects(id) on delete set null,
  score int not null check (score >= 0),
  max_score int not null check (max_score > 0),
  duration_seconds int not null check (duration_seconds between 0 and 86400),
  details jsonb not null default '{}'::jsonb,
  played_at timestamptz not null default now(),
  check (score <= max_score)
);
create index game_sessions_student_idx on public.game_sessions (student_id, played_at desc);

alter table public.branches enable row level security;
alter table public.games enable row level security;
alter table public.game_items enable row level security;
alter table public.game_sessions enable row level security;

grant select on public.branches, public.games, public.game_items, public.game_sessions to authenticated;
grant insert, update, delete on public.games, public.game_items, public.branches to authenticated;
grant insert on public.game_sessions to authenticated;
grant all on public.branches, public.games, public.game_items, public.game_sessions to service_role;

create policy "members read branches" on public.branches for select to authenticated using (true);
create policy "members read games" on public.games for select to authenticated using (active or public.has_role(auth.uid(), 'admin'));
create policy "members read game items" on public.game_items for select to authenticated using (true);
create policy "admins manage branches" on public.branches for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
create policy "admins manage games" on public.games for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
create policy "teachers manage game items" on public.game_items for all to authenticated
  using (public.has_role(auth.uid(), 'teacher') or public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'teacher') or public.has_role(auth.uid(), 'admin'));

-- Students write and read only their own sessions; linked parents read (never change); teachers/admins read.
create policy "students record own sessions" on public.game_sessions for insert to authenticated
  with check (student_id = auth.uid());
create policy "read own, child or class sessions" on public.game_sessions for select to authenticated
  using (
    student_id = auth.uid()
    or exists (select 1 from public.parent_links pl where pl.parent_id = auth.uid() and pl.student_id = game_sessions.student_id)
    or public.has_role(auth.uid(), 'teacher')
    or public.has_role(auth.uid(), 'admin')
  );
