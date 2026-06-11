import { View, StyleSheet, type ViewStyle, type DimensionValue } from 'react-native';
import { theme } from '@/lib/theme';

type PillDef = {
  w: number;
  h: number;
  top?: DimensionValue;
  left?: DimensionValue;
  right?: DimensionValue;
  bottom?: DimensionValue;
  rotate: string;
  filled?: boolean;
  color?: string;
};

const SOFT = theme.colors.accentSoft; //  #DCFCE7
const SOFTER = theme.colors.accentSofter; //  #F0FDF4

// Distribución densa de cápsulas por toda la pantalla (posiciones en %).
const PILLS: PillDef[] = [
  // Fila superior
  { w: 130, h: 48, top: '-1%', left: '-12%', rotate: '-28deg', filled: true, color: SOFT },
  { w: 70, h: 28, top: '3%', left: '42%', rotate: '20deg', filled: false, color: SOFT },
  { w: 96, h: 36, top: '6%', right: '-8%', rotate: '34deg', filled: true, color: SOFTER },
  { w: 54, h: 22, top: '11%', left: '14%', rotate: '-12deg', filled: true, color: SOFT },
  // Segunda fila
  { w: 84, h: 32, top: '17%', right: '8%', rotate: '-22deg', filled: false, color: SOFT },
  { w: 60, h: 24, top: '21%', left: '-6%', rotate: '40deg', filled: true, color: SOFTER },
  { w: 110, h: 40, top: '24%', left: '30%', rotate: '14deg', filled: true, color: SOFT },
  // Tercera fila
  { w: 72, h: 28, top: '33%', left: '-8%', rotate: '-18deg', filled: false, color: SOFT },
  { w: 50, h: 20, top: '36%', right: '14%', rotate: '28deg', filled: true, color: SOFT },
  { w: 92, h: 34, top: '40%', right: '-10%', rotate: '-30deg', filled: true, color: SOFTER },
  { w: 58, h: 24, top: '44%', left: '22%', rotate: '46deg', filled: true, color: SOFT },
  // Centro-bajo
  { w: 118, h: 44, top: '52%', left: '-12%', rotate: '22deg', filled: true, color: SOFT },
  { w: 64, h: 26, top: '56%', right: '6%', rotate: '-16deg', filled: false, color: SOFT },
  { w: 48, h: 20, top: '60%', left: '40%', rotate: '34deg', filled: true, color: SOFTER },
  { w: 80, h: 30, top: '64%', right: '-6%', rotate: '18deg', filled: true, color: SOFT },
  // Cuarta fila
  { w: 100, h: 38, top: '70%', left: '-8%', rotate: '-24deg', filled: false, color: SOFT },
  { w: 56, h: 22, top: '74%', right: '20%', rotate: '40deg', filled: true, color: SOFT },
  { w: 72, h: 28, top: '78%', left: '28%', rotate: '-14deg', filled: true, color: SOFTER },
  // Pie
  { w: 140, h: 52, bottom: '-2%', right: '-12%', rotate: '26deg', filled: true, color: SOFT },
  { w: 88, h: 34, bottom: '4%', left: '-10%', rotate: '-20deg', filled: false, color: SOFT },
  { w: 52, h: 22, bottom: '10%', right: '34%', rotate: '48deg', filled: true, color: SOFTER },
  { w: 66, h: 26, bottom: '14%', left: '34%', rotate: '12deg', filled: true, color: SOFT },
];

function pillStyle(p: PillDef): ViewStyle {
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
      ? { backgroundColor: p.color ?? SOFT }
      : { borderWidth: 2.5, borderColor: p.color ?? SOFT, backgroundColor: 'transparent' }),
  };
}

type PillBackgroundProps = {
  /** Opacidad global del patrón (default 1). */
  opacity?: number;
};

/**
 * Fondo decorativo con MUCHAS cápsulas (píldoras) dispersas — el motivo de
 * marca de Keriva. Detrás del contenido en pantallas claras, para que el fondo
 * tenga vida sin estorbar la lectura. No interfiere con los toques.
 */
export default function PillBackground({ opacity = 1 }: PillBackgroundProps) {
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity, overflow: 'hidden' }]}>
      {PILLS.map((p, i) => (
        <View key={i} pointerEvents="none" style={pillStyle(p)} />
      ))}
    </View>
  );
}
