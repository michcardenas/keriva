-- Sprint 1 (expanded): roles, DR-specific profile fields and per-role policies.
--
-- Roles:
--   usuario  -> regular end user (default)
--   farmacia -> pharmacy staff, linked to a specific row in "Farmacias"
--   admin    -> moderator / platform administrator
--
-- DR context additions:
--   telefono  (text)  e.g. "+1 809-555-1234"
--   cedula    (text)  Dominican national ID
--
-- The admin and farmacia roles are assigned manually via SQL by an
-- existing admin. New signups are always usuario.

-- ---------------------------------------------------------------------
-- 1. rol enum
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'rol_usuario') then
    create type public.rol_usuario as enum ('usuario', 'farmacia', 'admin');
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 2. Extend perfiles
-- ---------------------------------------------------------------------
alter table public.perfiles
  add column if not exists rol         public.rol_usuario not null default 'usuario',
  add column if not exists telefono    text,
  add column if not exists cedula      text,
  add column if not exists farmacia_id bigint references public."Farmacias"(id) on delete set null;

create index if not exists perfiles_rol_idx on public.perfiles (rol);
create index if not exists perfiles_farmacia_id_idx on public.perfiles (farmacia_id);

-- ---------------------------------------------------------------------
-- 3. Helper: does current user have role X? (SECURITY DEFINER to avoid
--    recursion in policies that reference perfiles)
-- ---------------------------------------------------------------------
create or replace function public.current_rol()
returns public.rol_usuario
language sql
stable
security definer
set search_path = public
as $$
  select rol from public.perfiles where id = auth.uid();
$$;

create or replace function public.current_farmacia_id()
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select farmacia_id from public.perfiles where id = auth.uid();
$$;

-- ---------------------------------------------------------------------
-- 4. handle_new_user: also writes default role and any metadata passed
--    at signup (nombre, telefono, cedula). Admins / farmacias are promoted
--    later via SQL.
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.perfiles (id, email, nombre, telefono, cedula)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'nombre', split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'telefono',
    new.raw_user_meta_data ->> 'cedula'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- 5. perfiles policies
-- ---------------------------------------------------------------------
drop policy if exists "perfiles_select_self" on public.perfiles;
drop policy if exists "perfiles_update_self" on public.perfiles;

create policy "perfiles_select_self_or_admin"
  on public.perfiles
  for select
  to authenticated
  using (auth.uid() = id or public.current_rol() = 'admin');

create policy "perfiles_update_self_or_admin"
  on public.perfiles
  for update
  to authenticated
  using (auth.uid() = id or public.current_rol() = 'admin')
  with check (auth.uid() = id or public.current_rol() = 'admin');

-- Regular users cannot self-promote: the rol column can only change when
-- the caller is already admin. Enforced with a trigger because `with check`
-- can't reference OLD row values.
create or replace function public.prevent_rol_self_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Bypass when there is no authenticated user (service_role, SQL editor,
  -- migrations). Required to bootstrap the first admin and to let ops
  -- scripts manage roles.
  if auth.uid() is null then
    return new;
  end if;

  if new.rol is distinct from old.rol then
    if public.current_rol() is distinct from 'admin'::public.rol_usuario then
      raise exception 'Only admins can change user roles';
    end if;
  end if;
  if new.farmacia_id is distinct from old.farmacia_id then
    if public.current_rol() is distinct from 'admin'::public.rol_usuario then
      raise exception 'Only admins can assign farmacia_id';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists perfiles_prevent_escalation on public.perfiles;
create trigger perfiles_prevent_escalation
  before update on public.perfiles
  for each row execute function public.prevent_rol_self_escalation();

-- ---------------------------------------------------------------------
-- 6. Farmacias policies (admins + owning farmacia can write)
-- ---------------------------------------------------------------------
drop policy if exists "Farmacias_update_admin_or_owner" on public."Farmacias";
create policy "Farmacias_update_admin_or_owner"
  on public."Farmacias"
  for update
  to authenticated
  using (
    public.current_rol() = 'admin'
    or (public.current_rol() = 'farmacia' and public.current_farmacia_id() = id)
  )
  with check (
    public.current_rol() = 'admin'
    or (public.current_rol() = 'farmacia' and public.current_farmacia_id() = id)
  );

drop policy if exists "Farmacias_insert_admin" on public."Farmacias";
create policy "Farmacias_insert_admin"
  on public."Farmacias"
  for insert
  to authenticated
  with check (public.current_rol() = 'admin');

-- ---------------------------------------------------------------------
-- 7. Precios policies: insert own + update/delete by owner, verification
--    (`verificado` flag) reserved for admin and the owning farmacia staff
-- ---------------------------------------------------------------------
drop policy if exists "Precios_insert_self" on public."Precios";
create policy "Precios_insert_self"
  on public."Precios"
  for insert
  to authenticated
  with check (auth.uid() = usuario_id);

drop policy if exists "Precios_delete_self" on public."Precios";
create policy "Precios_delete_self"
  on public."Precios"
  for delete
  to authenticated
  using (auth.uid() = usuario_id or public.current_rol() = 'admin');

drop policy if exists "Precios_update_owner_or_staff" on public."Precios";
create policy "Precios_update_owner_or_staff"
  on public."Precios"
  for update
  to authenticated
  using (
    auth.uid() = usuario_id
    or public.current_rol() = 'admin'
    or (public.current_rol() = 'farmacia' and public.current_farmacia_id() = farmacia_id)
  )
  with check (
    auth.uid() = usuario_id
    or public.current_rol() = 'admin'
    or (public.current_rol() = 'farmacia' and public.current_farmacia_id() = farmacia_id)
  );

-- ---------------------------------------------------------------------
-- 8. Medicamentos: read-only public; only admin can write
-- ---------------------------------------------------------------------
drop policy if exists "Medicamentos_insert_admin" on public."Medicamentos";
create policy "Medicamentos_insert_admin"
  on public."Medicamentos"
  for insert
  to authenticated
  with check (public.current_rol() = 'admin');

drop policy if exists "Medicamentos_update_admin" on public."Medicamentos";
create policy "Medicamentos_update_admin"
  on public."Medicamentos"
  for update
  to authenticated
  using (public.current_rol() = 'admin')
  with check (public.current_rol() = 'admin');
