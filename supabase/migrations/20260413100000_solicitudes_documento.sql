-- Add optional document URL and coordinates to pharmacy registration requests
alter table public.solicitudes_farmacia
  add column if not exists documento_url text;

alter table public.solicitudes_farmacia
  add column if not exists latitud double precision not null default 0;

alter table public.solicitudes_farmacia
  add column if not exists longitud double precision not null default 0;

-- Storage bucket for solicitud documents
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'solicitud-docs',
  'solicitud-docs',
  true,
  10485760,  -- 10 MB per file
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Storage policies: users upload to their own folder, anyone can read
drop policy if exists "solicitud_docs_read" on storage.objects;
create policy "solicitud_docs_read"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'solicitud-docs');

drop policy if exists "solicitud_docs_insert" on storage.objects;
create policy "solicitud_docs_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'solicitud-docs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "solicitud_docs_delete" on storage.objects;
create policy "solicitud_docs_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'solicitud-docs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Update approval function to use coordinates from the request
create or replace function public.aprobar_solicitud_farmacia(
  p_solicitud_id bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_solicitud    solicitudes_farmacia%rowtype;
  v_caller_rol   public.rol_usuario;
  v_farmacia_id  bigint;
begin
  v_caller_rol := current_rol();
  if v_caller_rol is distinct from 'admin' then
    raise exception 'Solo administradores pueden aprobar solicitudes';
  end if;

  select * into v_solicitud
  from solicitudes_farmacia
  where id = p_solicitud_id
  for update;

  if not found then
    raise exception 'Solicitud no encontrada';
  end if;

  if v_solicitud.estado != 'pendiente' then
    raise exception 'Esta solicitud ya fue procesada';
  end if;

  -- Create pharmacy with real coordinates from the request
  insert into "Farmacias" (nombre, direccion, ciudad, telefono, horario, activa, latitud, longitud)
  values (
    v_solicitud.nombre_comercial,
    v_solicitud.direccion,
    v_solicitud.ciudad,
    v_solicitud.telefono_farmacia,
    v_solicitud.horario,
    true,
    v_solicitud.latitud,
    v_solicitud.longitud
  )
  returning id into v_farmacia_id;

  update perfiles
  set rol = 'farmacia',
      farmacia_id = v_farmacia_id,
      updated_at = now()
  where id = v_solicitud.usuario_id;

  update solicitudes_farmacia
  set estado = 'aprobada',
      revisado_por = auth.uid(),
      updated_at = now()
  where id = p_solicitud_id;

  return jsonb_build_object('ok', true, 'farmacia_id', v_farmacia_id);
end;
$$;
