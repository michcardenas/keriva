import { type ReactNode } from 'react';
import { Pressable, type PressableProps, type ViewStyle, type StyleProp } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { theme } from '@/lib/theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type PressableScaleProps = PressableProps & {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Escala al presionar (default: 0.96). Usa 0.92 para botones pequeños. */
  scaleTo?: number;
};

/**
 * Botón/tarjeta con micro-animación de pulsación (resorte). Reemplaza a
 * TouchableOpacity para dar un feedback más premium y consistente en toda la app.
 */
export default function PressableScale({
  children,
  style,
  scaleTo = theme.motion.scale.pressIn,
  onPressIn,
  onPressOut,
  ...rest
}: PressableScaleProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      {...rest}
      style={[style, animatedStyle]}
      onPressIn={(e) => {
        scale.value = withSpring(scaleTo, theme.motion.spring);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.value = withSpring(1, theme.motion.spring);
        onPressOut?.(e);
      }}
    >
      {children}
    </AnimatedPressable>
  );
}
