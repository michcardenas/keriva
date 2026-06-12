import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Pill, Clock, ChevronRight, Users, Check, X } from 'lucide-react-native';
import { useAuth } from '@/lib/AuthContext';
import AuthRequiredPlaceholder from '@/components/AuthRequiredPlaceholder';
import PillBackground from '@/components/ui/PillBackground';
import PressableScale from '@/components/ui/PressableScale';
import Reveal from '@/components/ui/Reveal';
import { useTheme } from '@/lib/ThemeContext';
import type { Theme } from '@/lib/theme';
import { listFamilia, type FamiliaDashboardRow } from '@/lib/api/familia';
import { listMedicamentosByPerfil } from '@/lib/api/care';
import { computeUpcomingDoses, type ScheduleableMed } from '@/lib/notifications';
import {
  registrarAdherencia, getAdherenciaRango, adherenciaKey,
  type AdherenciaAccion,
} from '@/lib/api/adherencia';

// =====================================================================
// Mis recordatorios de hoy (R5)
// =====================================================================
// Aplana las próximas tomas de TODOS los miembros de la familia para HOY
// y las ordena cronológicamente. La fuente del cálculo es la misma que la
// que programa las notificaciones (computeUpcomingDoses).
// =====================================================================

const TZ_RD = 'America/Santo_Domingo';

type Dose = {
  id: string;            // únique por med+timestamp
  when: Date;
  perfilId: string;
  perfilNombre: string;
  perfilEmoji: string;
  medNombre: string;
  medId: string;
};

/** "2026-06-11" en zona RD. */
function ymdRD(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ_RD, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(d);
}

function horaRD(d: Date): string {
  return new Intl.DateTimeFormat('es-DO', {
    timeZone: TZ_RD, hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(d);
}

export default function RecordatoriosHoyScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [loading, setLoading] = useState(true);
  const [doses, setDoses] = useState<Dose[]>([]);
  const [perfilesCount, setPerfilesCount] = useState(0);
  // R6: mapa keyAdherencia → 'tomado' | 'saltado' | 'pospuesto' para las tomas
  // que el usuario ya marcó hoy. Se actualiza optimistamente al tocar.
  const [adherencias, setAdherencias] = useState<Record<string, AdherenciaAccion>>({});
  const [marking, setMarking] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const familia: FamiliaDashboardRow[] = await listFamilia();
      setPerfilesCount(familia.length);
      const now = new Date();
      const todayKey = ymdRD(now);

      const all: Dose[] = [];
      // Por cada perfil, carga sus medicamentos activos y calcula las tomas
      // que caen DENTRO de hoy (en zona RD).
      await Promise.all(
        familia.map(async (p) => {
          const meds = await listMedicamentosByPerfil(p.id);
          for (const med of meds.filter((m) => m.activo)) {
            const scheduleable: ScheduleableMed = {
              id: med.id,
              perfilId: med.perfilId,
              nombreDisplay: med.nombreDisplay,
              frecuenciaTipo: med.frecuenciaTipo,
              frecuenciaValor: med.frecuenciaValor,
              horasToma: med.horasToma,
              diasSemana: med.diasSemana,
            };
            const upcoming = computeUpcomingDoses(scheduleable, 1, now);
            for (const when of upcoming) {
              if (ymdRD(when) !== todayKey) continue;
              all.push({
                id: `${med.id}:${when.toISOString()}`,
                when,
                perfilId: p.id,
                perfilNombre: p.nombre ?? '',
                perfilEmoji: p.avatarEmoji ?? '👤',
                medNombre: med.nombreDisplay,
                medId: med.id,
              });
            }
          }
        }),
      );
      all.sort((a, b) => a.when.getTime() - b.when.getTime());
      setDoses(all);

      // R6: trae los registros de adherencia ya guardados para HOY.
      const perfilIds = familia.map((p) => p.id);
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);
      const records = await getAdherenciaRango(
        perfilIds,
        startOfDay.toISOString(),
        endOfDay.toISOString(),
      );
      const map: Record<string, AdherenciaAccion> = {};
      for (const r of records) map[adherenciaKey(r.medicamentoId, r.scheduledAt)] = r.accion;
      setAdherencias(map);
    } finally {
      setLoading(false);
    }
  }, []);

  async function handleMarcar(dose: Dose, accion: AdherenciaAccion) {
    const key = adherenciaKey(dose.medId, dose.when.toISOString());
    setMarking(dose.id);
    // Optimista
    setAdherencias((prev) => ({ ...prev, [key]: accion }));
    const res = await registrarAdherencia(dose.medId, dose.when, accion);
    if (!res.ok) {
      // rollback
      setAdherencias((prev) => {
        const copy = { ...prev };
        delete copy[key];
        return copy;
      });
    }
    setMarking(null);
  }

  useEffect(() => { load(); }, [load]);

  // Agrupa por perfil para tarjetas-resumen del header
  const porPerfil = useMemo(() => {
    const map = new Map<string, { nombre: string; emoji: string; total: number }>();
    for (const d of doses) {
      const cur = map.get(d.perfilId) ?? { nombre: d.perfilNombre, emoji: d.perfilEmoji, total: 0 };
      cur.total += 1;
      map.set(d.perfilId, cur);
    }
    return [...map.values()];
  }, [doses]);

  if (!session) {
    return (
      <AuthRequiredPlaceholder
        icon={<Clock size={56} color={theme.colors.accent} />}
        title="Inicia sesión"
        description="Tus recordatorios de medicamentos viven en tu cuenta."
      />
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <PillBackground />
      <View style={styles.topBar}>
        <PressableScale onPress={() => router.back()} style={styles.iconBtn} scaleTo={0.9}>
          <ArrowLeft size={22} color={theme.colors.textPrimary} />
        </PressableScale>
        <Text style={styles.headerTitle}>Recordatorios de hoy</Text>
        <View style={styles.iconBtn} />
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={theme.colors.accent} /></View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: theme.spacing.xl, paddingBottom: insets.bottom + 40 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Resumen rápido */}
          <Reveal variant="up" delay={40}>
            <View style={styles.summaryCard}>
              <View style={styles.summaryIcon}>
                <Clock size={28} color={theme.colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.summaryLabel}>Tomas programadas hoy</Text>
                <Text style={styles.summaryValue}>{doses.length}</Text>
                {perfilesCount > 0 && (
                  <Text style={styles.summarySub}>
                    para {perfilesCount} miembro{perfilesCount === 1 ? '' : 's'} de la familia
                  </Text>
                )}
              </View>
            </View>
          </Reveal>

          {/* Mini-chips por miembro */}
          {porPerfil.length > 0 && (
            <Reveal variant="up" delay={80}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipsRow}
              >
                {porPerfil.map((p, i) => (
                  <View key={i} style={styles.chip}>
                    <Text style={styles.chipEmoji}>{p.emoji}</Text>
                    <View>
                      <Text style={styles.chipName} numberOfLines={1}>{p.nombre || 'Perfil'}</Text>
                      <Text style={styles.chipCount}>
                        {p.total} toma{p.total === 1 ? '' : 's'}
                      </Text>
                    </View>
                  </View>
                ))}
              </ScrollView>
            </Reveal>
          )}

          {doses.length === 0 ? (
            <View style={styles.emptyBox}>
              <Pill size={42} color={theme.colors.textMuted} />
              <Text style={styles.emptyTitle}>Sin recordatorios para hoy</Text>
              <Text style={styles.emptyText}>
                Cuando agregues medicamentos en Mi familia aparecerán aquí, ordenados por hora.
              </Text>
              <PressableScale
                style={styles.emptyBtn}
                onPress={() => router.push('/familia' as any)}
              >
                <Users size={16} color={theme.colors.accentText} />
                <Text style={styles.emptyBtnText}>Ir a Mi familia</Text>
              </PressableScale>
            </View>
          ) : (
            <View style={{ marginTop: theme.spacing.lg }}>
              {doses.map((d, i) => {
                const isPast = d.when.getTime() < Date.now();
                const key = adherenciaKey(d.medId, d.when.toISOString());
                const estado = adherencias[key];
                const isMarking = marking === d.id;
                return (
                  <Reveal key={d.id} index={i} delay={100}>
                    <View style={[
                      styles.doseCard,
                      isPast && !estado && styles.doseCardPast,
                      estado === 'tomado' && styles.doseCardTomado,
                      estado === 'saltado' && styles.doseCardSaltado,
                    ]}>
                      <View style={styles.doseHourBox}>
                        <Text style={styles.doseHour}>{horaRD(d.when)}</Text>
                        <Text style={styles.doseHourSub}>{isPast ? 'pasó' : 'hoy'}</Text>
                      </View>
                      <View style={styles.doseBody}>
                        <Text style={styles.doseMed} numberOfLines={1}>{d.medNombre}</Text>
                        <View style={styles.doseRow}>
                          <Text style={styles.doseEmoji}>{d.perfilEmoji}</Text>
                          <Text style={styles.doseFor} numberOfLines={1}>
                            Para {d.perfilNombre || 'el perfil'}
                          </Text>
                        </View>
                        {/* R6 — Botones de adherencia */}
                        {estado ? (
                          <View style={styles.adherenciaStateRow}>
                            <Text style={[
                              styles.adherenciaStateTag,
                              estado === 'tomado' ? styles.tagTomado : styles.tagSaltado,
                            ]}>
                              {estado === 'tomado' ? '✓ Tomado' : '× Saltado'}
                            </Text>
                            <PressableScale
                              style={styles.adherenciaUndo}
                              onPress={() => handleMarcar(d, estado === 'tomado' ? 'saltado' : 'tomado')}
                              disabled={isMarking}
                            >
                              <Text style={styles.adherenciaUndoText}>Cambiar</Text>
                            </PressableScale>
                          </View>
                        ) : (
                          <View style={styles.adherenciaBtnRow}>
                            <PressableScale
                              style={styles.adherenciaBtnTomado}
                              onPress={() => handleMarcar(d, 'tomado')}
                              disabled={isMarking}
                            >
                              <Check size={14} color={theme.colors.accentText} />
                              <Text style={styles.adherenciaBtnTextLight}>Tomé</Text>
                            </PressableScale>
                            <PressableScale
                              style={styles.adherenciaBtnSaltado}
                              onPress={() => handleMarcar(d, 'saltado')}
                              disabled={isMarking}
                            >
                              <X size={14} color={theme.colors.danger} />
                              <Text style={styles.adherenciaBtnTextDanger}>Salté</Text>
                            </PressableScale>
                          </View>
                        )}
                      </View>
                    </View>
                  </Reveal>
                );
              })}
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const makeStyles = (theme: Theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  center: { padding: theme.spacing.huge, alignItems: 'center' },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
  },
  iconBtn: {
    width: 44, height: 44, borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surface,
    borderWidth: 1, borderColor: theme.colors.border,
    alignItems: 'center', justifyContent: 'center',
    ...theme.shadow.sm,
  },
  headerTitle: { ...theme.text.h3, color: theme.colors.textPrimary },

  summaryCard: {
    flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    marginTop: theme.spacing.lg,
    ...theme.shadow.card,
  },
  summaryIcon: {
    width: 56, height: 56, borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.accentSofter,
    alignItems: 'center', justifyContent: 'center',
  },
  summaryLabel: { ...theme.text.caption, color: theme.colors.textSecondary },
  summaryValue: { fontFamily: theme.font.bold, fontSize: 32, color: theme.colors.textPrimary, lineHeight: 36 },
  summarySub: { ...theme.text.caption, color: theme.colors.textSecondary, marginTop: 2 },

  chipsRow: { gap: theme.spacing.sm, paddingVertical: theme.spacing.md, paddingRight: theme.spacing.lg },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surface,
    borderWidth: 1, borderColor: theme.colors.border,
  },
  chipEmoji: { fontSize: 22 },
  chipName: { fontFamily: theme.font.bodyBold, fontSize: 13, color: theme.colors.textPrimary, maxWidth: 110 },
  chipCount: { ...theme.text.caption, color: theme.colors.textSecondary },

  emptyBox: {
    alignItems: 'center', gap: theme.spacing.md,
    paddingVertical: theme.spacing.huge,
    paddingHorizontal: theme.spacing.lg,
  },
  emptyTitle: { ...theme.text.h3, color: theme.colors.textPrimary },
  emptyText: { ...theme.text.body, color: theme.colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  emptyBtn: {
    flexDirection: 'row', gap: theme.spacing.sm, alignItems: 'center',
    backgroundColor: theme.colors.accent,
    paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.pill,
    ...theme.shadow.accent,
  },
  emptyBtnText: { fontFamily: theme.font.bold, fontSize: 14, color: theme.colors.accentText },

  doseCard: {
    flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    ...theme.shadow.card,
  },
  doseCardPast: { opacity: 0.55 },
  doseHourBox: {
    width: 70, alignItems: 'center', justifyContent: 'center',
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.accentSofter,
    borderRadius: theme.radius.md,
  },
  doseHour: { fontFamily: theme.font.bold, fontSize: 18, color: theme.colors.accent },
  doseHourSub: { ...theme.text.caption, fontSize: 10, color: theme.colors.accent, opacity: 0.7, marginTop: 2 },
  doseBody: { flex: 1, gap: 2 },
  doseMed: { fontFamily: theme.font.bodyBold, fontSize: 15, color: theme.colors.textPrimary },
  doseRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  doseEmoji: { fontSize: 14 },
  doseFor: { ...theme.text.caption, color: theme.colors.textSecondary, flex: 1 },
  doseAction: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: theme.colors.accentSofter,
    alignItems: 'center', justifyContent: 'center',
  },

  // R6 — Adherencia
  doseCardTomado: { borderWidth: 1.5, borderColor: theme.colors.accent, backgroundColor: theme.colors.accentSofter },
  doseCardSaltado: { borderWidth: 1.5, borderColor: theme.colors.dangerSoft, backgroundColor: theme.colors.dangerSoft, opacity: 0.85 },
  adherenciaBtnRow: { flexDirection: 'row', gap: theme.spacing.sm, marginTop: theme.spacing.sm },
  adherenciaBtnTomado: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: theme.colors.accent,
    paddingHorizontal: theme.spacing.md, paddingVertical: 6,
    borderRadius: theme.radius.pill,
  },
  adherenciaBtnSaltado: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: theme.colors.dangerSoft,
    paddingHorizontal: theme.spacing.md, paddingVertical: 6,
    borderRadius: theme.radius.pill,
    borderWidth: 1, borderColor: theme.colors.danger,
  },
  adherenciaBtnTextLight: { fontFamily: theme.font.bodyBold, fontSize: 12, color: theme.colors.accentText },
  adherenciaBtnTextDanger: { fontFamily: theme.font.bodyBold, fontSize: 12, color: theme.colors.danger },
  adherenciaStateRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, marginTop: theme.spacing.sm },
  adherenciaStateTag: {
    fontFamily: theme.font.bodyBold, fontSize: 12,
    paddingHorizontal: theme.spacing.sm, paddingVertical: 4,
    borderRadius: theme.radius.pill,
  },
  tagTomado: { color: theme.colors.accent, backgroundColor: theme.colors.accentSoft },
  tagSaltado: { color: theme.colors.danger, backgroundColor: theme.colors.dangerSoft },
  adherenciaUndo: { paddingHorizontal: theme.spacing.sm, paddingVertical: 4 },
  adherenciaUndoText: { ...theme.text.caption, color: theme.colors.textSecondary, textDecorationLine: 'underline' },
});
