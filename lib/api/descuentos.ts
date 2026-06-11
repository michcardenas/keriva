import { supabase } from '@/lib/supabase';

// =====================================================================
// Descuentos avanzados — vigencia (desde/hasta), tipo (% o monto fijo) y
// alcance (general / por sucursal / por producto). RLS: la cuenta dueña.
// =====================================================================

export type DescuentoTipo = 'porcentaje' | 'monto';

export type Descuento = {
  id: string;
  farmaciaId: number;
  sucursalId: string | null; // null = todas las sucursales
  productoId: string | null; // null = todos los productos
  tipo: DescuentoTipo;
  valor: number;
  descripcion: string | null;
  vigenteDesde: string;
  vigenteHasta: string | null; // null = sin fin
  activo: boolean;
  sucursalNombre: string | null;
  productoNombre: string | null;
};

function toNum(v: string | number | null): number {
  if (v === null || v === undefined) return 0;
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

type DescuentoRow = {
  id: string;
  farmacia_id: number;
  sucursal_id: string | null;
  producto_id: string | null;
  tipo: DescuentoTipo;
  valor: string | number;
  descripcion: string | null;
  vigente_desde: string;
  vigente_hasta: string | null;
  activo: boolean;
  sucursales: { nombre: string } | null;
  productos: { nombre_comercial: string } | null;
};

function mapDescuento(r: DescuentoRow): Descuento {
  return {
    id: r.id,
    farmaciaId: r.farmacia_id,
    sucursalId: r.sucursal_id,
    productoId: r.producto_id,
    tipo: r.tipo,
    valor: toNum(r.valor),
    descripcion: r.descripcion,
    vigenteDesde: r.vigente_desde,
    vigenteHasta: r.vigente_hasta,
    activo: r.activo,
    sucursalNombre: r.sucursales?.nombre ?? null,
    productoNombre: r.productos?.nombre_comercial ?? null,
  };
}

const SELECT =
  'id, farmacia_id, sucursal_id, producto_id, tipo, valor, descripcion, vigente_desde, vigente_hasta, activo, sucursales(nombre), productos(nombre_comercial)';

export async function getDescuentos(farmaciaId: number): Promise<Descuento[]> {
  const { data, error } = await supabase
    .from('descuentos')
    .select(SELECT)
    .eq('farmacia_id', farmaciaId)
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return (data as unknown as DescuentoRow[]).map(mapDescuento);
}

export type DescuentoInput = {
  tipo: DescuentoTipo;
  valor: number;
  sucursalId?: string | null;
  productoId?: string | null;
  descripcion?: string | null;
  vigenteDesde?: string | null;
  vigenteHasta?: string | null;
};

export async function createDescuento(
  farmaciaId: number,
  input: DescuentoInput,
): Promise<{ ok: boolean; error?: string }> {
  if (!(input.valor > 0)) return { ok: false, error: 'El valor debe ser mayor a 0.' };
  if (input.tipo === 'porcentaje' && input.valor > 100) {
    return { ok: false, error: 'El porcentaje no puede ser mayor a 100.' };
  }
  const { error } = await supabase.from('descuentos').insert({
    farmacia_id: farmaciaId,
    sucursal_id: input.sucursalId ?? null,
    producto_id: input.productoId ?? null,
    tipo: input.tipo,
    valor: input.valor,
    descripcion: input.descripcion ?? null,
    vigente_desde: input.vigenteDesde ?? new Date().toISOString(),
    vigente_hasta: input.vigenteHasta ?? null,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function updateDescuento(
  id: string,
  patch: Partial<DescuentoInput> & { activo?: boolean },
): Promise<{ ok: boolean; error?: string }> {
  const body: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.tipo !== undefined) body.tipo = patch.tipo;
  if (patch.valor !== undefined) body.valor = patch.valor;
  if (patch.sucursalId !== undefined) body.sucursal_id = patch.sucursalId;
  if (patch.productoId !== undefined) body.producto_id = patch.productoId;
  if (patch.descripcion !== undefined) body.descripcion = patch.descripcion;
  if (patch.vigenteDesde !== undefined) body.vigente_desde = patch.vigenteDesde;
  if (patch.vigenteHasta !== undefined) body.vigente_hasta = patch.vigenteHasta;
  if (patch.activo !== undefined) body.activo = patch.activo;

  const { error } = await supabase.from('descuentos').update(body).eq('id', id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function toggleDescuentoActivo(
  id: string,
  activo: boolean,
): Promise<{ ok: boolean; error?: string }> {
  return updateDescuento(id, { activo });
}

export async function deleteDescuento(id: string): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.from('descuentos').delete().eq('id', id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
