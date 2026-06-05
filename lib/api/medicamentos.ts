import { supabase } from '@/lib/supabase';
import { generateCSV, downloadCSV } from '@/lib/csv';
import type { MedicamentoConPrecios, MedicamentoDetalle } from '@/lib/database.types';

// View model used by the UI. Fields are in English and floats are parsed,
// so screens don't need to know anything about the underlying schema.
export type MedicationCard = {
  id: string;
  name: string;
  dosage: string;
  category: string;
  minPrice: number;
  referencePrice: number;
};

export type MedicationDetailView = {
  id: string;
  name: string;
  dosage: string;
  category: string;
  genericName: string | null;
  minPrice: number;
  avgPrice: number;
  prices: Array<{
    price: number;
    pharmacyName: string;
    pharmacyAddress: string;
    latitude: number;
    longitude: number;
  }>;
};

function toNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const n = typeof value === 'number' ? value : parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

function computeMinPrice(
  precios: Array<{ precio: string | number }> | null | undefined,
  fallback: number,
): number {
  if (!precios || precios.length === 0) return fallback;
  const parsed = precios.map((p) => toNumber(p.precio)).filter((n) => n > 0);
  if (parsed.length === 0) return fallback;
  return Math.min(...parsed);
}

function mapMedicamento(med: MedicamentoConPrecios): MedicationCard {
  const referencePrice = toNumber(med.precio_referencia_rd);
  return {
    id: String(med.id),
    name: med.nombre,
    dosage: med.concentracion ?? '',
    category: med.categoria ?? '',
    minPrice: computeMinPrice(med.Precios, referencePrice),
    referencePrice,
  };
}

const SELECT_MEDICAMENTO = `
  id,
  nombre,
  nombre_generico,
  concentracion,
  presentacion,
  laboratorio,
  categoria,
  precio_referencia_rd,
  Precios(precio)
`;

export type MedicationOption = {
  id: number;
  name: string;
  dosage: string;
  category: string;
};

export async function getAllMedicationOptions(): Promise<MedicationOption[]> {
  const { data, error } = await supabase
    .from('Medicamentos')
    .select('id, nombre, concentracion, categoria')
    .order('nombre', { ascending: true });
  if (error) return [];
  return ((data as Array<{ id: number; nombre: string; concentracion: string | null; categoria: string | null }>) ?? []).map((m) => ({
    id: m.id,
    name: m.nombre,
    dosage: m.concentracion ?? '',
    category: m.categoria ?? '',
  }));
}

export async function getPopularMedications(limit = 6): Promise<MedicationCard[]> {
  // Fast query: skip the Precios join for initial page load.
  // Use precio_referencia_rd instead — real prices load on detail tap.
  const { data, error } = await supabase
    .from('Medicamentos')
    .select('id, nombre, concentracion, categoria, precio_referencia_rd')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  type FastRow = { id: number; nombre: string; concentracion: string | null; categoria: string | null; precio_referencia_rd: string | number | null };
  return ((data as FastRow[]) ?? []).map((med) => ({
    id: String(med.id),
    name: med.nombre,
    dosage: med.concentracion ?? '',
    category: med.categoria ?? '',
    minPrice: toNumber(med.precio_referencia_rd),
    referencePrice: toNumber(med.precio_referencia_rd),
  }));
}

// ---------------------------------------------------------------------------
// Module-level prefetch: starts the network call as soon as this module is
// imported (during JS parse), running IN PARALLEL with auth/fonts/routing.
// By the time the Search screen mounts, data is usually already cached.
// ---------------------------------------------------------------------------
let _cachedPopular: MedicationCard[] | null = null;
const _prefetch = getPopularMedications(6)
  .then((data) => { _cachedPopular = data; return data; })
  .catch(() => [] as MedicationCard[]);

export function getPopularMedicationsCached(): Promise<MedicationCard[]> {
  if (_cachedPopular) return Promise.resolve(_cachedPopular);
  return _prefetch;
}

export async function searchMedications(params: {
  query?: string;
  category?: string;
  limit?: number;
}): Promise<MedicationCard[]> {
  const { query, category, limit = 20 } = params;
  let q = supabase.from('Medicamentos').select(SELECT_MEDICAMENTO);

  if (query && query.trim()) {
    const term = query.trim();
    q = q.or(`nombre.ilike.%${term}%,nombre_generico.ilike.%${term}%,concentracion.ilike.%${term}%`);
  }

  if (category && category !== 'Todo') {
    q = q.eq('categoria', category);
  }

  const { data, error } = await q.limit(limit);
  if (error) throw error;
  return ((data as unknown as MedicamentoConPrecios[]) ?? []).map(mapMedicamento);
}

export async function getMedicationDetail(id: string): Promise<MedicationDetailView | null> {
  const numericId = Number(id);
  if (!Number.isFinite(numericId)) return null;

  const { data, error } = await supabase
    .from('Medicamentos')
    .select(`
      id,
      nombre,
      nombre_generico,
      concentracion,
      presentacion,
      laboratorio,
      categoria,
      precio_referencia_rd,
      Precios(
        precio,
        Farmacias(nombre, direccion, latitud, longitud)
      )
    `)
    .eq('id', numericId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const med = data as unknown as MedicamentoDetalle;
  const referencePrice = toNumber(med.precio_referencia_rd);

  const prices = (med.Precios ?? [])
    .map((p) => ({
      price: toNumber(p.precio),
      pharmacyName: p.Farmacias?.nombre ?? 'Farmacia desconocida',
      pharmacyAddress: p.Farmacias?.direccion ?? '',
      latitude: toNumber(p.Farmacias?.latitud),
      longitude: toNumber(p.Farmacias?.longitud),
    }))
    .filter((p) => p.price > 0)
    .sort((a, b) => a.price - b.price);

  const minPrice = prices.length > 0 ? prices[0].price : referencePrice;
  const avgPrice =
    prices.length > 0
      ? prices.reduce((acc, p) => acc + p.price, 0) / prices.length
      : referencePrice;

  return {
    id: String(med.id),
    name: med.nombre,
    dosage: med.concentracion ?? '',
    category: med.categoria ?? '',
    genericName: med.nombre_generico,
    minPrice,
    avgPrice,
    prices,
  };
}

// ── CSV Export / Import ─────────────────────────────────────

const MED_CSV_HEADERS = ['nombre', 'nombre_generico', 'concentracion', 'presentacion', 'laboratorio', 'categoria', 'precio_referencia_rd'];

export async function exportMedicamentosCSV(): Promise<void> {
  const { data, error } = await supabase
    .from('Medicamentos')
    .select('nombre, nombre_generico, concentracion, presentacion, laboratorio, categoria, precio_referencia_rd')
    .order('nombre', { ascending: true });

  if (error || !data) return;

  const rows = (data as Array<Record<string, any>>).map((m) => ({
    nombre: m.nombre ?? '',
    nombre_generico: m.nombre_generico ?? '',
    concentracion: m.concentracion ?? '',
    presentacion: m.presentacion ?? '',
    laboratorio: m.laboratorio ?? '',
    categoria: m.categoria ?? '',
    precio_referencia_rd: m.precio_referencia_rd != null ? String(m.precio_referencia_rd) : '',
  }));

  const csv = generateCSV(MED_CSV_HEADERS, rows);
  await downloadCSV(csv, `medicamentos_${new Date().toISOString().slice(0, 10)}.csv`);
}

export async function importMedicamentosCSV(
  rows: Array<Record<string, string>>,
): Promise<{ inserted: number; errors: number }> {
  let inserted = 0;
  let errors = 0;

  const chunks: Array<typeof rows> = [];
  for (let i = 0; i < rows.length; i += 50) {
    chunks.push(rows.slice(i, i + 50));
  }

  for (const chunk of chunks) {
    const mapped = chunk
      .filter((r) => r.nombre?.trim())
      .map((r) => ({
        nombre: r.nombre.trim(),
        nombre_generico: r.nombre_generico?.trim() || null,
        concentracion: r.concentracion?.trim() || null,
        presentacion: r.presentacion?.trim() || null,
        laboratorio: r.laboratorio?.trim() || null,
        categoria: r.categoria?.trim() || null,
        precio_referencia_rd: parseFloat(r.precio_referencia_rd) || null,
      }));

    if (mapped.length === 0) continue;

    const { error, data } = await supabase
      .from('Medicamentos')
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
