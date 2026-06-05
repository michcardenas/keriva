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

export async function restGet<T = any>(path: string): Promise<T> {
  const token = await getAccessTokenAsync();
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: buildHeaders(token),
  });
  if (!r.ok) {
    const text = await r.text().catch(() => '');
    throw new Error(`REST GET ${path} → ${r.status}: ${text || 'no body'}`);
  }
  return r.json();
}

export async function restPost<T = any>(path: string, body: unknown): Promise<T> {
  const token = await getAccessTokenAsync();
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: 'POST',
    headers: buildHeaders(token, {
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    }),
    body: JSON.stringify(body),
  });
  const data = await r.json().catch(() => null);
  if (!r.ok) {
    const msg = (data && (data.message || data.error_description || data.hint)) || `HTTP ${r.status}`;
    throw new Error(msg);
  }
  return data as T;
}

export async function restPatch<T = any>(path: string, body: unknown): Promise<T> {
  const token = await getAccessTokenAsync();
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: 'PATCH',
    headers: buildHeaders(token, {
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    }),
    body: JSON.stringify(body),
  });
  const data = await r.json().catch(() => null);
  if (!r.ok) {
    const msg = (data && (data.message || data.error_description || data.hint)) || `HTTP ${r.status}`;
    throw new Error(msg);
  }
  return data as T;
}

export async function restRpc<T = any>(fn: string, body: Record<string, unknown>): Promise<T> {
  const token = await getAccessTokenAsync();
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: buildHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  });
  const data = await r.json().catch(() => null);
  if (!r.ok) {
    const msg = (data && (data.message || data.error_description || data.hint)) || `HTTP ${r.status}`;
    throw new Error(msg);
  }
  return data as T;
}
