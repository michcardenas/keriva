import { supabase } from '@/lib/supabase';

export type ReportStatus = 'verificado' | 'pendiente';

export type MyReport = {
  id: number;
  createdAt: string;
  price: number;
  hasPhoto: boolean;
  photoUrl: string | null;
  status: ReportStatus;
  medicationName: string;
  medicationDosage: string;
  pharmacyName: string;
  pharmacyCity: string;
};

export type PendingReport = MyReport & {
  reporterName: string | null;
  reporterEmail: string | null;
};

type PrecioRow = {
  id: number;
  created_at: string;
  precio: string | number;
  tiene_foto: boolean;
  verificado: boolean;
  foto_url: string | null;
  Medicamentos: {
    nombre: string | null;
    concentracion: string | null;
  } | null;
  Farmacias: {
    nombre: string | null;
    ciudad: string | null;
  } | null;
};

type PendingRow = PrecioRow & {
  usuario_id: string | null;
  farmacia_id: number | null;
};

function toNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const n = typeof value === 'number' ? value : parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

const PRECIO_SELECT = `
  id,
  created_at,
  precio,
  tiene_foto,
  verificado,
  foto_url,
  Medicamentos(nombre, concentracion),
  Farmacias(nombre, ciudad)
`;

function mapPrecio(r: PrecioRow): MyReport {
  return {
    id: r.id,
    createdAt: r.created_at,
    price: toNumber(r.precio),
    hasPhoto: r.tiene_foto,
    photoUrl: r.foto_url,
    status: r.verificado ? 'verificado' : 'pendiente',
    medicationName: r.Medicamentos?.nombre ?? 'Medicamento',
    medicationDosage: r.Medicamentos?.concentracion ?? '',
    pharmacyName: r.Farmacias?.nombre ?? 'Farmacia',
    pharmacyCity: r.Farmacias?.ciudad ?? '',
  };
}

export async function getMyReports(userId: string, limit = 50): Promise<MyReport[]> {
  const { data, error } = await supabase
    .from('Precios')
    .select(PRECIO_SELECT)
    .eq('usuario_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  const rows = (data as unknown as PrecioRow[]) ?? [];
  return rows.map(mapPrecio);
}

export async function getMyStats(userId: string): Promise<{
  totalReports: number;
  verifiedReports: number;
  pendingReports: number;
}> {
  const { data, error } = await supabase
    .from('Precios')
    .select('id, verificado')
    .eq('usuario_id', userId);

  if (error) throw error;
  const rows = (data as Array<{ id: number; verificado: boolean }>) ?? [];

  return {
    totalReports: rows.length,
    verifiedReports: rows.filter((r) => r.verificado).length,
    pendingReports: rows.filter((r) => !r.verificado).length,
  };
}

export async function getMyPoints(userId: string): Promise<number> {
  const { data, error } = await supabase
    .from('Puntos')
    .select('puntos')
    .eq('usuario_id', userId);
  if (error) return 0;
  const rows = (data as Array<{ puntos: number }>) ?? [];
  return rows.reduce((sum, r) => sum + (r.puntos ?? 0), 0);
}

export type PointTransaction = {
  id: string;
  accion: string;
  puntos: number;
  descripcion: string;
  created_at: string;
};

export async function getMyPointsHistory(
  userId: string,
): Promise<PointTransaction[]> {
  const { data, error } = await supabase
    .from('Puntos')
    .select('id, accion, puntos, descripcion, created_at')
    .eq('usuario_id', userId)
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return data as PointTransaction[];
}

// ---------------------------------------------------------------------
// Report creation
// ---------------------------------------------------------------------

export type CreateReportInput = {
  userId: string;
  medicamentoId: number;
  farmaciaId: number;
  price: number;
  photoUri?: string | null; // local uri / data url / blob url
};

async function uriToBlob(uri: string): Promise<Blob> {
  // Works for data:, blob:, http(s):, and file:// on native (Expo polyfills fetch)
  const response = await fetch(uri);
  return await response.blob();
}

function extFromBlob(blob: Blob): string {
  const type = blob.type || 'image/jpeg';
  if (type.includes('png')) return 'png';
  if (type.includes('webp')) return 'webp';
  return 'jpg';
}

async function uploadPhoto(userId: string, photoUri: string): Promise<string | null> {
  try {
    const blob = await uriToBlob(photoUri);
    const ext = extFromBlob(blob);
    const filename = `${userId}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from('precio-fotos')
      .upload(filename, blob, {
        contentType: blob.type || 'image/jpeg',
        upsert: false,
      });
    if (error) {
      console.error('Photo upload failed:', error.message);
      return null;
    }
    const { data } = supabase.storage.from('precio-fotos').getPublicUrl(filename);
    return data.publicUrl;
  } catch (err) {
    console.error('Photo upload error:', err);
    return null;
  }
}

export type CreateReportResult =
  | { ok: true; reportId: number; hasPhoto: boolean }
  | { ok: false; error: string };

export async function createPriceReport(
  input: CreateReportInput,
): Promise<CreateReportResult> {
  if (!Number.isFinite(input.price) || input.price <= 0) {
    return { ok: false, error: 'Ingresa un precio válido' };
  }

  let photoUrl: string | null = null;
  if (input.photoUri) {
    photoUrl = await uploadPhoto(input.userId, input.photoUri);
  }

  const { data, error } = await supabase
    .from('Precios')
    .insert({
      medicamento_id: input.medicamentoId,
      farmacia_id: input.farmaciaId,
      usuario_id: input.userId,
      precio: input.price,
      tiene_foto: photoUrl !== null,
      verificado: false,
      foto_url: photoUrl,
    })
    .select('id, tiene_foto')
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? 'No se pudo crear el reporte' };
  }

  return { ok: true, reportId: data.id as number, hasPhoto: data.tiene_foto as boolean };
}

// ---------------------------------------------------------------------
// Moderation / verification
// ---------------------------------------------------------------------

export async function getPendingReports(scope: {
  kind: 'admin' | 'farmacia';
  farmaciaId?: number;
}): Promise<MyReport[]> {
  let q = supabase
    .from('Precios')
    .select(PRECIO_SELECT)
    .eq('verificado', false)
    .order('created_at', { ascending: false })
    .limit(100);

  if (scope.kind === 'farmacia') {
    if (!scope.farmaciaId) return [];
    q = q.eq('farmacia_id', scope.farmaciaId);
  }

  const { data, error } = await q;
  if (error) return [];
  return ((data as unknown as PrecioRow[]) ?? []).map(mapPrecio);
}

export async function verifyReport(reportId: number): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase
    .from('Precios')
    .update({ verificado: true })
    .eq('id', reportId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function rejectReport(reportId: number): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.from('Precios').delete().eq('id', reportId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// =====================================================================
// Adendum v2.1 — Precio Rango + Auditoría (Bloque 3)
// =====================================================================
// Todo lo que está arriba es el flujo Fase 2 (reportes con foto).
// Lo que sigue es el flujo Fase 1 del adendum:
//   · calcular_rango_precio  → rango ±5% sobre precio_base con descuento
//   · price_audits           → votos comunitarios ✅/❌
//   · farmacia_whatsapp      → deeplink wa.me con mensaje pre-llenado
// =====================================================================

export type PrecioRango = {
  precioMin: number;
  precioMax: number;
  moneda: string;
};

export type AuditVote = 'correcto' | 'incorrecto';

export type AuditResult =
  | { ok: true; votoId: string }
  | { ok: false; error: string; limitReached?: boolean };

export type PrecioHealth = {
  totalVotos: number;
  votosOk: number;
  votosMal: number;
  pctCorrecto: number | null;
  estado: 'ok' | 'revisar' | 'problema' | 'pocos_datos' | null;
};

/**
 * Rango estimado ±5% para un SKU en una farmacia (adendum §3.3).
 * Retorna null si no hay precio_base vigente.
 */
export async function getPriceRange(
  skuId: string,
  farmaciaId: number,
): Promise<PrecioRango | null> {
  const { data, error } = await supabase.rpc('calcular_rango_precio', {
    p_sku_id: skuId,
    p_farmacia_id: farmaciaId,
  });

  if (error || !data || !Array.isArray(data) || data.length === 0) return null;

  const row = data[0] as { precio_min: string | number; precio_max: string | number; moneda: string };
  return {
    precioMin: Number(row.precio_min),
    precioMax: Number(row.precio_max),
    moneda: row.moneda ?? 'DOP',
  };
}

/**
 * ¿Farmacia abierta ahora? (adendum §3.2 — modal fuera de horario).
 * Optimista: true si no hay datos.
 */
export async function isFarmaciaOpenNow(farmaciaId: number): Promise<boolean> {
  const { data, error } = await supabase.rpc('farmacia_abierta_ahora', {
    p_farmacia_id: farmaciaId,
  });
  if (error || data === null || data === undefined) return true;
  return Boolean(data);
}

/**
 * Inserta voto ✅/❌ de auditoría. El trigger bloquea >3 votos/día por farmacia.
 */
export async function createAuditVote(params: {
  skuId: string;
  farmaciaId: number;
  voto: AuditVote;
  precioVisto?: number;
}): Promise<AuditResult> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return { ok: false, error: 'Debes iniciar sesión para votar' };

  const { data, error } = await supabase
    .from('price_audits')
    .insert({
      user_id: auth.user.id,
      sku_id: params.skuId,
      farmacia_id: params.farmaciaId,
      voto: params.voto,
      precio_visto: params.precioVisto ?? null,
    })
    .select('id')
    .single();

  if (error) {
    if (error.message?.includes('Límite diario')) {
      return {
        ok: false,
        error: 'Ya hiciste 3 votos hoy para esta farmacia. Vuelve mañana.',
        limitReached: true,
      };
    }
    return { ok: false, error: error.message };
  }

  return { ok: true, votoId: String(data.id) };
}

/** Votos del usuario actual hoy en esta farmacia (para desactivar botones). */
export async function getUserAuditCountToday(farmaciaId: number): Promise<number> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return 0;

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const { count } = await supabase
    .from('price_audits')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', auth.user.id)
    .eq('farmacia_id', farmaciaId)
    .gte('created_at', startOfDay.toISOString());

  return count ?? 0;
}

/** Salud del precio (ratio votos 30d) — usado en panel admin o badge "Precio confiable". */
export async function getPriceHealth(
  skuId: string,
  farmaciaId: number,
): Promise<PrecioHealth | null> {
  const { data, error } = await supabase
    .from('v_precio_health_detalle')
    .select('total_votos, votos_ok, votos_mal, pct_correcto, estado')
    .eq('sku_id', skuId)
    .eq('farmacia_id', farmaciaId)
    .maybeSingle();

  if (error || !data) return null;

  return {
    totalVotos: Number(data.total_votos),
    votosOk: Number(data.votos_ok),
    votosMal: Number(data.votos_mal),
    pctCorrecto: data.pct_correcto === null ? null : Number(data.pct_correcto),
    estado: data.estado as PrecioHealth['estado'],
  };
}

/** Datos de afiliación WhatsApp (null si no afiliada). */
export async function getFarmaciaWhatsapp(farmaciaId: number): Promise<{
  numeroWhatsapp: string;
  horarioApertura: string | null;
  horarioCierre: string | null;
  descuentoEstandar: number | null;
} | null> {
  const { data, error } = await supabase
    .from('farmacia_whatsapp')
    .select('numero_whatsapp, horario_apertura, horario_cierre, descuento_estandar')
    .eq('farmacia_id', farmaciaId)
    .eq('afiliada', true)
    .maybeSingle();

  if (error || !data) return null;

  return {
    numeroWhatsapp: data.numero_whatsapp,
    horarioApertura: data.horario_apertura,
    horarioCierre: data.horario_cierre,
    descuentoEstandar: data.descuento_estandar === null ? null : Number(data.descuento_estandar),
  };
}

/** Construye deeplink wa.me con mensaje pre-llenado (adendum §3.2). */
export function buildWhatsAppLink(
  numero: string,
  medicamento: string,
  precioRango: string,
): string {
  const mensaje = encodeURIComponent(
    `Hola, vi en Keriva que tienen ${medicamento} a un estimado de ${precioRango}. ` +
      `¿Me confirman su precio exacto y si tienen disponibilidad para hoy?`,
  );
  const numeroLimpio = numero.replace(/[^0-9]/g, '');
  return `https://wa.me/${numeroLimpio}?text=${mensaje}`;
}

/** Formatea rango para mostrar. Ej: "RD$ 420 – RD$ 480". */
export function formatPriceRange(rango: PrecioRango): string {
  const symbol = rango.moneda === 'USD' ? 'US$' : 'RD$';
  const min = Math.round(rango.precioMin);
  const max = Math.round(rango.precioMax);
  return `${symbol} ${min} – ${symbol} ${max}`;
}

// =====================================================================
// Helpers de match medicamento → producto + listado de farmacias afiliadas
// =====================================================================

/**
 * Intenta matchear un medicamento legado (por nombre/principio activo) contra
 * la tabla `productos` (SKUs del adendum). Usa trigram similarity si está
 * disponible; si no, cae a ILIKE.
 */
export async function findProductoByMedicamentoName(
  nombre: string,
  principioActivo?: string | null,
): Promise<{ id: string; nombreComercial: string } | null> {
  const q = nombre.trim();
  if (!q) return null;

  // Primero match exacto por nombre_comercial
  const { data: exactMatch } = await supabase
    .from('productos')
    .select('id, nombre_comercial')
    .ilike('nombre_comercial', q)
    .eq('activo', true)
    .limit(1)
    .maybeSingle();

  if (exactMatch) {
    return { id: exactMatch.id, nombreComercial: exactMatch.nombre_comercial };
  }

  // Luego por principio_activo si viene
  if (principioActivo) {
    const { data: activoMatch } = await supabase
      .from('productos')
      .select('id, nombre_comercial')
      .ilike('principio_activo', principioActivo.trim())
      .eq('activo', true)
      .limit(1)
      .maybeSingle();
    if (activoMatch) {
      return { id: activoMatch.id, nombreComercial: activoMatch.nombre_comercial };
    }
  }

  // Finalmente fuzzy por nombre_comercial
  const { data: fuzzyMatch } = await supabase
    .from('productos')
    .select('id, nombre_comercial')
    .ilike('nombre_comercial', `%${q}%`)
    .eq('activo', true)
    .limit(1)
    .maybeSingle();

  if (fuzzyMatch) {
    return { id: fuzzyMatch.id, nombreComercial: fuzzyMatch.nombre_comercial };
  }

  return null;
}

/**
 * Farmacias afiliadas al sistema WhatsApp (adendum §3.2).
 * Retorna top N ordenadas por fecha de afiliación más reciente.
 */
export async function getAffiliatedPharmacies(limit = 5): Promise<
  Array<{
    farmaciaId: number;
    nombre: string;
    direccion: string;
    descuento: number | null;
    latitud: number | null;
    longitud: number | null;
  }>
> {
  const { data, error } = await supabase
    .from('v_farmacias_whatsapp')
    .select('farmacia_id, farmacia_nombre, descuento_estandar')
    .limit(limit);

  if (error || !data) return [];

  // Completar dirección + coordenadas desde "Farmacias"
  const ids = data.map((d) => d.farmacia_id);
  const { data: detalles } = await supabase
    .from('Farmacias')
    .select('id, direccion, latitud, longitud')
    .in('id', ids);

  const detMap = new Map<number, { direccion: string; latitud: number | null; longitud: number | null }>();
  (detalles ?? []).forEach((f: { id: number; direccion: string; latitud: number | null; longitud: number | null }) => {
    detMap.set(f.id, {
      direccion: f.direccion,
      latitud: f.latitud === null ? null : Number(f.latitud),
      longitud: f.longitud === null ? null : Number(f.longitud),
    });
  });

  return data.map((d) => {
    const det = detMap.get(d.farmacia_id as number);
    return {
      farmaciaId: d.farmacia_id as number,
      nombre: (d.farmacia_nombre as string) ?? 'Farmacia',
      direccion: det?.direccion ?? 'Sin dirección',
      descuento: d.descuento_estandar === null ? null : Number(d.descuento_estandar),
      latitud: det?.latitud ?? null,
      longitud: det?.longitud ?? null,
    };
  });
}
