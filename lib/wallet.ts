// =====================================================================
// Keriva Wallet — modelo de niveles, ahorro estimado y compartir (A1)
// =====================================================================
// Helper puro (sin side-effects) que define el sistema de niveles, calcula
// el nivel actual a partir de los puntos y el ahorro estimado a partir de
// las reservas confirmadas. Sin RPCs: todo se calcula en cliente.
// =====================================================================

export type Nivel = {
  numero: number;
  nombre: string;
  emoji: string;
  minPuntos: number;
  maxPuntos: number | null; // null = sin tope (último nivel)
};

// 5 niveles que cubren desde recién registrado hasta poder mostrar progreso
// real durante meses de uso activo.
export const NIVELES: Nivel[] = [
  { numero: 1, nombre: 'Explorador',  emoji: '🌱', minPuntos: 0,    maxPuntos: 49 },
  { numero: 2, nombre: 'Conocedor',   emoji: '🔎', minPuntos: 50,   maxPuntos: 149 },
  { numero: 3, nombre: 'Aliado',      emoji: '🤝', minPuntos: 150,  maxPuntos: 349 },
  { numero: 4, nombre: 'Curador',     emoji: '💎', minPuntos: 350,  maxPuntos: 749 },
  { numero: 5, nombre: 'Embajador',   emoji: '👑', minPuntos: 750,  maxPuntos: null },
];

export function nivelActual(puntos: number): Nivel {
  for (let i = NIVELES.length - 1; i >= 0; i--) {
    if (puntos >= NIVELES[i].minPuntos) return NIVELES[i];
  }
  return NIVELES[0];
}

export function siguienteNivel(puntos: number): Nivel | null {
  const actual = nivelActual(puntos);
  const idx = NIVELES.findIndex((n) => n.numero === actual.numero);
  if (idx < 0 || idx >= NIVELES.length - 1) return null;
  return NIVELES[idx + 1];
}

/** Progreso 0..1 hacia el siguiente nivel. 1 si ya es máximo. */
export function progresoNivel(puntos: number): number {
  const actual = nivelActual(puntos);
  const sig = siguienteNivel(puntos);
  if (!sig) return 1;
  const range = sig.minPuntos - actual.minPuntos;
  if (range <= 0) return 1;
  const done = puntos - actual.minPuntos;
  return Math.max(0, Math.min(1, done / range));
}

// =====================================================================
// Ahorro estimado
// =====================================================================
// El Brief pide mostrar ahorro estimado en rango ±5% con disclaimer
// pedagógico. Sin precio_referencia confiable por reserva, usamos una
// constante promedio del ahorro típico al usar Keriva (basado en la
// estrategia comercial: farmacia afiliada da descuento estándar).
//
// Cuando haya precio_referencia confiable por producto se puede sustituir
// por la suma real (referencia − pagado).
// =====================================================================

/** Promedio de ahorro por reserva confirmada (RD$). Editar aquí cuando haya datos reales. */
const AHORRO_PROMEDIO_POR_RESERVA = 75;
const VARIACION_RANGO = 0.05; // ±5%

export type AhorroEstimado = {
  centro: number;
  min: number;
  max: number;
  base: 'reservas' | 'vacio';
  reservas: number;
};

export function calcularAhorro(reservasConfirmadas: number): AhorroEstimado {
  if (reservasConfirmadas <= 0) {
    return { centro: 0, min: 0, max: 0, base: 'vacio', reservas: 0 };
  }
  const centro = reservasConfirmadas * AHORRO_PROMEDIO_POR_RESERVA;
  return {
    centro,
    min: Math.round(centro * (1 - VARIACION_RANGO)),
    max: Math.round(centro * (1 + VARIACION_RANGO)),
    base: 'reservas',
    reservas: reservasConfirmadas,
  };
}

// =====================================================================
// Compartir progreso (cooldown semanal)
// =====================================================================

/** Texto sugerido para compartir en redes. Personalizado con nombre+nivel. */
export function buildShareMessage(opts: { nombre?: string | null; nivel: Nivel; puntos: number }): string {
  const nombre = (opts.nombre ?? '').trim();
  const intro = nombre ? `Hola, soy ${nombre}.` : 'Hola.';
  return [
    `${intro} Estoy usando Keriva ${opts.nivel.emoji} ${opts.nivel.nombre}.`,
    `Llevo ${opts.puntos.toLocaleString('es-DO')} puntos comparando precios de medicamentos en República Dominicana.`,
    'Compara, ahorra y encuentra farmacias cerca de ti: keriva.app',
  ].join('\n');
}

const SHARE_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

/** True si ya pasaron 7 días desde el último share. */
export function canEarnShareReward(lastShareIso: string | null): boolean {
  if (!lastShareIso) return true;
  const last = new Date(lastShareIso).getTime();
  if (!Number.isFinite(last)) return true;
  return Date.now() - last >= SHARE_COOLDOWN_MS;
}
