import { useEffect } from 'react';
import { View, Text, StyleSheet, Image, type ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
  withDelay,
} from 'react-native-reanimated';

type KerivaLoaderProps = {
  /** Texto opcional debajo del logo (default: "Cargando…") */
  label?: string | null;
  /** Tamaño del logo en px (default: 100) */
  size?: number;
  /** Si true, ocupa toda la pantalla con overlay de fondo (default: true) */
  fullscreen?: boolean;
  /** Color del fondo del overlay (default: verde oscuro brand) */
  backgroundColor?: string;
  /** Color del texto (default: verde acento brand) */
  textColor?: string;
  /** Estilo extra */
  style?: ViewStyle;
};

/**
 * Loader de marca Keriva — logo animado con pulse + halo expansivo.
 * Usado en pantallas con carga pesada (mapa con 839 farmacias, búsqueda,
 * detalle, etc.) para dar feedback visual consistente con la identidad.
 */
export default function KerivaLoader({
  label = 'Cargando…',
  size = 100,
  fullscreen = true,
  backgroundColor = '#052419',
  textColor = '#34C26A',
  style,
}: KerivaLoaderProps) {
  const scale = useSharedValue(1);
  const haloScale = useSharedValue(1);
  const haloOpacity = useSharedValue(0.6);

  useEffect(() => {
    // Pulse del logo: 1 → 1.08 → 1 en loop (2.4s)
    scale.value = withRepeat(
      withSequence(
        withTiming(1.08, { duration: 1200, easing: Easing.inOut(Easing.quad) }),
        withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      false,
    );

    // Halo: expande y se desvanece en 1.6s, se repite con delay
    haloScale.value = withRepeat(
      withSequence(
        withTiming(1.6, { duration: 1600, easing: Easing.out(Easing.quad) }),
        withTiming(1, { duration: 0 }),
      ),
      -1,
      false,
    );
    haloOpacity.value = withRepeat(
      withSequence(
        withTiming(0, { duration: 1600, easing: Easing.out(Easing.quad) }),
        withDelay(0, withTiming(0.6, { duration: 0 })),
      ),
      -1,
      false,
    );
  }, [scale, haloScale, haloOpacity]);

  const logoStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const haloStyle = useAnimatedStyle(() => ({
    transform: [{ scale: haloScale.value }],
    opacity: haloOpacity.value,
  }));

  const content = (
    <View style={styles.inner}>
      <View style={[styles.logoWrap, { width: size, height: size }]}>
        <Animated.View
          style={[
            styles.halo,
            haloStyle,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: textColor,
            },
          ]}
        />
        <Animated.View style={[logoStyle, styles.logoWrap, { width: size, height: size }]}>
          <Image
            source={require('@/assets/images/logo.png')}
            style={{ width: size, height: size }}
            resizeMode="contain"
          />
        </Animated.View>
      </View>
      {label && <Text style={[styles.label, { color: textColor }]}>{label}</Text>}
    </View>
  );

  if (!fullscreen) {
    return <View style={[styles.contained, style]}>{content}</View>;
  }

  return (
    <View style={[StyleSheet.absoluteFill, styles.overlay, { backgroundColor }, style]}>
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
  contained: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  inner: {
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
  },
  logoWrap: {
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  halo: {
    position: 'absolute',
    opacity: 0.6,
  },
  label: {
    fontFamily: 'DMSans-Medium',
    fontSize: 14,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
});
