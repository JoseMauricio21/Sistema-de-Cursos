-- ========================================
-- ADMIN LMS SCHEMA + POLICIES (SUPABASE)
-- ========================================
-- Execute this script in Supabase SQL Editor.
-- It extends the existing schema to support a full admin dashboard.

begin;

create extension if not exists pgcrypto;

-- ========================================
-- HELPER FUNCTIONS
-- ========================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

-- ========================================
-- PROFILES UPDATES
-- ========================================

alter table public.profiles
    add column if not exists username text,
    add column if not exists role text not null default 'student';

-- Ensure role constraint exists only once.
do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conname = 'profiles_role_check'
          and conrelid = 'public.profiles'::regclass
    ) then
        alter table public.profiles
            add constraint profiles_role_check
            check (role in ('student', 'admin'));
    end if;
end $$;

-- Normalize existing usernames from email if needed.
update public.profiles
set username = split_part(lower(email), '@', 1)
where username is null
  and email is not null;

-- Avoid collisions before creating the unique index.
with ranked as (
    select
        id,
        username,
        row_number() over (partition by lower(username) order by created_at, id) as rn
    from public.profiles
    where username is not null
)
update public.profiles p
set username = p.username || '_' || substring(p.id::text, 1, 4)
from ranked r
where p.id = r.id
  and r.rn > 1;

create unique index if not exists idx_profiles_username_unique
    on public.profiles (lower(username))
    where username is not null;

create index if not exists idx_profiles_role
    on public.profiles (role);

alter table public.profiles enable row level security;

create or replace function public.is_admin(user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1
        from public.profiles p
        where p.id = user_id
          and p.role = 'admin'
    );
$$;

revoke all on function public.is_admin(uuid) from public;
grant execute on function public.is_admin(uuid) to authenticated;

create or replace function public.resolve_login_email(p_identifier text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
    v_identifier text;
    v_email text;
begin
    v_identifier := lower(trim(coalesce(p_identifier, '')));

    if v_identifier = '' then
        return null;
    end if;

    if position('@' in v_identifier) > 0 then
        return v_identifier;
    end if;

    select p.email
    into v_email
    from public.profiles p
    where lower(p.username) = v_identifier
    limit 1;

    return v_email;
end;
$$;

revoke all on function public.resolve_login_email(text) from public;
grant execute on function public.resolve_login_email(text) to anon, authenticated;

-- Replace profile policies with admin-aware policies.
drop policy if exists "Users can view their own profile" on public.profiles;
drop policy if exists "Users can update their own profile" on public.profiles;
drop policy if exists "Users can insert their own profile" on public.profiles;
drop policy if exists "Users can delete their own profile" on public.profiles;
drop policy if exists profiles_select_own_or_admin on public.profiles;
drop policy if exists profiles_update_own_or_admin on public.profiles;
drop policy if exists profiles_insert_own on public.profiles;

create policy profiles_select_own_or_admin
on public.profiles
for select
using (auth.uid() = id or public.is_admin(auth.uid()));

create policy profiles_update_own_or_admin
on public.profiles
for update
using (auth.uid() = id or public.is_admin(auth.uid()))
with check (auth.uid() = id or public.is_admin(auth.uid()));

create policy profiles_insert_own
on public.profiles
for insert
with check (auth.uid() = id or public.is_admin(auth.uid()));

-- Keep updated_at current.
drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

-- ========================================
-- ADMIN PERMISSIONS
-- ========================================

create table if not exists public.admin_permissions (
    id bigserial primary key,
    admin_id uuid not null references public.profiles(id) on delete cascade,
    permission_code text not null,
    is_enabled boolean not null default true,
    created_at timestamptz not null default now(),
    unique (admin_id, permission_code)
);

alter table public.admin_permissions enable row level security;

drop policy if exists admin_permissions_admin_only on public.admin_permissions;
create policy admin_permissions_admin_only
on public.admin_permissions
for all
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

-- ========================================
-- COURSES + LESSON BUILDER
-- ========================================

create table if not exists public.courses (
    id uuid primary key default gen_random_uuid(),
    created_by uuid not null references public.profiles(id) on delete restrict,
    title text not null,
    description text,
    cover_image_url text,
    status text not null default 'draft' check (status in ('draft', 'published')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.course_assignments (
    id uuid primary key default gen_random_uuid(),
    course_id uuid not null references public.courses(id) on delete cascade,
    student_id uuid not null references public.profiles(id) on delete cascade,
    assigned_by uuid not null references public.profiles(id) on delete restrict,
    is_visible boolean not null default true,
    assigned_at timestamptz not null default now(),
    unique (course_id, student_id)
);

create table if not exists public.course_lessons (
    id uuid primary key default gen_random_uuid(),
    course_id uuid not null references public.courses(id) on delete cascade,
    title text not null,
    description text,
    position integer not null default 1,
    is_published boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (course_id, position)
);

create table if not exists public.lesson_blocks (
    id uuid primary key default gen_random_uuid(),
    lesson_id uuid not null references public.course_lessons(id) on delete cascade,
    position integer not null,
    block_type text not null check (block_type in ('text', 'image', 'youtube')),
    content_text text,
    media_url text,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    unique (lesson_id, position)
);

create table if not exists public.lesson_questions (
    id uuid primary key default gen_random_uuid(),
    lesson_id uuid not null references public.course_lessons(id) on delete cascade,
    question_text text not null,
    question_type text not null default 'single' check (question_type in ('single', 'multiple', 'short')),
    options jsonb,
    correct_answer jsonb,
    is_required boolean not null default true,
    created_at timestamptz not null default now()
);

create index if not exists idx_courses_created_by on public.courses(created_by);
create index if not exists idx_courses_status on public.courses(status);
create index if not exists idx_course_assignments_student on public.course_assignments(student_id);
create index if not exists idx_lessons_course on public.course_lessons(course_id, position);
create index if not exists idx_blocks_lesson on public.lesson_blocks(lesson_id, position);
create index if not exists idx_lesson_questions_lesson on public.lesson_questions(lesson_id);

alter table public.courses enable row level security;
alter table public.course_assignments enable row level security;
alter table public.course_lessons enable row level security;
alter table public.lesson_blocks enable row level security;
alter table public.lesson_questions enable row level security;

-- Courses policies

drop policy if exists courses_admin_manage on public.courses;
drop policy if exists courses_student_read_assigned on public.courses;

create policy courses_admin_manage
on public.courses
for all
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

create policy courses_student_read_assigned
on public.courses
for select
using (
    public.is_admin(auth.uid())
    or exists (
        select 1
        from public.course_assignments ca
        where ca.course_id = courses.id
          and ca.student_id = auth.uid()
          and ca.is_visible = true
    )
);

-- Course assignments policies

drop policy if exists course_assignments_admin_manage on public.course_assignments;
drop policy if exists course_assignments_student_read_own on public.course_assignments;

create policy course_assignments_admin_manage
on public.course_assignments
for all
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

create policy course_assignments_student_read_own
on public.course_assignments
for select
using (student_id = auth.uid());

-- Lessons policies

drop policy if exists lessons_admin_manage on public.course_lessons;
drop policy if exists lessons_student_read on public.course_lessons;

create policy lessons_admin_manage
on public.course_lessons
for all
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

create policy lessons_student_read
on public.course_lessons
for select
using (
    public.is_admin(auth.uid())
    or (
        is_published = true
        and exists (
            select 1
            from public.course_assignments ca
            where ca.course_id = course_lessons.course_id
              and ca.student_id = auth.uid()
              and ca.is_visible = true
        )
    )
);

-- Lesson blocks policies

drop policy if exists lesson_blocks_admin_manage on public.lesson_blocks;
drop policy if exists lesson_blocks_student_read on public.lesson_blocks;

create policy lesson_blocks_admin_manage
on public.lesson_blocks
for all
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

create policy lesson_blocks_student_read
on public.lesson_blocks
for select
using (
    public.is_admin(auth.uid())
    or exists (
        select 1
        from public.course_lessons l
        join public.course_assignments ca on ca.course_id = l.course_id
        where l.id = lesson_blocks.lesson_id
          and l.is_published = true
          and ca.student_id = auth.uid()
          and ca.is_visible = true
    )
);

-- Lesson questions policies

drop policy if exists lesson_questions_admin_manage on public.lesson_questions;
drop policy if exists lesson_questions_student_read on public.lesson_questions;

create policy lesson_questions_admin_manage
on public.lesson_questions
for all
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

create policy lesson_questions_student_read
on public.lesson_questions
for select
using (
    public.is_admin(auth.uid())
    or exists (
        select 1
        from public.course_lessons l
        join public.course_assignments ca on ca.course_id = l.course_id
        where l.id = lesson_questions.lesson_id
          and l.is_published = true
          and ca.student_id = auth.uid()
          and ca.is_visible = true
    )
);

-- updated_at triggers

drop trigger if exists trg_courses_updated_at on public.courses;
create trigger trg_courses_updated_at
before update on public.courses
for each row execute function public.set_updated_at();

drop trigger if exists trg_course_lessons_updated_at on public.course_lessons;
create trigger trg_course_lessons_updated_at
before update on public.course_lessons
for each row execute function public.set_updated_at();

-- ========================================
-- LIVE EVENTS
-- ========================================

create table if not exists public.live_events (
    id uuid primary key default gen_random_uuid(),
    created_by uuid not null references public.profiles(id) on delete restrict,
    title text not null,
    description text,
    youtube_url text not null,
    starts_at timestamptz,
    status text not null default 'draft' check (status in ('draft', 'published')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.live_assignments (
    id uuid primary key default gen_random_uuid(),
    live_id uuid not null references public.live_events(id) on delete cascade,
    student_id uuid not null references public.profiles(id) on delete cascade,
    assigned_by uuid not null references public.profiles(id) on delete restrict,
    is_visible boolean not null default true,
    assigned_at timestamptz not null default now(),
    unique (live_id, student_id)
);

create index if not exists idx_live_events_status on public.live_events(status);
create index if not exists idx_live_assignments_student on public.live_assignments(student_id);

alter table public.live_events enable row level security;
alter table public.live_assignments enable row level security;

drop policy if exists live_events_admin_manage on public.live_events;
drop policy if exists live_events_student_read on public.live_events;

create policy live_events_admin_manage
on public.live_events
for all
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

create policy live_events_student_read
on public.live_events
for select
using (
    public.is_admin(auth.uid())
    or (
        status = 'published'
        and exists (
            select 1
            from public.live_assignments la
            where la.live_id = live_events.id
              and la.student_id = auth.uid()
              and la.is_visible = true
        )
    )
);

drop policy if exists live_assignments_admin_manage on public.live_assignments;
drop policy if exists live_assignments_student_read on public.live_assignments;

create policy live_assignments_admin_manage
on public.live_assignments
for all
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

create policy live_assignments_student_read
on public.live_assignments
for select
using (student_id = auth.uid());

drop trigger if exists trg_live_events_updated_at on public.live_events;
create trigger trg_live_events_updated_at
before update on public.live_events
for each row execute function public.set_updated_at();

-- ========================================
-- EXAMS
-- ========================================

create table if not exists public.exams (
    id uuid primary key default gen_random_uuid(),
    created_by uuid not null references public.profiles(id) on delete restrict,
    title text not null,
    description text,
    status text not null default 'draft' check (status in ('draft', 'published')),
    available_from timestamptz,
    available_to timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.exam_questions (
    id uuid primary key default gen_random_uuid(),
    exam_id uuid not null references public.exams(id) on delete cascade,
    position integer not null,
    question_text text not null,
    question_type text not null default 'single' check (question_type in ('single', 'multiple', 'short')),
    options jsonb,
    correct_answer jsonb,
    points numeric(6,2) not null default 1,
    created_at timestamptz not null default now(),
    unique (exam_id, position)
);

create table if not exists public.exam_assignments (
    id uuid primary key default gen_random_uuid(),
    exam_id uuid not null references public.exams(id) on delete cascade,
    student_id uuid not null references public.profiles(id) on delete cascade,
    assigned_by uuid not null references public.profiles(id) on delete restrict,
    status text not null default 'assigned' check (status in ('assigned', 'published', 'completed')),
    score numeric(6,2),
    assigned_at timestamptz not null default now(),
    unique (exam_id, student_id)
);

create index if not exists idx_exams_status on public.exams(status);
create index if not exists idx_exam_assignments_student on public.exam_assignments(student_id);

alter table public.exams enable row level security;
alter table public.exam_questions enable row level security;
alter table public.exam_assignments enable row level security;

drop policy if exists exams_admin_manage on public.exams;
drop policy if exists exams_student_read on public.exams;

create policy exams_admin_manage
on public.exams
for all
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

create policy exams_student_read
on public.exams
for select
using (
    public.is_admin(auth.uid())
    or (
        status = 'published'
        and exists (
            select 1
            from public.exam_assignments ea
            where ea.exam_id = exams.id
              and ea.student_id = auth.uid()
        )
    )
);

drop policy if exists exam_questions_admin_manage on public.exam_questions;
drop policy if exists exam_questions_student_read on public.exam_questions;

create policy exam_questions_admin_manage
on public.exam_questions
for all
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

create policy exam_questions_student_read
on public.exam_questions
for select
using (
    public.is_admin(auth.uid())
    or exists (
        select 1
        from public.exams e
        join public.exam_assignments ea on ea.exam_id = e.id
        where e.id = exam_questions.exam_id
          and e.status = 'published'
          and ea.student_id = auth.uid()
    )
);

drop policy if exists exam_assignments_admin_manage on public.exam_assignments;
drop policy if exists exam_assignments_student_read on public.exam_assignments;
drop policy if exists exam_assignments_student_update on public.exam_assignments;

create policy exam_assignments_admin_manage
on public.exam_assignments
for all
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

create policy exam_assignments_student_read
on public.exam_assignments
for select
using (student_id = auth.uid());

create policy exam_assignments_student_update
on public.exam_assignments
for update
using (student_id = auth.uid())
with check (student_id = auth.uid());

drop trigger if exists trg_exams_updated_at on public.exams;
create trigger trg_exams_updated_at
before update on public.exams
for each row execute function public.set_updated_at();

-- ========================================
-- GROUPS
-- ========================================

create table if not exists public.student_groups (
    id uuid primary key default gen_random_uuid(),
    created_by uuid not null references public.profiles(id) on delete restrict,
    name text not null,
    description text,
    created_at timestamptz not null default now(),
    unique (name)
);

create table if not exists public.group_members (
    id uuid primary key default gen_random_uuid(),
    group_id uuid not null references public.student_groups(id) on delete cascade,
    student_id uuid not null references public.profiles(id) on delete cascade,
    added_by uuid not null references public.profiles(id) on delete restrict,
    added_at timestamptz not null default now(),
    unique (group_id, student_id)
);

create table if not exists public.group_course_assignments (
    id uuid primary key default gen_random_uuid(),
    group_id uuid not null references public.student_groups(id) on delete cascade,
    course_id uuid not null references public.courses(id) on delete cascade,
    assigned_by uuid not null references public.profiles(id) on delete restrict,
    assigned_at timestamptz not null default now(),
    unique (group_id, course_id)
);

create index if not exists idx_group_members_student on public.group_members(student_id);

alter table public.student_groups enable row level security;
alter table public.group_members enable row level security;
alter table public.group_course_assignments enable row level security;

drop policy if exists groups_admin_manage on public.student_groups;
drop policy if exists groups_student_read on public.student_groups;

create policy groups_admin_manage
on public.student_groups
for all
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

create policy groups_student_read
on public.student_groups
for select
using (
    public.is_admin(auth.uid())
    or exists (
        select 1
        from public.group_members gm
        where gm.group_id = student_groups.id
          and gm.student_id = auth.uid()
    )
);

drop policy if exists group_members_admin_manage on public.group_members;
drop policy if exists group_members_student_read on public.group_members;

create policy group_members_admin_manage
on public.group_members
for all
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

create policy group_members_student_read
on public.group_members
for select
using (student_id = auth.uid());

drop policy if exists group_course_assignments_admin_manage on public.group_course_assignments;
drop policy if exists group_course_assignments_student_read on public.group_course_assignments;

create policy group_course_assignments_admin_manage
on public.group_course_assignments
for all
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

create policy group_course_assignments_student_read
on public.group_course_assignments
for select
using (
    public.is_admin(auth.uid())
    or exists (
        select 1
        from public.group_members gm
        where gm.group_id = group_course_assignments.group_id
          and gm.student_id = auth.uid()
    )
);

-- ========================================
-- ADMIN RPC: UPDATE STUDENT DATA + PASSWORD
-- ========================================

create or replace function public.admin_update_student_profile(
    p_student_id uuid,
    p_email text default null,
    p_password text default null,
    p_full_name text default null,
    p_username text default null,
    p_avatar_url text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_profile public.profiles%rowtype;
    v_clean_password text;
begin
    if not public.is_admin(auth.uid()) then
        raise exception 'Only admins can execute this function';
    end if;

    -- Update auth.users email when provided.
    if p_email is not null and length(trim(p_email)) > 0 then
        update auth.users
        set email = trim(lower(p_email)),
            updated_at = now()
        where id = p_student_id;
    end if;

    -- Update password directly in auth.users (admin operation).
    if p_password is not null and length(trim(p_password)) > 0 then
        v_clean_password := trim(p_password);

        if length(v_clean_password) < 6 then
            raise exception 'Password must have at least 6 characters';
        end if;

        update auth.users
        set encrypted_password = crypt(v_clean_password, gen_salt('bf')),
            updated_at = now()
        where id = p_student_id;
    end if;

    update public.profiles
    set email = coalesce(nullif(trim(lower(p_email)), ''), email),
        full_name = coalesce(nullif(trim(p_full_name), ''), full_name),
        username = coalesce(nullif(trim(lower(p_username)), ''), username),
        avatar_url = coalesce(nullif(trim(p_avatar_url), ''), avatar_url),
        updated_at = now()
    where id = p_student_id
    returning * into v_profile;

    if not found then
        raise exception 'Student profile not found';
    end if;

    return to_jsonb(v_profile);
end;
$$;

revoke all on function public.admin_update_student_profile(uuid, text, text, text, text, text) from public;
grant execute on function public.admin_update_student_profile(uuid, text, text, text, text, text) to authenticated;

-- ========================================
-- TIFFANY ADMIN SETUP (MANUAL STEP)
-- ========================================
-- 1) In Supabase Auth, create the admin user first:
--    email: tiffany.admin@plataforma.com
--    password: acceso1@
--
-- 2) Then execute this block (update email if needed):
--
-- update public.profiles
-- set full_name = 'Tiffany',
--     username = 'tiff',
--     role = 'admin',
--     updated_at = now()
-- where email = 'tiffany.admin@plataforma.com';
--
-- insert into public.admin_permissions (admin_id, permission_code, is_enabled)
-- select p.id, perm.code, true
-- from public.profiles p
-- cross join (
--     values
--         ('courses.read'),
--         ('courses.create'),
--         ('students.manage'),
--         ('live.manage'),
--         ('exams.manage'),
--         ('groups.manage')
-- ) as perm(code)
-- where p.email = 'tiffany.admin@plataforma.com'
-- on conflict (admin_id, permission_code) do nothing;
--
-- App login supports username, so Tiffany can sign in with:
-- username: tiff
-- password: acceso1@

commit;
