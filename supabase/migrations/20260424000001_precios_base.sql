-- =====================================================================
-- Adendum v2.1 — Precios base de referencia (Bloque 1, migración 2/5)
-- =====================================================================
-- Tabla precios_base: precio de referencia de mercado por SKU.
--
-- Diferencia con tablas existentes:
--   · "Precios"     → reportes crowdsource de usuarios (flujo Fase 2)
--   · "Medicamentos"→ catálogo curado básico (legado, 83 filas)
--   · precios_base  → precio de referencia oficial (input para cálculo
--                     del rango estimado — adendum v2.1 §3.3)
--
-- Modelo temporal:
--   · Varias filas por sku permitidas (historial de precios)
--   · Solo una vigente a la vez (vigente_hasta IS NULL)
--   · Trigger cierra automáticamente el anterior al insertar uno nuevo.
-- =====================================================================

-- =====================================================================
-- 1. Tabla
-- =====================================================================
create table if not exists public.precios_base (
  id              uuid primary key default gen_random_uuid(),
  sku_id          uuid not null references public.productos(id) on delete cascade,
  precio_base     numeric(10,2) not null,
  moneda          text not null default 'DOP',
  fuente          text,                   -- 'manual', 'contract', 'scrape', 'promese'
  notas           text,
  vigente_desde   timestamptz not null default now(),
  vigente_hasta   timestamptz,            -- NULL = vigente ahora
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint precios_base_precio_positivo   check (precio_base > 0),
  constraint precios_base_moneda_valida     check (moneda in ('DOP', 'USD')),
  constraint precios_base_rango_valido      check (vigente_hasta is null or vigente_hasta > vigente_desde)
);

-- =====================================================================
-- 2. Índices
-- =====================================================================
-- Solo uno vigente por sku (vigente_hasta IS NULL)
create unique index if not exists uq_precios_base_vigente_sku
  on public.precios_base (sku_id)
  where vigente_hasta is null;

-- Búsqueda histórica por sku
create index if not exists idx_precios_base_sku_vigencia
  on public.precios_base (sku_id, vigente_desde desc);

-- Rango temporal (reportes / auditoría)
create index if not exists idx_precios_base_vigencia_rango
  on public.precios_base (vigente_desde, vigente_hasta);

-- =====================================================================
-- 3. Trigger updated_at (reutiliza función de migración 1/5)
-- =====================================================================
drop trigger if exists trg_precios_base_updated on public.precios_base;
create trigger trg_precios_base_updated
  before update on public.precios_base
  for each row execute function public.set_updated_at();

-- =====================================================================
-- 4. Trigger de cierre automático del precio anterior
-- =====================================================================
-- Al insertar un nuevo precio vigente (vigente_hasta IS NULL) para un sku
-- que ya tiene uno vigente, cerrar el anterior automáticamente.
-- Esto evita violación del unique index uq_precios_base_vigente_sku.
create or replace function public.cerrar_precio_base_anterior()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.vigente_hasta is null then
    update public.precios_base
       set vigente_hasta = new.vigente_desde
     where sku_id       = new.sku_id
       and id          <> new.id
       and vigente_hasta is null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_precios_base_cierre on public.precios_base;
create trigger trg_precios_base_cierre
  before insert on public.precios_base
  for each row execute function public.cerrar_precio_base_anterior();

-- =====================================================================
-- 5. Vista: solo precios vigentes
-- =====================================================================
create or replace view public.v_precios_base_vigentes as
select
  pb.id,
  pb.sku_id,
  pb.precio_base,
  pb.moneda,
  pb.fuente,
  pb.vigente_desde,
  p.nombre_comercial,
  p.laboratorio_id,
  p.categoria_id
from public.precios_base pb
join public.productos p on p.id = pb.sku_id
where pb.vigente_hasta is null
  and p.activo = true;

comment on view public.v_precios_base_vigentes is
  'Precios base vigentes por SKU. Fuente única del precio de referencia para el cálculo de rango ±5% (adendum v2.1 §3.3).';

-- =====================================================================
-- 6. RLS policies
-- =====================================================================
alter table public.precios_base enable row level security;

-- Lectura pública: cualquiera (anon + auth) puede ver los precios vigentes.
-- El histórico (vigente_hasta IS NOT NULL) queda solo para admin.
drop policy if exists "precios_base_read_vigentes" on public.precios_base;
create policy "precios_base_read_vigentes"
  on public.precios_base for select
  to anon, authenticated
  using (vigente_hasta is null or public.current_rol() = 'admin');

drop policy if exists "precios_base_write_admin" on public.precios_base;
create policy "precios_base_write_admin"
  on public.precios_base for all
  to authenticated
  using (public.current_rol() = 'admin')
  with check (public.current_rol() = 'admin');

-- =====================================================================
-- 7. Comentarios de documentación
-- =====================================================================
comment on table public.precios_base is
  'Precio de referencia de mercado por SKU. Input para calcular_rango_precio() (adendum v2.1 §3.3).';
comment on column public.precios_base.sku_id is
  'FK a productos.id. Se usa sku_id para alinear con convenciones del adendum v2.1.';
comment on column public.precios_base.vigente_hasta is
  'NULL = precio actualmente vigente. Solo puede haber uno NULL por sku (unique index).';
comment on column public.precios_base.fuente is
  'Origen del precio: manual (admin), contract (con laboratorio), scrape (web), promese (gobierno).';
