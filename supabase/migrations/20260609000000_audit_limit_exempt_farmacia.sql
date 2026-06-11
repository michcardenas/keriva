-- =====================================================================
-- Contribuciones ilimitadas para farmacia y admin
-- =====================================================================
-- El trigger check_price_audit_limit() limitaba a 3 votos/usuario/farmacia/día
-- y solo eximía al rol 'admin'. El cliente pide que tanto 'farmacia' como
-- 'admin' puedan contribuir/auditar SIN límite (son miles de productos).
-- Solo cambia la condición de bypass para incluir 'farmacia'.
-- =====================================================================

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
