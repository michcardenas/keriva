// =====================================================================
// Sentry — reporte de errores (Bug 04)
// =====================================================================
// El documento del cliente pide conectar Sentry en el catch del mapa para
// monitorear errores en producción.
//
// En lugar del SDK nativo @sentry/react-native (que exige config-plugin y
// rebuild de EAS), este cliente ligero envía el evento directamente al
// endpoint "envelope" de Sentry usando fetch. Ventajas:
//   · Funciona idéntico en web y móvil, sin config nativa.
//   · No rompe el bundler si aún no hay DSN.
//   · Si EXPO_PUBLIC_SENTRY_DSN no está configurado, hace no-op silencioso.
//
// Para activarlo: añade EXPO_PUBLIC_SENTRY_DSN al .env con el DSN del
// proyecto Sentry (Settings → Client Keys (DSN)).
// =====================================================================

const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN ?? '';

type ParsedDsn = {
  endpoint: string;
  publicKey: string;
};

function parseDsn(dsn: string): ParsedDsn | null {
  try {
    // Formato: https://<publicKey>@<host>/<projectId>
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

function randomEventId(): string {
  let id = '';
  for (let i = 0; i < 32; i++) {
    id += Math.floor(Math.random() * 16).toString(16);
  }
  return id;
}

/**
 * Reporta una excepción a Sentry. Nunca lanza: si Sentry no está configurado
 * o el envío falla, hace no-op (en dev imprime un aviso en consola).
 */
export function captureException(
  error: unknown,
  context?: Record<string, unknown>,
): void {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
      ? error
      : JSON.stringify(error);

  if (!parsed) {
    if (__DEV__) {
      console.warn('[sentry:disabled] captureException →', message, context ?? '');
    }
    return;
  }

  try {
    const eventId = randomEventId();
    const sentAt = new Date().toISOString();

    const event = {
      event_id: eventId,
      timestamp: Date.now() / 1000,
      platform: 'javascript',
      level: 'error',
      logger: 'keriva',
      exception: {
        values: [
          {
            type: error instanceof Error ? error.name : 'Error',
            value: message,
            stacktrace:
              error instanceof Error && error.stack
                ? { frames: [{ function: error.stack.split('\n')[0] }] }
                : undefined,
          },
        ],
      },
      extra: context,
    };

    const envelope =
      JSON.stringify({ event_id: eventId, sent_at: sentAt }) +
      '\n' +
      JSON.stringify({ type: 'event' }) +
      '\n' +
      JSON.stringify(event);

    // No await: el reporte es "fire and forget" y no debe bloquear la UI.
    void fetch(parsed.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-sentry-envelope' },
      body: envelope,
    }).catch(() => {
      /* swallow — el reporte de errores nunca debe romper la app */
    });
  } catch {
    /* swallow */
  }
}
