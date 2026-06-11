import { useState } from 'react';
import { View, Text, Pressable, StyleSheet, type ViewStyle } from 'react-native';
import { Star, StarHalf } from 'lucide-react-native';
import { theme } from '@/lib/theme';

// =====================================================================
// StarRating — estrellas reutilizables (Keriva Reviews).
//
// Dos modos:
//   · Display (default): muestra `value` (admite medias estrellas) +
//     opcionalmente el promedio y el conteo de reseñas.
//   · Input (onChange definido): estrellas tocables 1-5 para calificar.
//
// Color de estrella: theme.colors.gold. Sin DMSans-SemiBold.
// =====================================================================

type StarRatingProps = {
  /** Valor actual (0-5). En modo display admite decimales (medias estrellas). */
  value: number;
  /** Si se define, el componente es interactivo (input) y reporta 1-5. */
  onChange?: (value: number) => void;
  /** Tamaño de cada estrella en px. */
  size?: number;
  /** Total de reseñas — si se define (>0) se muestra "(N)" junto a las estrellas. */
  count?: number;
  /** Muestra el promedio numérico antes de las estrellas (ej. "4.5"). */
  showValue?: boolean;
  style?: ViewStyle;
};

const GOLD = theme.colors.gold;
const EMPTY = '#D8DDE3';

export default function StarRating({
  value,
  onChange,
  size = 16,
  count,
  showValue = false,
  style,
}: StarRatingProps) {
  const interactive = typeof onChange === 'function';
  const [hover, setHover] = useState<number | null>(null);

  // En modo input usamos el hover (si hay) o el valor; redondeado a entero.
  const shown = interactive ? (hover ?? value) : value;

  const stars = [1, 2, 3, 4, 5].map((i) => {
    // Relleno de cada posición: lleno / medio / vacío.
    const diff = shown - (i - 1);
    let kind: 'full' | 'half' | 'empty';
    if (diff >= 0.75) kind = 'full';
    else if (diff >= 0.25 && !interactive) kind = 'half';
    else kind = 'empty';

    const StarIcon = kind === 'half' ? StarHalf : Star;
    const filled = kind !== 'empty';

    const node = (
      <StarIcon
        size={size}
        color={filled ? GOLD : EMPTY}
        fill={filled ? GOLD : 'transparent'}
        strokeWidth={2}
      />
    );

    if (!interactive) {
      return <View key={i}>{node}</View>;
    }

    return (
      <Pressable
        key={i}
        onPress={() => onChange?.(i)}
        onHoverIn={() => setHover(i)}
        onHoverOut={() => setHover(null)}
        hitSlop={6}
        style={styles.tapStar}
        accessibilityRole="button"
        accessibilityLabel={`${i}`}
      >
        {node}
      </Pressable>
    );
  });

  return (
    <View style={[styles.row, style]}>
      {showValue && value > 0 && (
        <Text style={[styles.valueText, { fontSize: size - 2 }]}>{value.toFixed(1)}</Text>
      )}
      <View style={styles.stars}>{stars}</View>
      {typeof count === 'number' && count > 0 && (
        <Text style={[styles.countText, { fontSize: size - 4 }]}>({count})</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  stars: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  tapStar: {
    paddingHorizontal: 1,
  },
  valueText: {
    fontFamily: theme.font.bodyBold,
    color: theme.colors.textPrimary,
  },
  countText: {
    fontFamily: theme.font.body,
    color: theme.colors.textSecondary,
  },
});
