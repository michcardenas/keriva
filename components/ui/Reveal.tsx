import { type ReactNode } from 'react';
import { type ViewStyle, type StyleProp } from 'react-native';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { theme } from '@/lib/theme';

type RevealProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Índice en una lista → escalona la entrada (cascada). */
  index?: number;
  /** Retraso base extra en ms. */
  delay?: number;
  /** 'up' (sube y aparece) o 'fade' (solo aparece). */
  variant?: 'up' | 'fade';
};

/**
 * Envuelve contenido con una entrada animada (aparece + sube ligeramente).
 * Pásale `index` dentro de un map para un efecto en cascada premium.
 *
 *   {items.map((it, i) => <Reveal key={it.id} index={i}>...</Reveal>)}
 */
export default function Reveal({ children, style, index = 0, delay = 0, variant = 'up' }: RevealProps) {
  const totalDelay = delay + index * theme.motion.stagger;
  const entering =
    variant === 'up'
      ? FadeInDown.delay(totalDelay).duration(theme.motion.duration.base).springify().damping(18)
      : FadeIn.delay(totalDelay).duration(theme.motion.duration.base);

  return (
    <Animated.View entering={entering} style={style}>
      {children}
    </Animated.View>
  );
}
