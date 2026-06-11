-- =====================================================================
-- Rol Farmacia — Catálogo: concentración (Etapa 1, 3/7) — Tarea #25
-- =====================================================================
-- `productos` ya tiene principio_activo y presentacion. Agregamos
-- `concentracion` como campo aparte (ej. "500 mg") para mejorar la búsqueda
-- por principio activo + concentración.
-- =====================================================================

alter table public.productos
  add column if not exists concentracion text;

-- Búsqueda por principio activo (filtro frecuente del usuario).
create index if not exists idx_productos_principio
  on public.productos (principio_activo) where activo = true;

comment on column public.productos.concentracion is
  'Concentración del SKU (ej. "500 mg"). Complementa principio_activo y presentacion.';
