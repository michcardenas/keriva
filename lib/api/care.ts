import { restGet, restPost, restPatch } from '@/lib/api/_rest';
import type { TipoPerfil } from '@/lib/api/familia';

// =====================================================================
// Tipos
// =====================================================================
export type FrecuenciaTipo = 'diaria' | 'horas' | 'semanal';

export type CareMedicamento = {
  id: string;
  perfilId: string;
  perfilTipo: TipoPerfil;
  skuId: string;
  nombreDisplay: string;
  frecuenciaTipo: FrecuenciaTipo;
  frecuenciaValor: number | null;
  horasToma: string[];          // ej. ['08:00','20:00']
  diasSemana: number[] | null;  // 1..7
  activo: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CareMedicamentoWithProducto = CareMedicamento & {
  productoNombre: string | null;
  productoPresentacion: string | null;
};

type CareMedRow = {
  id: string;
  perfil_id: string;
  perfil_tipo: TipoPerfil;
  sku_id: string;
  nombre_display: string;
  frecuencia_tipo: FrecuenciaTipo;
  frecuencia_valor: number | null;
  horas_toma: string[];
  dias_semana: number[] | null;
  activo: boolean;
  created_at: string;
  updated_at: string;
  productos?: {
    nombre_comercial: string | null;
    presentacion: string | null;
  } | null;
};

function toMed(row: CareMedRow): CareMedicamentoWithProducto {
  return {
    id: row.id,
    perfilId: row.perfil_id,
    perfilTipo: row.perfil_tipo,
    skuId: row.sku_id,
    nombreDisplay: row.nombre_display,
    frecuenciaTipo: row.frecuencia_tipo,
    frecuenciaValor: row.frecuencia_valor,
    horasToma: row.horas_toma ?? [],
    diasSemana: row.dias_semana,
    activo: row.activo,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    productoNombre: row.productos?.nombre_comercial ?? null,
    productoPresentacion: row.productos?.presentacion ?? null,
  };
}

// =====================================================================
// Queries
// =====================================================================

/** Lista medicamentos activos de un perfil. */
export async function listMedicamentosByPerfil(
  perfilId: string,
): Promise<CareMedicamentoWithProducto[]> {
  try {
    const select =
      'id,perfil_id,perfil_tipo,sku_id,nombre_display,frecuencia_tipo,frecuencia_valor,horas_toma,dias_semana,activo,created_at,updated_at,productos:sku_id(nombre_comercial,presentacion)';
    const data = await restGet<any[]>(
      `care_medicamentos?select=${encodeURIComponent(select)}` +
        `&perfil_id=eq.${perfilId}&activo=eq.true&order=created_at.asc`,
    );
    return (data ?? []).map((r) => toMed(r as unknown as CareMedRow));
  } catch (e) {
    console.warn('listMedicamentosByPerfil error', e);
    return [];
  }
}

// =====================================================================
// Mutaciones
// =====================================================================

export type CreateCareMedInput = {
  perfilId: string;
  perfilTipo: TipoPerfil;
  skuId: string;
  nombreDisplay: string;
  frecuenciaTipo: FrecuenciaTipo;
  frecuenciaValor?: number;
  horasToma?: string[];
  diasSemana?: number[];
};

export async function addMedicamento(
  input: CreateCareMedInput,
): Promise<{ ok: boolean; med?: CareMedicamento; error?: string }> {
  try {
    const data = await restPost<any[]>('care_medicamentos', {
      perfil_id: input.perfilId,
      perfil_tipo: input.perfilTipo,
      sku_id: input.skuId,
      nombre_display: input.nombreDisplay.trim(),
      frecuencia_tipo: input.frecuenciaTipo,
      frecuencia_valor: input.frecuenciaValor ?? null,
      horas_toma: input.horasToma ?? [],
      dias_semana: input.diasSemana ?? null,
    });
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return { ok: false, error: 'No se pudo agregar' };
    return { ok: true, med: toMed(row as CareMedRow) };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? 'No se pudo agregar' };
  }
}

export async function softDeleteMedicamento(
  medId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await restPatch(`care_medicamentos?id=eq.${medId}`, { activo: false });
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? 'No se pudo eliminar' };
  }
}

// =====================================================================
// Helpers UI
// =====================================================================

export function labelFrecuencia(tipo: FrecuenciaTipo, valor: number | null): string {
  if (tipo === 'diaria') {
    if (!valor || valor === 1) return 'Una vez al día';
    return `${valor} veces al día`;
  }
  if (tipo === 'horas') return `Cada ${valor ?? '?'} horas`;
  if (tipo === 'semanal') {
    if (!valor || valor === 1) return 'Una vez a la semana';
    return `${valor} veces a la semana`;
  }
  return '';
}

export const FRECUENCIA_OPTIONS: { key: FrecuenciaTipo; label: string }[] = [
  { key: 'diaria', label: 'Diaria' },
  { key: 'horas', label: 'Cada N horas' },
  { key: 'semanal', label: 'Semanal' },
];
