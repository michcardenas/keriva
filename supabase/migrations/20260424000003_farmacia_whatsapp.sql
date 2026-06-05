-- =====================================================================
-- Adendum v2.1 — Farmacia WhatsApp + función de rango (Bloque 1, 4/5)
-- =====================================================================
-- Tabla farmacia_whatsapp: afiliación de farmacias al sistema Keriva
-- con número WhatsApp, horario, días de operación y descuento estándar.
--
-- Botón "Reservar por WhatsApp" (adendum v2.1 §3.2):
--   · Solo se muestra si farmacia.afiliada = true
--   · Valida horario_apertura / horario_cierre / dias_operacion
--   · Si fuera de horario → modal "¿Enviar de todas formas?"
--
-- Función calcular_rango_precio (adendum v2.1 §3.3):
--   precio_keriva = precio_base * (1 - descuento_estandar/100)
--   rango_min = precio_keriva * 0.95
--   rango_max = precio_keriva * 1.05
--
-- Nota sobre tipo de farmacia_id:
--   El adendum usa UUID, pero la tabla legacy "Farmacias" tiene id bigint.
--   Usamos bigint aquí para compatibilidad con el schema existente.
-- =====================================================================

-- =====================================================================
-- 1. Tabla farmacia_whatsapp
-- =====================================================================
create table if not exists public.farmacia_whatsapp (
  id                  uuid primary key default gen_random_uuid(),
  farmacia_id         bigint not null unique references public."Farmacias"(id) on delete cascade,
  numero_whatsapp     text not null,                  -- formato E.164: +18091234567
  horario_apertura    time,
  horario_cierre      time,
  dias_operacion      smallint[] not null default '{1,2,3,4,5,6,7}'::smallint[],
  descuento_estandar  numeric(5,2),                   -- % de descuento sobre precio_base
  afiliada            boolean not null default false,
  fecha_afiliacion    date,
  contrato_ref        text,                           -- referencia comercial opcional
  notas               text,
  created_by          uuid references auth.users(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  -- E.164: + seguido de 1-9 (primer dígito país) + 6 a 14 dígitos
  constraint farmacia_whatsapp_numero_e164
    check (numero_whatsapp ~ '^\+[1-9][0-9]{6,14}$'),
  -- Descuento entre 0 y 100 (%)
  constraint farmacia_whatsapp_descuento_rango
    check (descuento_estandar is null or (descuento_estandar >= 0 and descuento_estandar <= 100)),
  -- Días ISO 1-7 (1=lunes, 7=domingo)
  constraint farmacia_whatsapp_dias_validos
    check (dias_operacion <@ '{1,2,3,4,5,6,7}'::smallint[]),
  -- Si está afiliada, debe tener fecha
  constraint farmacia_whatsapp_afiliacion_consistente
    check ((afiliada = false) or (afiliada = true and fecha_afiliacion is not null))
);

-- =====================================================================
-- 2. Índices
-- =====================================================================
-- Query más caliente: "¿esta farmacia muestra botón WhatsApp?"
create index if not exists idx_farmacia_whatsapp_afiliada
  on public.farmacia_whatsapp (afiliada) where afiliada = true;

-- Reportes: farmacias afiliadas por fecha
create index if not exists idx_farmacia_whatsapp_fecha_afil
  on public.farmacia_whatsapp (fecha_afiliacion desc) where afiliada = true;

-- =====================================================================
-- 3. Trigger updated_at
-- =====================================================================
drop trigger if exists trg_farmacia_whatsapp_updated on public.farmacia_whatsapp;
create trigger trg_farmacia_whatsapp_updated
  before update on public.farmacia_whatsapp
  for each row execute function public.set_updated_at();

-- =====================================================================
-- 4. Función: ¿farmacia abierta ahora?
-- =====================================================================
-- Retorna true si la farmacia está dentro de su horario de operación.
-- Usado por el frontend para decidir si mostrar el modal "fuera de horario".
create or replace function public.farmacia_abierta_ahora(p_farmacia_id bigint)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    case
      when fw.horario_apertura is null or fw.horario_cierre is null then true
      when extract(isodow from now())::smallint <> all(fw.dias_operacion) then false
      when fw.horario_apertura < fw.horario_cierre then
        (now()::time >= fw.horario_apertura and now()::time <= fw.horario_cierre)
      else
        -- Horario nocturno que cruza medianoche (ej. 22:00 - 06:00)
        (now()::time >= fw.horario_apertura or now()::time <= fw.horario_cierre)
    end
  from public.farmacia_whatsapp fw
  where fw.farmacia_id = p_farmacia_id
    and fw.afiliada = true;
$$;

comment on function public.farmacia_abierta_ahora(bigint) is
  'True si la farmacia está dentro de horario según dias_operacion y horarios (adendum v2.1 §3.2 — modal fuera de horario).';

-- =====================================================================
-- 5. Función: calcular rango de precio (adendum v2.1 §3.3)
-- =====================================================================
-- Input:  p_sku_id (uuid de productos), p_farmacia_id (bigint de Farmacias)
-- Output: (precio_min, precio_max) como rango ±5% sobre precio_base con
--         descuento estándar de la farmacia aplicado.
--
-- Filtra por precios_base.vigente_hasta IS NULL (solo el vigente).
-- Si no hay precio_base para el sku → retorna 0 filas.
-- Si la farmacia no está afiliada → descuento se trata como 0.
create or replace function public.calcular_rango_precio(
  p_sku_id       uuid,
  p_farmacia_id  bigint
) returns table (
  precio_min  numeric(10,2),
  precio_max  numeric(10,2),
  moneda      text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    round(pb.precio_base * (1 - coalesce(fw.descuento_estandar, 0) / 100) * 0.95, 2) as precio_min,
    round(pb.precio_base * (1 - coalesce(fw.descuento_estandar, 0) / 100) * 1.05, 2) as precio_max,
    pb.moneda
  from public.precios_base pb
  left join public.farmacia_whatsapp fw on fw.farmacia_id = p_farmacia_id and fw.afiliada = true
  where pb.sku_id = p_sku_id
    and pb.vigente_hasta is null;
$$;

comment on function public.calcular_rango_precio(uuid, bigint) is
  'Calcula rango ±5% sobre precio_base vigente con descuento de farmacia afiliada (adendum v2.1 §3.3).';

-- =====================================================================
-- 6. RLS policies
-- =====================================================================
alter table public.farmacia_whatsapp enable row level security;

-- Lectura: público puede leer farmacias afiliadas (para mostrar el botón).
-- Admin ve todas (afiliadas + prospectos).
-- La propia farmacia (rol=farmacia) puede leer su propio registro.
drop policy if exists "farmacia_whatsapp_read_public" on public.farmacia_whatsapp;
create policy "farmacia_whatsapp_read_public"
  on public.farmacia_whatsapp for select
  to anon, authenticated
  using (
    afiliada = true
    or public.current_rol() = 'admin'
    or (public.current_rol() = 'farmacia' and public.current_farmacia_id() = farmacia_id)
  );

-- Escritura: solo admin (el onboarding lo hace el Area Manager por ahora,
-- según adendum §6 — portal de auto-gestión está pospuesto a Fase 2).
drop policy if exists "farmacia_whatsapp_write_admin" on public.farmacia_whatsapp;
create policy "farmacia_whatsapp_write_admin"
  on public.farmacia_whatsapp for all
  to authenticated
  using (public.current_rol() = 'admin')
  with check (public.current_rol() = 'admin');

-- =====================================================================
-- 7. Vista pública: farmacias con WhatsApp activo
-- =====================================================================
-- Join con "Farmacias" para el frontend: nombre, dirección, coords + info
-- de afiliación en un solo query.
create or replace view public.v_farmacias_whatsapp as
select
  f.id            as farmacia_id,
  f.nombre        as farmacia_nombre,
  fw.numero_whatsapp,
  fw.horario_apertura,
  fw.horario_cierre,
  fw.dias_operacion,
  fw.descuento_estandar,
  fw.afiliada,
  fw.fecha_afiliacion,
  public.farmacia_abierta_ahora(f.id) as abierta_ahora
from public."Farmacias" f
join public.farmacia_whatsapp fw on fw.farmacia_id = f.id
where fw.afiliada = true;

comment on view public.v_farmacias_whatsapp is
  'Farmacias afiliadas con info de WhatsApp + flag abierta_ahora (adendum v2.1 §3.2).';

-- =====================================================================
-- 8. Comentarios de documentación
-- =====================================================================
comment on table  public.farmacia_whatsapp is
  'Afiliación de farmacias al sistema WhatsApp/descuento estándar (adendum v2.1 §3.2).';
comment on column public.farmacia_whatsapp.dias_operacion is
  'Días ISO: 1=lunes, 7=domingo. Default {1..7} = todos los días.';
comment on column public.farmacia_whatsapp.descuento_estandar is
  'Porcentaje 0-100 aplicado sobre precio_base. NULL = sin descuento registrado.';
comment on column public.farmacia_whatsapp.afiliada is
  'true = paga membresía y muestra botón WhatsApp. false = solo prospecto.';
