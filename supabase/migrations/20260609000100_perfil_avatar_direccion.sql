-- =====================================================================
-- Editar perfil: foto (avatar), dirección y ubicación
-- =====================================================================
-- Agrega columnas al perfil para foto, dirección y coordenadas, y crea el
-- bucket público `avatars` con sus políticas (lectura pública, subida/edición
-- por el propio usuario en su carpeta auth.uid()).
-- =====================================================================

alter table public.perfiles add column if not exists avatar_url text;
alter table public.perfiles add column if not exists direccion  text;
alter table public.perfiles add column if not exists latitud    double precision;
alter table public.perfiles add column if not exists longitud   double precision;

-- Bucket de avatares
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "avatars_read" on storage.objects;
create policy "avatars_read"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'avatars');

drop policy if exists "avatars_insert" on storage.objects;
create policy "avatars_insert"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatars_update" on storage.objects;
create policy "avatars_update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
