-- =====================================================================
-- Onboarding farmacia — observaciones, documentos RD y reenvío — #33-35 (2/2)
-- =====================================================================
-- ⚠️ CORRER DESPUÉS del 20260609001700 (estados del enum).
--
-- Flujo: pendiente → en_revision → (aprobada | rechazada | con_observaciones)
--   · con_observaciones → la farmacia corrige y reenvía → vuelve a pendiente.
-- Documentos RD: licencia de funcionamiento, registro de la droguería/farmacia,
--   cédula del representante (se suben al bucket existente solicitud-docs).
-- =====================================================================

-- 1. Columnas nuevas
alter table public.solicitudes_farmacia
  add column if not exists observaciones    text,
  add column if not exists doc_licencia_url text,
  add column if not exists doc_registro_url text,
  add column if not exists doc_cedula_url   text;

-- 2. Admin: marcar "en revisión"
create or replace function public.marcar_solicitud_en_revision(p_solicitud_id bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if public.current_rol() is distinct from 'admin' then
    raise exception 'Solo administradores';
  end if;
  update public.solicitudes_farmacia
     set estado = 'en_revision', revisado_por = auth.uid(), updated_at = now()
   where id = p_solicitud_id and estado in ('pendiente', 'en_revision');
  if not found then raise exception 'Solicitud no encontrada o no aplicable'; end if;
  return jsonb_build_object('ok', true);
end; $$;

-- 3. Admin: pedir correcciones (con observaciones)
create or replace function public.solicitar_observaciones_solicitud(
  p_solicitud_id bigint,
  p_observaciones text
)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if public.current_rol() is distinct from 'admin' then
    raise exception 'Solo administradores';
  end if;
  update public.solicitudes_farmacia
     set estado = 'con_observaciones', observaciones = p_observaciones,
         revisado_por = auth.uid(), updated_at = now()
   where id = p_solicitud_id;
  if not found then raise exception 'Solicitud no encontrada'; end if;
  return jsonb_build_object('ok', true);
end; $$;

-- 4. Farmacia: reenviar corregido (vuelve a pendiente)
create or replace function public.reenviar_solicitud_farmacia(
  p_solicitud_id   bigint,
  p_doc_licencia   text default null,
  p_doc_registro   text default null,
  p_doc_cedula     text default null
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_owner  uuid;
  v_estado public.estado_solicitud;
begin
  select usuario_id, estado into v_owner, v_estado
    from public.solicitudes_farmacia where id = p_solicitud_id;
  if not found then raise exception 'Solicitud no encontrada'; end if;
  if v_owner is distinct from auth.uid() then raise exception 'No autorizado'; end if;
  if v_estado not in ('con_observaciones', 'rechazada') then
    raise exception 'Esta solicitud no admite reenvío';
  end if;
  update public.solicitudes_farmacia
     set estado = 'pendiente',
         observaciones = null,
         doc_licencia_url = coalesce(p_doc_licencia, doc_licencia_url),
         doc_registro_url = coalesce(p_doc_registro, doc_registro_url),
         doc_cedula_url   = coalesce(p_doc_cedula,   doc_cedula_url),
         updated_at = now()
   where id = p_solicitud_id;
  return jsonb_build_object('ok', true);
end; $$;

comment on function public.reenviar_solicitud_farmacia is
  'La farmacia reenvía su solicitud corregida (con_observaciones/rechazada → pendiente).';
