// =====================================================================
// PostHog — analítica de producto con Ley 172-13 (sin PII por defecto)
// =====================================================================
// Cliente HTTP ligero al endpoint /capture/ de PostHog (US Cloud). Mismo
// patrón que lib/sentry: fetch directo, no requiere config nativa ni
// rebuild EAS, no-op si la API key falta.
//
// Política Ley 172-13:
//   · Cada dispositivo tiene un distinct_id ANÓNIMO persistente
//     (`keriva_anon_id`). NO se vincula a la cuenta a menos que el usuario
//     haya aceptado el consentimiento de datos de salud.
//   · `identifyUser(userId)` SOLO debe llamarse tras consentimiento.
//   · `capture()` nunca envía email, teléfono, nombre, ni dirección — el
//     caller debe pasar SOLO IDs y enums (rol, categoría, tipo evento).
//
// Eventos clave instrumentados:
//   · search_med           — usuario busca un medicamento
//   · pharmacy_view        — usuario abre detalle de farmacia/medicamento
//   · reserve_created      — usuario crea una reserva
//   · reserve_confirmed    — farmacia confirma la venta
//   · signup_completed     — registro nuevo
// =====================================================================

const API_KEY = process.env.EXPO_PUBLIC_POSTHOG_KEY ?? '';
const HOST = process.env.EXPO_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com';
const STORAGE_KEY = 'keriva_anon_id';

export const isAnalyticsEnabled = API_KEY.length > 0;

// Eventos válidos — el TS narrow evita typos en el caller.
export type AnalyticsEvent =
  | 'search_med'
  | 'pharmacy_view'
  | 'reserve_created'
  | 'reserve_confirmed'
  | 'signup_completed';

let anonId: string | null = null;
let identifiedUserId: string | null = null;
let initialized = false;

function randomId(): string {
  // 16 bytes → 32 hex chars. Suficiente para distinct_id anónimo.
  let id = '';
  for (let i = 0; i < 32; i++) {
    id += Math.floor(Math.random() * 16).toString(16);
  }
  return id;
}

function loadAnonId(): string {
  // Web: localStorage. RN: caer al random in-memory si AsyncStorage no está
  // disponible en este path (se persiste igual la próxima vez que la app
  // levante con storage listo). Aceptable porque el id es opaco.
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored && stored.length === 32) return stored;
      const fresh = randomId();
      window.localStorage.setItem(STORAGE_KEY, fresh);
      return fresh;
    } catch {
      // ignore
    }
  }
  return randomId();
}

/** Idempotente — llamar una vez al boot de la app. */
export function initAnalytics(): void {
  if (initialized) return;
  initialized = true;
  if (!isAnalyticsEnabled) return;
  anonId = loadAnonId();
}

/**
 * Vincula el distinct_id anónimo al user real. SOLO debe llamarse después
 * del consentimiento Ley 172-13 (modal U3). Se envía un evento $identify
 * que hace alias del anon → user.
 */
export function identifyUser(userId: string): void {
  if (!isAnalyticsEnabled || !anonId) return;
  if (identifiedUserId === userId) return; // dedupe
  identifiedUserId = userId;
  void sendCapture('$identify', {
    distinct_id: userId,
    $anon_distinct_id: anonId,
  });
}

/** Limpia la identidad (llamar en logout). El distinct_id vuelve a anónimo. */
export function clearIdentity(): void {
  identifiedUserId = null;
}

/**
 * Envía un evento. Las props deben ser SOLO IDs, enums y números — nunca
 * PII. El caller es responsable de no pasar email/teléfono/nombre.
 */
export function capture(
  event: AnalyticsEvent,
  properties?: Record<string, string | number | boolean | null>,
): void {
  if (!isAnalyticsEnabled || !anonId) return;
  const distinctId = identifiedUserId ?? anonId;
  void sendCapture(event, { distinct_id: distinctId, ...properties });
}

async function sendCapture(
  event: string,
  properties: Record<string, unknown>,
): Promise<void> {
  try {
    const body = JSON.stringify({
      api_key: API_KEY,
      event,
      properties: {
        ...properties,
        $lib: 'keriva-light',
        platform: typeof window !== 'undefined' ? 'web' : 'native',
      },
      timestamp: new Date().toISOString(),
    });
    await fetch(`${HOST}/capture/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
  } catch {
    /* swallow — la analítica nunca debe romper la app */
  }
}
