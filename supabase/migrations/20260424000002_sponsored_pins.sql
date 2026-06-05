-- =====================================================================
-- Adendum v2.1 — Sponsored Pins (Bloque 1, migración 3/5)
-- =====================================================================
-- Pin Patrocinado: laboratorio paga por fijar un SKU como resultado #1
-- cuando el usuario busca dentro de una categoría terapéutica específica.
--
-- Reglas del adendum v2.1 §3.1:
--   · Máximo 1 pin patrocinado por búsqueda (nunca dos).
--   · No permitir pins en categorías con restricted = true (oncología,
--     psiquiatría, anticonceptivos, VIH). → trigger de validación.
--   · Si hay múltiples candidatos, elegir por prioridad ascendente; en
--     empate, el de fecha_inicio más reciente.
--   · Si no hay pin activo → resultados ordenan por relevancia normal.
-- =====================================================================

-- =====================================================================
-- 1. Tabla sponsored_pins
-- =====================================================================
create table if not exists public.sponsored_pins (
  id              uuid primary key default gen_random_uuid(),
  laboratorio_id  uuid not null references public.laboratorios(id)            on delete cascade,
  sku_id          uuid not null references public.productos(id)               on delete cascade,
  categoria_id    uuid not null references public.categorias_terapeuticas(id) on delete cascade,
  fecha_inicio    timestamptz not null,
  fecha_fin       timestamptz not null,
  prioridad       smallint not null default 1,
  activo          boolean not null default true,
  contrato_ref    text,                       -- referencia comercial opcional (PO, contrato firmado)
  notas           text,
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint pin_fechas_validas       check (fecha_fin > fecha_inicio),
  constraint pin_prioridad_positiva   check (prioridad >= 1)
);

-- =====================================================================
-- 2. Índices
-- =====================================================================
-- Resolución rápida de "pin activo por categoría" (query principal)
create index if not exists idx_pin_activo_categoria
  on public.sponsored_pins (categoria_id, activo, fecha_inicio, fecha_fin)
  where activo = true;

-- Reportes por laboratorio
create index if not exists idx_pin_laboratorio
  on public.sponsored_pins (laboratorio_id, activo)
  where activo = true;

-- Lookup por SKU (para analítica de ventas)
create index if not exists idx_pin_sku
  on public.sponsored_pins (sku_id);

-- =====================================================================
-- 3. Trigger updated_at (reutiliza función de migración 1/5)
-- =====================================================================
drop trigger if exists trg_sponsored_pins_updated on public.sponsored_pins;
create trigger trg_sponsored_pins_updated
  before update on public.sponsored_pins
  for each row execute function public.set_updated_at();

-- =====================================================================
-- 4. Trigger: bloquear pins en categorías restringidas
-- =====================================================================
-- Adendum v2.1 §3.1: prohibido activar patrocinio en categorías con
-- restricted = true (oncología, psiquiatría, anticonceptivos, VIH).
create or replace function public.prevent_sponsored_pin_restricted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  es_restricted boolean;
  nombre_cat    text;
begin
  select restricted, nombre
    into es_restricted, nombre_cat
    from public.categorias_terapeuticas
   where id = new.categoria_id;

  if es_restricted is true then
    raise exception 'No se pueden crear pins patrocinados en categoría restringida: %', nombre_cat
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sponsored_pins_restricted on public.sponsored_pins;
create trigger trg_sponsored_pins_restricted
  before insert or update of categoria_id, activo on public.sponsored_pins
  for each row
  when (new.activo = true)
  execute function public.prevent_sponsored_pin_restricted();

-- =====================================================================
-- 5. Función helper: pin activo por categoría
-- =====================================================================
-- Encapsula la lógica de resolución del adendum §3.1:
--   · activo = true
--   · fecha actual entre fecha_inicio y fecha_fin
--   · categoría NO restringida
--   · si múltiples candidatos → prioridad ascendente → fecha_inicio más reciente
--   · retorna máximo 1 fila (LIMIT 1)
create or replace function public.get_sponsored_pin_for_categoria(
  p_categoria_id uuid
) returns table (
  pin_id          uuid,
  sku_id          uuid,
  laboratorio_id  uuid,
  nombre_comercial text,
  laboratorio_nombre text,
  fecha_inicio    timestamptz,
  fecha_fin       timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    sp.id,
    sp.sku_id,
    sp.laboratorio_id,
    p.nombre_comercial,
    l.nombre,
    sp.fecha_inicio,
    sp.fecha_fin
  from public.sponsored_pins sp
  join public.categorias_terapeuticas c on c.id = sp.categoria_id
  join public.productos               p on p.id = sp.sku_id
  join public.laboratorios            l on l.id = sp.laboratorio_id
  where sp.categoria_id = p_categoria_id
    and sp.activo       = true
    and c.restricted    = false
    and p.activo        = true
    and l.activo        = true
    and now() between sp.fecha_inicio and sp.fecha_fin
  order by sp.prioridad asc, sp.fecha_inicio desc
  limit 1;
$$;

comment on function public.get_sponsored_pin_for_categoria(uuid) is
  'Retorna el pin patrocinado vigente para una categoría (adendum v2.1 §3.1). Máximo 1 fila. Respeta flag restricted.';

-- =====================================================================
-- 6. Vista pública: pins activos (para el frontend)
-- =====================================================================
create or replace view public.v_sponsored_pins_activos as
select
  sp.id,
  sp.sku_id,
  sp.laboratorio_id,
  sp.categoria_id,
  sp.fecha_inicio,
  sp.fecha_fin,
  sp.prioridad,
  p.nombre_comercial,
  l.nombre as laboratorio_nombre,
  c.slug   as categoria_slug
from public.sponsored_pins sp
join public.categorias_terapeuticas c on c.id = sp.categoria_id
join public.productos               p on p.id = sp.sku_id
join public.laboratorios            l on l.id = sp.laboratorio_id
where sp.activo    = true
  and c.restricted = false
  and p.activo     = true
  and l.activo     = true
  and now() between sp.fecha_inicio and sp.fecha_fin;

comment on view public.v_sponsored_pins_activos is
  'Pins patrocinados vigentes. El frontend puede hacer JOIN aquí o llamar a get_sponsored_pin_for_categoria().';

-- =====================================================================
-- 7. RLS policies
-- =====================================================================
alter table public.sponsored_pins enable row level security;

-- Lectura pública limitada a pins activos y vigentes
-- (adendum v2.1 §3.1 "Política de RLS")
drop policy if exists "sponsored_pins_read_activos" on public.sponsored_pins;
create policy "sponsored_pins_read_activos"
  on public.sponsored_pins for select
  to anon, authenticated
  using (
    public.current_rol() = 'admin'
    or (
      activo = true
      and now() between fecha_inicio and fecha_fin
    )
  );

-- Solo admin puede crear, modificar, eliminar
drop policy if exists "sponsored_pins_write_admin" on public.sponsored_pins;
create policy "sponsored_pins_write_admin"
  on public.sponsored_pins for all
  to authenticated
  using (public.current_rol() = 'admin')
  with check (public.current_rol() = 'admin');

-- =====================================================================
-- 8. Comentarios de documentación
-- =====================================================================
comment on table  public.sponsored_pins is
  'Pins patrocinados por laboratorios. Máximo 1 por categoría visible por búsqueda (adendum v2.1 §3.1).';
comment on column public.sponsored_pins.prioridad is
  'Menor valor gana. Usado como desempate entre pins vigentes de la misma categoría.';
comment on column public.sponsored_pins.contrato_ref is
  'Referencia al contrato comercial firmado con el laboratorio (auditoría interna).';
