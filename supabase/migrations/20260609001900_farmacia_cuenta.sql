-- =====================================================================
-- Perfil de la cuenta de farmacia (Etapa 1) — Tarea #39
-- =====================================================================
-- La "cuenta" de la farmacia es la fila legacy "Farmacias" (bigint) a la que
-- apunta perfiles.farmacia_id. Para editar su nombre comercial sin depender de
-- la RLS (incierta) de esa tabla, usamos RPCs SECURITY DEFINER que solo tocan
-- la farmacia del propio usuario.
-- =====================================================================

-- Logo opcional de la marca.
alter table public."Farmacias"
  add column if not exists logo_url text;

-- Datos de la cuenta del usuario actual (su farmacia).
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

-- Actualizar el nombre comercial (y opcionalmente el logo) de la propia cuenta.
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
