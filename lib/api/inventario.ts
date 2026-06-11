import { supabase } from '@/lib/supabase';

// =====================================================================
// Inventario por sucursal — precio + disponibilidad de cada producto del
// catálogo (`productos`) en una sucursal. RLS: solo la cuenta dueña escribe.
// =====================================================================

export type ProductoLite = {
  id: string;
  nombreComercial: string;
  principioActivo: string | null;
  concentracion: string | null;
  presentacion: string | null;
};

export type InventarioItem = {
  id: string;
  sucursalId: string;
  productoId: string;
  disponible: boolean;
  precio: number | null;
  producto: ProductoLite | null;
};

function toNum(v: string | number | null): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

type ProductoRow = {
  id: string;
  nombre_comercial: string;
  principio_activo: string | null;
  concentracion: string | null;
  presentacion: string | null;
};

function mapProducto(r: ProductoRow): ProductoLite {
  return {
    id: r.id,
    nombreComercial: r.nombre_comercial,
    principioActivo: r.principio_activo,
    concentracion: r.concentracion,
    presentacion: r.presentacion,
  };
}

/** Busca en el catálogo maestro por nombre comercial o principio activo. */
export async function searchProductos(query: string, limit = 25): Promise<ProductoLite[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const { data, error } = await supabase
    .from('productos')
    .select('id, nombre_comercial, principio_activo, concentracion, presentacion')
    .or(`nombre_comercial.ilike.%${q}%,principio_activo.ilike.%${q}%`)
    .eq('activo', true)
    .order('nombre_comercial', { ascending: true })
    .limit(limit);
  if (error || !data) return [];
  return (data as ProductoRow[]).map(mapProducto);
}

type InventarioRow = {
  id: string;
  sucursal_id: string;
  producto_id: string;
  disponible: boolean;
  precio: string | number | null;
  productos: ProductoRow | null;
};

function mapItem(r: InventarioRow): InventarioItem {
  return {
    id: r.id,
    sucursalId: r.sucursal_id,
    productoId: r.producto_id,
    disponible: r.disponible,
    precio: toNum(r.precio),
    producto: r.productos ? mapProducto(r.productos) : null,
  };
}

/** Inventario completo de una sucursal (con datos del producto). */
export async function getInventario(sucursalId: string): Promise<InventarioItem[]> {
  const { data, error } = await supabase
    .from('inventario_sucursal')
    .select(
      'id, sucursal_id, producto_id, disponible, precio, productos(id, nombre_comercial, principio_activo, concentracion, presentacion)',
    )
    .eq('sucursal_id', sucursalId)
    .order('updated_at', { ascending: false });
  if (error || !data) return [];
  return (data as unknown as InventarioRow[]).map(mapItem);
}

/** Crea o actualiza el item (disponible + precio) de un producto en la sucursal. */
export async function upsertInventario(
  sucursalId: string,
  productoId: string,
  disponible: boolean,
  precio: number | null,
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase
    .from('inventario_sucursal')
    .upsert(
      {
        sucursal_id: sucursalId,
        producto_id: productoId,
        disponible,
        precio,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'sucursal_id,producto_id' },
    );
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function toggleDisponible(
  id: string,
  disponible: boolean,
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase
    .from('inventario_sucursal')
    .update({ disponible, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function deleteInventario(id: string): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.from('inventario_sucursal').delete().eq('id', id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// =====================================================================
// Carga masiva (#29) — importar inventario desde CSV/Excel
// =====================================================================

/** Catálogo completo (para hacer el match de la carga en memoria). */
export async function getCatalogo(): Promise<ProductoLite[]> {
  const { data, error } = await supabase
    .from('productos')
    .select('id, nombre_comercial, principio_activo, concentracion, presentacion')
    .eq('activo', true)
    .order('nombre_comercial', { ascending: true })
    .limit(5000);
  if (error || !data) return [];
  return (data as ProductoRow[]).map(mapProducto);
}

// ── Búsqueda del lado usuario: sucursales que tienen un producto ──

export type SucursalDisponible = {
  sucursalId: string;
  farmaciaId: number;
  nombre: string;
  direccion: string;
  latitud: number | null;
  longitud: number | null;
  telefono: string | null;
  whatsapp: string | null;
  precio: number | null;
};

/**
 * Sucursales (de farmacias aprobadas, activas) que tienen DISPONIBLE el
 * producto. Gating inherente: una "Farmacias" solo existe tras aprobación, y
 * las sucursales cuelgan de ella. Ordenar por cercanía se hace en el cliente
 * con la ubicación del usuario.
 */
export async function getSucursalesConProducto(productoId: string): Promise<SucursalDisponible[]> {
  const { data, error } = await supabase
    .from('inventario_sucursal')
    .select(
      'precio, sucursales!inner(id, farmacia_id, nombre, direccion, latitud, longitud, telefono, whatsapp, activa)',
    )
    .eq('producto_id', productoId)
    .eq('disponible', true);
  if (error || !data) return [];
  return (data as any[])
    .filter((r) => r.sucursales && r.sucursales.activa)
    .map((r) => ({
      sucursalId: r.sucursales.id,
      farmaciaId: r.sucursales.farmacia_id,
      nombre: r.sucursales.nombre,
      direccion: r.sucursales.direccion,
      latitud: toNum(r.sucursales.latitud),
      longitud: toNum(r.sucursales.longitud),
      telefono: r.sucursales.telefono,
      whatsapp: r.sucursales.whatsapp,
      precio: toNum(r.precio),
    }));
}

export type CargaModo = 'actualizar' | 'reemplazar';
export type CargaError = { fila: number; nombre: string; motivo: string };
export type CargaResultado = { total: number; aplicadas: number; errores: CargaError[] };

function norm(s: string | null | undefined): string {
  return (s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}

/** Busca un campo en la fila probando varios nombres de columna (case/acento-insensible). */
function field(row: Record<string, string>, names: string[]): string {
  for (const n of names) {
    for (const key of Object.keys(row)) {
      if (norm(key) === norm(n)) return (row[key] ?? '').trim();
    }
  }
  return '';
}

function parseDisponible(v: string): boolean {
  const s = norm(v);
  if (['no', 'false', '0', 'agotado', 'n'].includes(s)) return false;
  return true; // por defecto disponible
}

/**
 * Procesa una carga masiva contra el catálogo:
 *  - Valida fila por fila (producto debe existir en el catálogo).
 *  - Aplica a una o varias sucursales (destino).
 *  - Modo 'reemplazar': borra el inventario previo de las sucursales destino.
 */
export async function procesarCargaMasiva(
  sucursalIds: string[],
  rows: Array<Record<string, string>>,
  modo: CargaModo,
): Promise<CargaResultado> {
  const errores: CargaError[] = [];
  if (sucursalIds.length === 0) {
    return { total: rows.length, aplicadas: 0, errores: [{ fila: 0, nombre: '', motivo: 'Sin sucursal de destino.' }] };
  }

  const catalogo = await getCatalogo();
  const byName = new Map<string, string>();
  const byNameConc = new Map<string, string>();
  for (const p of catalogo) {
    byName.set(norm(p.nombreComercial), p.id);
    byNameConc.set(`${norm(p.nombreComercial)}|${norm(p.concentracion)}`, p.id);
  }

  const valid: Array<{ productoId: string; disponible: boolean; precio: number | null }> = [];
  rows.forEach((row, i) => {
    const fila = i + 2; // +2: fila 1 = encabezado
    const nombre = field(row, ['nombre', 'producto', 'medicamento', 'nombre_comercial']);
    const conc = field(row, ['concentracion', 'concentración', 'dosis']);
    if (!nombre) {
      errores.push({ fila, nombre: '', motivo: 'Fila sin nombre de producto.' });
      return;
    }
    const pid = byNameConc.get(`${norm(nombre)}|${norm(conc)}`) ?? byName.get(norm(nombre));
    if (!pid) {
      errores.push({ fila, nombre, motivo: 'No está en el catálogo maestro.' });
      return;
    }
    const precioRaw = field(row, ['precio', 'precio (rd$)', 'price']).replace(',', '.');
    const precio = precioRaw ? parseFloat(precioRaw) : null;
    if (precioRaw && (precio === null || !Number.isFinite(precio) || precio < 0)) {
      errores.push({ fila, nombre, motivo: 'Precio inválido.' });
      return;
    }
    valid.push({
      productoId: pid,
      disponible: parseDisponible(field(row, ['disponible', 'disp', 'stock'])),
      precio,
    });
  });

  // Modo reemplazar: limpiar inventario previo de las sucursales destino.
  if (modo === 'reemplazar') {
    const { error: delErr } = await supabase
      .from('inventario_sucursal')
      .delete()
      .in('sucursal_id', sucursalIds);
    if (delErr) {
      errores.push({ fila: 0, nombre: '', motivo: `No se pudo reemplazar: ${delErr.message}` });
      return { total: rows.length, aplicadas: 0, errores };
    }
  }

  // Upsert (sucursales destino × productos válidos), en lotes.
  const now = new Date().toISOString();
  const payload: Array<Record<string, unknown>> = [];
  for (const sid of sucursalIds) {
    for (const v of valid) {
      payload.push({ sucursal_id: sid, producto_id: v.productoId, disponible: v.disponible, precio: v.precio, updated_at: now });
    }
  }
  for (let i = 0; i < payload.length; i += 200) {
    const chunk = payload.slice(i, i + 200);
    const { error } = await supabase
      .from('inventario_sucursal')
      .upsert(chunk, { onConflict: 'sucursal_id,producto_id' });
    if (error) errores.push({ fila: 0, nombre: '', motivo: `Error al guardar un lote: ${error.message}` });
  }

  return { total: rows.length, aplicadas: valid.length, errores };
}
