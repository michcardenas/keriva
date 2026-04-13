import { supabase } from '@/lib/supabase';
import type { FarmaciaConPrecios } from '@/lib/database.types';

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

export async function getActivePharmacies(): Promise<PharmacyView[]> {
  const { data, error } = await supabase
    .from('Farmacias')
    .select(`
      id,
      nombre,
      direccion,
      ciudad,
      latitud,
      longitud,
      telefono,
      horario,
      activa,
      Precios(precio)
    `)
    .eq('activa', true)
    .order('nombre', { ascending: true });

  if (error) throw error;

  const rows = (data as unknown as FarmaciaConPrecios[]) ?? [];

  const mapped: PharmacyView[] = rows.map((p) => {
    const prices = (p.Precios ?? []).map((x) => toNumber(x.precio)).filter((n) => n > 0);
    const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
    return {
      id: String(p.id),
      name: p.nombre,
      address: p.direccion,
      city: p.ciudad,
      latitude: toNumber(p.latitud),
      longitude: toNumber(p.longitud),
      phone: p.telefono ?? 'No disponible',
      hours: p.horario ?? 'Consultar horario',
      active: p.activa,
      minPrice,
      isCheapest: false,
    };
  });

  // Flag the cheapest pharmacy (only among those that have reported prices).
  const withPrice = mapped.filter((p) => p.minPrice > 0);
  if (withPrice.length > 0) {
    const globalMin = Math.min(...withPrice.map((p) => p.minPrice));
    for (const p of mapped) {
      p.isCheapest = p.minPrice === globalMin && p.minPrice > 0;
    }
  }

  return mapped;
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
