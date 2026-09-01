begin;

create extension if not exists pgcrypto;

-- =========================================================
-- 1) TABLAS BASE
-- =========================================================

drop table if exists public.admin_permissions cascade;
drop table if exists public.activity_logs cascade;
drop table if exists public.sessions cascade;
drop table if exists public.profiles cascade;

create table public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    email text not null unique,
    full_name text not null default '',
    username text,
    role text not null default 'student' check (role in ('student', 'admin')),
    avatar_url text,
    bio text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create table public.activity_logs (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.profiles(id) on delete cascade,
    action text not null,
    description text,
    ip_address inet,
    created_at timestamptz not null default now()
);

alter table public.activity_logs enable row level security;

create table public.sessions (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.profiles(id) on delete cascade,
    session_token text not null unique,
    expires_at timestamptz not null,
    created_at timestamptz not null default now()
);

alter table public.sessions enable row level security;

create table public.admin_permissions (
    id bigserial primary key,
    admin_id uuid not null references public.profiles(id) on delete cascade,
    permission_code text not null,
    is_enabled boolean not null default true,
    created_at timestamptz not null default now(),
    unique (admin_id, permission_code)
);

alter table public.admin_permissions enable row level security;

-- =========================================================
-- 2) ÍNDICES
-- =========================================================

create unique index if not exists idx_profiles_username_unique
    on public.profiles (lower(username))
    where username is not null;

create index if not exists idx_profiles_role
    on public.profiles (role);

create index if not exists idx_profiles_email
    on public.profiles (email);

create index if not exists idx_activity_logs_user_id
    on public.activity_logs (user_id);

create index if not exists idx_sessions_user_id
    on public.sessions (user_id);

-- =========================================================
-- 3) TRIGGERS / HELPERS
-- =========================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

-- =========================================================
-- 4) FUNCIONES DE PERMISOS
-- =========================================================

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

-- =========================================================
-- 5) RESOLVER LOGIN POR USERNAME O EMAIL
-- =========================================================

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

-- =========================================================
-- 6) CREAR PERFIL AL REGISTRAR USUARIO
-- =========================================================

create or replace function public.create_user_profile(
    user_id uuid,
    user_email text,
    user_full_name text,
    p_username text default null,
    p_role text default 'student'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_username text;
    v_full_name text;
    v_role text;
begin
    v_full_name := trim(coalesce(user_full_name, ''));
    if v_full_name = '' then
        v_full_name := split_part(coalesce(user_email, ''), '@', 1);
    end if;

    v_username := trim(coalesce(p_username, ''));
    if v_username = '' then
        v_username := split_part(lower(coalesce(user_email, '')), '@', 1);
    end if;

    v_username := lower(v_username);

    if v_role is null then
        v_role := 'student';
    end if;

    if lower(coalesce(p_role, 'student')) in ('admin', 'student') then
        v_role := lower(p_role);
    else
        v_role := 'student';
    end if;

    insert into public.profiles (
        id,
        email,
        full_name,
        username,
        role,
        avatar_url,
        created_at,
        updated_at
    )
    values (
        user_id,
        lower(user_email),
        v_full_name,
        v_username,
        v_role,
        null,
        now(),
        now()
    )
    on conflict (id) do update
    set
        email = excluded.email,
        full_name = excluded.full_name,
        username = excluded.username,
        role = excluded.role,
        updated_at = now();

    return jsonb_build_object(
        'success', true,
        'id', user_id,
        'email', lower(user_email),
        'full_name', v_full_name,
        'username', v_username,
        'role', v_role
    );
exception when others then
    return jsonb_build_object(
        'success', false,
        'error', sqlerrm
    );
end;
$$;

revoke all on function public.create_user_profile(uuid, text, text, text, text) from public;
grant execute on function public.create_user_profile(uuid, text, text, text, text) to anon, authenticated;

-- Trigger automático para crear perfil al crear usuario auth
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_username text;
    v_full_name text;
begin
    v_username := coalesce(
        nullif(trim(lower(new.raw_user_meta_data->>'username')), ''),
        split_part(lower(new.email), '@', 1)
    );

    v_full_name := coalesce(
        nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
        nullif(trim(new.raw_user_meta_data->>'name'), ''),
        split_part(new.email, '@', 1)
    );

    insert into public.profiles (
        id,
        email,
        full_name,
        username,
        role,
        avatar_url,
        created_at,
        updated_at
    )
    values (
        new.id,
        lower(new.email),
        v_full_name,
        v_username,
        'student',
        null,
        now(),
        now()
    )
    on conflict (id) do update
    set
        email = excluded.email,
        full_name = excluded.full_name,
        username = excluded.username,
        updated_at = now();

    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

-- =========================================================
-- 7) POLÍTICAS RLS
-- =========================================================

drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_or_admin"
on public.profiles
for select
using (auth.uid() = id or public.is_admin(auth.uid()));

drop policy if exists "profiles_update_own_or_admin" on public.profiles;
create policy "profiles_update_own_or_admin"
on public.profiles
for update
using (auth.uid() = id or public.is_admin(auth.uid()))
with check (auth.uid() = id or public.is_admin(auth.uid()));

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles
for insert
with check (auth.uid() = id or public.is_admin(auth.uid()));

drop policy if exists "profiles_delete_own_or_admin" on public.profiles;
create policy "profiles_delete_own_or_admin"
on public.profiles
for delete
using (auth.uid() = id or public.is_admin(auth.uid()));

drop policy if exists "activity_logs_select_own_or_admin" on public.activity_logs;
create policy "activity_logs_select_own_or_admin"
on public.activity_logs
for select
using (auth.uid() = user_id or public.is_admin(auth.uid()));

drop policy if exists "activity_logs_insert_own_or_admin" on public.activity_logs;
create policy "activity_logs_insert_own_or_admin"
on public.activity_logs
for insert
with check (auth.uid() = user_id or public.is_admin(auth.uid()));

drop policy if exists "sessions_select_own_or_admin" on public.sessions;
create policy "sessions_select_own_or_admin"
on public.sessions
for select
using (auth.uid() = user_id or public.is_admin(auth.uid()));

drop policy if exists "sessions_insert_own_or_admin" on public.sessions;
create policy "sessions_insert_own_or_admin"
on public.sessions
for insert
with check (auth.uid() = user_id or public.is_admin(auth.uid()));

drop policy if exists "sessions_update_own_or_admin" on public.sessions;
create policy "sessions_update_own_or_admin"
on public.sessions
for update
using (auth.uid() = user_id or public.is_admin(auth.uid()))
with check (auth.uid() = user_id or public.is_admin(auth.uid()));

drop policy if exists "sessions_delete_own_or_admin" on public.sessions;
create policy "sessions_delete_own_or_admin"
on public.sessions
for delete
using (auth.uid() = user_id or public.is_admin(auth.uid()));

drop policy if exists "admin_permissions_admin_only" on public.admin_permissions;
create policy "admin_permissions_admin_only"
on public.admin_permissions
for all
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

-- =========================================================
-- 8) VERIFICACIÓN FINAL
-- =========================================================

select
    routine_schema,
    routine_name,
    routine_type
from information_schema.routines
where routine_schema = 'public'
  and routine_name in ('is_admin', 'resolve_login_email', 'create_user_profile', 'handle_new_user')
order by routine_name;

commit;
