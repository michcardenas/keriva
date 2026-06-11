-- =====================================================================
-- Rol Farmacia — Eventos / Leads (Etapa 1, 7/7) — Tarea #37
-- =====================================================================
-- Captura de eventos del lado del usuario para las métricas de la farmacia:
--   · busqueda    → término buscado (para "los más buscados", a nivel producto)
--   · vista       → vio la ficha del producto/farmacia
--   · como_llegar → pidió la ruta
--   · contacto    → tocó WhatsApp / llamar (conversión fuerte)
--
-- Privacidad (Ley 172-13 RD): usuario_id es OPCIONAL (NULL = anónimo). Por
-- defecto se capturan de forma anónima/agregada; asociar al usuario requiere
-- consentimiento explícito. Tabla append-only (sin update/delete).
-- =====================================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'evento_tipo') then
    create type public.evento_tipo as enum ('busqueda', 'vista', 'como_llegar', 'contacto');
  end if;
end $$;

create table if not exists public.eventos (
  id           uuid primary key default gen_random_uuid(),
  tipo         public.evento_tipo not null,
  producto_id  uuid   references public.productos(id) on delete set null,
  sucursal_id  uuid   references public.sucursales(id) on delete set null,
  farmacia_id  bigint references public."Farmacias"(id) on delete set null,
  usuario_id   uuid   references auth.users(id) on delete set null,   -- NULL = anónimo
  termino      text,                                                   -- término (para 'busqueda')
  created_at   timestamptz not null default now()
);

create index if not exists idx_eventos_farmacia on public.eventos (farmacia_id, created_at desc);
create index if not exists idx_eventos_producto on public.eventos (producto_id, created_at desc);
create index if not exists idx_eventos_tipo on public.eventos (tipo, created_at desc);

alter table public.eventos enable row level security;

-- Inserción pública (anon + auth): se capturan eventos aunque el usuario no
-- esté logueado. No se exige usuario_id (anónimo).
drop policy if exists "eventos_insert_public" on public.eventos;
create policy "eventos_insert_public"
  on public.eventos for insert
  to anon, authenticated
  with check (true);

-- Lectura: solo la farmacia dueña (sus métricas) o admin. NUNCA pública.
drop policy if exists "eventos_read_owner" on public.eventos;
create policy "eventos_read_owner"
  on public.eventos for select
  to authenticated
  using (public.current_rol() = 'admin' or farmacia_id = public.current_farmacia_id());

comment on table public.eventos is
  'Eventos/leads del usuario para métricas de farmacia. usuario_id NULL = anónimo (Ley 172-13 RD).';
