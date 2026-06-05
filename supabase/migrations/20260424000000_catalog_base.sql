-- =====================================================================
-- Adendum v2.1 — Catalog base tables (Bloque 1, migración 1/5)
-- =====================================================================
-- Nuevas tablas que soportan:
--   · Pin Patrocinado (laboratorios → categorias → productos)
--   · Sistema de productos comerciales con categorización terapéutica
--   · Flag `restricted` en categorías (oncología, psiquiatría, anticoncep-
--     tivos, VIH) para bloquear patrocinios según el adendum 3.1.
--
-- Convenciones:
--   · Tablas nuevas en snake_case (vs. legacy "Farmacias", "Medicamentos")
--   · UUID con gen_random_uuid() (requerido por adendum v2.1)
--   · `productos` puede enlazar a digemaps_catalogo (bigint) para
--     trazabilidad del registro oficial.
--   · RLS: lectura pública (anon + authenticated); escritura solo admin.
--
-- Extensiones requeridas: pgcrypto para gen_random_uuid().
-- =====================================================================

create extension if not exists pgcrypto;

-- =====================================================================
-- 1. laboratorios
-- =====================================================================
create table if not exists public.laboratorios (
  id           uuid primary key default gen_random_uuid(),
  nombre       text not null,
  slug         text not null unique,
  pais         text,                -- país de origen: 'RD', 'US', 'DE', etc.
  rnc          text,                -- RNC (si opera en RD)
  contacto     text,                -- email o teléfono comercial
  activo       boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint laboratorios_nombre_not_empty check (length(trim(nombre)) > 0)
);

create index if not exists idx_laboratorios_activo
  on public.laboratorios (activo) where activo = true;

-- =====================================================================
-- 2. categorias_terapeuticas
-- =====================================================================
-- Reemplaza el array hardcoded CATEGORIES de app/(tabs)/index.tsx.
-- El flag `restricted` bloquea patrocinios (adendum 3.1).
create table if not exists public.categorias_terapeuticas (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique,
  nombre       text not null,
  icono        text,                -- nombre del ícono lucide: 'Heart', 'Shield', etc.
  color        text,                -- hex color: '#E53935'
  orden        smallint not null default 0,
  restricted   boolean not null default false,
  activo       boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint categorias_color_hex check (color is null or color ~ '^#[0-9A-Fa-f]{6}$')
);

create index if not exists idx_categorias_activo_orden
  on public.categorias_terapeuticas (activo, orden) where activo = true;

create index if not exists idx_categorias_restricted
  on public.categorias_terapeuticas (restricted);

-- =====================================================================
-- 3. productos (SKU comercial = unidad vendible)
-- =====================================================================
-- Un "producto" es una presentación comercial concreta.
-- Referencia opcional al registro DIGEMAPS oficial (bigint).
create table if not exists public.productos (
  id                    uuid primary key default gen_random_uuid(),
  nombre_comercial      text not null,
  sku                   text,                 -- GS1 / código manufacturer
  principio_activo      text,
  presentacion          text,                 -- ej: "Tabletas 500mg x 30"
  laboratorio_id        uuid references public.laboratorios(id) on delete set null,
  categoria_id          uuid references public.categorias_terapeuticas(id) on delete set null,
  -- FK a digemaps_catalogo se agrega al final con verificación de tipo
  -- (la tabla fue creada por import de CSV, no por migración).
  digemaps_catalogo_id  bigint,
  activo                boolean not null default true,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint productos_nombre_not_empty check (length(trim(nombre_comercial)) > 0)
);

create index if not exists idx_productos_laboratorio
  on public.productos (laboratorio_id) where activo = true;

create index if not exists idx_productos_categoria
  on public.productos (categoria_id) where activo = true;

create index if not exists idx_productos_digemaps
  on public.productos (digemaps_catalogo_id);

create unique index if not exists uq_productos_sku
  on public.productos (sku) where sku is not null;

-- =====================================================================
-- 4. updated_at trigger (reutilizable)
-- =====================================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_laboratorios_updated on public.laboratorios;
create trigger trg_laboratorios_updated
  before update on public.laboratorios
  for each row execute function public.set_updated_at();

drop trigger if exists trg_categorias_updated on public.categorias_terapeuticas;
create trigger trg_categorias_updated
  before update on public.categorias_terapeuticas
  for each row execute function public.set_updated_at();

drop trigger if exists trg_productos_updated on public.productos;
create trigger trg_productos_updated
  before update on public.productos
  for each row execute function public.set_updated_at();

-- =====================================================================
-- 5. RLS policies
-- =====================================================================
alter table public.laboratorios           enable row level security;
alter table public.categorias_terapeuticas enable row level security;
alter table public.productos              enable row level security;

-- Laboratorios: lectura pública, escritura solo admin
drop policy if exists "laboratorios_read_all" on public.laboratorios;
create policy "laboratorios_read_all"
  on public.laboratorios for select
  to anon, authenticated
  using (activo = true or public.current_rol() = 'admin');

drop policy if exists "laboratorios_write_admin" on public.laboratorios;
create policy "laboratorios_write_admin"
  on public.laboratorios for all
  to authenticated
  using (public.current_rol() = 'admin')
  with check (public.current_rol() = 'admin');

-- Categorías: lectura pública, escritura solo admin
drop policy if exists "categorias_read_all" on public.categorias_terapeuticas;
create policy "categorias_read_all"
  on public.categorias_terapeuticas for select
  to anon, authenticated
  using (activo = true or public.current_rol() = 'admin');

drop policy if exists "categorias_write_admin" on public.categorias_terapeuticas;
create policy "categorias_write_admin"
  on public.categorias_terapeuticas for all
  to authenticated
  using (public.current_rol() = 'admin')
  with check (public.current_rol() = 'admin');

-- Productos: lectura pública, escritura solo admin
drop policy if exists "productos_read_all" on public.productos;
create policy "productos_read_all"
  on public.productos for select
  to anon, authenticated
  using (activo = true or public.current_rol() = 'admin');

drop policy if exists "productos_write_admin" on public.productos;
create policy "productos_write_admin"
  on public.productos for all
  to authenticated
  using (public.current_rol() = 'admin')
  with check (public.current_rol() = 'admin');

-- =====================================================================
-- 6. Seed — categorías terapéuticas
-- =====================================================================
-- Migra las 16 categorías actuales de app/(tabs)/index.tsx + agrega las
-- 4 categorías restringidas del adendum (oncología, psiquiatría,
-- anticonceptivos, VIH).
insert into public.categorias_terapeuticas (slug, nombre, icono, color, orden, restricted)
values
  ('todo',              'Todo',                'Pill',       '#106B4F',  0, false),
  ('presion-arterial',  'Presión arterial',    'Heart',      '#E53935', 10, false),
  ('analgesico',        'Analgésico',          'Zap',        '#FF6F00', 20, false),
  ('antibiotico',       'Antibiótico',         'Shield',     '#1565C0', 30, false),
  ('diabetes',          'Diabetes',            'Droplets',   '#6A1B9A', 40, false),
  ('gastro',            'Gastro',              'Flame',      '#EF6C00', 50, false),
  ('vitaminas',         'Vitaminas',           'Leaf',       '#2E7D32', 60, false),
  ('colesterol',        'Colesterol',          'Heart',      '#AD1457', 70, false),
  ('alergico',          'Alérgico',            'Wind',       '#00838F', 80, false),
  ('antiinflamatorio',  'Antiinflamatorio',    'Thermometer','#D84315', 90, false),
  ('diuretico',         'Diurético',           'Droplets',   '#0277BD',100, false),
  ('respiratorio',      'Respiratorio',        'Wind',       '#00695C',110, false),
  ('antidepresivo',     'Antidepresivo',       'Brain',      '#4527A0',120, true),  -- psiquiatría → restricted
  ('gota',              'Gota',                'Droplets',   '#283593',130, false),
  ('neurologico',       'Neurológico',         'Brain',      '#1A237E',140, false),
  ('tiroides',          'Tiroides',            'Syringe',    '#4E342E',150, false),
  ('anticoagulante',    'Anticoagulante',      'Droplets',   '#B71C1C',160, false),
  -- Categorías restringidas del adendum (sin ícono en app actual, quedan ocultas hasta diseñar)
  ('oncologia',         'Oncología',           'ShieldAlert','#424242',200, true),
  ('psiquiatria',       'Psiquiatría',         'Brain',      '#424242',210, true),
  ('anticonceptivos',   'Anticonceptivos',     'Heart',      '#424242',220, true),
  ('vih',               'VIH / Antirretrovirales','Shield',  '#424242',230, true)
on conflict (slug) do nothing;

-- =====================================================================
-- 7. Seed — laboratorios principales en RD
-- =====================================================================
-- Lista curada de laboratorios con presencia en República Dominicana.
-- Incluye multinacionales (para pins premium) y nacionales (para farmacias
-- afiliadas). Se puede expandir desde el panel admin.
insert into public.laboratorios (nombre, slug, pais, activo)
values
  ('Pfizer',                       'pfizer',              'US', true),
  ('Bayer',                        'bayer',               'DE', true),
  ('Novartis',                     'novartis',            'CH', true),
  ('Roche',                        'roche',               'CH', true),
  ('Sanofi',                       'sanofi',              'FR', true),
  ('Merck',                        'merck',               'US', true),
  ('GlaxoSmithKline',              'gsk',                 'GB', true),
  ('AstraZeneca',                  'astrazeneca',         'GB', true),
  ('Bristol-Myers Squibb',         'bristol-myers',       'US', true),
  ('Johnson & Johnson',            'johnson-johnson',     'US', true),
  ('Abbott',                       'abbott',              'US', true),
  ('Eli Lilly',                    'eli-lilly',           'US', true),
  ('Boehringer Ingelheim',         'boehringer',          'DE', true),
  ('Teva Pharmaceutical',          'teva',                'IL', true),
  -- Laboratorios con presencia fuerte en RD
  ('Laboratorios Orbe',            'orbe',                'DO', true),
  ('Farmacéutica Magnachem',       'magnachem',           'DO', true),
  ('Laboratorios Rowe',            'rowe',                'DO', true),
  ('Letamar Farmacéutica',         'letamar',             'DO', true),
  ('PROMESE/CAL',                  'promese-cal',         'DO', true)  -- oficial gobierno
on conflict (slug) do nothing;

-- =====================================================================
-- 8. FK opcional a digemaps_catalogo (defensivo: solo si el tipo coincide)
-- =====================================================================
-- Crea el FK únicamente si digemaps_catalogo.id es bigint (int8).
-- Si el tipo difiere, la columna queda sin FK pero sigue funcional como
-- identificador "soft". El panel admin puede reconciliar después.
do $$
declare
  col_type text;
begin
  select data_type into col_type
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'digemaps_catalogo'
    and column_name = 'id';

  if col_type = 'bigint' then
    begin
      alter table public.productos
        add constraint productos_digemaps_fk
        foreign key (digemaps_catalogo_id)
        references public.digemaps_catalogo(id)
        on delete set null;
      raise notice 'FK productos → digemaps_catalogo creado.';
    exception when duplicate_object then
      raise notice 'FK productos → digemaps_catalogo ya existe.';
    end;
  else
    raise notice 'digemaps_catalogo.id no es bigint (%). FK omitido.', col_type;
  end if;
end $$;

-- =====================================================================
-- 9. Comentarios para documentación
-- =====================================================================
comment on table  public.laboratorios           is 'Laboratorios farmacéuticos que pueden patrocinar pins (adendum v2.1 §3.1).';
comment on table  public.categorias_terapeuticas is 'Categorías terapéuticas de medicamentos. restricted=true bloquea patrocinios.';
comment on table  public.productos              is 'SKU comerciales. Referencia opcional a digemaps_catalogo para trazabilidad.';
comment on column public.categorias_terapeuticas.restricted is 'Si true, no se puede activar pin patrocinado (adendum v2.1 §3.1).';
comment on column public.productos.digemaps_catalogo_id     is 'Link opcional al registro oficial DIGEMAPS (25.785 entradas).';
