-- =====================================================================
-- Rol Farmacia — Reservas (Etapa 1, 6/7) — Tarea #40
-- =====================================================================
-- El usuario reserva un producto en una sucursal; la farmacia confirma
-- (= venta), rechaza o cancela. Las reservas confirmadas alimentan las
-- métricas de ventas/ingresos/conversión.
-- =====================================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'reserva_estado') then
    create type public.reserva_estado as enum ('pendiente', 'confirmada', 'rechazada', 'cancelada');
  end if;
end $$;

create table if not exists public.reservas (
  id           uuid primary key default gen_random_uuid(),
  usuario_id   uuid not null references auth.users(id) on delete cascade,
  sucursal_id  uuid not null references public.sucursales(id) on delete cascade,
  producto_id  uuid not null references public.productos(id) on delete cascade,
  cantidad     integer not null default 1,
  precio       numeric(10,2),
  estado       public.reserva_estado not null default 'pendiente',
  nota         text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint reservas_cantidad_positiva check (cantidad > 0)
);

create index if not exists idx_reservas_usuario  on public.reservas (usuario_id, created_at desc);
create index if not exists idx_reservas_sucursal on public.reservas (sucursal_id, created_at desc);
create index if not exists idx_reservas_estado   on public.reservas (estado);

drop trigger if exists trg_reservas_updated on public.reservas;
create trigger trg_reservas_updated
  before update on public.reservas
  for each row execute function public.set_updated_at();

alter table public.reservas enable row level security;

-- Lectura: el usuario sus reservas; la farmacia las de sus sucursales; admin todo.
drop policy if exists "reservas_read" on public.reservas;
create policy "reservas_read"
  on public.reservas for select
  to authenticated
  using (
    usuario_id = auth.uid()
    or public.current_rol() = 'admin'
    or public.farmacia_owns_sucursal(sucursal_id)
  );

-- Crear: solo el usuario, como autor de su reserva.
drop policy if exists "reservas_insert_usuario" on public.reservas;
create policy "reservas_insert_usuario"
  on public.reservas for insert
  to authenticated
  with check (usuario_id = auth.uid());

-- Actualizar: el usuario (cancelar la suya), la farmacia dueña (confirmar/
-- rechazar) o admin.
drop policy if exists "reservas_update" on public.reservas;
create policy "reservas_update"
  on public.reservas for update
  to authenticated
  using (
    usuario_id = auth.uid()
    or public.current_rol() = 'admin'
    or public.farmacia_owns_sucursal(sucursal_id)
  )
  with check (
    usuario_id = auth.uid()
    or public.current_rol() = 'admin'
    or public.farmacia_owns_sucursal(sucursal_id)
  );

comment on table public.reservas is
  'Reservas de usuarios por sucursal. Estado confirmada = venta (fuente de métricas de ventas).';
