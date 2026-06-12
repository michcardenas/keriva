import { Platform } from 'react-native';

// =====================================================================
// Recordatorios de medicamentos — notificaciones LOCALES (Bloque 9)
// =====================================================================
// Programa avisos en el device cuando el usuario configura un medicamento.
// NO usa OneSignal — son notificaciones locales del SO, funcionan offline.
//
// Estrategia: programar las próximas N tomas (14 días por defecto) cuando
// el usuario crea/edita el medicamento. Cuando el usuario reabre la app
// (vía rescheduleAll), las que ya disparon se reemplazan por las siguientes
// para mantener siempre cobertura adelante.
//
// Identificador: cada notificación lleva `med:<medId>:<isoDate>` para que
// se puedan cancelar todas las de un medicamento sin tocar las otras.
// =====================================================================

// Carga perezosa de expo-notifications — el módulo no existe en web (Platform.OS === 'web')
// y queremos que el bundle siga compilando.
function getNotifs(): any {
  if (Platform.OS === 'web') return null;
  try {
    return require('expo-notifications');
  } catch {
    return null;
  }
}

const TZ_RD = 'America/Santo_Domingo';

export type ScheduleableMed = {
  id: string;
  perfilId: string;
  nombreDisplay: string;
  frecuenciaTipo: 'diaria' | 'horas' | 'semanal';
  frecuenciaValor: number | null;
  horasToma: string[];           // ej. ['08:00','20:00'] — HH:MM
  diasSemana: number[] | null;   // 1..7 (lun=1 ... dom=7), null = todos
};

let handlerInstalled = false;
let permissionsAskedThisSession = false;

/**
 * Configura cómo el sistema muestra una notificación cuando llega (foreground
 * y background). Idempotente. Llamar una vez al boot de la app.
 */
export function setupNotificationHandler(): void {
  const N = getNotifs();
  if (!N || handlerInstalled) return;
  handlerInstalled = true;
  N.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      // Expo SDK 52+
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

/**
 * Pide permiso para enviar notificaciones. Idempotente: si ya está concedido
 * no vuelve a abrir el prompt. Devuelve true si el usuario aceptó.
 */
export async function requestPermissions(): Promise<boolean> {
  const N = getNotifs();
  if (!N) return false;
  try {
    const { status: existing } = await N.getPermissionsAsync();
    if (existing === 'granted') return true;
    if (permissionsAskedThisSession) return false;
    permissionsAskedThisSession = true;
    const { status } = await N.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: false, allowSound: true },
    });
    return status === 'granted';
  } catch {
    return false;
  }
}

/** True si el SO ya concedió permiso (sin abrir prompt). */
export async function hasPermissions(): Promise<boolean> {
  const N = getNotifs();
  if (!N) return false;
  try {
    const { status } = await N.getPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────
// Cálculo de las próximas tomas
// ─────────────────────────────────────────────────────────────────────

function parseHHMM(hhmm: string): { h: number; m: number } | null {
  // Acepta HH:MM y HH:MM:SS — Postgres normaliza time a HH:MM:SS al guardar.
  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(hhmm.trim());
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (!Number.isFinite(h) || h < 0 || h > 23) return null;
  if (!Number.isFinite(m) || m < 0 || m > 59) return null;
  return { h, m };
}

/**
 * Devuelve el ISO weekday (1=lun..7=dom) de una fecha tomando la zona
 * America/Santo_Domingo. Intl.DateTimeFormat es lo único confiable para esto
 * en RN.
 */
function isoWeekdayRD(d: Date): number {
  const wd = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ_RD,
    weekday: 'short',
  }).format(d);
  // Mon..Sun
  return { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }[wd] ?? 1;
}

/**
 * Construye un Date que representa "hoy + offsetDays a las h:m hora RD".
 * RD es UTC-4 sin DST, lo cual simplifica el cálculo.
 */
function dateAtRD(now: Date, offsetDays: number, h: number, m: number): Date {
  // Empezamos con un Date en la zona local del device y ajustamos al TZ RD.
  // La forma segura es construir un ISO string con offset -04:00.
  const base = new Date(now.getTime() + offsetDays * 24 * 60 * 60 * 1000);
  // Fecha YYYY-MM-DD en RD
  const ymd = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ_RD, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(base); // ej. "2026-06-11"
  const hh = String(h).padStart(2, '0');
  const mm = String(m).padStart(2, '0');
  return new Date(`${ymd}T${hh}:${mm}:00-04:00`);
}

/**
 * Calcula las próximas fechas de toma para un medicamento, en los próximos
 * `days` días (por defecto 14). Filtra las que ya pasaron.
 */
export function computeUpcomingDoses(
  med: ScheduleableMed,
  days = 14,
  now: Date = new Date(),
): Date[] {
  const out: Date[] = [];
  const horas = (med.horasToma ?? [])
    .map(parseHHMM)
    .filter((x): x is { h: number; m: number } => x !== null);
  if (horas.length === 0) return [];

  if (med.frecuenciaTipo === 'horas') {
    // Cada X horas desde la primera hora_toma (o 08:00 si no hay).
    const stepHours = med.frecuenciaValor && med.frecuenciaValor > 0 ? med.frecuenciaValor : 8;
    const start = horas[0] ?? { h: 8, m: 0 };
    const totalSlots = Math.floor((days * 24) / stepHours) + 1;
    for (let i = 0; i < totalSlots; i++) {
      const offsetHours = i * stepHours;
      const d = dateAtRD(now, Math.floor(offsetHours / 24), start.h + (offsetHours % 24), start.m);
      if (d.getTime() > now.getTime()) out.push(d);
    }
    return out;
  }

  // 'diaria' y 'semanal': iteramos por día y filtramos por diasSemana.
  for (let day = 0; day <= days; day++) {
    const sampleDate = new Date(now.getTime() + day * 24 * 60 * 60 * 1000);
    const wd = isoWeekdayRD(sampleDate);
    if (med.diasSemana && med.diasSemana.length > 0 && !med.diasSemana.includes(wd)) continue;
    for (const { h, m } of horas) {
      const d = dateAtRD(now, day, h, m);
      if (d.getTime() > now.getTime()) out.push(d);
    }
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────
// Programar / cancelar
// ─────────────────────────────────────────────────────────────────────

function identifierFor(medId: string, when: Date): string {
  return `med:${medId}:${when.toISOString()}`;
}

/**
 * Programa los próximos avisos para un medicamento. Si ya había avisos
 * para el mismo medId, se cancelan antes (evita duplicados).
 */
export async function scheduleMedicamento(
  med: ScheduleableMed,
  perfilNombre: string,
  days = 14,
): Promise<{ scheduled: number }> {
  const N = getNotifs();
  if (!N) return { scheduled: 0 };
  const allow = await hasPermissions();
  if (!allow) return { scheduled: 0 };

  await cancelMedicamento(med.id);

  const doses = computeUpcomingDoses(med, days);
  let scheduled = 0;
  for (const when of doses) {
    try {
      await N.scheduleNotificationAsync({
        identifier: identifierFor(med.id, when),
        content: {
          title: `Hora de tomar ${med.nombreDisplay}`,
          body: perfilNombre
            ? `Recordatorio para ${perfilNombre}`
            : 'Recordatorio de medicamento',
          data: { medId: med.id, perfilId: med.perfilId, type: 'med_reminder' },
          sound: true,
        },
        trigger: {
          type: N.SchedulableTriggerInputTypes?.DATE ?? 'date',
          date: when,
        },
      });
      scheduled++;
    } catch {
      // ignora un fallo puntual y sigue con el resto
    }
  }
  return { scheduled };
}

/** Cancela todas las notificaciones programadas de un medicamento. */
export async function cancelMedicamento(medId: string): Promise<void> {
  const N = getNotifs();
  if (!N) return;
  try {
    const list = await N.getAllScheduledNotificationsAsync();
    const prefix = `med:${medId}:`;
    await Promise.all(
      (list ?? [])
        .filter((n: any) => typeof n.identifier === 'string' && n.identifier.startsWith(prefix))
        .map((n: any) => N.cancelScheduledNotificationAsync(n.identifier)),
    );
  } catch {
    // swallow
  }
}

/**
 * Reprograma TODAS las notificaciones de una lista de medicamentos. Útil para
 * llamar al boot de la pantalla familia/medicamentos, o cuando el usuario
 * recién conceda el permiso de notificaciones.
 */
export async function rescheduleAll(
  meds: ScheduleableMed[],
  perfilNombrePorPerfilId: Record<string, string>,
): Promise<{ scheduled: number; mediCount: number }> {
  const N = getNotifs();
  if (!N) return { scheduled: 0, mediCount: 0 };
  const allow = await hasPermissions();
  if (!allow) return { scheduled: 0, mediCount: 0 };

  let scheduled = 0;
  for (const med of meds) {
    const nombre = perfilNombrePorPerfilId[med.perfilId] ?? '';
    const r = await scheduleMedicamento(med, nombre);
    scheduled += r.scheduled;
  }
  return { scheduled, mediCount: meds.length };
}

/**
 * Cuenta cuántas notificaciones de tipo 'med_reminder' están programadas.
 * Útil para diagnóstico y pantalla "Mis recordatorios" en el futuro.
 */
export async function countScheduledReminders(): Promise<number> {
  const N = getNotifs();
  if (!N) return 0;
  try {
    const list = await N.getAllScheduledNotificationsAsync();
    return (list ?? []).filter((n: any) => n.content?.data?.type === 'med_reminder').length;
  } catch {
    return 0;
  }
}
