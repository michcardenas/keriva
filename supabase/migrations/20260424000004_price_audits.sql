-- =====================================================================
-- Adendum v2.1 — Price Audits (Bloque 1, migración 5/5 — FINAL)
-- =====================================================================
-- Sistema de auditoría comunitaria de precios (adendum v2.1 §3.3).
--
-- Reemplaza en Fase 1 el flujo actual de "reportar precio con foto":
--   · Usuario ve rango estimado "RD$ 420 – RD$ 480"
--   · Debajo, dos botones pequeños:
--        ✅ "Compré a este precio" → voto = 'correcto'
--        ❌ "Precio incorrecto"    → voto = 'incorrecto'
--   · Máximo 3 votos por usuario por farmacia por día (antiabuso).
--   · No se requiere foto de factura (eso queda para Fase 2).
--
-- Vista v_precio_health: ratio de votos por SKU/farmacia últimos 30 días.
-- Permite al admin identificar farmacias con precios mal calibrados.
-- =====================================================================

-- =====================================================================
-- 1. Tabla price_audits
-- =====================================================================
create table if not exists public.price_audits (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid   not null references auth.users(id)         on delete cascade,
  sku_id        uuid   not null references public.productos(id)   on delete cascade,
  farmacia_id   bigint not null references public."Farmacias"(id) on delete cascade,
  voto          text   not null,
  precio_visto  numeric(10,2),        -- opcional: precio que vio el usuario al votar
  created_at    timestamptz not null default now(),
  constraint price_audits_voto_valido
    check (voto in ('correcto', 'incorrecto'))
);

-- =====================================================================
-- 2. Índices
-- =====================================================================
-- Query principal de la vista v_precio_health
create index if not exists idx_audits_farmacia_sku
  on public.price_audits (farmacia_id, sku_id, created_at desc);

-- Antiabuso: verificar votos por usuario/farmacia/día
create index if not exists idx_audits_user_farmacia_fecha
  on public.price_audits (user_id, farmacia_id, created_at desc);

-- Reportes por usuario
create index if not exists idx_audits_user
  on public.price_audits (user_id, created_at desc);

-- =====================================================================
-- 3. Trigger antiabuso: máx 3 votos por usuario/farmacia/día
-- =====================================================================
-- Adendum v2.1 §3.3: "Para evitar abuso: máximo 3 votos por usuario por
-- farmacia por día (validación en backend)."
create or replace function public.check_price_audit_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  votos_hoy integer;
begin
  -- Bypass para admin (puede auditar manualmente sin límite)
  if public.current_rol() = 'admin' then
    return new;
  end if;

  select count(*) into votos_hoy
    from public.price_audits
   where user_id     = new.user_id
     and farmacia_id = new.farmacia_id
     and created_at >= date_trunc('day', now());

  if votos_hoy >= 3 then
    raise exception 'Límite diario alcanzado: máximo 3 votos por farmacia por día'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_price_audits_limit on public.price_audits;
create trigger trg_price_audits_limit
  before insert on public.price_audits
  for each row execute function public.check_price_audit_limit();

-- =====================================================================
-- 4. Vista v_precio_health (adendum §3.3)
-- =====================================================================
-- Ratio de votos por SKU/farmacia en los últimos 30 días.
-- Usado por admin para detectar farmacias con precios mal calibrados.
create or replace view public.v_precio_health as
select
  pa.farmacia_id,
  pa.sku_id,
  count(*)                                             as total_votos,
  count(*) filter (where pa.voto = 'correcto')         as votos_ok,
  count(*) filter (where pa.voto = 'incorrecto')       as votos_mal,
  round(
    count(*) filter (where pa.voto = 'correcto')::numeric
    / nullif(count(*), 0) * 100, 1
  )                                                    as pct_correcto,
  max(pa.created_at)                                   as ultimo_voto,
  min(pa.created_at)                                   as primer_voto
from public.price_audits pa
where pa.created_at > now() - interval '30 days'
group by pa.farmacia_id, pa.sku_id;

comment on view public.v_precio_health is
  'Ratio de votos comunitarios por SKU/farmacia últimos 30 días (adendum v2.1 §3.3).';

-- =====================================================================
-- 5. Vista enriquecida para panel admin
-- =====================================================================
-- Join con nombres para que el admin vea "Pfizer · Atorvastatina · Farmacia X"
-- en vez de UUIDs sueltos.
create or replace view public.v_precio_health_detalle as
select
  ph.farmacia_id,
  f.nombre                     as farmacia_nombre,
  ph.sku_id,
  p.nombre_comercial           as producto_nombre,
  l.nombre                     as laboratorio_nombre,
  ph.total_votos,
  ph.votos_ok,
  ph.votos_mal,
  ph.pct_correcto,
  ph.ultimo_voto,
  case
    when ph.total_votos < 5                    then 'pocos_datos'
    when ph.pct_correcto >= 80                 then 'ok'
    when ph.pct_correcto between 50 and 79.9   then 'revisar'
    else                                            'problema'
  end                          as estado
from public.v_precio_health ph
join public."Farmacias" f on f.id = ph.farmacia_id
join public.productos   p on p.id = ph.sku_id
left join public.laboratorios l on l.id = p.laboratorio_id;

comment on view public.v_precio_health_detalle is
  'v_precio_health con nombres legibles + flag de estado (ok/revisar/problema) para admin.';

-- =====================================================================
-- 6. RLS policies
-- =====================================================================
alter table public.price_audits enable row level security;

-- Insert: solo el propio usuario autenticado, con user_id = auth.uid()
drop policy if exists "price_audits_insert_self" on public.price_audits;
create policy "price_audits_insert_self"
  on public.price_audits for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Select: cada usuario ve sus propios votos; admin ve todos
drop policy if exists "price_audits_read_self_or_admin" on public.price_audits;
create policy "price_audits_read_self_or_admin"
  on public.price_audits for select
  to authenticated
  using (
    auth.uid() = user_id
    or public.current_rol() = 'admin'
  );

-- Delete: solo admin (para moderación)
drop policy if exists "price_audits_delete_admin" on public.price_audits;
create policy "price_audits_delete_admin"
  on public.price_audits for delete
  to authenticated
  using (public.current_rol() = 'admin');

-- Update: bloqueado (los votos son inmutables; si cambia de opinión, inserta otro)
-- (no policy = no update)

-- =====================================================================
-- 7. Comentarios de documentación
-- =====================================================================
comment on table  public.price_audits is
  'Votos comunitarios ✅/❌ sobre el rango estimado de precio (adendum v2.1 §3.3).';
comment on column public.price_audits.voto is
  'correcto = ✅ "Compré a este precio" · incorrecto = ❌ "Precio incorrecto"';
comment on column public.price_audits.precio_visto is
  'Precio exacto que el usuario vio en Keriva al votar. Usado para calibrar precio_base.';
