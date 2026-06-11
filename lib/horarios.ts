// =====================================================================
// Horarios estructurados de sucursales — U2 "Abierta ahora"
// =====================================================================
// Formato del JSONB (sucursales.horarios):
//   { lun: ["08:00","20:00"], mar: ["08:00","20:00"], ..., dom: null }
// `null` o key ausente = cerrado ese día.
//
// La zona horaria SIEMPRE es America/Santo_Domingo (RD = UTC-4 sin DST).
// =====================================================================

export type RangoHorario = [string, string]; // [open, close] en HH:MM
export type DiaSemana = 'lun' | 'mar' | 'mie' | 'jue' | 'vie' | 'sab' | 'dom';
export type Horarios = Partial<Record<DiaSemana, RangoHorario | null>>;

export const DIAS_SEMANA: DiaSemana[] = ['lun', 'mar', 'mie', 'jue', 'vie', 'sab', 'dom'];
export const DIA_LABEL: Record<DiaSemana, string> = {
  lun: 'Lunes',
  mar: 'Martes',
  mie: 'Miércoles',
  jue: 'Jueves',
  vie: 'Viernes',
  sab: 'Sábado',
  dom: 'Domingo',
};

const RD_TZ = 'America/Santo_Domingo';

/** Día de la semana actual en RD (lun..dom). */
function diaActualRD(now = new Date()): DiaSemana {
  // Intl.DateTimeFormat respeta el TZ — getDay() del Date local no.
  const weekday = new Intl.DateTimeFormat('en-US', {
    timeZone: RD_TZ,
    weekday: 'short',
  }).format(now);
  // Mon, Tue, Wed, Thu, Fri, Sat, Sun
  const map: Record<string, DiaSemana> = {
    Mon: 'lun', Tue: 'mar', Wed: 'mie', Thu: 'jue', Fri: 'vie', Sat: 'sab', Sun: 'dom',
  };
  return map[weekday] ?? 'lun';
}

/** Hora actual en RD como "HH:MM" (24h). */
function horaActualRD(now = new Date()): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: RD_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(now);
}

/**
 * ¿La sucursal está abierta ahora (hora RD)?
 * Devuelve false si no hay horarios estructurados, si el día está null o
 * si la hora está fuera del rango.
 */
export function isOpenNow(horarios: Horarios | null | undefined, now = new Date()): boolean {
  if (!horarios) return false;
  const dia = diaActualRD(now);
  const rango = horarios[dia];
  if (!rango || !Array.isArray(rango) || rango.length !== 2) return false;
  const [open, close] = rango;
  if (typeof open !== 'string' || typeof close !== 'string') return false;
  const hora = horaActualRD(now);
  // Rango simple HH:MM <= ahora <= HH:MM. No maneja overnight (cierra 02:00
  // del día siguiente) — caso poco común en farmacias y se puede modelar
  // luego con dos días (jue=[22,24], vie=[0,2]).
  return hora >= open && hora <= close;
}

/** Texto compacto resumiendo los horarios (para mostrar en la card). */
export function resumenHorarios(horarios: Horarios | null | undefined): string {
  if (!horarios) return 'Horario no disponible';
  const abiertos = DIAS_SEMANA.filter((d) => Array.isArray(horarios[d]));
  if (abiertos.length === 0) return 'Cerrada permanentemente';
  if (abiertos.length === 7) {
    const ranges = new Set(abiertos.map((d) => (horarios[d] as RangoHorario).join('-')));
    if (ranges.size === 1) return `Lun-Dom ${[...ranges][0]}`;
  }
  return abiertos.map((d) => `${DIA_LABEL[d].slice(0, 3)} ${(horarios[d] as RangoHorario).join('-')}`).join(' · ');
}
