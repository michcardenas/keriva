import { supabase } from '@/lib/supabase';

// =====================================================================
// Adherencia de medicamentos (R6)
// =====================================================================
// Registra si una toma programada se completó, se saltó o se pospuso.
// El identificador único de la toma es (medicamento_id, scheduled_at).
// =====================================================================

export type AdherenciaAccion = 'tomado' | 'saltado' | 'pospuesto';

export type AdherenciaRecord = {
  medicamentoId: string;
  scheduledAt: string;
  accion: AdherenciaAccion;
  registradoAt: string;
};

export async function registrarAdherencia(
  medicamentoId: string,
  scheduledAt: Date | string,
  accion: AdherenciaAccion,
): Promise<{ ok: boolean; error?: string }> {
  const scheduledIso = scheduledAt instanceof Date ? scheduledAt.toISOString() : scheduledAt;
  const { data, error } = await supabase.rpc('registrar_adherencia', {
    p_medicamento_id: medicamentoId,
    p_scheduled_at: scheduledIso,
    p_accion: accion,
  });
  if (error) return { ok: false, error: error.message };
  const res = data as { ok: boolean; error?: string } | null;
  if (!res?.ok) return { ok: false, error: res?.error ?? 'No se pudo registrar.' };
  return { ok: true };
}

/**
 * Trae los registros de adherencia para los perfiles del usuario en el rango
 * indicado (típico: hoy desde 00:00 RD hasta 23:59 RD).
 */
export async function getAdherenciaRango(
  perfilIds: string[],
  desdeIso: string,
  hastaIso: string,
): Promise<AdherenciaRecord[]> {
  if (perfilIds.length === 0) return [];
  const { data, error } = await supabase
    .from('care_adherencia')
    .select('medicamento_id, scheduled_at, accion, registrado_at')
    .in('perfil_id', perfilIds)
    .gte('scheduled_at', desdeIso)
    .lte('scheduled_at', hastaIso);
  if (error || !data) return [];
  return (data as any[]).map((r) => ({
    medicamentoId: r.medicamento_id,
    scheduledAt: r.scheduled_at,
    accion: r.accion,
    registradoAt: r.registrado_at,
  }));
}

/** Clave única para mapear: medId + ISO truncado a minutos. */
export function adherenciaKey(medicamentoId: string, scheduledIso: string): string {
  // Trunca a minutos para tolerar pequeñas diferencias por TZ/segundos.
  return `${medicamentoId}:${scheduledIso.slice(0, 16)}`;
}
