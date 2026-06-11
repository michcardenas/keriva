import { restGet, restPost, restPatch } from '@/lib/api/_rest';

// =====================================================================
// Tipos
// =====================================================================
export type TipoPerfil =
  | 'titular'
  | 'dependiente_pediatrico'
  | 'dependiente_adulto';

export type KerivaPerfil = {
  id: string;
  userId: string;
  nombre: string;
  apellido: string | null;
  tipoPerfil: TipoPerfil;
  fechaNacimiento: string | null; // YYYY-MM-DD
  pesoLb: number | null;
  pesoKg: number | null;
  avatarEmoji: string | null;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
};

export type FamiliaDashboardRow = KerivaPerfil & {
  edadAnios: number | null;
  medicamentosActivos: number;
  disclaimerAceptado: boolean;
};

type KerivaPerfilRow = {
  id: string;
  user_id: string;
  nombre: string;
  apellido: string | null;
  tipo_perfil: TipoPerfil;
  fecha_nacimiento: string | null;
  peso_lb: number | null;
  peso_kg: number | null;
  avatar_emoji: string | null;
  activo: boolean;
  created_at: string;
  updated_at: string;
};

type FamiliaDashboardRowDB = KerivaPerfilRow & {
  perfil_id: string;
  edad_anios: number | null;
  medicamentos_activos: number;
  disclaimer_aceptado: boolean;
};

function toPerfil(row: KerivaPerfilRow): KerivaPerfil {
  return {
    id: row.id,
    userId: row.user_id,
    nombre: row.nombre,
    apellido: row.apellido,
    tipoPerfil: row.tipo_perfil,
    fechaNacimiento: row.fecha_nacimiento,
    pesoLb: row.peso_lb,
    pesoKg: row.peso_kg,
    avatarEmoji: row.avatar_emoji,
    activo: row.activo,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toFamiliaRow(row: FamiliaDashboardRowDB): FamiliaDashboardRow {
  return {
    ...toPerfil({ ...row, id: row.perfil_id }),
    edadAnios: row.edad_anios,
    medicamentosActivos: row.medicamentos_activos ?? 0,
    disclaimerAceptado: row.disclaimer_aceptado ?? false,
  };
}

// =====================================================================
// Queries
// =====================================================================

/**
 * Lista la familia del usuario autenticado (titular + dependientes activos),
 * con datos agregados de la vista v_familia_dashboard.
 */
export async function listFamilia(): Promise<FamiliaDashboardRow[]> {
  try {
    const data = await restGet(
      'v_familia_dashboard?select=*&order=tipo_perfil.asc',
    );
    return (data ?? []).map((r: any) => toFamiliaRow(r as FamiliaDashboardRowDB));
  } catch (e) {
    console.warn('listFamilia error', e);
    return [];
  }
}

/** Recupera un perfil específico. */
export async function getPerfilFamilia(
  perfilId: string,
): Promise<KerivaPerfil | null> {
  try {
    const data = await restGet(
      `keriva_perfiles?select=*&id=eq.${perfilId}&limit=1`,
    );
    if (!Array.isArray(data) || data.length === 0) return null;
    return toPerfil(data[0] as KerivaPerfilRow);
  } catch (e) {
    console.warn('getPerfilFamilia error', e);
    return null;
  }
}

/** Recupera el titular del usuario autenticado. */
export async function getTitular(userId: string): Promise<KerivaPerfil | null> {
  try {
    const data = await restGet(
      `keriva_perfiles?select=*&user_id=eq.${userId}&tipo_perfil=eq.titular&activo=eq.true&limit=1`,
    );
    if (!Array.isArray(data) || data.length === 0) return null;
    return toPerfil(data[0] as KerivaPerfilRow);
  } catch (e) {
    console.warn('getTitular error', e);
    return null;
  }
}

// =====================================================================
// Mutaciones
// =====================================================================

export type CreateDependienteInput = {
  nombre: string;
  apellido?: string;
  tipoPerfil: 'dependiente_pediatrico' | 'dependiente_adulto';
  fechaNacimiento?: string; // YYYY-MM-DD
  pesoLb?: number;
  avatarEmoji?: string;
};

/**
 * Crea un dependiente para el usuario autenticado. El backend valida el
 * límite de 7 perfiles activos vía trigger.
 */
export async function createDependiente(
  userId: string,
  input: CreateDependienteInput,
): Promise<{ ok: boolean; perfil?: KerivaPerfil; error?: string }> {
  try {
    const data = await restPost('keriva_perfiles', {
      user_id: userId,
      nombre: input.nombre.trim(),
      apellido: input.apellido?.trim() || null,
      tipo_perfil: input.tipoPerfil,
      fecha_nacimiento: input.fechaNacimiento || null,
      peso_lb: input.pesoLb ?? null,
      avatar_emoji: input.avatarEmoji || defaultEmojiFor(input.tipoPerfil),
    });
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return { ok: false, error: 'No se pudo crear el perfil' };
    return { ok: true, perfil: toPerfil(row as KerivaPerfilRow) };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? 'No se pudo crear el perfil' };
  }
}

export type UpdatePerfilInput = Partial<{
  nombre: string;
  apellido: string | null;
  fechaNacimiento: string | null;
  pesoLb: number | null;
  avatarEmoji: string;
}>;

export async function updatePerfilFamilia(
  perfilId: string,
  patch: UpdatePerfilInput,
): Promise<{ ok: boolean; error?: string }> {
  const payload: Record<string, unknown> = {};
  if (patch.nombre !== undefined) payload.nombre = patch.nombre.trim();
  if (patch.apellido !== undefined)
    payload.apellido = patch.apellido?.trim() || null;
  if (patch.fechaNacimiento !== undefined)
    payload.fecha_nacimiento = patch.fechaNacimiento;
  if (patch.pesoLb !== undefined) payload.peso_lb = patch.pesoLb;
  if (patch.avatarEmoji !== undefined) payload.avatar_emoji = patch.avatarEmoji;

  try {
    await restPatch(`keriva_perfiles?id=eq.${perfilId}`, payload);
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? 'No se pudo guardar' };
  }
}

/**
 * Eliminar = soft delete (activo=false). El titular NO puede eliminarse;
 * para eso el usuario tendría que borrar su cuenta.
 */
export async function softDeleteDependiente(
  perfilId: string,
): Promise<{ ok: boolean; error?: string }> {
  // Bloqueo a nivel cliente — el backend también podría bloquearlo con un trigger.
  const perfil = await getPerfilFamilia(perfilId);
  if (!perfil) return { ok: false, error: 'Perfil no encontrado' };
  if (perfil.tipoPerfil === 'titular') {
    return { ok: false, error: 'No puedes eliminar el perfil titular' };
  }

  try {
    await restPatch(`keriva_perfiles?id=eq.${perfilId}`, { activo: false });
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? 'No se pudo eliminar' };
  }
}

// =====================================================================
// Helpers
// =====================================================================

export function defaultEmojiFor(tipo: TipoPerfil): string {
  switch (tipo) {
    case 'titular':
      return '👤';
    case 'dependiente_pediatrico':
      return '👶';
    case 'dependiente_adulto':
      return '🧓';
  }
}

export function labelTipoPerfil(tipo: TipoPerfil): string {
  switch (tipo) {
    case 'titular':
      return 'Titular';
    case 'dependiente_pediatrico':
      return 'Pediátrico';
    case 'dependiente_adulto':
      return 'Adulto';
  }
}

export const AVATAR_OPTIONS = [
  '👤', '👨', '👩', '🧑', '👶', '👧', '👦',
  '🧓', '👴', '👵', '🧔', '🦰', '🦱', '🐶', '🐱',
];

// 1 titular + 6 dependientes = 7 perfiles activos (Mejora 05, may 2026).
// Debe coincidir con el trigger check_perfil_limit() en la BD.
export const FAMILIA_LIMIT = 7;
