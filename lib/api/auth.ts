import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';

export type Perfil = {
  id: string;
  nombre: string | null;
  email: string | null;
  idioma: string | null;
  ciudad: string | null;
};

function getResetRedirectUrl(): string | undefined {
  // On web we redirect back to our own /auth/reset-password page.
  // On native, Supabase will open the URL via the deep link defined in app.json.
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `${window.location.origin}/auth/reset-password`;
  }
  return 'keriva://auth/reset-password';
}

export type AuthError = { message: string };

export type AuthResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: AuthError };

function toError(message: string): AuthError {
  return { message };
}

// Map Supabase auth errors to short human messages.
function mapError(err: unknown): AuthError {
  if (err && typeof err === 'object' && 'message' in err) {
    const msg = String((err as { message: unknown }).message);
    if (msg.includes('Invalid login credentials')) {
      return toError('Correo o contraseña incorrectos');
    }
    if (msg.includes('already registered')) {
      return toError('Ya existe una cuenta con ese correo');
    }
    if (msg.includes('Password should be')) {
      return toError('La contraseña debe tener al menos 6 caracteres');
    }
    if (msg.includes('Email not confirmed')) {
      return toError('Confirma tu correo antes de iniciar sesión');
    }
    return toError(msg);
  }
  return toError('Error inesperado. Intenta de nuevo.');
}

export async function signUpWithEmail(params: {
  email: string;
  password: string;
  nombre?: string;
  telefono?: string;
  cedula?: string;
}): Promise<AuthResult<{ userId: string | null; needsConfirmation: boolean; email: string }>> {
  const { email, password, nombre, telefono, cedula } = params;
  const normalizedEmail = email.trim().toLowerCase();
  const metadata: Record<string, string> = {};
  if (nombre) metadata.nombre = nombre;
  if (telefono) metadata.telefono = telefono;
  if (cedula) metadata.cedula = cedula;

  const { data, error } = await supabase.auth.signUp({
    email: normalizedEmail,
    password,
    options: {
      data: Object.keys(metadata).length > 0 ? metadata : undefined,
    },
  });
  if (error) return { ok: false, error: mapError(error) };
  return {
    ok: true,
    data: {
      userId: data.user?.id ?? null,
      needsConfirmation: !data.session,
      email: normalizedEmail,
    },
  };
}

export async function sendPasswordResetEmail(
  email: string,
): Promise<AuthResult<null>> {
  const { error } = await supabase.auth.resetPasswordForEmail(
    email.trim().toLowerCase(),
    { redirectTo: getResetRedirectUrl() },
  );
  if (error) return { ok: false, error: mapError(error) };
  return { ok: true, data: null };
}

export async function updateUserPassword(
  newPassword: string,
): Promise<AuthResult<null>> {
  if (newPassword.length < 6) {
    return { ok: false, error: toError('La contraseña debe tener al menos 6 caracteres') };
  }
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) return { ok: false, error: mapError(error) };
  return { ok: true, data: null };
}

export async function resendConfirmationEmail(
  email: string,
): Promise<AuthResult<null>> {
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email: email.trim().toLowerCase(),
  });
  if (error) return { ok: false, error: mapError(error) };
  return { ok: true, data: null };
}

export async function signInWithEmail(params: {
  email: string;
  password: string;
}): Promise<AuthResult<{ userId: string }>> {
  const { email, password } = params;
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });
  if (error) return { ok: false, error: mapError(error) };
  if (!data.user) return { ok: false, error: toError('No se pudo iniciar sesión') };
  return { ok: true, data: { userId: data.user.id } };
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

export async function getCurrentPerfil(userId: string): Promise<Perfil | null> {
  const { data, error } = await supabase
    .from('perfiles')
    .select('id, nombre, email, idioma, ciudad')
    .eq('id', userId)
    .maybeSingle();
  if (error || !data) return null;
  return data as Perfil;
}
