import { View, StyleSheet } from 'react-native';
import { Calendar } from 'lucide-react-native';
import { theme } from '@/lib/theme';

// =====================================================================
// DateField (web) — Bug 02 · tema claro
// =====================================================================
// En web usamos el <input type="date"> nativo del navegador: muestra el
// calendario del SO, formatea según el locale (DD/MM/AAAA en RD) y su `value`
// siempre es ISO (YYYY-MM-DD). El usuario nunca escribe el formato a mano.
// =====================================================================

export type DateFieldProps = {
  /** Fecha en formato ISO (YYYY-MM-DD) o null si no hay valor. */
  value: string | null;
  onChange: (iso: string | null) => void;
  minimumDate?: Date;
  maximumDate?: Date;
  placeholder?: string;
};

function toISO(d?: Date): string | undefined {
  if (!d) return undefined;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function DateField({
  value,
  onChange,
  minimumDate,
  maximumDate,
}: DateFieldProps) {
  return (
    <View style={styles.wrapper}>
      <Calendar size={18} color={theme.colors.accent} />
      <input
        type="date"
        value={value ?? ''}
        min={toISO(minimumDate)}
        max={toISO(maximumDate)}
        onChange={(e) => onChange(e.target.value || null)}
        style={{
          flex: 1,
          width: '100%',
          background: 'transparent',
          border: 'none',
          outline: 'none',
          color: theme.colors.textPrimary,
          fontFamily: 'DMSans-Regular',
          fontSize: 15,
          // Calendario/ícono del navegador en esquema claro.
          colorScheme: 'light',
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.lg,
    height: 56,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
  },
});
