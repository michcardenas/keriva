import { supabase } from '@/lib/supabase';

// =====================================================================
// Eventos / Leads / Demanda insatisfecha (U4)
// =====================================================================
// La tabla `eventos` captura señales del usuario para métricas del lado
// farmacia (qué se busca, qué se ve, qué se cotiza). Para U4 nos centramos
// en los eventos de DEMANDA INSATISFECHA: el usuario buscó algo y no había.
//
// Privacidad: usuario_id es opcional (NULL = anónimo). Se llena solo si el
// usuario aceptó el consentimiento Ley 172-13 (U3).
// =====================================================================

export type EventoTipo =
  | 'busqueda'
  | 'vista'
  | 'como_llegar'
  | 'contacto'
  | 'busqueda_sin_resultado'
  | 'sin_disponibilidad';

type LogInput = {
  tipo: EventoTipo;
  termino?: string | null;
  productoId?: string | null;
  sucursalId?: string | null;
  farmaciaId?: number | null;
  metadata?: Record<string, unknown> | null;
};

/**
 * Inserta un evento. Nunca lanza: si el RLS, el enum o la columna metadata no
 * existen aún (migración U4 no corrida), hace no-op silencioso.
 */
export async function logEvento(input: LogInput): Promise<void> {
  try {
    const userId = (await supabase.auth.getUser()).data.user?.id ?? null;
    const { error } = await supabase.from('eventos').insert({
      tipo: input.tipo,
      termino: input.termino ?? null,
      producto_id: input.productoId ?? null,
      sucursal_id: input.sucursalId ?? null,
      farmacia_id: input.farmaciaId ?? null,
      usuario_id: userId,
      metadata: input.metadata ?? null,
    });
    if (error && __DEV__) {
      console.warn('[eventos:insert] error', error.message);
    }
  } catch {
    /* swallow — los eventos no deben romper la UX */
  }
}

/** Atajos por tipo (la mayoría del código solo necesita uno). */
export const logBusquedaSinResultado = (termino: string, metadata?: Record<string, unknown>) =>
  logEvento({ tipo: 'busqueda_sin_resultado', termino, metadata });

export const logSinDisponibilidad = (productoId: string | null, metadata?: Record<string, unknown>) =>
  logEvento({ tipo: 'sin_disponibilidad', productoId, metadata });

// Nota: la lectura de la demanda agregada vive en el panel admin web (vista
// SQL `v_demanda_insatisfecha`). La app móvil solo CAPTURA estos eventos.
