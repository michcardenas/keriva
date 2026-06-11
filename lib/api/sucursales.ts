import { supabase } from '@/lib/supabase';
import type { Horarios } from '@/lib/horarios';

// =====================================================================
// Sucursales — sedes de una farmacia (cuenta = "Farmacias".id, bigint).
// La RLS garantiza que cada cuenta solo gestione sus propias sucursales
// (vía current_farmacia_id()); por eso aquí basta con pasar el farmaciaId
// de perfil.farmaciaId al crear.
// =====================================================================

export type Sucursal = {
  id: string;
  farmaciaId: number;
  nombre: string;
  direccion: string;
  ciudad: string | null;
  telefono: string | null;
  whatsapp: string | null;
  horario: string | null;
  horarios: Horarios | null;
  latitud: number | null;
  longitud: number | null;
  activa: boolean;
  esPrincipal: boolean;
  createdAt: string;
};

type SucursalRow = {
  id: string;
  farmacia_id: number;
  nombre: string;
  direccion: string;
  ciudad: string | null;
  telefono: string | null;
  whatsapp: string | null;
  horario: string | null;
  horarios: Horarios | null;
  latitud: string | number | null;
  longitud: string | number | null;
  activa: boolean;
  es_principal: boolean;
  created_at: string;
};

function toNum(v: string | number | null): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

function mapSucursal(r: SucursalRow): Sucursal {
  return {
    id: r.id,
    farmaciaId: r.farmacia_id,
    nombre: r.nombre,
    direccion: r.direccion,
    ciudad: r.ciudad,
    telefono: r.telefono,
    whatsapp: r.whatsapp,
    horario: r.horario,
    horarios: r.horarios ?? null,
    latitud: toNum(r.latitud),
    longitud: toNum(r.longitud),
    activa: r.activa,
    esPrincipal: r.es_principal,
    createdAt: r.created_at,
  };
}

const SELECT =
  // `horarios` (jsonb) puede no existir hasta que la migración U2 corra. El
  // select degrada bien — supabase-js ignora columnas faltantes en el response.
  'id, farmacia_id, nombre, direccion, ciudad, telefono, whatsapp, horario, horarios, latitud, longitud, activa, es_principal, created_at';

/** Actualiza solo el JSONB de horarios estructurados (U2 "Abierta ahora"). */
export async function updateHorariosSucursal(
  id: string,
  horarios: Horarios | null,
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase
    .from('sucursales')
    .update({ horarios, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Sucursales de una farmacia (la cuenta dueña ve todas, incl. inactivas). */
export async function getSucursales(farmaciaId: number): Promise<Sucursal[]> {
  const { data, error } = await supabase
    .from('sucursales')
    .select(SELECT)
    .eq('farmacia_id', farmaciaId)
    .order('es_principal', { ascending: false })
    .order('nombre', { ascending: true });

  if (error || !data) return [];
  return (data as SucursalRow[]).map(mapSucursal);
}

export type SucursalInput = {
  nombre: string;
  direccion: string;
  ciudad?: string | null;
  telefono?: string | null;
  whatsapp?: string | null;
  horario?: string | null;
  latitud?: number | null;
  longitud?: number | null;
  esPrincipal?: boolean;
};

/** Crea una sucursal para la farmacia (RLS valida que sea la cuenta dueña). */
export async function createSucursal(
  farmaciaId: number,
  input: SucursalInput,
): Promise<{ ok: boolean; id?: string; error?: string }> {
  if (!input.nombre?.trim()) return { ok: false, error: 'El nombre es obligatorio.' };
  if (!input.direccion?.trim()) return { ok: false, error: 'La dirección es obligatoria.' };

  const { data, error } = await supabase
    .from('sucursales')
    .insert({
      farmacia_id: farmaciaId,
      nombre: input.nombre.trim(),
      direccion: input.direccion.trim(),
      ciudad: input.ciudad ?? null,
      telefono: input.telefono ?? null,
      whatsapp: input.whatsapp ?? null,
      horario: input.horario ?? null,
      latitud: input.latitud ?? null,
      longitud: input.longitud ?? null,
      es_principal: input.esPrincipal ?? false,
    })
    .select('id')
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  return { ok: true, id: (data as { id: string } | null)?.id };
}

export async function updateSucursal(
  id: string,
  patch: Partial<SucursalInput>,
): Promise<{ ok: boolean; error?: string }> {
  const body: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.nombre !== undefined) body.nombre = patch.nombre.trim();
  if (patch.direccion !== undefined) body.direccion = patch.direccion.trim();
  if (patch.ciudad !== undefined) body.ciudad = patch.ciudad;
  if (patch.telefono !== undefined) body.telefono = patch.telefono;
  if (patch.whatsapp !== undefined) body.whatsapp = patch.whatsapp;
  if (patch.horario !== undefined) body.horario = patch.horario;
  if (patch.latitud !== undefined) body.latitud = patch.latitud;
  if (patch.longitud !== undefined) body.longitud = patch.longitud;
  if (patch.esPrincipal !== undefined) body.es_principal = patch.esPrincipal;

  const { error } = await supabase.from('sucursales').update(body).eq('id', id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function toggleSucursalActiva(
  id: string,
  activa: boolean,
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase
    .from('sucursales')
    .update({ activa, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function deleteSucursal(id: string): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.from('sucursales').delete().eq('id', id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
