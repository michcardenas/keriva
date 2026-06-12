import { View, StyleSheet, type ViewStyle, type DimensionValue } from 'react-native';
import { theme } from '@/lib/theme';
import { useColorMode } from '@/lib/ThemeContext';

type PillDef = {
  w: number;
  h: number;
  top?: DimensionValue;
  left?: DimensionValue;
  right?: DimensionValue;
  bottom?: DimensionValue;
  rotate: string;
  /** 'soft' = más visible, 'softer' = más sutil. La resolución por modo
   *   ocurre en runtime en pillStyle() para que el mismo PILLS sirva en
   *   light y dark. */
  tone?: 'soft' | 'softer';
  filled?: boolean;
};

// Paletas por modo. En dark usamos grises casi imperceptibles para que el
// motivo no compita con el contenido (era el principal reclamo: verde claro
// sobre fondo negro queda muy "chollón").
const LIGHT_SOFT = theme.colors.accentSoft;     // #DCFCE7 — verde claro visible
const LIGHT_SOFTER = theme.colors.accentSofter; // #F0FDF4 — verde casi blanco
const DARK_SOFT = 'rgba(255, 255, 255, 0.05)';  // gris muy sutil sobre negro
const DARK_SOFTER = 'rgba(255, 255, 255, 0.025)'; // casi imperceptible

// Distribución densa de cápsulas por toda la pantalla (posiciones en %).
const PILLS: PillDef[] = [
  // Fila superior
  { w: 130, h: 48, top: '-1%', left: '-12%', rotate: '-28deg', filled: true, tone: 'soft'},
  { w: 70, h: 28, top: '3%', left: '42%', rotate: '20deg', filled: false, tone: 'soft'},
  { w: 96, h: 36, top: '6%', right: '-8%', rotate: '34deg', filled: true, tone: 'softer'},
  { w: 54, h: 22, top: '11%', left: '14%', rotate: '-12deg', filled: true, tone: 'soft'},
  // Segunda fila
  { w: 84, h: 32, top: '17%', right: '8%', rotate: '-22deg', filled: false, tone: 'soft'},
  { w: 60, h: 24, top: '21%', left: '-6%', rotate: '40deg', filled: true, tone: 'softer'},
  { w: 110, h: 40, top: '24%', left: '30%', rotate: '14deg', filled: true, tone: 'soft'},
  // Tercera fila
  { w: 72, h: 28, top: '33%', left: '-8%', rotate: '-18deg', filled: false, tone: 'soft'},
  { w: 50, h: 20, top: '36%', right: '14%', rotate: '28deg', filled: true, tone: 'soft'},
  { w: 92, h: 34, top: '40%', right: '-10%', rotate: '-30deg', filled: true, tone: 'softer'},
  { w: 58, h: 24, top: '44%', left: '22%', rotate: '46deg', filled: true, tone: 'soft'},
  // Centro-bajo
  { w: 118, h: 44, top: '52%', left: '-12%', rotate: '22deg', filled: true, tone: 'soft'},
  { w: 64, h: 26, top: '56%', right: '6%', rotate: '-16deg', filled: false, tone: 'soft'},
  { w: 48, h: 20, top: '60%', left: '40%', rotate: '34deg', filled: true, tone: 'softer'},
  { w: 80, h: 30, top: '64%', right: '-6%', rotate: '18deg', filled: true, tone: 'soft'},
  // Cuarta fila
  { w: 100, h: 38, top: '70%', left: '-8%', rotate: '-24deg', filled: false, tone: 'soft'},
  { w: 56, h: 22, top: '74%', right: '20%', rotate: '40deg', filled: true, tone: 'soft'},
  { w: 72, h: 28, top: '78%', left: '28%', rotate: '-14deg', filled: true, tone: 'softer'},
  // Pie
  { w: 140, h: 52, bottom: '-2%', right: '-12%', rotate: '26deg', filled: true, tone: 'soft'},
  { w: 88, h: 34, bottom: '4%', left: '-10%', rotate: '-20deg', filled: false, tone: 'soft'},
  { w: 52, h: 22, bottom: '10%', right: '34%', rotate: '48deg', filled: true, tone: 'softer'},
  { w: 66, h: 26, bottom: '14%', left: '34%', rotate: '12deg', filled: true, tone: 'soft'},
];

function pillStyle(p: PillDef, soft: string, softer: string): ViewStyle {
  const color = p.tone === 'softer' ? softer : soft;
  return {
    position: 'absolute',
    width: p.w,
    height: p.h,
    borderRadius: p.h / 2,
    top: p.top,
    left: p.left,
    right: p.right,
    bottom: p.bottom,
    transform: [{ rotate: p.rotate }],
    ...(p.filled
      ? { backgroundColor: color }
      : { borderWidth: 2.5, borderColor: color, backgroundColor: 'transparent' }),
  };
}

type PillBackgroundProps = {
  /** Opacidad global del patrón (default 1). En light el verde funciona a 1;
   *  en dark bajamos la opacidad efectiva para que las píldoras se sientan
   *  como una textura, no como decoración chillona. */
  opacity?: number;
};

/**
 * Fondo decorativo con MUCHAS cápsulas (píldoras) dispersas — el motivo de
 * marca de Keriva. Detrás del contenido. Reacciona al modo: verde claro en
 * light, gris muy sutil (casi una textura) en dark.
 */
export default function PillBackground({ opacity = 1 }: PillBackgroundProps) {
  const { mode } = useColorMode();
  const isDark = mode === 'dark';
  const soft = isDark ? DARK_SOFT : LIGHT_SOFT;
  const softer = isDark ? DARK_SOFTER : LIGHT_SOFTER;
  // En dark reducimos opacidad efectiva para que el patrón no compita con el
  // contenido (queja del cliente: "queda muy chollona / pesada").
  const effectiveOpacity = isDark ? opacity * 0.6 : opacity;
  return (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { opacity: effectiveOpacity, overflow: 'hidden' }]}
    >
      {PILLS.map((p, i) => (
        <View key={i} pointerEvents="none" style={pillStyle(p, soft, softer)} />
      ))}
    </View>
  );
}
