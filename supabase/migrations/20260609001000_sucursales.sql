-- =====================================================================
-- Rol Farmacia — Sucursales (Etapa 1, migración 1/7) — Tarea #22
-- =====================================================================
-- Una farmacia (cuenta = tabla legacy "Farmacias", bigint) tiene N sucursales,
-- cada una con sus propios datos (dirección, teléfono, horario, ubicación).
-- La cuenta se gestiona con perfiles.farmacia_id; aquí cuelgan las sedes.
--
-- Helper farmacia_owns_sucursal(): SECURITY DEFINER para usarse en las RLS de
-- inventario/descuentos/reservas sin recursión de políticas.
-- =====================================================================

create extension if not exists pgcrypto;

-- =====================================================================
-- 1. Tabla
-- =====================================================================
create table if not exists public.sucursales (
  id            uuid primary key default gen_random_uuid(),
  farmacia_id   bigint not null references public."Farmacias"(id) on delete cascade,
  nombre        text not null,
  direccion     text not null,
  ciudad        text,
  telefono      text,
  whatsapp      text,
  horario       text,
  latitud       numeric,
  longitud      numeric,
  activa        boolean not null default true,
  es_principal  boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint sucursales_nombre_not_empty check (length(trim(nombre)) > 0),
  constraint sucursales_lat_valida check (latitud is null or latitud between -90 and 90),
  constraint sucursales_lng_valida check (longitud is null or longitud between -180 and 180)
);

-- =====================================================================
-- 2. Índices
-- =====================================================================
create index if not exists idx_sucursales_farmacia on public.sucursales (farmacia_id);
create index if not exists idx_sucursales_activa on public.sucursales (activa) where activa = true;
-- Solo una sucursal principal por farmacia
create unique index if not exists uq_sucursales_principal
  on public.sucursales (farmacia_id) where es_principal = true;

-- =====================================================================
-- 3. Trigger updated_at
-- =====================================================================
drop trigger if exists trg_sucursales_updated on public.sucursales;
create trigger trg_sucursales_updated
  before update on public.sucursales
  for each row execute function public.set_updated_at();

-- =====================================================================
-- 4. Helper de propiedad (SECURITY DEFINER → no dispara RLS en el subquery)
-- =====================================================================
create or replace function public.farmacia_owns_sucursal(p_sucursal_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.sucursales s
    where s.id = p_sucursal_id
      and s.farmacia_id = (select farmacia_id from public.perfiles where id = auth.uid())
  );
$$;

-- =====================================================================
-- 5. RLS
-- =====================================================================
alter table public.sucursales enable row level security;

-- Lectura: público ve las activas; admin y la cuenta dueña ven todas.
drop policy if exists "sucursales_read" on public.sucursales;
create policy "sucursales_read"
  on public.sucursales for select
  to anon, authenticated
  using (
    activa = true
    or public.current_rol() = 'admin'
    or farmacia_id = public.current_farmacia_id()
  );

-- Escritura: solo la cuenta dueña de la farmacia (o admin).
drop policy if exists "sucursales_write_owner" on public.sucursales;
create policy "sucursales_write_owner"
  on public.sucursales for all
  to authenticated
  using (public.current_rol() = 'admin' or farmacia_id = public.current_farmacia_id())
  with check (public.current_rol() = 'admin' or farmacia_id = public.current_farmacia_id());

comment on table public.sucursales is
  'Sedes de una farmacia (cuenta = "Farmacias".id). Cada una con sus datos propios.';
