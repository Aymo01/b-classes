-- 0008: members-only access. NOT APPLIED. Apply only when the client approves the database work.
-- Assumes has_role(uuid, app_role) exists (from migration 0000, which exists in the live database).
-- Review handle_new_user against the live function before applying: this replaces it.

-- 1. Teacher accounts: school email only. Teachers sign in with school_email and nothing else.
create table if not exists public.teacher_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete set null,
  school_email text not null unique check (school_email = lower(school_email)),
  last_sign_in_email text,
  created_at timestamptz not null default now()
);

-- 2. Approved students and parents, added by an admin.
create table if not exists public.student_allowlist (
  email text primary key check (email = lower(email)),
  role text not null check (role in ('student', 'parent')),
  grade int check (grade between 1 and 12),
  added_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check ((role = 'student') = (grade is not null))
);

-- 3. Sign-ups an admin has rejected. They stay pending and drop off the list.
create table if not exists public.rejected_signups (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.teacher_accounts enable row level security;
alter table public.student_allowlist enable row level security;
alter table public.rejected_signups enable row level security;

create policy "admins manage teacher accounts" on public.teacher_accounts for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
create policy "teachers read own account" on public.teacher_accounts for select to authenticated
  using (user_id = auth.uid());
create policy "admins manage allowlist" on public.student_allowlist for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
create policy "admins read rejected" on public.rejected_signups for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));

-- 4. Sign-up no longer grants a role. Every account starts pending.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, grade)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)), null)
  on conflict (id) do nothing;
  return new;
end $$;

-- 5. Sign-in check. Binds a teacher to their account and syncs the role rows that RLS reads.
create or replace function public.get_my_access_facts()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  _email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  _uid uuid := auth.uid();
  _teacher public.teacher_accounts;
  _allow record;
begin
  if _uid is null then return '{}'::jsonb; end if;

  update public.teacher_accounts
     set user_id = _uid, last_sign_in_email = _email
   where school_email = _email and (user_id is null or user_id = _uid)
   returning * into _teacher;

  if _teacher.id is not null then
    insert into public.user_roles (user_id, role) values (_uid, 'teacher') on conflict do nothing;
  end if;

  select * into _allow from public.student_allowlist where email = _email;
  if found then
    insert into public.user_roles (user_id, role) values (_uid, _allow.role::public.app_role) on conflict do nothing;
  end if;

  return jsonb_build_object(
    'is_admin', public.has_role(_uid, 'admin'),
    'teacher', case when _teacher.id is not null then to_jsonb(_teacher) else null end,
    'allowlist_role', case when found then _allow.role else null end
  );
end $$;

-- 6. Admin functions. Each one checks the admin role itself.
create or replace function public.admin_add_teacher_account(_school_email text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'forbidden'; end if;
  insert into public.teacher_accounts (school_email) values (lower(trim(_school_email)))
  on conflict (school_email) do nothing;
end $$;

create or replace function public.admin_remove_teacher_account(_school_email text)
returns void language plpgsql security definer set search_path = public as $$
declare _uid uuid;
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'forbidden'; end if;
  select user_id into _uid from public.teacher_accounts where school_email = lower(trim(_school_email));
  delete from public.teacher_accounts where school_email = lower(trim(_school_email));
  if _uid is not null then
    delete from public.user_roles where user_id = _uid and role = 'teacher';
  end if;
end $$;

create or replace function public.admin_add_allowlist(_email text, _role text, _grade int)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'forbidden'; end if;
  insert into public.student_allowlist (email, role, grade, added_by)
  values (lower(trim(_email)), _role, _grade, auth.uid())
  on conflict (email) do update set role = excluded.role, grade = excluded.grade;
end $$;

create or replace function public.admin_remove_allowlist(_email text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'forbidden'; end if;
  delete from public.student_allowlist where email = lower(trim(_email));
end $$;

create or replace function public.admin_list_pending_users()
returns table(user_id uuid, email text, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'forbidden'; end if;
  return query
  select u.id, lower(u.email)::text, u.created_at
  from auth.users u
  where not exists (select 1 from public.user_roles r where r.user_id = u.id)
    and not exists (select 1 from public.rejected_signups j where j.user_id = u.id)
  order by u.created_at desc;
end $$;

create or replace function public.admin_approve_pending_user(_user_id uuid, _email text, _role text, _grade int)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'forbidden'; end if;
  perform public.admin_add_allowlist(_email, _role, _grade);
  insert into public.user_roles (user_id, role) values (_user_id, _role::public.app_role) on conflict do nothing;
  if _role = 'student' and _grade is not null then
    update public.profiles set grade = _grade where id = _user_id;
  end if;
end $$;

create or replace function public.admin_reject_pending_user(_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'forbidden'; end if;
  insert into public.rejected_signups (user_id) values (_user_id) on conflict do nothing;
end $$;

-- 7. Only signed-in users can call these, never anonymous visitors.
revoke execute on function public.get_my_access_facts(), public.admin_add_teacher_account(text),
  public.admin_remove_teacher_account(text), public.admin_add_allowlist(text, text, int),
  public.admin_remove_allowlist(text), public.admin_list_pending_users(),
  public.admin_approve_pending_user(uuid, text, text, int), public.admin_reject_pending_user(uuid)
  from anon, public;
grant execute on function public.get_my_access_facts(), public.admin_add_teacher_account(text),
  public.admin_remove_teacher_account(text), public.admin_add_allowlist(text, text, int),
  public.admin_remove_allowlist(text), public.admin_list_pending_users(),
  public.admin_approve_pending_user(uuid, text, text, int), public.admin_reject_pending_user(uuid)
  to authenticated;
