-- =====================================================================
-- Brief Fase 1 — Semana 1: Multi-Perfil + Keriva Care (cimientos)
-- =====================================================================
-- Crea las tablas núcleo del sistema multi-perfil y Keriva Care
-- según el Brief Técnico Consolidado v1.0 (Abril 2026), secciones:
--   · 3.1 keriva_perfiles            (titular + hasta 4 dependientes)
--   · 3.2 care_medicamentos          (meds crónicos por perfil)
--   · 3.3 care_consentimientos       (Ley 172-13 — 3 toggles)
--   · 3.3 perfil_disclaimer_log      (disclaimer médico bloqueante)
--   · 3.9 v_familia_dashboard        (vista de familia)
--
-- Convenciones:
--   · snake_case (consistente con tablas nuevas)
--   · UUID + gen_random_uuid()
--   · RLS activa en todas las tablas de datos personales
--   · ON DELETE CASCADE sobre datos personales (cumplimiento Ley 172-13)
--   · La tabla legacy `perfiles` (1:1 con auth.users) se conserva como
--     "cuenta" del usuario. `keriva_perfiles` es la familia.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. keriva_perfiles — Núcleo multi-perfil
-- ---------------------------------------------------------------------
create table if not exists public.keriva_perfiles (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  nombre           text not null,
  apellido         text,
  tipo_perfil      text not null
                     check (tipo_perfil in
                       ('titular','dependiente_pediatrico','dependiente_adulto')),
  fecha_nacimiento date,
  -- Peso en libras (entrada del usuario — estándar cultural RD)
  peso_lb          numeric(6,2),
  -- Peso en kg calculado automáticamente para cálculos médicos
  -- (nunca se muestra al usuario — solo interno)
  peso_kg          numeric(6,3)
                     generated always as (round(peso_lb / 2.20462, 3)) stored,
  avatar_emoji     text default '👤',
  activo           boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint keriva_perfiles_nombre_not_empty check (length(trim(nombre)) > 0)
);

-- Un solo titular por cuenta
create unique index if not exists uq_keriva_titular
  on public.keriva_perfiles (user_id)
  where tipo_perfil = 'titular' and activo = true;

-- Índice para listar la familia del usuario
create index if not exists idx_keriva_perfiles_user
  on public.keriva_perfiles (user_id) where activo = true;

-- Trigger: límite de 5 perfiles activos por cuenta (1 titular + 4 deps)
create or replace function public.check_perfil_limit()
returns trigger
language plpgsql
as $$
begin
  if (select count(*) from public.keriva_perfiles
      where user_id = new.user_id and activo = true) >= 5 then
    raise exception 'Límite de 5 perfiles por cuenta alcanzado';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_keriva_perfil_limit on public.keriva_perfiles;
create trigger trg_keriva_perfil_limit
  before insert on public.keriva_perfiles
  for each row execute function public.check_perfil_limit();

-- Trigger: actualizar updated_at en cada modificación
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_keriva_perfiles_updated on public.keriva_perfiles;
create trigger trg_keriva_perfiles_updated
  before update on public.keriva_perfiles
  for each row execute function public.set_updated_at();

-- RLS
alter table public.keriva_perfiles enable row level security;

drop policy if exists "keriva_perfiles_user_all" on public.keriva_perfiles;
create policy "keriva_perfiles_user_all"
  on public.keriva_perfiles
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- 2. Auto-crear titular cuando se crea un perfiles row (signup)
-- ---------------------------------------------------------------------
create or replace function public.handle_new_titular()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.keriva_perfiles (user_id, nombre, tipo_perfil, avatar_emoji)
  values (
    new.id,
    coalesce(nullif(trim(new.nombre), ''), split_part(new.email, '@', 1)),
    'titular',
    '👤'
  )
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists on_perfiles_created_titular on public.perfiles;
create trigger on_perfiles_created_titular
  after insert on public.perfiles
  for each row execute function public.handle_new_titular();

-- ---------------------------------------------------------------------
-- 3. care_medicamentos — Medicamentos crónicos por perfil
-- ---------------------------------------------------------------------
create table if not exists public.care_medicamentos (
  id                uuid primary key default gen_random_uuid(),
  perfil_id         uuid not null references public.keriva_perfiles(id) on delete cascade,
  -- Desnormalización intencional para analytics sin JOIN
  perfil_tipo       text not null
                      check (perfil_tipo in
                        ('titular','dependiente_pediatrico','dependiente_adulto')),
  sku_id            uuid not null references public.productos(id),
  nombre_display    text not null,
  frecuencia_tipo   text not null
                      check (frecuencia_tipo in ('diaria','horas','semanal')),
  frecuencia_valor  smallint,
  horas_toma        time[] not null default '{}',
  dias_semana       smallint[],
  activo            boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_care_meds_perfil
  on public.care_medicamentos (perfil_id) where activo = true;
create index if not exists idx_care_meds_tipo
  on public.care_medicamentos (perfil_tipo);

drop trigger if exists trg_care_meds_updated on public.care_medicamentos;
create trigger trg_care_meds_updated
  before update on public.care_medicamentos
  for each row execute function public.set_updated_at();

alter table public.care_medicamentos enable row level security;

drop policy if exists "care_meds_user_all" on public.care_medicamentos;
create policy "care_meds_user_all"
  on public.care_medicamentos
  for all
  to authenticated
  using (
    exists (select 1 from public.keriva_perfiles kp
            where kp.id = care_medicamentos.perfil_id
              and kp.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.keriva_perfiles kp
            where kp.id = care_medicamentos.perfil_id
              and kp.user_id = auth.uid())
  );

-- ---------------------------------------------------------------------
-- 4. care_consentimientos — Ley 172-13 (3 toggles)
-- ---------------------------------------------------------------------
create table if not exists public.care_consentimientos (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null unique references auth.users(id) on delete cascade,
  acepta_tec             boolean not null default false,
  acepta_geolocalizacion boolean not null default false,
  acepta_historial       boolean not null default false,
  acepta_notificaciones  boolean not null default false,
  version_tec            text not null,
  ip_aceptacion          text,
  timestamp_aceptacion   timestamptz not null default now()
);

alter table public.care_consentimientos enable row level security;

drop policy if exists "care_consent_user_all" on public.care_consentimientos;
create policy "care_consent_user_all"
  on public.care_consentimientos
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- 5. perfil_disclaimer_log — Disclaimer médico por perfil (snapshot legal)
-- ---------------------------------------------------------------------
create table if not exists public.perfil_disclaimer_log (
  id                   uuid primary key default gen_random_uuid(),
  perfil_id            uuid not null references public.keriva_perfiles(id) on delete cascade,
  user_id              uuid not null references auth.users(id) on delete cascade,
  version_disclaimer   text not null,    -- 'kids_v1.0' | 'care_v1.0'
  tipo_disclaimer      text not null
                         check (tipo_disclaimer in ('pediatrico','adulto_care')),
  texto_disclaimer     text not null,    -- snapshot exacto del texto mostrado
  ip_aceptacion        text,
  device_fingerprint   text,
  timestamp_aceptacion timestamptz not null default now(),
  activo               boolean not null default true
);

create index if not exists idx_disclaimer_check
  on public.perfil_disclaimer_log
  (perfil_id, tipo_disclaimer, activo) where activo = true;

alter table public.perfil_disclaimer_log enable row level security;

drop policy if exists "perfil_disclaimer_user_all" on public.perfil_disclaimer_log;
create policy "perfil_disclaimer_user_all"
  on public.perfil_disclaimer_log
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- 6. Vista: v_familia_dashboard — Familia con estado disclaimer + meds
-- ---------------------------------------------------------------------
create or replace view public.v_familia_dashboard as
  select
    kp.id              as perfil_id,
    kp.user_id,
    kp.nombre,
    kp.apellido,
    kp.tipo_perfil,
    kp.peso_lb,
    kp.peso_kg,
    kp.avatar_emoji,
    kp.fecha_nacimiento,
    case when kp.fecha_nacimiento is null then null
         else date_part('year', age(kp.fecha_nacimiento))::int
    end as edad_anios,
    coalesce(
      (select count(*)::int from public.care_medicamentos cm
        where cm.perfil_id = kp.id and cm.activo = true),
      0
    ) as medicamentos_activos,
    exists (
      select 1 from public.perfil_disclaimer_log dl
       where dl.perfil_id = kp.id and dl.activo = true
    ) as disclaimer_aceptado
  from public.keriva_perfiles kp
  where kp.activo = true;

-- La vista hereda RLS de keriva_perfiles (la consulta interna filtra por user_id).
-- En Supabase las vistas heredan permisos del invocador (security_invoker).
alter view public.v_familia_dashboard set (security_invoker = true);

-- =====================================================================
-- Fin migración Semana 1
-- =====================================================================
