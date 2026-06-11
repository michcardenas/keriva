-- =====================================================================
-- Mejora 05 — Ampliar el límite de dependientes de 4 a 6
-- =====================================================================
-- Documento del cliente (20 may 2026): el caso de uso dominicano incluye
-- con frecuencia abuelos, tías, sobrinos a cargo en el mismo hogar.
-- Nuevo límite: 1 titular + 6 dependientes = 7 perfiles activos por cuenta.
--
-- Reemplaza la función check_perfil_limit() definida en
-- 20260513000000_week1_multiperfil_care.sql (que limitaba a 5).
-- No requiere cambios de schema, solo actualizar el umbral del trigger.
-- =====================================================================

create or replace function public.check_perfil_limit()
returns trigger
language plpgsql
as $$
begin
  if (select count(*) from public.keriva_perfiles
      where user_id = new.user_id and activo = true) >= 7 then
    raise exception 'Límite de 7 perfiles por cuenta alcanzado';
  end if;
  return new;
end;
$$;

-- El trigger trg_keriva_perfil_limit ya apunta a esta función; al usar
-- `create or replace` no es necesario recrearlo.
