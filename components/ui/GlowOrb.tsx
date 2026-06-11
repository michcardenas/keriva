import { View, Platform, type ViewStyle } from 'react-native';

type GlowOrbProps = {
  color: string;
  size: number;
  top?: number;
  left?: number;
  right?: number;
  bottom?: number;
  opacity?: number;
};

/**
 * Orbe de luz difuminado para fondos glassmorphism. Pensado para colocarse
 * detrás de un <BlurView> a pantalla completa, que lo convierte en un brillo
 * suave. En web añade boxShadow del mismo color para reforzar el glow.
 */
export default function GlowOrb({
  color,
  size,
  top,
  left,
  right,
  bottom,
  opacity = 0.55,
}: GlowOrbProps) {
  const base: ViewStyle = {
    position: 'absolute',
    width: size,
    height: size,
    borderRadius: size / 2,
    backgroundColor: color,
    opacity,
    top,
    left,
    right,
    bottom,
  };

  const glow =
    Platform.OS === 'web'
      ? ({ boxShadow: `0px 0px ${size * 0.9}px ${size * 0.4}px ${color}` } as unknown as ViewStyle)
      : {
          shadowColor: color,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.9,
          shadowRadius: size * 0.5,
          elevation: 0,
        };

  return <View pointerEvents="none" style={[base, glow]} />;
}
