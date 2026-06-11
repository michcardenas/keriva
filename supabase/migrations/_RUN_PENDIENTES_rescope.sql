-- ============================================================================
-- KERIVA — Migraciones PENDIENTES del re-scope (correr TODO de una vez)
-- ----------------------------------------------------------------------------
-- Dónde: Supabase Dashboard -> SQL Editor -> pegar todo -> Run
-- Proyecto: zclgqjvsvimqaaikabnl
-- Seguro: idempotente (if not exists / create or replace / drop policy if exists).
--         Si algo ya estaba aplicado, NO rompe.
-- Generado: 2026-06-10
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────
-- 1/3  Auditoría sin límite para farmacia + admin  (verificación/refresco)
--      Fuente: 20260609000000_audit_limit_exempt_farmacia.sql
-- ────────────────────────────────────────────────────────────────────────
create or replace function public.check_price_audit_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  votos_hoy integer;
begin
  -- Bypass para admin y farmacia (contribuyen/auditan sin límite).
  if public.current_rol() in ('admin', 'farmacia') then
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

-- ────────────────────────────────────────────────────────────────────────
-- 2/3  Perfil de cuenta de farmacia (logo + RPCs mi_farmacia/actualizar)
--      Fuente: 20260609001900_farmacia_cuenta.sql
-- ────────────────────────────────────────────────────────────────────────
alter table public."Farmacias"
  add column if not exists logo_url text;

create or replace function public.mi_farmacia()
returns table(id bigint, nombre text, logo_url text)
language sql
stable
security definer
set search_path = public
as $$
  select f.id, f.nombre, f.logo_url
  from public."Farmacias" f
  where f.id = (select farmacia_id from public.perfiles where id = auth.uid());
$$;

create or replace function public.actualizar_cuenta_farmacia(
  p_nombre text,
  p_logo_url text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fid bigint;
begin
  select farmacia_id into v_fid from public.perfiles where id = auth.uid();
  if v_fid is null then raise exception 'Esta cuenta no es una farmacia'; end if;
  if length(trim(coalesce(p_nombre, ''))) = 0 then raise exception 'El nombre no puede estar vacío'; end if;
  update public."Farmacias"
     set nombre = trim(p_nombre),
         logo_url = coalesce(p_logo_url, logo_url)
   where id = v_fid;
  return jsonb_build_object('ok', true);
end;
$$;

-- ────────────────────────────────────────────────────────────────────────
-- 3/3  Keriva Reviews (tabla resenas + vista + RLS)
--      Fuente: 20260609000300_resenas_farmacias.sql
-- ────────────────────────────────────────────────────────────────────────
create table if not exists public.resenas (
  id            uuid primary key default gen_random_uuid(),
  farmacia_id   uuid not null references public.farmacias_osm(id) on delete cascade,
  usuario_id    uuid not null references auth.users(id) on delete cascade,
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

create index if not exists idx_resenas_farmacia
  on public.resenas (farmacia_id, created_at desc);
create index if not exists idx_resenas_usuario
  on public.resenas (usuario_id, created_at desc);

drop trigger if exists trg_resenas_updated on public.resenas;
create trigger trg_resenas_updated
  before update on public.resenas
  for each row execute function public.set_updated_at();

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
  'Promedio, total y distribución de calificaciones por farmacia (farmacias_osm.id).';

alter table public.resenas enable row level security;

drop policy if exists "resenas_read_public" on public.resenas;
create policy "resenas_read_public"
  on public.resenas for select to anon, authenticated using (true);

drop policy if exists "resenas_insert_propio" on public.resenas;
create policy "resenas_insert_propio"
  on public.resenas for insert to authenticated
  with check (auth.uid() = usuario_id);

drop policy if exists "resenas_update_propio" on public.resenas;
create policy "resenas_update_propio"
  on public.resenas for update to authenticated
  using (auth.uid() = usuario_id or public.current_rol() = 'admin')
  with check (auth.uid() = usuario_id or public.current_rol() = 'admin');

drop policy if exists "resenas_delete_propio_o_admin" on public.resenas;
create policy "resenas_delete_propio_o_admin"
  on public.resenas for delete to authenticated
  using (auth.uid() = usuario_id or public.current_rol() = 'admin');

grant select on public.v_farmacia_ratings to anon, authenticated;

-- ============================================================================
-- VERIFICACIÓN — debe devolver 6 filas
-- ============================================================================
select 'fn' tipo, proname nombre from pg_proc
  where proname in ('check_price_audit_limit','mi_farmacia','actualizar_cuenta_farmacia')
union all select 'tabla', 'resenas' where to_regclass('public.resenas') is not null
union all select 'vista', 'v_farmacia_ratings' where to_regclass('public.v_farmacia_ratings') is not null
union all select 'col', 'Farmacias.logo_url' from information_schema.columns
  where table_name = 'Farmacias' and column_name = 'logo_url';
