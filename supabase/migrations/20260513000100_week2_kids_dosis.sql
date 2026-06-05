-- =====================================================================
-- Brief Fase 1 — Semana 2: Keriva Kids (dosis + restricciones + disclaimer)
-- =====================================================================
-- Según secciones del brief:
--   · 3.5 dosis_pediatricas, restricciones_pediatricas (tablas maestras)
--   · 4.1 cálculo de dosis pediátrica (lógica de negocio)
--   · 5   disclaimer médico bloqueante (función registrar_disclaimer)
--
-- Las tablas de dosis/restricciones son MAESTRAS (lectura pública).
-- El equipo de Keriva las pobla manualmente citando la fuente
-- (PROMESE/CAL, Vademécum Pediátrico estándar).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. dosis_pediatricas
-- ---------------------------------------------------------------------
create table if not exists public.dosis_pediatricas (
  id                  uuid primary key default gen_random_uuid(),
  sku_id              uuid not null references public.productos(id) on delete cascade,
  dosis_mg_por_kg     numeric(6,2) not null,
  dosis_max_mg        numeric(8,2),                -- tope absoluto de seguridad
  frecuencia_horas    smallint not null,
  via_administracion  text,                        -- 'oral', 'tópica', 'rectal'...
  notas               text,
  fuente              text not null,               -- 'PROMESE/CAL' | 'Vademécum Pediátrico'
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint dosis_positive check (dosis_mg_por_kg > 0),
  constraint dosis_max_positive check (dosis_max_mg is null or dosis_max_mg > 0),
  constraint frecuencia_positive check (frecuencia_horas > 0)
);

-- Una sola dosis vigente por SKU (si hay variantes, ampliar a partial unique con flag activo)
create unique index if not exists uq_dosis_sku
  on public.dosis_pediatricas (sku_id);

create index if not exists idx_dosis_sku on public.dosis_pediatricas (sku_id);

alter table public.dosis_pediatricas enable row level security;

-- Lectura pública (anon + authenticated). Datos no personales.
drop policy if exists "dosis_public_read" on public.dosis_pediatricas;
create policy "dosis_public_read"
  on public.dosis_pediatricas
  for select
  using (true);

drop trigger if exists trg_dosis_updated on public.dosis_pediatricas;
create trigger trg_dosis_updated
  before update on public.dosis_pediatricas
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 2. restricciones_pediatricas
-- ---------------------------------------------------------------------
create table if not exists public.restricciones_pediatricas (
  id                  uuid primary key default gen_random_uuid(),
  sku_id              uuid not null references public.productos(id) on delete cascade,
  edad_minima_meses   smallint,                    -- null = sin mínimo
  edad_maxima_meses   smallint,                    -- null = sin máximo
  contraindicado      boolean not null default false,
  advertencia         text,
  fuente              text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists idx_restricciones_sku
  on public.restricciones_pediatricas (sku_id);

alter table public.restricciones_pediatricas enable row level security;

drop policy if exists "restricciones_public_read" on public.restricciones_pediatricas;
create policy "restricciones_public_read"
  on public.restricciones_pediatricas
  for select
  using (true);

drop trigger if exists trg_restricciones_updated on public.restricciones_pediatricas;
create trigger trg_restricciones_updated
  before update on public.restricciones_pediatricas
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 3. Función: registrar_disclaimer (security definer)
-- ---------------------------------------------------------------------
-- Brief §5.1 paso 4: registra el log de aceptación con snapshot del texto,
-- IP y device fingerprint. SECURITY DEFINER porque el cliente no puede
-- escribir tablas privilegiadas — esta función valida que el perfil sea del
-- usuario autenticado y registra.
create or replace function public.registrar_disclaimer(
  p_perfil_id          uuid,
  p_tipo_disclaimer    text,        -- 'pediatrico' | 'adulto_care'
  p_version            text,        -- 'kids_v1.0', 'care_v1.0', ...
  p_texto              text,
  p_ip                 text default null,
  p_device_fingerprint text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_log_id  uuid;
begin
  -- 1) Verificar que el perfil pertenezca al usuario autenticado
  select user_id into v_user_id
    from public.keriva_perfiles
   where id = p_perfil_id and activo = true;

  if v_user_id is null then
    raise exception 'Perfil no encontrado o inactivo';
  end if;

  if v_user_id <> auth.uid() then
    raise exception 'No autorizado: el perfil no pertenece al usuario';
  end if;

  -- 2) Validar tipo
  if p_tipo_disclaimer not in ('pediatrico','adulto_care') then
    raise exception 'tipo_disclaimer inválido: %', p_tipo_disclaimer;
  end if;

  -- 3) Insertar (no desactivar versiones previas — el flag `activo` permite
  --    histórico; el chequeo "ya aceptó" filtra por activo=true).
  insert into public.perfil_disclaimer_log (
    perfil_id, user_id, version_disclaimer, tipo_disclaimer,
    texto_disclaimer, ip_aceptacion, device_fingerprint
  ) values (
    p_perfil_id, v_user_id, p_version, p_tipo_disclaimer,
    p_texto, p_ip, p_device_fingerprint
  )
  returning id into v_log_id;

  return v_log_id;
end;
$$;

revoke all on function public.registrar_disclaimer(uuid, text, text, text, text, text) from public;
grant execute on function public.registrar_disclaimer(uuid, text, text, text, text, text) to authenticated;

-- ---------------------------------------------------------------------
-- 4. Vista helper para Kids: dosis + restricciones por producto
-- ---------------------------------------------------------------------
create or replace view public.v_producto_pediatrico as
  select
    p.id as sku_id,
    p.nombre_comercial,
    p.principio_activo,
    p.presentacion,
    p.categoria_id,
    d.dosis_mg_por_kg,
    d.dosis_max_mg,
    d.frecuencia_horas,
    d.via_administracion,
    d.notas             as dosis_notas,
    d.fuente            as dosis_fuente,
    r.edad_minima_meses,
    r.edad_maxima_meses,
    r.contraindicado,
    r.advertencia       as restriccion_advertencia,
    r.fuente            as restriccion_fuente
  from public.productos p
  left join public.dosis_pediatricas d on d.sku_id = p.id
  left join public.restricciones_pediatricas r on r.sku_id = p.id
  where p.activo = true;

alter view public.v_producto_pediatrico set (security_invoker = true);

-- =====================================================================
-- Fin migración Semana 2
-- =====================================================================
