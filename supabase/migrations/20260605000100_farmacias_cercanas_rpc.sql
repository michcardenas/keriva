-- =====================================================================
-- Bug 01 (Capa 2) — Query inicial limitada por radio con PostGIS
-- =====================================================================
-- El documento del cliente pide que el mapa cargue inicialmente solo las
-- farmacias dentro de 2 km del usuario (fallback 5 km si hay <5 resultados),
-- y cargue más al hacer pan/zoom.
--
-- Esto agrega:
--   1. La extensión PostGIS (si no está).
--   2. Una columna geográfica generada `geom` en farmacias_osm.
--   3. Un índice GiST para que ST_DWithin sea rápido.
--   4. La RPC farmacias_cercanas(p_lat, p_lng, p_radio_m).
--
-- La app degrada con gracia: si esta migración aún no está aplicada, el
-- cliente cae a getActivePharmacies() (todas, ya agrupadas por clustering).
-- =====================================================================

create extension if not exists postgis;

-- Columna geográfica generada a partir de latitud/longitud (texto o numérico).
alter table public.farmacias_osm
  add column if not exists geom geography(Point, 4326)
  generated always as (
    st_setsrid(
      st_makepoint(
        nullif(longitud::text, '')::float8,
        nullif(latitud::text, '')::float8
      ),
      4326
    )::geography
  ) stored;

create index if not exists idx_farmacias_osm_geom
  on public.farmacias_osm using gist (geom);

-- RPC: farmacias activas dentro de `p_radio_m` metros del punto, ordenadas
-- por cercanía. LIMIT 100 para no saturar el mapa.
create or replace function public.farmacias_cercanas(
  p_lat float8,
  p_lng float8,
  p_radio_m float8 default 2000
)
returns setof public.farmacias_osm
language sql
stable
as $$
  select *
  from public.farmacias_osm
  where activa = true
    and geom is not null
    and st_dwithin(
      geom,
      st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography,
      p_radio_m
    )
  order by geom <-> st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography
  limit 100;
$$;

-- Permitir que usuarios anónimos y autenticados llamen la RPC (lectura pública,
-- igual que el mapa).
grant execute on function public.farmacias_cercanas(float8, float8, float8) to anon, authenticated;
