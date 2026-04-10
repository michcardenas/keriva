import { supabase } from '@/lib/supabase';
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
  const { data, error } = await supabase
    .from('Medicamentos')
    .select(SELECT_MEDICAMENTO)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return ((data as unknown as MedicamentoConPrecios[]) ?? []).map(mapMedicamento);
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
        Farmacias(nombre, direccion)
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
