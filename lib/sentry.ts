// =====================================================================
// Sentry — reporte de errores con Ley 172-13 (cero PII por defecto)
// =====================================================================
// Cliente HTTP ligero que envía eventos al endpoint "envelope" de Sentry
// usando fetch. Ventajas frente al SDK nativo @sentry/react-native:
//   · Funciona idéntico en web y móvil sin config-plugin ni rebuild EAS.
//   · Si EXPO_PUBLIC_SENTRY_DSN no está configurado, hace no-op silencioso.
//
// Política Ley 172-13 (datos de salud):
//   · sendDefaultPii efectivo = false. Los eventos NO llevan email, teléfono,
//     dirección, IP, ni nombres por defecto.
//   · setUser SOLO debe llamarse después del consentimiento explícito
//     (modal Ley 172-13). Hasta entonces, los reportes son anónimos.
//   · El context que pase el caller se sanitiza antes de enviar: cualquier
//     campo cuyo nombre matchee una lista de claves sensibles se reemplaza
//     por '[redacted]'.
//
// Activación: añade EXPO_PUBLIC_SENTRY_DSN al .env.
// =====================================================================

const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN ?? '';

type ParsedDsn = {
  endpoint: string;
  publicKey: string;
};

function parseDsn(dsn: string): ParsedDsn | null {
  try {
    const url = new URL(dsn);
    const publicKey = url.username;
    const projectId = url.pathname.replace(/^\//, '');
    if (!publicKey || !projectId) return null;
    const endpoint = `${url.protocol}//${url.host}/api/${projectId}/envelope/?sentry_key=${publicKey}&sentry_version=7`;
    return { endpoint, publicKey };
  } catch {
    return null;
  }
}

const parsed = DSN ? parseDsn(DSN) : null;

export const isSentryEnabled = parsed !== null;

// ─────────────────────────────────────────────────────────────────────
// Estado en memoria
// ─────────────────────────────────────────────────────────────────────
let currentUserId: string | null = null;
let initialized = false;

// Claves a redactar dentro del context.extra. Lista conservadora: cualquier
// llave que contenga uno de estos substrings (case-insensitive) se reemplaza
// por '[redacted]' antes de enviar el evento.
const PII_KEY_PATTERNS = [
  'email',
  'mail',
  'phone',
  'telefono',
  'tel',
  'cedula',
  'documento',
  'rnc',
  'address',
  'direccion',
  'nombre',
  'name',
  'apellido',
  'lastname',
  'birth',
  'nacimiento',
  'password',
  'token',
  'secret',
];

function isPiiKey(key: string): boolean {
  const lower = key.toLowerCase();
  return PII_KEY_PATTERNS.some((p) => lower.includes(p));
}

// Redacta emails y teléfonos *dentro* de strings (no las descarta enteras —
// preservamos el resto del mensaje para que el error siga siendo útil).
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const PHONE_RE = /\+?\d[\d\s\-().]{7,}\d/g;

function sanitizeString(s: string): string {
  return s.replace(EMAIL_RE, '[email]').replace(PHONE_RE, '[phone]');
}

function sanitize(value: unknown, depth = 0): unknown {
  if (depth > 4) return '[truncated]';
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return sanitizeString(value);
  if (typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((v) => sanitize(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = isPiiKey(k) ? '[redacted]' : sanitize(v, depth + 1);
  }
  return out;
}

function randomEventId(): string {
  let id = '';
  for (let i = 0; i < 32; i++) {
    id += Math.floor(Math.random() * 16).toString(16);
  }
  return id;
}

// ─────────────────────────────────────────────────────────────────────
// API pública
// ─────────────────────────────────────────────────────────────────────

/**
 * Identifica al usuario en futuros eventos. SOLO debe llamarse después del
 * consentimiento Ley 172-13. Se guarda únicamente el UUID — nunca email,
 * nombre ni teléfono.
 */
export function setUser(userId: string): void {
  currentUserId = userId;
}

/** Limpia el user (llamar en logout). */
export function clearUser(): void {
  currentUserId = null;
}

/**
 * Inicializa Sentry: registra global handler para errores no atrapados.
 * Idempotente — llamar una vez al boot de la app.
 */
export function initSentry(): void {
  if (initialized) return;
  initialized = true;
  if (!parsed) return;

  // Web: window.onerror + unhandledrejection
  if (typeof window !== 'undefined') {
    const prevOnError = window.onerror;
    window.onerror = (msg, src, line, col, err) => {
      captureException(err ?? new Error(String(msg)), { source: src, line, col });
      if (typeof prevOnError === 'function') {
        return prevOnError(msg, src, line, col, err);
      }
      return false;
    };
    window.addEventListener('unhandledrejection', (ev) => {
      captureException(ev.reason ?? new Error('Unhandled promise rejection'));
    });
  }

  // React Native: ErrorUtils global handler
  const g = globalThis as unknown as {
    ErrorUtils?: {
      getGlobalHandler: () => (err: Error, isFatal?: boolean) => void;
      setGlobalHandler: (fn: (err: Error, isFatal?: boolean) => void) => void;
    };
  };
  if (g.ErrorUtils && typeof g.ErrorUtils.setGlobalHandler === 'function') {
    const prev = g.ErrorUtils.getGlobalHandler();
    g.ErrorUtils.setGlobalHandler((err, isFatal) => {
      captureException(err, { isFatal: !!isFatal });
      prev(err, isFatal);
    });
  }
}

/**
 * Reporta una excepción a Sentry. Nunca lanza: si Sentry no está configurado
 * o el envío falla, hace no-op (en dev imprime un aviso).
 */
export function captureException(
  error: unknown,
  context?: Record<string, unknown>,
): void {
  const rawMessage =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
      ? error
      : JSON.stringify(error);
  const message = sanitizeString(rawMessage);

  if (!parsed) {
    if (__DEV__) {
      console.warn('[sentry:disabled] captureException →', message, context ?? '');
    }
    return;
  }

  try {
    const eventId = randomEventId();
    const sentAt = new Date().toISOString();
    const safeContext = context ? (sanitize(context) as Record<string, unknown>) : undefined;

    const event: Record<string, unknown> = {
      event_id: eventId,
      timestamp: Date.now() / 1000,
      platform: 'javascript',
      level: 'error',
      logger: 'keriva',
      // Política PII: solo se incluye user.id si el caller llamó setUser().
      user: currentUserId ? { id: currentUserId } : undefined,
      // Pista mínima de entorno (NO incluye IP ni device-id).
      tags: {
        env: __DEV__ ? 'dev' : 'prod',
        platform: typeof window !== 'undefined' ? 'web' : 'native',
      },
      exception: {
        values: [
          {
            type: error instanceof Error ? error.name : 'Error',
            value: message,
            stacktrace:
              error instanceof Error && error.stack
                ? { frames: [{ function: sanitizeString(error.stack.split('\n')[0]) }] }
                : undefined,
          },
        ],
      },
      extra: safeContext,
    };

    const envelope =
      JSON.stringify({ event_id: eventId, sent_at: sentAt }) +
      '\n' +
      JSON.stringify({ type: 'event' }) +
      '\n' +
      JSON.stringify(event);

    void fetch(parsed.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-sentry-envelope' },
      body: envelope,
    }).catch(() => {
      /* swallow — el reporte nunca debe romper la app */
    });
  } catch {
    /* swallow */
  }
}
