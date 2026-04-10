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
