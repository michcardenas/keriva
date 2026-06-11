-- =====================================================================
-- Consentimiento Ley 172-13 (RD) — datos de salud
-- =====================================================================
-- Tarea U3 del re-scope Usuario.
--
-- La Ley 172-13 (RD) regula la protección de datos personales,
-- particularmente los datos de salud (categoría sensible). Hasta que el
-- usuario acepte explícitamente el tratamiento, Keriva NO debe:
--   · Vincular su user_id a eventos de analítica (PostHog).
--   · Adjuntar su user_id a eventos de error (Sentry).
--   · Compartir su perfil con terceros.
--
-- El consentimiento se registra como timestamp. NULL = no aceptado.
-- Es opt-in: la app funciona sin él (lectura pública), pero no hay PII
-- en observabilidad ni features de salud personalizadas.
-- =====================================================================

alter table public.perfiles
  add column if not exists consentimiento_172_13_at timestamptz null;

comment on column public.perfiles.consentimiento_172_13_at is
  'Marca temporal en que el usuario aceptó el tratamiento de datos de salud (Ley 172-13 RD). NULL = no aceptado.';

-- RPC para que el usuario actual registre su consentimiento. Idempotente:
-- si ya aceptó, mantiene el timestamp original.
create or replace function public.aceptar_consentimiento_172_13()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.perfiles
     set consentimiento_172_13_at = coalesce(consentimiento_172_13_at, now()),
         updated_at = now()
   where id = auth.uid();
  if not found then
    raise exception 'Perfil no encontrado para el usuario actual';
  end if;
  return jsonb_build_object(
    'ok', true,
    'consentimiento_at',
    (select consentimiento_172_13_at from public.perfiles where id = auth.uid())
  );
end;
$$;

comment on function public.aceptar_consentimiento_172_13 is
  'Registra el consentimiento Ley 172-13 del usuario autenticado. Idempotente.';
