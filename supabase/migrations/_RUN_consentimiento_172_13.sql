-- =====================================================================
-- KERIVA — Consentimiento Ley 172-13 (correr en SQL Editor de Supabase)
-- ----------------------------------------------------------------------
-- Dónde: Supabase Dashboard → SQL Editor → pegar todo → Run
-- Proyecto: zclgqjvsvimqaaikabnl
-- Seguro: idempotente (if not exists / create or replace).
-- =====================================================================

alter table public.perfiles
  add column if not exists consentimiento_172_13_at timestamptz null;

comment on column public.perfiles.consentimiento_172_13_at is
  'Marca temporal en que el usuario aceptó el tratamiento de datos de salud (Ley 172-13 RD). NULL = no aceptado.';

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

-- ─── Verificación ────────────────────────────────────────────
-- Debe devolver 1 fila (col existe) + 1 fila (fn existe)
select 'col' tipo, 'perfiles.consentimiento_172_13_at' nombre
  from information_schema.columns
  where table_name = 'perfiles' and column_name = 'consentimiento_172_13_at'
union all
select 'fn', proname from pg_proc where proname = 'aceptar_consentimiento_172_13';
