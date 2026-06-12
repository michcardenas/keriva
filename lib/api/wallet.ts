import { supabase } from '@/lib/supabase';

// =====================================================================
// Keriva Wallet — API de recompensas (W2)
// =====================================================================

export type ShareRewardResult =
  | { ok: true; puntos: number }
  | { ok: false; error: 'cooldown' | 'unknown'; nextAt?: string };

/**
 * Otorga +15 puntos al usuario por compartir. La RPC valida el cooldown de
 * 7 días en server. Si está en cooldown, retorna `{ok:false, error:'cooldown'}`.
 */
export async function ganarPtsCompartir(): Promise<ShareRewardResult> {
  const { data, error } = await supabase.rpc('ganar_pts_compartir');
  if (error) return { ok: false, error: 'unknown' };
  const res = data as { ok?: boolean; puntos?: number; error?: string; next_at?: string } | null;
  if (!res || res.ok === false) {
    return {
      ok: false,
      error: res?.error === 'cooldown' ? 'cooldown' : 'unknown',
      nextAt: res?.next_at,
    };
  }
  return { ok: true, puntos: res.puntos ?? 15 };
}
