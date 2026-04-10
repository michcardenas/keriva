-- Sprint 1: Authentication baseline
--
-- Creates a `perfiles` table keyed on auth.users.id, a trigger that
-- auto-inserts a profile row when a new auth user signs up, RLS policies
-- for that table, and adds write policies to Precios and Puntos so an
-- authenticated user can only insert rows with their own usuario_id.
--
-- Notes:
--   * The legacy `Usuarios` table (bigint id) is left untouched. It is
--     empty and can be dropped in a later cleanup migration.
--   * Foreign keys on Precios.usuario_id / Puntos.usuario_id are added
--     here for data integrity. If those columns already contain data
--     that does not match auth.users, this migration would fail — but
--     both tables are currently empty so it is safe.

-- -----------------------------------------------------------------------
-- 1. perfiles table
-- -----------------------------------------------------------------------
create table if not exists public.perfiles (
  id          uuid         primary key references auth.users(id) on delete cascade,
  nombre      text,
  email       text,
  idioma      text         default 'es',
  ciudad      text,
  created_at  timestamptz  not null default now(),
  updated_at  timestamptz  not null default now()
);

alter table public.perfiles enable row level security;

-- Users can read their own profile
drop policy if exists "perfiles_select_self" on public.perfiles;
create policy "perfiles_select_self"
  on public.perfiles
  for select
  to authenticated
  using (auth.uid() = id);

-- Users can insert their own profile row (belt-and-braces; trigger also does it)
drop policy if exists "perfiles_insert_self" on public.perfiles;
create policy "perfiles_insert_self"
  on public.perfiles
  for insert
  to authenticated
  with check (auth.uid() = id);

-- Users can update their own profile
drop policy if exists "perfiles_update_self" on public.perfiles;
create policy "perfiles_update_self"
  on public.perfiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- -----------------------------------------------------------------------
-- 2. Trigger: auto-create profile row when a new auth.users row appears
-- -----------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.perfiles (id, email, nombre)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'nombre', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------
-- 3. FKs on Precios and Puntos
-- -----------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'precios_usuario_id_fkey'
  ) then
    alter table public."Precios"
      add constraint precios_usuario_id_fkey
      foreign key (usuario_id) references auth.users(id) on delete set null;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'puntos_usuario_id_fkey'
  ) then
    alter table public."Puntos"
      add constraint puntos_usuario_id_fkey
      foreign key (usuario_id) references auth.users(id) on delete cascade;
  end if;
end
$$;

-- -----------------------------------------------------------------------
-- 4. Precios write policy for authenticated users
-- -----------------------------------------------------------------------
drop policy if exists "Precios_insert_self" on public."Precios";
create policy "Precios_insert_self"
  on public."Precios"
  for insert
  to authenticated
  with check (auth.uid() = usuario_id);

-- -----------------------------------------------------------------------
-- 5. Puntos read and write policies
-- -----------------------------------------------------------------------
drop policy if exists "Puntos_select_self" on public."Puntos";
create policy "Puntos_select_self"
  on public."Puntos"
  for select
  to authenticated
  using (auth.uid() = usuario_id);

drop policy if exists "Puntos_insert_self" on public."Puntos";
create policy "Puntos_insert_self"
  on public."Puntos"
  for insert
  to authenticated
  with check (auth.uid() = usuario_id);
