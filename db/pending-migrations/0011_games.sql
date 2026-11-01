-- Games area. NOT applied to any live database (apply to a separate staging project first).
-- Everything the games area shows (games, branches, subjects, questions, results) lives in these tables.
-- Students never read game_items, game_runs or game_duels directly: the server reads them with the service role,
-- so answers cannot be fetched from the browser, and the server alone writes scores.

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

-- Play material per subject. No content ships with the app. Only status = 'approved' ever reaches a student.
-- kind: choice {prompt, options[], correct} | pair {left, right} | order {prompt, sequence[]} | card {front, back}
--       | ladder {start, target, words[]} | word {word, clue} | place {prompt, mapUrl, x, y, radius}
create table public.game_items (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects(id) on delete cascade,
  kind text not null check (kind in ('choice', 'pair', 'order', 'card', 'ladder', 'word', 'place')),
  topic text,
  qtype text,
  payload jsonb not null,
  status text not null default 'draft' check (status in ('draft', 'approved', 'rejected')),
  generated_by text not null default 'teacher' check (generated_by in ('ai', 'teacher')),
  source text,
  review_note text,
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index game_items_subject_idx on public.game_items (subject_id, kind, status);

-- One row per started play. The server picks the questions, records each checked answer and its timing.
create table public.game_runs (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  game_id uuid not null references public.games(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  item_ids uuid[] not null,
  layout jsonb,
  events jsonb not null default '[]'::jsonb,
  wrong_streak int not null default 0,
  locked_until timestamptz,
  duel_id uuid,
  daily boolean not null default false,
  play_date date not null default (now() at time zone 'Asia/Hebron')::date,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);
create unique index game_runs_daily_once on public.game_runs (student_id, game_id, play_date) where daily;
create index game_runs_student_idx on public.game_runs (student_id, started_at desc);

-- One row per finished play, written only by the server.
create table public.game_sessions (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null unique references public.game_runs(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  game_id uuid not null references public.games(id) on delete cascade,
  subject_id uuid references public.subjects(id) on delete set null,
  duel_id uuid,
  score int not null check (score >= 0),
  max_score int not null check (max_score > 0),
  duration_seconds int not null check (duration_seconds between 0 and 86400),
  details jsonb not null default '{}'::jsonb,
  play_date date not null default (now() at time zone 'Asia/Hebron')::date,
  played_at timestamptz not null default now(),
  check (score <= max_score)
);
create index game_sessions_student_idx on public.game_sessions (student_id, played_at desc);
create index game_sessions_day_idx on public.game_sessions (game_id, play_date);

-- Head-to-head quiz: the creator shares the code, the second student joins with it.
create table public.game_duels (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  game_id uuid not null references public.games(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  item_ids uuid[] not null,
  created_by uuid not null references public.profiles(id) on delete cascade,
  opponent_id uuid references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  check (opponent_id is null or opponent_id <> created_by)
);

alter table public.branches enable row level security;
alter table public.games enable row level security;
alter table public.game_items enable row level security;
alter table public.game_runs enable row level security;
alter table public.game_sessions enable row level security;
alter table public.game_duels enable row level security;

grant select on public.branches, public.games, public.game_sessions to authenticated;
grant select, insert, update, delete on public.game_items to authenticated;
grant insert, update, delete on public.games, public.branches to authenticated;
grant all on public.branches, public.games, public.game_items, public.game_runs, public.game_sessions, public.game_duels to service_role;
-- No grant on game_runs / game_duels and no insert grant on game_sessions for authenticated: only the server writes them.

create policy "members read branches" on public.branches for select to authenticated using (true);
create policy "members read games" on public.games for select to authenticated using (active or public.has_role(auth.uid(), 'admin'));
create policy "admins manage branches" on public.branches for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
create policy "admins manage games" on public.games for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

-- Teachers and admins see and review every item. Students have no policy at all, so a draft, a rejected
-- question or an answer key can never be read with a student's own session.
create policy "teachers manage game items" on public.game_items for all to authenticated
  using (public.has_role(auth.uid(), 'teacher') or public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'teacher') or public.has_role(auth.uid(), 'admin'));

-- Students read their own sessions; linked parents read (never change); teachers/admins read.
create policy "read own, child or class sessions" on public.game_sessions for select to authenticated
  using (
    student_id = auth.uid()
    or exists (select 1 from public.parent_links pl where pl.parent_id = auth.uid() and pl.student_id = game_sessions.student_id)
    or public.has_role(auth.uid(), 'teacher')
    or public.has_role(auth.uid(), 'admin')
  );
