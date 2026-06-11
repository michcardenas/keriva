import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from '@/lib/supabase';

export type Rol = 'usuario' | 'farmacia' | 'admin';

export type PerfilCompleto = {
  id: string;
  nombre: string | null;
  email: string | null;
  idioma: string | null;
  ciudad: string | null;
  direccion: string | null;
  telefono: string | null;
  cedula: string | null;
  rol: Rol;
  farmaciaId: number | null;
  avatarUrl: string | null;
  latitud: number | null;
  longitud: number | null;
};

type PerfilRow = {
  id: string;
  nombre: string | null;
  email: string | null;
  idioma: string | null;
  ciudad: string | null;
  direccion: string | null;
  telefono: string | null;
  cedula: string | null;
  rol: Rol;
  farmacia_id: number | null;
  avatar_url: string | null;
  latitud: number | null;
  longitud: number | null;
};

function toPerfil(row: PerfilRow): PerfilCompleto {
  return {
    id: row.id,
    nombre: row.nombre,
    email: row.email,
    idioma: row.idioma,
    ciudad: row.ciudad,
    direccion: row.direccion,
    telefono: row.telefono,
    cedula: row.cedula,
    rol: row.rol,
    farmaciaId: row.farmacia_id,
    avatarUrl: row.avatar_url,
    latitud: row.latitud === null ? null : Number(row.latitud),
    longitud: row.longitud === null ? null : Number(row.longitud),
  };
}

export async function getPerfil(userId: string): Promise<PerfilCompleto | null> {
  const { data, error } = await supabase
    .from('perfiles')
    .select(
      'id, nombre, email, idioma, ciudad, direccion, telefono, cedula, rol, farmacia_id, avatar_url, latitud, longitud',
    )
    .eq('id', userId)
    .maybeSingle();

  if (error || !data) return null;
  return toPerfil(data as PerfilRow);
}

export async function updatePerfil(
  userId: string,
  patch: Partial<
    Pick<
      PerfilCompleto,
      'nombre' | 'telefono' | 'cedula' | 'ciudad' | 'direccion' | 'idioma' | 'avatarUrl' | 'latitud' | 'longitud'
    >
  >,
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase
    .from('perfiles')
    .update({
      nombre: patch.nombre ?? undefined,
      telefono: patch.telefono ?? undefined,
      cedula: patch.cedula ?? undefined,
      ciudad: patch.ciudad ?? undefined,
      direccion: patch.direccion ?? undefined,
      idioma: patch.idioma ?? undefined,
      avatar_url: patch.avatarUrl ?? undefined,
      latitud: patch.latitud ?? undefined,
      longitud: patch.longitud ?? undefined,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ── Avatar (foto de perfil) ──────────────────────────────────

/**
 * Sube la foto de perfil al bucket `avatars` y devuelve su URL pública.
 *
 * Bug 6: en Android nativo `fetch(file://…).blob()` falla (devuelve un blob
 * vacío / lanza), por eso en nativo leemos el archivo como base64 con
 * expo-file-system y lo subimos como `Uint8Array`. En web seguimos usando blob.
 */
export async function uploadAvatar(userId: string, photoUri: string): Promise<string | null> {
  try {
    // Deducir extensión/MIME desde la uri (ImagePicker no siempre da el tipo).
    const rawExt = (photoUri.split('?')[0].split('.').pop() || 'jpg').toLowerCase();
    const ext = rawExt === 'jpeg' ? 'jpg' : ['png', 'webp', 'jpg'].includes(rawExt) ? rawExt : 'jpg';
    const contentType =
      ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
    const filename = `${userId}/avatar-${Date.now()}.${ext}`;

    let body: Blob | Uint8Array;
    if (Platform.OS === 'web') {
      const response = await fetch(photoUri);
      body = await response.blob();
    } else {
      // Nativo: base64 → bytes (patrón recomendado de Supabase para RN).
      const base64 = await FileSystem.readAsStringAsync(photoUri, { encoding: 'base64' });
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      body = bytes;
    }

    const { error } = await supabase.storage
      .from('avatars')
      .upload(filename, body, { contentType, upsert: true });
    if (error) {
      console.error('Avatar upload failed:', error.message);
      return null;
    }
    const { data } = supabase.storage.from('avatars').getPublicUrl(filename);
    return data.publicUrl;
  } catch (err) {
    console.error('Avatar upload error:', err);
    return null;
  }
}
