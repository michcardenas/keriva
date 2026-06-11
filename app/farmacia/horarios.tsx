import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, Switch, ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Clock } from 'lucide-react-native';
import { theme } from '@/lib/theme';
import PressableScale from '@/components/ui/PressableScale';
import PillBackground from '@/components/ui/PillBackground';
import { getSucursales, updateHorariosSucursal } from '@/lib/api/sucursales';
import { useAuth } from '@/lib/AuthContext';
import { DIAS_SEMANA, DIA_LABEL, type DiaSemana, type Horarios } from '@/lib/horarios';

// =====================================================================
// Editor de horarios estructurados por sucursal (U2)
// =====================================================================
// El cliente puede setear, por cada día (lun..dom), si la sucursal abre y en
// qué rango HH:MM. Esto alimenta el filtro "Abierta ahora" y el badge verde
// en la pantalla del medicamento.
// =====================================================================

type DayState = { abierto: boolean; open: string; close: string };

function emptyDay(): DayState {
  return { abierto: false, open: '08:00', close: '20:00' };
}

function horariosToState(h: Horarios | null): Record<DiaSemana, DayState> {
  const out = {} as Record<DiaSemana, DayState>;
  for (const d of DIAS_SEMANA) {
    const r = h?.[d];
    if (Array.isArray(r) && r.length === 2) {
      out[d] = { abierto: true, open: r[0], close: r[1] };
    } else {
      out[d] = emptyDay();
    }
  }
  return out;
}

function stateToHorarios(s: Record<DiaSemana, DayState>): Horarios {
  const out: Horarios = {};
  for (const d of DIAS_SEMANA) {
    out[d] = s[d].abierto ? [s[d].open, s[d].close] : null;
  }
  return out;
}

function isValidHora(h: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(h);
}

export default function HorariosScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { perfil } = useAuth();
  const params = useLocalSearchParams<{ sucursalId?: string; nombre?: string }>();
  const sucursalId = typeof params.sucursalId === 'string' ? params.sucursalId : null;
  const nombre = typeof params.nombre === 'string' ? params.nombre : 'Sucursal';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [state, setState] = useState<Record<DiaSemana, DayState>>(() => horariosToState(null));

  useEffect(() => {
    (async () => {
      const farmaciaId = perfil?.farmaciaId;
      if (!farmaciaId || !sucursalId) { setLoading(false); return; }
      const sucs = await getSucursales(farmaciaId);
      const s = sucs.find((x) => x.id === sucursalId);
      setState(horariosToState(s?.horarios ?? null));
      setLoading(false);
    })();
  }, [perfil?.farmaciaId, sucursalId]);

  function setDay(d: DiaSemana, patch: Partial<DayState>) {
    setState((prev) => ({ ...prev, [d]: { ...prev[d], ...patch } }));
  }

  function copiarLunesATodos() {
    const ref = state.lun;
    const next = {} as Record<DiaSemana, DayState>;
    for (const d of DIAS_SEMANA) next[d] = { ...ref };
    setState(next);
  }

  async function handleSave() {
    setError(null);
    if (!sucursalId) return;
    // Validar HH:MM y que open < close en cada día abierto
    for (const d of DIAS_SEMANA) {
      const s = state[d];
      if (!s.abierto) continue;
      if (!isValidHora(s.open) || !isValidHora(s.close)) {
        setError(`Formato inválido en ${DIA_LABEL[d]}. Usa HH:MM (ej. 08:00).`);
        return;
      }
      if (s.open >= s.close) {
        setError(`En ${DIA_LABEL[d]} la hora de cierre debe ser mayor que la de apertura.`);
        return;
      }
    }
    setSaving(true);
    const res = await updateHorariosSucursal(sucursalId, stateToHorarios(state));
    setSaving(false);
    if (!res.ok) { setError(res.error ?? 'No se pudo guardar.'); return; }
    setToast('Horarios guardados');
    setTimeout(() => setToast(null), 1800);
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <PillBackground opacity={0.55} />
      <View style={styles.header}>
        <PressableScale onPress={() => router.back()} style={styles.iconBtn}>
          <ArrowLeft size={22} color={theme.colors.textPrimary} />
        </PressableScale>
        <Text style={styles.headerTitle} numberOfLines={1}>Horarios · {nombre}</Text>
        <View style={styles.iconBtn} />
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={theme.colors.accent} /></View>
      ) : !sucursalId ? (
        <View style={styles.center}><Text style={styles.muted}>Sucursal no encontrada.</Text></View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: insets.bottom + 100 }}>
          <View style={styles.tipCard}>
            <Clock size={18} color={theme.colors.accent} />
            <Text style={styles.tipText}>
              Estos horarios habilitan el filtro <Text style={styles.tipStrong}>"Abierta ahora"</Text> en la búsqueda del usuario.
            </Text>
          </View>

          <PressableScale onPress={copiarLunesATodos} style={styles.copyBtn}>
            <Text style={styles.copyBtnText}>Copiar lunes a todos los días</Text>
          </PressableScale>

          {DIAS_SEMANA.map((d) => {
            const s = state[d];
            return (
              <View key={d} style={styles.dayCard}>
                <View style={styles.dayHeader}>
                  <Text style={styles.dayLabel}>{DIA_LABEL[d]}</Text>
                  <Switch
                    value={s.abierto}
                    onValueChange={(v) => setDay(d, { abierto: v })}
                    trackColor={{ true: theme.colors.accentSoft, false: theme.colors.border }}
                    thumbColor={s.abierto ? theme.colors.accent : '#f4f3f4'}
                  />
                </View>
                {s.abierto ? (
                  <View style={styles.dayInputs}>
                    <View style={styles.inputBox}>
                      <Text style={styles.inputLabel}>Abre</Text>
                      <TextInput
                        style={styles.input}
                        value={s.open}
                        onChangeText={(t) => setDay(d, { open: t })}
                        placeholder="08:00"
                        maxLength={5}
                      />
                    </View>
                    <View style={styles.inputBox}>
                      <Text style={styles.inputLabel}>Cierra</Text>
                      <TextInput
                        style={styles.input}
                        value={s.close}
                        onChangeText={(t) => setDay(d, { close: t })}
                        placeholder="20:00"
                        maxLength={5}
                      />
                    </View>
                  </View>
                ) : (
                  <Text style={styles.cerradoText}>Cerrada este día</Text>
                )}
              </View>
            );
          })}

          {error && <Text style={styles.errorText}>{error}</Text>}

          <PressableScale onPress={handleSave} style={[styles.saveBtn, saving && { opacity: 0.6 }]}>
            <Text style={styles.saveBtnText}>{saving ? 'Guardando…' : 'Guardar horarios'}</Text>
          </PressableScale>
        </ScrollView>
      )}

      {toast && (
        <View style={[styles.toast, { bottom: insets.bottom + 24 }]}>
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { ...theme.text.h3, color: theme.colors.textPrimary, flex: 1, textAlign: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  muted: { ...theme.text.body, color: theme.colors.textSecondary, textAlign: 'center' },

  tipCard: {
    flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm,
    backgroundColor: theme.colors.accentSofter, padding: theme.spacing.md,
    borderRadius: theme.radius.md, marginBottom: theme.spacing.md,
  },
  tipText: { ...theme.text.caption, color: theme.colors.textPrimary, flex: 1, lineHeight: 17 },
  tipStrong: { fontFamily: theme.font.bodyBold, color: theme.colors.accent },

  copyBtn: {
    alignItems: 'center', paddingVertical: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  copyBtnText: {
    ...theme.text.bodyMedium, fontSize: 13, color: theme.colors.accent,
    textDecorationLine: 'underline',
  },

  dayCard: {
    backgroundColor: theme.colors.surface, borderRadius: theme.radius.md,
    padding: theme.spacing.md, marginBottom: theme.spacing.sm,
    borderWidth: 1, borderColor: theme.colors.border,
  },
  dayHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dayLabel: { ...theme.text.title, color: theme.colors.textPrimary },
  dayInputs: { flexDirection: 'row', gap: theme.spacing.md, marginTop: theme.spacing.sm },
  inputBox: { flex: 1, gap: 4 },
  inputLabel: { ...theme.text.caption, color: theme.colors.textSecondary },
  input: {
    backgroundColor: theme.colors.bgSecondary, borderRadius: theme.radius.sm,
    paddingHorizontal: theme.spacing.md, height: 44,
    fontFamily: theme.font.body, fontSize: 14, color: theme.colors.textPrimary,
    borderWidth: 1, borderColor: theme.colors.border,
  },
  cerradoText: {
    ...theme.text.caption, color: theme.colors.textMuted,
    fontStyle: 'italic', marginTop: theme.spacing.xs,
  },

  errorText: {
    ...theme.text.caption, color: theme.colors.danger,
    textAlign: 'center', marginTop: theme.spacing.md,
  },
  saveBtn: {
    backgroundColor: theme.colors.accent, borderRadius: theme.radius.pill,
    paddingVertical: theme.spacing.md, alignItems: 'center',
    marginTop: theme.spacing.lg, ...theme.shadow.accent,
  },
  saveBtnText: { ...theme.text.button, color: theme.colors.accentText },

  toast: {
    position: 'absolute', alignSelf: 'center',
    backgroundColor: theme.colors.textPrimary,
    paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.pill, ...theme.shadow.md,
  },
  toastText: { ...theme.text.bodyMedium, color: theme.colors.white },
});
