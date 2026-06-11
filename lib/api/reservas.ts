import { supabase } from '@/lib/supabase';
import { capture } from '@/lib/analytics';

// =====================================================================
// Reservas — el usuario reserva un producto en una sucursal; la farmacia
// confirma (= venta), rechaza o cancela. RLS: el usuario ve/crea las suyas;
// la farmacia ve/gestiona las de sus sucursales.
// =====================================================================

export type ReservaEstado = 'pendiente' | 'confirmada' | 'rechazada' | 'cancelada';

export type Reserva = {
  id: string;
  usuarioId: string;
  sucursalId: string;
  productoId: string;
  cantidad: number;
  precio: number | null;
  estado: ReservaEstado;
  nota: string | null;
  createdAt: string;
  productoNombre: string | null;
  sucursalNombre: string | null;
};

function toNum(v: string | number | null): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

type ReservaRow = {
  id: string;
  usuario_id: string;
  sucursal_id: string;
  producto_id: string;
  cantidad: number;
  precio: string | number | null;
  estado: ReservaEstado;
  nota: string | null;
  created_at: string;
  productos: { nombre_comercial: string } | null;
  sucursales: { nombre: string } | null;
};

function mapReserva(r: ReservaRow): Reserva {
  return {
    id: r.id,
    usuarioId: r.usuario_id,
    sucursalId: r.sucursal_id,
    productoId: r.producto_id,
    cantidad: r.cantidad,
    precio: toNum(r.precio),
    estado: r.estado,
    nota: r.nota,
    createdAt: r.created_at,
    productoNombre: r.productos?.nombre_comercial ?? null,
    sucursalNombre: r.sucursales?.nombre ?? null,
  };
}

const SELECT =
  'id, usuario_id, sucursal_id, producto_id, cantidad, precio, estado, nota, created_at, productos(nombre_comercial), sucursales(nombre)';

/** Reservas de la farmacia (la RLS ya filtra a las de sus sucursales). */
export async function getReservasFarmacia(estado?: ReservaEstado): Promise<Reserva[]> {
  let q = supabase.from('reservas').select(SELECT).order('created_at', { ascending: false });
  if (estado) q = q.eq('estado', estado);
  const { data, error } = await q;
  if (error || !data) return [];
  return (data as unknown as ReservaRow[]).map(mapReserva);
}

/** Reservas del usuario actual. */
export async function getMisReservas(usuarioId: string): Promise<Reserva[]> {
  const { data, error } = await supabase
    .from('reservas')
    .select(SELECT)
    .eq('usuario_id', usuarioId)
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return (data as unknown as ReservaRow[]).map(mapReserva);
}

export type CreateReservaInput = {
  usuarioId: string;
  sucursalId: string;
  productoId: string;
  cantidad?: number;
  precio?: number | null;
  nota?: string | null;
};

export async function createReserva(
  input: CreateReservaInput,
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const { data, error } = await supabase
    .from('reservas')
    .insert({
      usuario_id: input.usuarioId,
      sucursal_id: input.sucursalId,
      producto_id: input.productoId,
      cantidad: input.cantidad ?? 1,
      precio: input.precio ?? null,
      nota: input.nota ?? null,
    })
    .select('id')
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  const id = (data as { id: string } | null)?.id;
  capture('reserve_created', {
    sucursal_id: input.sucursalId,
    producto_id: input.productoId,
    cantidad: input.cantidad ?? 1,
  });
  return { ok: true, id };
}

/** Cambia el estado (confirmar = venta, rechazar, cancelar). */
export async function setEstadoReserva(
  id: string,
  estado: ReservaEstado,
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase
    .from('reservas')
    .update({ estado, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) return { ok: false, error: error.message };
  if (estado === 'confirmada') {
    capture('reserve_confirmed', { reserva_id: id });
  }
  return { ok: true };
}
