import { supabase } from '@/lib/supabase';
import { generateCSV, downloadCSV } from '@/lib/csv';
import type { FarmaciaOsm } from '@/lib/database.types';

export type PharmacyView = {
  id: string;
  name: string;
  address: string;
  city: string;
  latitude: number;
  longitude: number;
  phone: string;
  hours: string;
  active: boolean;
  minPrice: number;
  isCheapest: boolean;
  /** true si la farmacia paga afiliación WhatsApp (adendum v2.1 §3.2) */
  afiliada?: boolean;
};

function toNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const n = typeof value === 'number' ? value : parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

export type PharmacyOption = {
  id: number;
  name: string;
  city: string;
  address: string;
};

export async function getAllPharmacyOptions(): Promise<PharmacyOption[]> {
  const { data, error } = await supabase
    .from('Farmacias')
    .select('id, nombre, ciudad, direccion')
    .eq('activa', true)
    .order('nombre', { ascending: true });
  if (error) return [];
  return ((data as Array<{ id: number; nombre: string; ciudad: string; direccion: string }>) ?? []).map((f) => ({
    id: f.id,
    name: f.nombre,
    city: f.ciudad,
    address: f.direccion,
  }));
}

/**
 * Fuente primaria del mapa: tabla `farmacias_osm` (839 farmacias
 * georreferenciadas desde OpenStreetMap, ver scripts/fetch_farmacias_osm.js).
 *
 * Incluye JOIN con `farmacia_whatsapp` para marcar farmacias afiliadas
 * (adendum v2.1 §3.2). Las afiliadas muestran botón WhatsApp en la card.
 *
 * Nota: minPrice/isCheapest quedan en 0/false hasta que el refactor del
 * Bloque 3 (precio rango ±5% + auditoría) conecte con `precios_base`.
 */
export async function getActivePharmacies(): Promise<PharmacyView[]> {
  const { data, error } = await supabase
    .from('farmacias_osm')
    .select(`
      id,
      nombre,
      direccion,
      ciudad,
      latitud,
      longitud,
      telefono,
      horario,
      farmacia_id,
      activa
    `)
    .eq('activa', true)
    .order('nombre', { ascending: true });

  if (error) throw error;

  const rows = (data as unknown as FarmaciaOsm[]) ?? [];

  // Lookup de afiliación: un query separado a farmacia_whatsapp porque el
  // FK va contra "Farmacias"(id) legacy y farmacias_osm puede no tener
  // el link resuelto todavía.
  const linkedIds = rows
    .map((r) => r.farmacia_id)
    .filter((id): id is number => typeof id === 'number');

  const afiliadasSet = new Set<number>();
  if (linkedIds.length > 0) {
    const { data: afiliadas } = await supabase
      .from('farmacia_whatsapp')
      .select('farmacia_id')
      .eq('afiliada', true)
      .in('farmacia_id', linkedIds);
    (afiliadas ?? []).forEach((a) => afiliadasSet.add(a.farmacia_id as number));
  }

  return rows.map((p) => ({
    id: p.id,
    name: p.nombre,
    address: p.direccion ?? 'Sin dirección registrada',
    city: p.ciudad ?? '',
    latitude: toNumber(p.latitud),
    longitude: toNumber(p.longitud),
    phone: p.telefono ?? 'No disponible',
    hours: p.horario ?? 'Consultar horario',
    active: p.activa,
    minPrice: 0,      // reservado para Bloque 3 (rango + auditoría)
    isCheapest: false,
    afiliada: p.farmacia_id ? afiliadasSet.has(p.farmacia_id) : false,
  }));
}

// ── Admin functions ─────────────────────────────────────────

export type FarmaciaAdmin = {
  id: number;
  nombre: string;
  direccion: string;
  ciudad: string;
  telefono: string | null;
  horario: string | null;
  activa: boolean;
  latitud: number;
  longitud: number;
  createdAt: string;
};

export async function getAllFarmaciasAdmin(): Promise<FarmaciaAdmin[]> {
  const { data, error } = await supabase
    .from('Farmacias')
    .select('id, nombre, direccion, ciudad, telefono, horario, activa, latitud, longitud, created_at')
    .order('created_at', { ascending: false });

  if (error) return [];
  return ((data ?? []) as Array<any>).map((f) => ({
    id: f.id,
    nombre: f.nombre,
    direccion: f.direccion,
    ciudad: f.ciudad,
    telefono: f.telefono,
    horario: f.horario,
    activa: f.activa,
    latitud: Number(f.latitud) || 0,
    longitud: Number(f.longitud) || 0,
    createdAt: f.created_at,
  }));
}

export async function toggleFarmaciaActiva(
  id: number,
  activa: boolean,
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase
    .from('Farmacias')
    .update({ activa })
    .eq('id', id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ── CSV Export / Import ─────────────────────────────────────

const FARMACIA_CSV_HEADERS = ['nombre', 'direccion', 'ciudad', 'telefono', 'horario', 'activa', 'latitud', 'longitud'];

export async function exportFarmaciasCSV(): Promise<void> {
  const data = await getAllFarmaciasAdmin();
  const rows = data.map((f) => ({
    nombre: f.nombre,
    direccion: f.direccion,
    ciudad: f.ciudad,
    telefono: f.telefono ?? '',
    horario: f.horario ?? '',
    activa: String(f.activa),
    latitud: String(f.latitud),
    longitud: String(f.longitud),
  }));
  const csv = generateCSV(FARMACIA_CSV_HEADERS, rows);
  await downloadCSV(csv, `farmacias_${new Date().toISOString().slice(0, 10)}.csv`);
}

export async function importFarmaciasCSV(
  rows: Array<Record<string, string>>,
): Promise<{ inserted: number; errors: number }> {
  let inserted = 0;
  let errors = 0;

  // Batch insert in chunks of 50
  const chunks: Array<typeof rows> = [];
  for (let i = 0; i < rows.length; i += 50) {
    chunks.push(rows.slice(i, i + 50));
  }

  for (const chunk of chunks) {
    const mapped = chunk
      .filter((r) => r.nombre?.trim())
      .map((r) => ({
        nombre: r.nombre.trim(),
        direccion: r.direccion?.trim() ?? '',
        ciudad: r.ciudad?.trim() ?? '',
        telefono: r.telefono?.trim() || null,
        horario: r.horario?.trim() || null,
        activa: r.activa?.toLowerCase() !== 'false',
        latitud: parseFloat(r.latitud) || 0,
        longitud: parseFloat(r.longitud) || 0,
      }));

    if (mapped.length === 0) continue;

    const { error, data } = await supabase
      .from('Farmacias')
      .upsert(mapped, { onConflict: 'nombre' })
      .select('id');

    if (error) {
      errors += mapped.length;
    } else {
      inserted += data?.length ?? 0;
    }
  }

  return { inserted, errors };
}
