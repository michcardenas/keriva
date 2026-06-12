import { supabase } from '@/lib/supabase';

// =====================================================================
// Medallas + Referidos (A2)
// =====================================================================

export type Medalla = {
  id: string;
  slug: string;
  nombre: string;
  descripcion: string;
  emoji: string;
  criterioTipo: string;
  criterioValor: number;
  orden: number;
};

export type MedallaConEstado = Medalla & {
  obtenida: boolean;
  obtenidaAt: string | null;
};

type MedallaRow = {
  id: string;
  slug: string;
  nombre: string;
  descripcion: string;
  emoji: string;
  criterio_tipo: string;
  criterio_valor: number;
  orden: number;
};

function mapMedalla(r: MedallaRow): Medalla {
  return {
    id: r.id,
    slug: r.slug,
    nombre: r.nombre,
    descripcion: r.descripcion,
    emoji: r.emoji,
    criterioTipo: r.criterio_tipo,
    criterioValor: r.criterio_valor,
    orden: r.orden,
  };
}

/** Lista las 7 medallas del catálogo. Lectura pública. */
export async function getCatalogoMedallas(): Promise<Medalla[]> {
  const { data, error } = await supabase
    .from('medallas')
    .select('id, slug, nombre, descripcion, emoji, criterio_tipo, criterio_valor, orden')
    .order('orden', { ascending: true });
  if (error || !data) return [];
  return (data as MedallaRow[]).map(mapMedalla);
}

/** Medallas que tiene el usuario actual (por id). */
export async function getMisMedallaIds(userId: string): Promise<Map<string, string>> {
  const { data, error } = await supabase
    .from('usuario_medallas')
    .select('medalla_id, obtenida_at')
    .eq('usuario_id', userId);
  const map = new Map<string, string>();
  if (error || !data) return map;
  for (const row of data as Array<{ medalla_id: string; obtenida_at: string }>) {
    map.set(row.medalla_id, row.obtenida_at);
  }
  return map;
}

/** Catálogo + estado por usuario (obtenida sí/no). */
export async function getMedallasConEstado(userId: string): Promise<MedallaConEstado[]> {
  const [cat, mias] = await Promise.all([getCatalogoMedallas(), getMisMedallaIds(userId)]);
  return cat.map((m) => ({
    ...m,
    obtenida: mias.has(m.id),
    obtenidaAt: mias.get(m.id) ?? null,
  }));
}

/** Pide al server reevaluar las medallas del usuario actual (idempotente). */
export async function evaluarMisMedallas(): Promise<void> {
  try {
    await supabase.rpc('evaluar_mis_medallas');
  } catch {
    /* swallow */
  }
}

// =====================================================================
// Referidos
// =====================================================================

/** Código de referido del usuario actual. Se genera por trigger al crearse el perfil. */
export async function getMiCodigoReferido(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('perfiles')
    .select('codigo_referido')
    .eq('id', userId)
    .maybeSingle();
  if (error || !data) return null;
  return (data as { codigo_referido: string | null }).codigo_referido ?? null;
}

export type ReferidoResult =
  | { ok: true }
  | { ok: false; error: 'sin_codigo' | 'codigo_invalido' | 'unknown' };

/** Aplica un código de referido (típicamente justo después de registrarse). */
export async function aplicarCodigoReferido(codigo: string): Promise<ReferidoResult> {
  const { data, error } = await supabase.rpc('aplicar_codigo_referido', { p_codigo: codigo });
  if (error) return { ok: false, error: 'unknown' };
  const res = data as { ok?: boolean; error?: string } | null;
  if (!res || res.ok === false) {
    const code = res?.error === 'codigo_invalido' ? 'codigo_invalido'
      : res?.error === 'sin_codigo' ? 'sin_codigo'
      : 'unknown';
    return { ok: false, error: code };
  }
  return { ok: true };
}
