-- =====================================================================
-- Keriva Reviews — Reseñas y calificaciones de farmacias (Tarea #4)
-- =====================================================================
-- Permite a los usuarios calificar (1-5 estrellas) y comentar farmacias.
--
-- Identidad de farmacia:
--   · La fuente del mapa es `farmacias_osm` (uuid, 839 filas geo).
--   · Por eso las reseñas cuelgan de farmacias_osm.id (uuid), NO de la
--     tabla legacy "Farmacias" (bigint, solo admin/afiliación WhatsApp).
--
-- Reglas:
--   · Una reseña por usuario por farmacia (unique). Editar = upsert.
--   · Lectura pública (anon + auth) — las estrellas se ven sin login.
--   · Escribir/editar/borrar: solo el autor. Admin puede moderar/borrar.
-- =====================================================================

-- =====================================================================
-- 1. Tabla
-- =====================================================================
create table if not exists public.resenas (
  id            uuid primary key default gen_random_uuid(),
  farmacia_id   uuid not null references public.farmacias_osm(id) on delete cascade,
  usuario_id    uuid not null references auth.users(id) on delete cascade,
  -- Nombre/avatar del autor denormalizados (snapshot al escribir). Necesario
  -- porque la RLS de `perfiles` solo permite leer el perfil propio, así que el
  -- front no puede resolver el nombre de OTROS autores vía join.
  autor_nombre      text,
  autor_avatar_url  text,
  calificacion  smallint not null,
  comentario    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint resenas_calificacion_rango check (calificacion between 1 and 5),
  constraint resenas_comentario_largo   check (comentario is null or char_length(comentario) <= 1000),
  constraint resenas_unica_por_usuario  unique (usuario_id, farmacia_id)
);

-- =====================================================================
-- 2. Índices
-- =====================================================================
-- Listar/agregar reseñas de una farmacia (orden por fecha desc)
create index if not exists idx_resenas_farmacia
  on public.resenas (farmacia_id, created_at desc);

-- "Mis reseñas" en el perfil
create index if not exists idx_resenas_usuario
  on public.resenas (usuario_id, created_at desc);

-- =====================================================================
-- 3. Trigger updated_at (reutiliza función de catalog_base)
-- =====================================================================
drop trigger if exists trg_resenas_updated on public.resenas;
create trigger trg_resenas_updated
  before update on public.resenas
  for each row execute function public.set_updated_at();

-- =====================================================================
-- 4. Vista agregada: promedio + total + distribución por farmacia
-- =====================================================================
-- Una fila por farmacia que tenga al menos una reseña. El front hace
-- LEFT JOIN lógico (las farmacias sin reseñas no aparecen aquí → 0/0).
create or replace view public.v_farmacia_ratings as
select
  farmacia_id,
  round(avg(calificacion)::numeric, 2) as promedio,
  count(*)                              as total,
  count(*) filter (where calificacion = 5) as c5,
  count(*) filter (where calificacion = 4) as c4,
  count(*) filter (where calificacion = 3) as c3,
  count(*) filter (where calificacion = 2) as c2,
  count(*) filter (where calificacion = 1) as c1
from public.resenas
group by farmacia_id;

comment on view public.v_farmacia_ratings is
  'Promedio, total y distribución de calificaciones por farmacia (farmacias_osm.id). Fuente de las estrellas en el mapa y la pantalla de reseñas.';

-- =====================================================================
-- 5. RLS policies
-- =====================================================================
alter table public.resenas enable row level security;

-- Lectura pública: cualquiera puede ver reseñas y estrellas (sin login).
drop policy if exists "resenas_read_public" on public.resenas;
create policy "resenas_read_public"
  on public.resenas for select
  to anon, authenticated
  using (true);

-- Crear: solo usuarios autenticados, y solo como autor de su propia reseña.
drop policy if exists "resenas_insert_propio" on public.resenas;
create policy "resenas_insert_propio"
  on public.resenas for insert
  to authenticated
  with check (auth.uid() = usuario_id);

-- Editar: el autor (admin también, para moderar contenido).
drop policy if exists "resenas_update_propio" on public.resenas;
create policy "resenas_update_propio"
  on public.resenas for update
  to authenticated
  using (auth.uid() = usuario_id or public.current_rol() = 'admin')
  with check (auth.uid() = usuario_id or public.current_rol() = 'admin');

-- Borrar: el autor o un admin (moderación de spam/abuso).
drop policy if exists "resenas_delete_propio_o_admin" on public.resenas;
create policy "resenas_delete_propio_o_admin"
  on public.resenas for delete
  to authenticated
  using (auth.uid() = usuario_id or public.current_rol() = 'admin');

-- =====================================================================
-- 6. Permisos sobre la vista (hereda RLS de la tabla base)
-- =====================================================================
grant select on public.v_farmacia_ratings to anon, authenticated;

-- =====================================================================
-- 7. Comentarios de documentación
-- =====================================================================
comment on table public.resenas is
  'Reseñas y calificaciones (1-5) de farmacias. FK a farmacias_osm.id (uuid).';
comment on column public.resenas.calificacion is
  'Estrellas 1-5 (smallint). Constraint resenas_calificacion_rango.';
comment on constraint resenas_unica_por_usuario on public.resenas is
  'Una reseña por usuario por farmacia. Editar la reseña = upsert sobre esta clave.';
