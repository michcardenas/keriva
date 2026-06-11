import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';

// =====================================================================
// Cross-platform REST helper
// =====================================================================
// Workaround for a deadlock issue we hit on supabase-js v2 + Expo web/HMR
// where supabase.from(...) calls would hang indefinitely. On native Android/iOS
// supabase-js works fine, so we use it directly. On web we fall back to a
// plain fetch against PostgREST using the access token from localStorage.
//
// All API helpers should use these wrappers instead of calling supabase.from
// or supabase.rpc directly, so behavior stays consistent across platforms.
// =====================================================================

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const IS_WEB = Platform.OS === 'web';

/**
 * Reads the persisted access_token. On web, from window.localStorage; on
 * native, from supabase-js (which persists via AsyncStorage). Returns null
 * if no session is available.
 */
export async function getAccessTokenAsync(): Promise<string | null> {
  if (IS_WEB) {
    if (typeof window === 'undefined') return null;
    try {
      const ref = SUPABASE_URL.replace(/^https?:\/\//, '').split('.')[0];
      const raw = window.localStorage.getItem(`sb-${ref}-auth-token`);
      if (!raw) return null;
      return JSON.parse(raw)?.access_token ?? null;
    } catch {
      return null;
    }
  }
  // Native: ask supabase-js (works correctly there)
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
}

/** Synchronous variant — only works on web (returns null on native). */
export function getAccessTokenSync(): string | null {
  if (!IS_WEB) return null;
  if (typeof window === 'undefined') return null;
  try {
    const ref = SUPABASE_URL.replace(/^https?:\/\//, '').split('.')[0];
    const raw = window.localStorage.getItem(`sb-${ref}-auth-token`);
    if (!raw) return null;
    return JSON.parse(raw)?.access_token ?? null;
  } catch {
    return null;
  }
}

/**
 * Build standard REST headers. Pass the access token (or omit to use anon).
 */
function buildHeaders(accessToken: string | null, extra?: Record<string, string>): Record<string, string> {
  return {
    apikey: SUPABASE_ANON,
    Authorization: `Bearer ${accessToken ?? SUPABASE_ANON}`,
    ...(extra ?? {}),
  };
}

/**
 * Refresca la sesión vía supabase-js y devuelve el nuevo access_token.
 * El JWT dura 1 hora; si expiró, PostgREST responde 401. Antes, la capa REST
 * leía el token de localStorage sin refrescarlo, así que la sesión web "moría"
 * tras 1 h. Ahora, ante un 401, refrescamos y reintentamos una vez.
 *
 * Tiene un timeout de seguridad: si el refresh se cuelga (lock de supabase-js),
 * resolvemos null en vez de bloquear la petición indefinidamente.
 */
async function refreshAccessToken(): Promise<string | null> {
  try {
    const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 6000));
    const refresh = supabase.auth
      .refreshSession()
      .then(({ data }) => data.session?.access_token ?? null)
      .catch(() => null);
    return await Promise.race([refresh, timeout]);
  } catch {
    return null;
  }
}

/**
 * fetch contra PostgREST con autenticación y reintento automático ante 401.
 */
async function authedFetch(
  path: string,
  opts: { method?: string; body?: unknown; extraHeaders?: Record<string, string> } = {},
): Promise<Response> {
  const { method = 'GET', body, extraHeaders } = opts;
  const url = `${SUPABASE_URL}/rest/v1/${path}`;
  const run = (token: string | null) =>
    fetch(url, {
      method,
      headers: buildHeaders(token, extraHeaders),
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

  const token = await getAccessTokenAsync();
  let res = await run(token);

  // Token expirado → refrescar y reintentar UNA vez (solo si había sesión).
  if (res.status === 401 && token) {
    const fresh = (await refreshAccessToken()) ?? (await getAccessTokenAsync());
    if (fresh && fresh !== token) {
      res = await run(fresh);
    }
  }
  return res;
}

export async function restGet<T = any>(path: string): Promise<T> {
  const r = await authedFetch(path);
  if (!r.ok) {
    const text = await r.text().catch(() => '');
    throw new Error(`REST GET ${path} → ${r.status}: ${text || 'no body'}`);
  }
  return r.json();
}

export async function restPost<T = any>(path: string, body: unknown): Promise<T> {
  const r = await authedFetch(path, {
    method: 'POST',
    body,
    extraHeaders: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
  });
  const data = await r.json().catch(() => null);
  if (!r.ok) {
    const msg = (data && (data.message || data.error_description || data.hint)) || `HTTP ${r.status}`;
    throw new Error(msg);
  }
  return data as T;
}

export async function restPatch<T = any>(path: string, body: unknown): Promise<T> {
  const r = await authedFetch(path, {
    method: 'PATCH',
    body,
    extraHeaders: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
  });
  const data = await r.json().catch(() => null);
  if (!r.ok) {
    const msg = (data && (data.message || data.error_description || data.hint)) || `HTTP ${r.status}`;
    throw new Error(msg);
  }
  return data as T;
}

export async function restRpc<T = any>(fn: string, body: Record<string, unknown>): Promise<T> {
  const r = await authedFetch(`rpc/${fn}`, {
    method: 'POST',
    body,
    extraHeaders: { 'Content-Type': 'application/json' },
  });
  const data = await r.json().catch(() => null);
  if (!r.ok) {
    const msg = (data && (data.message || data.error_description || data.hint)) || `HTTP ${r.status}`;
    throw new Error(msg);
  }
  return data as T;
}
