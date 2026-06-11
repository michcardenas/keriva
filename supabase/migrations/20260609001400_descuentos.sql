-- =====================================================================
-- Rol Farmacia — Descuentos avanzados (Etapa 1, 5/7) — Tarea #30
-- =====================================================================
-- Descuento con vigencia (inicio/fin), tipo (% o monto fijo) y alcance:
--   · sucursal_id NULL  → aplica a TODAS las sucursales de la farmacia
--   · producto_id NULL  → aplica a TODOS los productos
-- Reemplaza el descuento_estandar simple de farmacia_whatsapp.
-- =====================================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'descuento_tipo') then
    create type public.descuento_tipo as enum ('porcentaje', 'monto');
  end if;
end $$;

create table if not exists public.descuentos (
  id            uuid primary key default gen_random_uuid(),
  farmacia_id   bigint not null references public."Farmacias"(id) on delete cascade,
  sucursal_id   uuid references public.sucursales(id) on delete cascade,  -- NULL = todas
  producto_id   uuid references public.productos(id) on delete cascade,   -- NULL = todos
  tipo          public.descuento_tipo not null default 'porcentaje',
  valor         numeric(10,2) not null,
  descripcion   text,
  vigente_desde timestamptz not null default now(),
  vigente_hasta timestamptz,                                              -- NULL = sin fin
  activo        boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint descuentos_valor_positivo check (valor > 0),
  constraint descuentos_pct_max       check (tipo <> 'porcentaje' or valor <= 100),
  constraint descuentos_rango_valido   check (vigente_hasta is null or vigente_hasta > vigente_desde)
);

create index if not exists idx_descuentos_farmacia on public.descuentos (farmacia_id);
create index if not exists idx_descuentos_sucursal on public.descuentos (sucursal_id);
create index if not exists idx_descuentos_producto on public.descuentos (producto_id);
create index if not exists idx_descuentos_vigencia
  on public.descuentos (vigente_desde, vigente_hasta) where activo = true;

drop trigger if exists trg_descuentos_updated on public.descuentos;
create trigger trg_descuentos_updated
  before update on public.descuentos
  for each row execute function public.set_updated_at();

alter table public.descuentos enable row level security;

-- Lectura pública de descuentos activos (admin y dueña ven todos).
drop policy if exists "descuentos_read" on public.descuentos;
create policy "descuentos_read"
  on public.descuentos for select
  to anon, authenticated
  using (activo = true or public.current_rol() = 'admin' or farmacia_id = public.current_farmacia_id());

-- Escritura: la cuenta dueña (o admin).
drop policy if exists "descuentos_write_owner" on public.descuentos;
create policy "descuentos_write_owner"
  on public.descuentos for all
  to authenticated
  using (public.current_rol() = 'admin' or farmacia_id = public.current_farmacia_id())
  with check (public.current_rol() = 'admin' or farmacia_id = public.current_farmacia_id());

comment on table public.descuentos is
  'Descuentos con vigencia/tipo/alcance. sucursal_id/producto_id NULL = aplica a todas/todos.';
