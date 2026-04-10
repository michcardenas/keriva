import { supabase } from '@/lib/supabase';

export type SearchSource = 'curado' | 'catalogo';

export type SearchResult = {
  source: SearchSource;
  id: number | null;
  commercialName: string;
  genericName: string | null;
  activeIngredient: string | null;
  dosage: string | null;
  dosageForm: string | null;
  manufacturer: string | null;
  category: string | null;
  referencePrice: number | null;
  status: string | null;
  registrationNumber: string | null;
  relevance: number;
};

type RpcRow = {
  source: string;
  id: number | null;
  nombre_comercial: string | null;
  nombre_generico: string | null;
  principio_activo: string | null;
  concentracion: string | null;
  forma_farmaceutica: string | null;
  fabricante: string | null;
  laboratorio: string | null;
  categoria: string | null;
  precio_referencia: number | null;
  estatus: string | null;
  registro_sanitario: string | null;
  relevancia: number;
};

function mapResult(r: RpcRow): SearchResult {
  return {
    source: r.source === 'curado' ? 'curado' : 'catalogo',
    id: r.id,
    commercialName: r.nombre_comercial ?? 'Sin nombre',
    genericName: r.nombre_generico,
    activeIngredient: r.principio_activo,
    dosage: r.concentracion,
    dosageForm: r.forma_farmaceutica,
    manufacturer: r.fabricante ?? r.laboratorio ?? null,
    category: r.categoria,
    referencePrice: r.precio_referencia,
    status: r.estatus,
    registrationNumber: r.registro_sanitario,
    relevance: r.relevancia,
  };
}

export async function searchMedications(query: string, limit = 30): Promise<SearchResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const { data, error } = await supabase.rpc('buscar_medicamentos', {
    termino: trimmed,
    limite: limit,
  });

  if (error) {
    console.error('Search RPC error:', error.message);
    return [];
  }

  return ((data as RpcRow[]) ?? []).map(mapResult);
}
