import { supabase } from '@/lib/supabase';

// =====================================================================
// Encargados por sucursal (F4)
// =====================================================================
// El dueño de la farmacia puede invitar a otros usuarios para que gestionen
// una sucursal. La invitación los promueve a rol=farmacia y los liga a la
// sucursal vía cuentas_sucursal. El gating fino "encargado solo ve su
// sucursal" queda para una pasada posterior.
// =====================================================================

export type Encargado = {
  id: string;
  sucursalId: string;
  userId: string;
  email: string | null;
  nombre: string | null;
  createdAt: string;
};

type EncargadoRow = {
  id: string;
  sucursal_id: string;
  user_id: string;
  created_at: string;
  perfiles?: { email: string | null; nombre: string | null } | null;
};

export async function getEncargados(sucursalId: string): Promise<Encargado[]> {
  const { data, error } = await supabase
    .from('cuentas_sucursal')
    .select('id, sucursal_id, user_id, created_at, perfiles(email, nombre)')
    .eq('sucursal_id', sucursalId)
    .order('created_at', { ascending: true });
  if (error || !data) return [];
  return (data as any[]).map((r: EncargadoRow) => ({
    id: r.id,
    sucursalId: r.sucursal_id,
    userId: r.user_id,
    email: r.perfiles?.email ?? null,
    nombre: r.perfiles?.nombre ?? null,
    createdAt: r.created_at,
  }));
}

export async function invitarEncargado(
  sucursalId: string,
  email: string,
): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = await supabase.rpc('invitar_encargado_sucursal', {
    p_sucursal_id: sucursalId,
    p_email: email,
  });
  if (error) return { ok: false, error: error.message };
  const result = data as { ok: boolean; error?: string } | null;
  if (!result?.ok) return { ok: false, error: result?.error ?? 'No se pudo invitar.' };
  return { ok: true };
}

export async function quitarEncargado(id: string): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.from('cuentas_sucursal').delete().eq('id', id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
