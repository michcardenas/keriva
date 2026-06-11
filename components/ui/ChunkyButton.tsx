import { type ReactNode } from 'react';
import { Pressable, View, Text, StyleSheet, type ViewStyle, type StyleProp } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { theme } from '@/lib/theme';

type ChunkyButtonProps = {
  label: string;
  onPress?: () => void;
  /** Color de la cara del botón. */
  color?: string;
  /** Color del borde 3D inferior (más oscuro). */
  edgeColor?: string;
  /** Color del texto. */
  textColor?: string;
  /** Ícono opcional a la derecha del texto. */
  icon?: ReactNode;
  /** Grosor del borde 3D (default 5). */
  depth?: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * Botón "gordito" con efecto 3D (estilo Duolingo): tiene un borde inferior más
 * oscuro que lo hace ver tridimensional, y al presionarlo se hunde — feedback
 * táctil y divertido. La cara se desliza hacia abajo cubriendo el borde.
 */
export default function ChunkyButton({
  label,
  onPress,
  color = theme.colors.funGreen,
  edgeColor = theme.colors.funGreenEdge,
  textColor = theme.colors.white,
  icon,
  depth = 5,
  style,
}: ChunkyButtonProps) {
  const translateY = useSharedValue(0);

  const faceStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => {
        translateY.value = withTiming(depth, { duration: 60 });
      }}
      onPressOut={() => {
        translateY.value = withTiming(0, { duration: 90 });
      }}
      style={[style]}
    >
      <View style={[styles.base, { backgroundColor: edgeColor, paddingBottom: depth, borderRadius: theme.radius.lg }]}>
        <Animated.View
          style={[
            styles.face,
            { backgroundColor: color, borderRadius: theme.radius.lg },
            faceStyle,
          ]}
        >
          <Text style={[styles.label, { color: textColor }]}>{label}</Text>
          {icon}
        </Animated.View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    width: '100%',
  },
  face: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    height: 56,
    paddingHorizontal: theme.spacing.xl,
  },
  label: {
    fontFamily: theme.font.bold,
    fontSize: 16,
    letterSpacing: 0.3,
  },
});
