-- Advanced medication search engine
--
-- Strategy:
--   1. pg_trgm   → fuzzy matching ("metfor" → "Metformina", typos)
--   2. unaccent   → ignore accents ("acido" → "ácido")
--   3. tsvector   → full-text relevance ranking
--   4. Materialized column `search_text` for fast composite search
--   5. GIN indexes on both tsvector and trigrams
--
-- Covers 25,785 DIGEMAPS records + 83 curated Medicamentos.

-- =====================================================================
-- 1. Enable extensions
-- =====================================================================
create extension if not exists pg_trgm;
create extension if not exists unaccent;

-- =====================================================================
-- 2. Immutable wrapper for unaccent (needed for indexes)
-- =====================================================================
create or replace function public.f_unaccent(text)
returns text
language sql
immutable parallel safe strict
as $$ select public.unaccent('public.unaccent', $1) $$;

-- =====================================================================
-- 3. Add search columns to digemaps_catalogo
-- =====================================================================
-- search_text: concatenated, lowered, unaccented text for trigram matching
alter table public.digemaps_catalogo
  add column if not exists search_text text;

-- search_vector: tsvector for full-text ranking
alter table public.digemaps_catalogo
  add column if not exists search_vector tsvector;

-- =====================================================================
-- 4. Populate search columns
-- =====================================================================
update public.digemaps_catalogo
set
  search_text = public.f_unaccent(lower(
    coalesce(nombre_comercial, '') || ' ' ||
    coalesce(nombre_generico, '') || ' ' ||
    coalesce(principio_activo, '') || ' ' ||
    coalesce(fabricante, '') || ' ' ||
    coalesce(forma_farmaceutica, '')
  )),
  search_vector = to_tsvector('spanish',
    coalesce(nombre_comercial, '') || ' ' ||
    coalesce(nombre_generico, '') || ' ' ||
    coalesce(principio_activo, '') || ' ' ||
    coalesce(fabricante, '') || ' ' ||
    coalesce(forma_farmaceutica, '')
  );

-- =====================================================================
-- 5. Same for Medicamentos (83 rows)
-- =====================================================================
alter table public."Medicamentos"
  add column if not exists search_text text;

alter table public."Medicamentos"
  add column if not exists search_vector tsvector;

update public."Medicamentos"
set
  search_text = public.f_unaccent(lower(
    coalesce(nombre, '') || ' ' ||
    coalesce(nombre_generico, '') || ' ' ||
    coalesce(concentracion, '') || ' ' ||
    coalesce(presentacion, '') || ' ' ||
    coalesce(laboratorio, '') || ' ' ||
    coalesce(categoria, '')
  )),
  search_vector = to_tsvector('spanish',
    coalesce(nombre, '') || ' ' ||
    coalesce(nombre_generico, '') || ' ' ||
    coalesce(concentracion, '') || ' ' ||
    coalesce(presentacion, '') || ' ' ||
    coalesce(laboratorio, '') || ' ' ||
    coalesce(categoria, '')
  );

-- =====================================================================
-- 6. GIN indexes (fast trigram + full-text lookups)
-- =====================================================================
create index if not exists idx_digemaps_search_trgm
  on public.digemaps_catalogo using gin (search_text gin_trgm_ops);

create index if not exists idx_digemaps_search_fts
  on public.digemaps_catalogo using gin (search_vector);

create index if not exists idx_medicamentos_search_trgm
  on public."Medicamentos" using gin (search_text gin_trgm_ops);

create index if not exists idx_medicamentos_search_fts
  on public."Medicamentos" using gin (search_vector);

-- =====================================================================
-- 7. Trigger to auto-update search columns on insert/update
-- =====================================================================
create or replace function public.digemaps_search_update()
returns trigger language plpgsql as $$
begin
  new.search_text := public.f_unaccent(lower(
    coalesce(new.nombre_comercial, '') || ' ' ||
    coalesce(new.nombre_generico, '') || ' ' ||
    coalesce(new.principio_activo, '') || ' ' ||
    coalesce(new.fabricante, '') || ' ' ||
    coalesce(new.forma_farmaceutica, '')
  ));
  new.search_vector := to_tsvector('spanish',
    coalesce(new.nombre_comercial, '') || ' ' ||
    coalesce(new.nombre_generico, '') || ' ' ||
    coalesce(new.principio_activo, '') || ' ' ||
    coalesce(new.fabricante, '') || ' ' ||
    coalesce(new.forma_farmaceutica, '')
  );
  return new;
end;
$$;

drop trigger if exists trg_digemaps_search on public.digemaps_catalogo;
create trigger trg_digemaps_search
  before insert or update on public.digemaps_catalogo
  for each row execute function public.digemaps_search_update();

create or replace function public.medicamentos_search_update()
returns trigger language plpgsql as $$
begin
  new.search_text := public.f_unaccent(lower(
    coalesce(new.nombre, '') || ' ' ||
    coalesce(new.nombre_generico, '') || ' ' ||
    coalesce(new.concentracion, '') || ' ' ||
    coalesce(new.presentacion, '') || ' ' ||
    coalesce(new.laboratorio, '') || ' ' ||
    coalesce(new.categoria, '')
  ));
  new.search_vector := to_tsvector('spanish',
    coalesce(new.nombre, '') || ' ' ||
    coalesce(new.nombre_generico, '') || ' ' ||
    coalesce(new.concentracion, '') || ' ' ||
    coalesce(new.presentacion, '') || ' ' ||
    coalesce(new.laboratorio, '') || ' ' ||
    coalesce(new.categoria, '')
  );
  return new;
end;
$$;

drop trigger if exists trg_medicamentos_search on public."Medicamentos";
create trigger trg_medicamentos_search
  before insert or update on public."Medicamentos"
  for each row execute function public.medicamentos_search_update();

-- =====================================================================
-- 8. RPC search function — called from the client via supabase.rpc()
-- =====================================================================
create or replace function public.buscar_medicamentos(
  termino text,
  limite integer default 30
)
returns table (
  source text,            -- 'catalogo' or 'curado'
  id bigint,
  nombre_comercial text,
  nombre_generico text,
  principio_activo text,
  concentracion text,
  forma_farmaceutica text,
  fabricante text,
  laboratorio text,
  categoria text,
  precio_referencia numeric,
  estatus text,
  registro_sanitario text,
  relevancia real
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  q_clean text;
  q_tsquery tsquery;
begin
  -- Normalize: unaccent, lowercase, trim
  q_clean := f_unaccent(lower(trim(termino)));

  -- Build tsquery: split words and join with &
  q_tsquery := to_tsquery('spanish',
    array_to_string(
      array(select lexeme from unnest(to_tsvector('spanish', q_clean)) order by lexeme),
      ' & '
    )
  );

  return query

  -- Curated medications (83 rows, higher priority)
  select
    'curado'::text as source,
    m.id,
    m.nombre as nombre_comercial,
    m.nombre_generico,
    null::text as principio_activo,
    m.concentracion,
    m.presentacion as forma_farmaceutica,
    null::text as fabricante,
    m.laboratorio,
    m.categoria,
    m.precio_referencia_rd as precio_referencia,
    'CURADO'::text as estatus,
    null::text as registro_sanitario,
    (
      -- Combine FTS rank + trigram similarity + curated bonus
      coalesce(ts_rank(m.search_vector, q_tsquery), 0) * 2.0
      + similarity(m.search_text, q_clean) * 3.0
      + 0.5  -- curated bonus
    )::real as relevancia
  from public."Medicamentos" m
  where
    m.search_text % q_clean                          -- trigram threshold
    or m.search_vector @@ q_tsquery                  -- full-text match
    or m.search_text ilike '%' || q_clean || '%'     -- fallback substring

  union all

  -- Full DIGEMAPS catalog (25,785 rows)
  select
    'catalogo'::text as source,
    null::bigint as id,
    d.nombre_comercial,
    d.nombre_generico,
    d.principio_activo,
    null::text as concentracion,
    d.forma_farmaceutica,
    d.fabricante,
    null::text as laboratorio,
    d.tipo_producto as categoria,
    null::numeric as precio_referencia,
    d.estatus,
    d.registro_sanitario,
    (
      coalesce(ts_rank(d.search_vector, q_tsquery), 0) * 2.0
      + similarity(d.search_text, q_clean) * 2.0
    )::real as relevancia
  from public.digemaps_catalogo d
  where
    d.search_text % q_clean
    or d.search_vector @@ q_tsquery
    or d.search_text ilike '%' || q_clean || '%'

  order by relevancia desc
  limit limite;
end;
$$;
