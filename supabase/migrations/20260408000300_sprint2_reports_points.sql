-- Sprint 2: Real price reporting flow
--
-- Adds the automatic points engine and the storage bucket needed for
-- photo uploads. The report UI calls supabase.storage and then inserts
-- into public."Precios" — both actions guarded by the RLS policies we
-- already defined in Sprint 1.

-- =====================================================================
-- 1. Storage bucket: precio-fotos
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'precio-fotos',
  'precio-fotos',
  true,                                        -- public read (anyone with the URL)
  5242880,                                     -- 5 MB per file
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Storage policies: authenticated users can upload / read / delete
-- only inside their own folder (keyed by auth.uid()).
drop policy if exists "precio_fotos_read" on storage.objects;
create policy "precio_fotos_read"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'precio-fotos');

drop policy if exists "precio_fotos_insert" on storage.objects;
create policy "precio_fotos_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'precio-fotos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "precio_fotos_delete" on storage.objects;
create policy "precio_fotos_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'precio-fotos'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.current_rol() = 'admin'
    )
  );

-- =====================================================================
-- 2. Extend "Precios" with a photo URL column
-- =====================================================================
alter table public."Precios"
  add column if not exists foto_url text;

-- =====================================================================
-- 3. Points trigger: award points when a report is created
--    Base:      +10
--    With photo:+15 extra (total 25)
-- =====================================================================
create or replace function public.award_points_on_report()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  puntos_base integer := 10;
  puntos_foto integer := 15;
  total integer;
  desc_txt text;
begin
  if new.usuario_id is null then
    return new;
  end if;

  total := puntos_base + case when new.tiene_foto then puntos_foto else 0 end;
  desc_txt := case
    when new.tiene_foto then 'Reporte con foto'
    else 'Reporte de precio'
  end;

  insert into public."Puntos" (usuario_id, accion, puntos, descripcion)
  values (new.usuario_id, 'reporte_creado', total, desc_txt);

  return new;
end;
$$;

drop trigger if exists precios_award_on_insert on public."Precios";
create trigger precios_award_on_insert
  after insert on public."Precios"
  for each row execute function public.award_points_on_report();

-- =====================================================================
-- 4. Points trigger: bonus when a price gets verified
--    +20 to the reporter on verification transition false -> true
-- =====================================================================
create or replace function public.award_points_on_verification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.verificado is true
     and (old.verificado is distinct from true)
     and new.usuario_id is not null then
    insert into public."Puntos" (usuario_id, accion, puntos, descripcion)
    values (new.usuario_id, 'reporte_verificado', 20, 'Tu reporte fue verificado');
  end if;
  return new;
end;
$$;

drop trigger if exists precios_award_on_verify on public."Precios";
create trigger precios_award_on_verify
  after update on public."Precios"
  for each row execute function public.award_points_on_verification();
