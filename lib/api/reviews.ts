import { supabase } from '@/lib/supabase';

// =====================================================================
// Keriva Reviews — API de reseñas y calificaciones de farmacias.
// =====================================================================
// Las reseñas cuelgan de `farmacias_osm.id` (uuid), que es la identidad
// de farmacia que se navega en el mapa. El nombre/avatar del autor se
// guardan denormalizados en la fila (la RLS de `perfiles` solo deja leer
// el perfil propio, así que no se pueden resolver vía join).
//
// Todas las lecturas degradan con gracia si la migración aún no se aplicó
// (tabla/vista inexistente) → devuelven vacío en lugar de lanzar, para no
// romper el mapa antes de correr el SQL en el dashboard.
// =====================================================================

export type FarmaciaRating = {
  /** farmacias_osm.id (uuid) */
  farmaciaId: string;
  /** promedio 1-5 (0 si no hay reseñas) */
  promedio: number;
  /** número total de reseñas */
  total: number;
  /** distribución [1★,2★,3★,4★,5★] */
  distribucion: [number, number, number, number, number];
};

export type Review = {
  id: string;
  farmaciaId: string;
  usuarioId: string;
  autorNombre: string | null;
  autorAvatarUrl: string | null;
  calificacion: number; // 1-5
  comentario: string | null;
  createdAt: string;
  updatedAt: string;
};

// ── Filas crudas (snake_case del DB) ──────────────────────────
type RatingRow = {
  farmacia_id: string;
  promedio: string | number;
  total: number;
  c5: number;
  c4: number;
  c3: number;
  c2: number;
  c1: number;
};

type ResenaRow = {
  id: string;
  farmacia_id: string;
  usuario_id: string;
  autor_nombre: string | null;
  autor_avatar_url: string | null;
  calificacion: number;
  comentario: string | null;
  created_at: string;
  updated_at: string;
};

function toNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const n = typeof value === 'number' ? value : parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

function mapRating(r: RatingRow): FarmaciaRating {
  return {
    farmaciaId: r.farmacia_id,
    promedio: toNumber(r.promedio),
    total: r.total ?? 0,
    distribucion: [r.c1 ?? 0, r.c2 ?? 0, r.c3 ?? 0, r.c4 ?? 0, r.c5 ?? 0],
  };
}

function mapReview(r: ResenaRow): Review {
  return {
    id: r.id,
    farmaciaId: r.farmacia_id,
    usuarioId: r.usuario_id,
    autorNombre: r.autor_nombre,
    autorAvatarUrl: r.autor_avatar_url,
    calificacion: r.calificacion,
    comentario: r.comentario,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

const RESENA_SELECT =
  'id, farmacia_id, usuario_id, autor_nombre, autor_avatar_url, calificacion, comentario, created_at, updated_at';

// ── Lectura de ratings (agregado) ─────────────────────────────

/**
 * Ratings de un lote de farmacias (para pintar estrellas en el mapa).
 * Devuelve un Map farmaciaId → FarmaciaRating; las farmacias sin reseñas
 * simplemente no aparecen en el Map.
 */
export async function getRatingsForPharmacies(
  farmaciaIds: string[],
): Promise<Map<string, FarmaciaRating>> {
  const out = new Map<string, FarmaciaRating>();
  if (farmaciaIds.length === 0) return out;

  const { data, error } = await supabase
    .from('v_farmacia_ratings')
    .select('farmacia_id, promedio, total, c5, c4, c3, c2, c1')
    .in('farmacia_id', farmaciaIds);

  if (error || !data) return out; // tabla/vista aún no migrada → sin estrellas
  for (const row of data as RatingRow[]) {
    out.set(row.farmacia_id, mapRating(row));
  }
  return out;
}

/** Rating de una sola farmacia (0/0 si no tiene reseñas). */
export async function getFarmaciaRating(farmaciaId: string): Promise<FarmaciaRating> {
  const { data, error } = await supabase
    .from('v_farmacia_ratings')
    .select('farmacia_id, promedio, total, c5, c4, c3, c2, c1')
    .eq('farmacia_id', farmaciaId)
    .maybeSingle();

  if (error || !data) {
    return { farmaciaId, promedio: 0, total: 0, distribucion: [0, 0, 0, 0, 0] };
  }
  return mapRating(data as RatingRow);
}

// ── Lectura de reseñas (lista) ────────────────────────────────

/** Reseñas de una farmacia, más recientes primero. */
export async function getReviews(farmaciaId: string, limit = 50): Promise<Review[]> {
  const { data, error } = await supabase
    .from('resenas')
    .select(RESENA_SELECT)
    .eq('farmacia_id', farmaciaId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return (data as ResenaRow[]).map(mapReview);
}

/** La reseña del usuario actual para esa farmacia (null si no tiene). */
export async function getMyReview(
  farmaciaId: string,
  userId: string,
): Promise<Review | null> {
  const { data, error } = await supabase
    .from('resenas')
    .select(RESENA_SELECT)
    .eq('farmacia_id', farmaciaId)
    .eq('usuario_id', userId)
    .maybeSingle();

  if (error || !data) return null;
  return mapReview(data as ResenaRow);
}

/** Reseñas escritas por el usuario (para "Mis reseñas" en el perfil). */
export async function getMyReviews(userId: string, limit = 50): Promise<Review[]> {
  const { data, error } = await supabase
    .from('resenas')
    .select(RESENA_SELECT)
    .eq('usuario_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return (data as ResenaRow[]).map(mapReview);
}

// ── Mutaciones ────────────────────────────────────────────────

export type UpsertReviewInput = {
  farmaciaId: string;
  userId: string;
  calificacion: number; // 1-5
  comentario?: string | null;
  autorNombre?: string | null;
  autorAvatarUrl?: string | null;
};

/**
 * Crea o actualiza la reseña del usuario para una farmacia. La unicidad
 * (usuario_id, farmacia_id) hace que editar = upsert sobre esa clave.
 */
export async function upsertReview(
  input: UpsertReviewInput,
): Promise<{ ok: boolean; reviewId?: string; error?: string }> {
  const calificacion = Math.round(input.calificacion);
  if (calificacion < 1 || calificacion > 5) {
    return { ok: false, error: 'La calificación debe estar entre 1 y 5.' };
  }

  const comentario = input.comentario?.trim() || null;

  const { data, error } = await supabase
    .from('resenas')
    .upsert(
      {
        farmacia_id: input.farmaciaId,
        usuario_id: input.userId,
        autor_nombre: input.autorNombre ?? null,
        autor_avatar_url: input.autorAvatarUrl ?? null,
        calificacion,
        comentario,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'usuario_id,farmacia_id' },
    )
    .select('id')
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  return { ok: true, reviewId: (data as { id: string } | null)?.id };
}

/** Borra una reseña (el autor o un admin, según RLS). */
export async function deleteReview(
  reviewId: string,
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.from('resenas').delete().eq('id', reviewId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
