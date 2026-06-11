-- =====================================================================
-- Rol Farmacia — Inventario por sucursal (Etapa 1, 4/7) — Tarea #26
-- =====================================================================
-- Precio y disponibilidad de cada producto en cada sucursal.
-- Stock = flag "disponible" (no cantidad numérica). Una fila por
-- (sucursal, producto). El precio es por sucursal.
-- =====================================================================

create table if not exists public.inventario_sucursal (
  id           uuid primary key default gen_random_uuid(),
  sucursal_id  uuid not null references public.sucursales(id) on delete cascade,
  producto_id  uuid not null references public.productos(id) on delete cascade,
  disponible   boolean not null default true,
  precio       numeric(10,2),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint inventario_precio_no_negativo check (precio is null or precio >= 0),
  constraint uq_inventario_sucursal_producto unique (sucursal_id, producto_id)
);

create index if not exists idx_inventario_sucursal on public.inventario_sucursal (sucursal_id);
create index if not exists idx_inventario_producto  on public.inventario_sucursal (producto_id);
-- Búsqueda "qué sucursales tienen disponible el producto X"
create index if not exists idx_inventario_disp_producto
  on public.inventario_sucursal (producto_id) where disponible = true;

drop trigger if exists trg_inventario_updated on public.inventario_sucursal;
create trigger trg_inventario_updated
  before update on public.inventario_sucursal
  for each row execute function public.set_updated_at();

-- =====================================================================
-- RLS
-- =====================================================================
alter table public.inventario_sucursal enable row level security;

-- Lectura pública: cualquiera ve disponibilidad y precio (alimenta la búsqueda).
drop policy if exists "inventario_read_public" on public.inventario_sucursal;
create policy "inventario_read_public"
  on public.inventario_sucursal for select
  to anon, authenticated
  using (true);

-- Escritura: solo la cuenta dueña de la sucursal (o admin).
drop policy if exists "inventario_write_owner" on public.inventario_sucursal;
create policy "inventario_write_owner"
  on public.inventario_sucursal for all
  to authenticated
  using (public.current_rol() = 'admin' or public.farmacia_owns_sucursal(sucursal_id))
  with check (public.current_rol() = 'admin' or public.farmacia_owns_sucursal(sucursal_id));

comment on table public.inventario_sucursal is
  'Precio y disponibilidad por (sucursal, producto). Stock = flag disponible.';
