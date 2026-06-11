-- ============================================================
-- KERIVA — Etapa 1 Rol Farmacia: corre TODO esto de una vez
-- (orden: sucursales → seed → catálogo → inventario → descuentos → reservas → eventos)
-- ============================================================


-- >>>>> 20260609001000_sucursales.sql
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


-- >>>>> 20260609001100_sucursales_seed_principal.sql
-- =====================================================================
-- Rol Farmacia — Sucursal principal por farmacia (Etapa 1, 2/7) — Tarea #24
-- =====================================================================
-- Migra cada "Farmacias" existente a una sucursal "principal" con sus datos
-- actuales, para no romper lo que ya hay. Idempotente: no duplica si ya existe.
-- =====================================================================

insert into public.sucursales
  (farmacia_id, nombre, direccion, ciudad, telefono, horario, latitud, longitud, activa, es_principal)
select
  f.id,
  'Sucursal principal',
  coalesce(nullif(trim(f.direccion), ''), 'Sin dirección registrada'),
  f.ciudad,
  f.telefono,
  f.horario,
  nullif(f.latitud, 0),
  nullif(f.longitud, 0),
  coalesce(f.activa, true),
  true
from public."Farmacias" f
where not exists (
  select 1 from public.sucursales s where s.farmacia_id = f.id
);


-- >>>>> 20260609001200_productos_concentracion.sql
-- =====================================================================
-- Rol Farmacia — Catálogo: concentración (Etapa 1, 3/7) — Tarea #25
-- =====================================================================
-- `productos` ya tiene principio_activo y presentacion. Agregamos
-- `concentracion` como campo aparte (ej. "500 mg") para mejorar la búsqueda
-- por principio activo + concentración.
-- =====================================================================

alter table public.productos
  add column if not exists concentracion text;

-- Búsqueda por principio activo (filtro frecuente del usuario).
create index if not exists idx_productos_principio
  on public.productos (principio_activo) where activo = true;

comment on column public.productos.concentracion is
  'Concentración del SKU (ej. "500 mg"). Complementa principio_activo y presentacion.';


-- >>>>> 20260609001300_inventario_sucursal.sql
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


-- >>>>> 20260609001400_descuentos.sql
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


-- >>>>> 20260609001500_reservas.sql
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


-- >>>>> 20260609001600_eventos.sql
-- =====================================================================
-- Rol Farmacia — Eventos / Leads (Etapa 1, 7/7) — Tarea #37
-- =====================================================================
-- Captura de eventos del lado del usuario para las métricas de la farmacia:
--   · busqueda    → término buscado (para "los más buscados", a nivel producto)
--   · vista       → vio la ficha del producto/farmacia
--   · como_llegar → pidió la ruta
--   · contacto    → tocó WhatsApp / llamar (conversión fuerte)
--
-- Privacidad (Ley 172-13 RD): usuario_id es OPCIONAL (NULL = anónimo). Por
-- defecto se capturan de forma anónima/agregada; asociar al usuario requiere
-- consentimiento explícito. Tabla append-only (sin update/delete).
-- =====================================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'evento_tipo') then
    create type public.evento_tipo as enum ('busqueda', 'vista', 'como_llegar', 'contacto');
  end if;
end $$;

create table if not exists public.eventos (
  id           uuid primary key default gen_random_uuid(),
  tipo         public.evento_tipo not null,
  producto_id  uuid   references public.productos(id) on delete set null,
  sucursal_id  uuid   references public.sucursales(id) on delete set null,
  farmacia_id  bigint references public."Farmacias"(id) on delete set null,
  usuario_id   uuid   references auth.users(id) on delete set null,   -- NULL = anónimo
  termino      text,                                                   -- término (para 'busqueda')
  created_at   timestamptz not null default now()
);

create index if not exists idx_eventos_farmacia on public.eventos (farmacia_id, created_at desc);
create index if not exists idx_eventos_producto on public.eventos (producto_id, created_at desc);
create index if not exists idx_eventos_tipo on public.eventos (tipo, created_at desc);

alter table public.eventos enable row level security;

-- Inserción pública (anon + auth): se capturan eventos aunque el usuario no
-- esté logueado. No se exige usuario_id (anónimo).
drop policy if exists "eventos_insert_public" on public.eventos;
create policy "eventos_insert_public"
  on public.eventos for insert
  to anon, authenticated
  with check (true);

-- Lectura: solo la farmacia dueña (sus métricas) o admin. NUNCA pública.
drop policy if exists "eventos_read_owner" on public.eventos;
create policy "eventos_read_owner"
  on public.eventos for select
  to authenticated
  using (public.current_rol() = 'admin' or farmacia_id = public.current_farmacia_id());

comment on table public.eventos is
  'Eventos/leads del usuario para métricas de farmacia. usuario_id NULL = anónimo (Ley 172-13 RD).';

