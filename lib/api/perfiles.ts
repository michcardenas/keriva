import { supabase } from '@/lib/supabase';

export type Rol = 'usuario' | 'farmacia' | 'admin';

export type PerfilCompleto = {
  id: string;
  nombre: string | null;
  email: string | null;
  idioma: string | null;
  ciudad: string | null;
  telefono: string | null;
  cedula: string | null;
  rol: Rol;
  farmaciaId: number | null;
};

type PerfilRow = {
  id: string;
  nombre: string | null;
  email: string | null;
  idioma: string | null;
  ciudad: string | null;
  telefono: string | null;
  cedula: string | null;
  rol: Rol;
  farmacia_id: number | null;
};

function toPerfil(row: PerfilRow): PerfilCompleto {
  return {
    id: row.id,
    nombre: row.nombre,
    email: row.email,
    idioma: row.idioma,
    ciudad: row.ciudad,
    telefono: row.telefono,
    cedula: row.cedula,
    rol: row.rol,
    farmaciaId: row.farmacia_id,
  };
}

export async function getPerfil(userId: string): Promise<PerfilCompleto | null> {
  const { data, error } = await supabase
    .from('perfiles')
    .select('id, nombre, email, idioma, ciudad, telefono, cedula, rol, farmacia_id')
    .eq('id', userId)
    .maybeSingle();

  if (error || !data) return null;
  return toPerfil(data as PerfilRow);
}

export async function updatePerfil(
  userId: string,
  patch: Partial<Pick<PerfilCompleto, 'nombre' | 'telefono' | 'cedula' | 'ciudad' | 'idioma'>>,
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase
    .from('perfiles')
    .update({
      nombre: patch.nombre ?? undefined,
      telefono: patch.telefono ?? undefined,
      cedula: patch.cedula ?? undefined,
      ciudad: patch.ciudad ?? undefined,
      idioma: patch.idioma ?? undefined,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
