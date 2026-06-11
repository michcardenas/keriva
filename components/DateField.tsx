import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Calendar } from 'lucide-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { theme } from '@/lib/theme';

// =====================================================================
// DateField (native) — Bug 02 · tema claro
// =====================================================================
// En Android/iOS abrimos el calendario nativo del sistema. El usuario nunca
// ve ni escribe el formato: se guarda en ISO (YYYY-MM-DD) y se muestra como
// DD/MM/AAAA (estándar RD). Reemplaza el TextInput de texto libre.
// =====================================================================

export type DateFieldProps = {
  /** Fecha en formato ISO (YYYY-MM-DD) o null si no hay valor. */
  value: string | null;
  onChange: (iso: string | null) => void;
  minimumDate?: Date;
  maximumDate?: Date;
  placeholder?: string;
};

function formatDisplay(iso: string | null): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return '';
  return `${d}/${m}/${y}`;
}

function toISO(d: Date): string {
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
  placeholder,
}: DateFieldProps) {
  const [show, setShow] = useState(false);
  // Default razonable cuando aún no hay fecha (no afecta el valor guardado).
  const current = value ? new Date(`${value}T00:00:00`) : new Date(2015, 0, 1);

  return (
    <>
      <TouchableOpacity
        style={styles.wrapper}
        onPress={() => setShow(true)}
        activeOpacity={0.7}
      >
        <Calendar size={18} color={theme.colors.accent} />
        <Text style={[styles.text, !value && styles.placeholder]}>
          {value ? formatDisplay(value) : placeholder ?? 'Seleccionar fecha'}
        </Text>
      </TouchableOpacity>

      {show && (
        <DateTimePicker
          value={current}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          minimumDate={minimumDate}
          maximumDate={maximumDate}
          onChange={(event, date) => {
            setShow(false);
            if (event.type === 'set' && date) {
              onChange(toISO(date));
            }
          }}
        />
      )}
    </>
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
  text: {
    flex: 1,
    fontFamily: theme.font.body,
    fontSize: 15,
    color: theme.colors.textPrimary,
  },
  placeholder: {
    color: theme.colors.textMuted,
  },
});
