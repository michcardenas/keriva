-- ============================================================
-- Pharmacy Registration Requests (Solicitudes de Farmacia)
-- Allows users to request pharmacy registration. Admins approve
-- or reject from the moderation panel.
-- ============================================================

-- 1. Enum for request status
create type public.estado_solicitud as enum ('pendiente', 'aprobada', 'rechazada');

-- 2. Requests table
create table public.solicitudes_farmacia (
  id                   bigint generated always as identity primary key,
  usuario_id           uuid           not null references auth.users(id) on delete cascade,
  estado               public.estado_solicitud not null default 'pendiente',

  -- Pharmacy data
  nombre_comercial     text           not null,
  rnc                  text           not null,
  direccion            text           not null,
  ciudad               text           not null,
  telefono_farmacia    text           not null,
  horario              text           not null,

  -- Owner data
  nombre_propietario   text           not null,
  cedula_propietario   text           not null,

  -- Admin response
  motivo_rechazo       text,
  revisado_por         uuid           references auth.users(id) on delete set null,

  created_at           timestamptz    not null default now(),
  updated_at           timestamptz    not null default now()
);

alter table public.solicitudes_farmacia enable row level security;

-- Indexes
create index solicitudes_farmacia_usuario_idx on public.solicitudes_farmacia (usuario_id);
create index solicitudes_farmacia_estado_idx  on public.solicitudes_farmacia (estado);

-- Only one pending request per user at a time
create unique index solicitudes_farmacia_one_pending
  on public.solicitudes_farmacia (usuario_id)
  where estado = 'pendiente';

-- 3. RLS Policies
-- Users can see their own requests; admins see all
create policy "solicitudes_select_own_or_admin"
  on public.solicitudes_farmacia for select to authenticated
  using (auth.uid() = usuario_id or public.current_rol() = 'admin');

-- Only regular users can create requests
create policy "solicitudes_insert_usuario"
  on public.solicitudes_farmacia for insert to authenticated
  with check (
    auth.uid() = usuario_id
    and public.current_rol() = 'usuario'
  );

-- Only admins can update (approve/reject)
create policy "solicitudes_update_admin"
  on public.solicitudes_farmacia for update to authenticated
  using  (public.current_rol() = 'admin')
  with check (public.current_rol() = 'admin');

-- 4. Approval function (atomic: create pharmacy + promote user)
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
  -- Verify caller is admin
  v_caller_rol := current_rol();
  if v_caller_rol is distinct from 'admin' then
    raise exception 'Solo administradores pueden aprobar solicitudes';
  end if;

  -- Lock and fetch
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

  -- 1. Create pharmacy
  insert into "Farmacias" (nombre, direccion, ciudad, telefono, horario, activa, latitud, longitud)
  values (
    v_solicitud.nombre_comercial,
    v_solicitud.direccion,
    v_solicitud.ciudad,
    v_solicitud.telefono_farmacia,
    v_solicitud.horario,
    true,
    0,
    0
  )
  returning id into v_farmacia_id;

  -- 2. Promote user to farmacia and link
  update perfiles
  set rol = 'farmacia',
      farmacia_id = v_farmacia_id,
      updated_at = now()
  where id = v_solicitud.usuario_id;

  -- 3. Mark request as approved
  update solicitudes_farmacia
  set estado = 'aprobada',
      revisado_por = auth.uid(),
      updated_at = now()
  where id = p_solicitud_id;

  return jsonb_build_object('ok', true, 'farmacia_id', v_farmacia_id);
end;
$$;

-- 5. Rejection function
create or replace function public.rechazar_solicitud_farmacia(
  p_solicitud_id bigint,
  p_motivo text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_rol public.rol_usuario;
begin
  v_caller_rol := current_rol();
  if v_caller_rol is distinct from 'admin' then
    raise exception 'Solo administradores pueden rechazar solicitudes';
  end if;

  update solicitudes_farmacia
  set estado = 'rechazada',
      motivo_rechazo = p_motivo,
      revisado_por = auth.uid(),
      updated_at = now()
  where id = p_solicitud_id
    and estado = 'pendiente';

  if not found then
    raise exception 'Solicitud no encontrada o ya procesada';
  end if;

  return jsonb_build_object('ok', true);
end;
$$;
