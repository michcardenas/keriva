import { type ReactNode } from 'react';
import { View, StyleSheet, Platform, type ViewStyle, type StyleProp } from 'react-native';
import { BlurView } from 'expo-blur';
import { theme } from '@/lib/theme';

type GlassCardProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Intensidad del desenfoque (0-100). Default 30. */
  intensity?: number;
  /** 'light' (vidrio claro) o 'dark'. Default 'light'. */
  tint?: 'light' | 'dark' | 'default';
  /** Vidrio más opaco para contenedores principales. */
  strong?: boolean;
};

/**
 * Tarjeta de vidrio esmerilado (glassmorphism). Usa expo-blur para el
 * desenfoque del fondo + una capa translúcida y borde sutil. En web,
 * expo-blur aplica backdrop-filter; si el navegador no lo soporta, el
 * color translúcido de respaldo mantiene la legibilidad.
 */
export default function GlassCard({
  children,
  style,
  intensity = 30,
  tint = 'light',
  strong = false,
}: GlassCardProps) {
  const overlay = {
    backgroundColor: strong ? theme.colors.glassStrong : theme.colors.glass,
    borderColor: strong ? theme.colors.glassBorderStrong : theme.colors.glassBorder,
  };

  // En web, BlurView puede no aplicar blur fiable en algunos navegadores;
  // backdrop-filter se añade explícitamente para reforzarlo.
  const webBackdrop =
    Platform.OS === 'web'
      ? ({ backdropFilter: `blur(${intensity / 2}px)`, WebkitBackdropFilter: `blur(${intensity / 2}px)` } as unknown as ViewStyle)
      : null;

  return (
    <View style={[styles.wrapper, style]}>
      <BlurView intensity={intensity} tint={tint} style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, styles.overlay, overlay, webBackdrop]} />
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: theme.radius.xl,
    overflow: 'hidden',
  },
  overlay: {
    borderRadius: theme.radius.xl,
    borderWidth: 1,
  },
  content: {
    position: 'relative',
  },
});
