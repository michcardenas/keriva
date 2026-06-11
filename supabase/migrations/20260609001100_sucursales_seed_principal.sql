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
