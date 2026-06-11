import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
  Modal,
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import {
  ArrowLeft,
  Plus,
  Pill,
  Trash2,
  Clock,
  Search,
  X,
  ShieldCheck,
  Lock,
} from 'lucide-react-native';
import { useAuth } from '@/lib/AuthContext';
import AuthRequiredPlaceholder from '@/components/AuthRequiredPlaceholder';
import DisclaimerModal from '@/components/DisclaimerModal';
import { getPerfilFamilia, type KerivaPerfil } from '@/lib/api/familia';
import {
  addMedicamento,
  listMedicamentosByPerfil,
  softDeleteMedicamento,
  FRECUENCIA_OPTIONS,
  type CareMedicamentoWithProducto,
  type FrecuenciaTipo,
} from '@/lib/api/care';
import {
  listProductosPediatricos,
  type ProductoPediatrico,
} from '@/lib/api/dosis';
import { hasActiveDisclaimer } from '@/lib/api/disclaimer';
import { useLanguage } from '@/lib/LanguageContext';
import { theme } from '@/lib/theme';
import PressableScale from '@/components/ui/PressableScale';
import Reveal from '@/components/ui/Reveal';
import KeyboardAwareScreen from '@/components/ui/KeyboardAwareScreen';
import PillBackground from '@/components/ui/PillBackground';

function webConfirm(message: string): boolean {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return window.confirm(message);
  }
  return true;
}

export default function MedicamentosScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const { session } = useAuth();

  // Etiquetas de frecuencia traducidas (los helpers de care.ts son data-layer
  // y no pueden usar el hook de idioma, así que se resuelven aquí).
  const freqOptLabel = (key: FrecuenciaTipo) =>
    key === 'diaria'
      ? t.familia.freqDaily
      : key === 'horas'
      ? t.familia.freqHoursOpt
      : t.familia.freqWeekly;
  const freqText = (tipo: FrecuenciaTipo, valor: number | null) => {
    if (tipo === 'diaria') {
      return !valor || valor === 1
        ? t.familia.freqOncePerDay
        : t.familia.freqTimesPerDay.replace('{n}', String(valor));
    }
    if (tipo === 'horas') {
      return t.familia.freqEveryHours.replace('{n}', String(valor ?? '?'));
    }
    if (tipo === 'semanal') {
      return !valor || valor === 1
        ? t.familia.freqOncePerWeek
        : t.familia.freqTimesPerWeek.replace('{n}', String(valor));
    }
    return '';
  };
  const params = useLocalSearchParams<{ perfilId?: string }>();
  const perfilId = typeof params.perfilId === 'string' ? params.perfilId : undefined;

  const [perfil, setPerfil] = useState<KerivaPerfil | null>(null);
  const [meds, setMeds] = useState<CareMedicamentoWithProducto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add medication modal
  const [addOpen, setAddOpen] = useState(false);
  const [productos, setProductos] = useState<ProductoPediatrico[]>([]);
  const [searchText, setSearchText] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [valorFocused, setValorFocused] = useState(false);
  const [selectedProd, setSelectedProd] = useState<ProductoPediatrico | null>(null);
  const [frecuenciaTipo, setFrecuenciaTipo] = useState<FrecuenciaTipo>('diaria');
  const [frecuenciaValor, setFrecuenciaValor] = useState('1');
  const [submitting, setSubmitting] = useState(false);

  // Disclaimer modal (solo perfiles pediátricos)
  const [needsDisclaimer, setNeedsDisclaimer] = useState(false);
  const [disclaimerOpen, setDisclaimerOpen] = useState(false);

  const load = useCallback(async () => {
    if (!perfilId) return;
    setError(null);
    try {
      const [p, m] = await Promise.all([
        getPerfilFamilia(perfilId),
        listMedicamentosByPerfil(perfilId),
      ]);
      setPerfil(p);
      setMeds(m);

      // Si es pediátrico, verificar disclaimer (no es bloqueante para ver/listar,
      // sí lo es antes de agregar un medicamento)
      if (p && p.tipoPerfil === 'dependiente_pediatrico') {
        const has = await hasActiveDisclaimer(perfilId, 'pediatrico');
        setNeedsDisclaimer(!has);
      } else {
        setNeedsDisclaimer(false);
      }
    } catch (e: any) {
      setError(e?.message ?? t.familia.loadGenericError);
    } finally {
      setLoading(false);
    }
  }, [perfilId, t]);

  useEffect(() => {
    if (session && perfilId) load();
    else setLoading(false);
  }, [session, perfilId, load]);

  useFocusEffect(
    useCallback(() => {
      if (session && perfilId) load();
    }, [session, perfilId, load]),
  );

  // Cargar productos cuando se abre el modal de "agregar"
  useEffect(() => {
    if (!addOpen) return;
    let cancelled = false;
    (async () => {
      const list = await listProductosPediatricos(searchText);
      if (!cancelled) setProductos(list);
    })();
    return () => {
      cancelled = true;
    };
  }, [addOpen, searchText]);

  const openAddFlow = useCallback(() => {
    if (!perfil) return;
    // Si pediátrico y no aceptó disclaimer, mostrarlo primero (bloqueante)
    if (perfil.tipoPerfil === 'dependiente_pediatrico' && needsDisclaimer) {
      setDisclaimerOpen(true);
      return;
    }
    setSearchText('');
    setSelectedProd(null);
    setFrecuenciaTipo('diaria');
    setFrecuenciaValor('1');
    setAddOpen(true);
  }, [perfil, needsDisclaimer]);

  const onDisclaimerAccept = useCallback(() => {
    setDisclaimerOpen(false);
    setNeedsDisclaimer(false);
    // Continúa al flujo de agregar
    setSearchText('');
    setSelectedProd(null);
    setFrecuenciaTipo('diaria');
    setFrecuenciaValor('1');
    setAddOpen(true);
  }, []);

  const onSubmitAdd = useCallback(async () => {
    if (!perfil || !selectedProd) return;
    setSubmitting(true);
    try {
      const valor = Number(frecuenciaValor);
      const res = await addMedicamento({
        perfilId: perfil.id,
        perfilTipo: perfil.tipoPerfil,
        skuId: selectedProd.skuId,
        nombreDisplay: selectedProd.nombreComercial,
        frecuenciaTipo,
        frecuenciaValor: Number.isFinite(valor) && valor > 0 ? valor : 1,
        horasToma: [],
      });
      if (!res.ok) {
        Alert.alert(t.familia.errorTitle, res.error ?? t.familia.addError);
        return;
      }
      setAddOpen(false);
      await load();
    } finally {
      setSubmitting(false);
    }
  }, [perfil, selectedProd, frecuenciaTipo, frecuenciaValor, load]);

  const handleDelete = useCallback(
    (med: CareMedicamentoWithProducto) => {
      const msg = t.familia.deleteMedConfirm.replace('{name}', med.nombreDisplay);
      const proceed = async () => {
        const res = await softDeleteMedicamento(med.id);
        if (!res.ok) {
          Alert.alert(t.familia.errorTitle, res.error ?? t.familia.deleteError);
          return;
        }
        await load();
      };
      if (Platform.OS === 'web') {
        if (webConfirm(msg)) proceed();
      } else {
        Alert.alert(t.familia.deleteMedTitle, msg, [
          { text: t.familia.cancel, style: 'cancel' },
          { text: t.familia.delete, style: 'destructive', onPress: proceed },
        ]);
      }
    },
    [load, t],
  );

  const tituloHeader = useMemo(() => {
    if (!perfil) return t.familia.medsTitle;
    return `${t.familia.medsTitle} · ${perfil.nombre}`;
  }, [perfil, t]);

  if (!session) {
    return (
      <AuthRequiredPlaceholder
        icon={<Lock size={48} color={theme.colors.accent} />}
        title={t.familia.authTitleShort}
        description={t.familia.medsAuthDesc}
      />
    );
  }

  return (
    <View style={styles.container}>
      <PillBackground />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <PressableScale style={styles.backButton} onPress={() => router.back()} scaleTo={0.9}>
          <ArrowLeft size={22} color={theme.colors.textPrimary} />
        </PressableScale>

        <Reveal variant="up" delay={60}>
          <View style={styles.header}>
            <View style={styles.heroIcon}>
              <Pill size={28} color={theme.colors.accent} />
            </View>
            <Text style={styles.title}>{tituloHeader}</Text>
            <Text style={styles.subtitle}>{t.familia.medsSubtitle}</Text>
          </View>
        </Reveal>

        {loading ? (
          <ActivityIndicator color={theme.colors.accent} style={{ marginTop: theme.spacing.huge }} />
        ) : error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : !perfil ? (
          <Text style={styles.errorText}>{t.familia.profileNotFound}</Text>
        ) : (
          <>
            {perfil.tipoPerfil === 'dependiente_pediatrico' && (
              <Reveal variant="fade" delay={120}>
                <View
                  style={[
                    styles.legalBanner,
                    needsDisclaimer ? styles.legalBannerPending : styles.legalBannerOk,
                  ]}
                >
                  <ShieldCheck
                    size={16}
                    color={needsDisclaimer ? theme.colors.warning : theme.colors.accent}
                  />
                  <Text
                    style={[
                      styles.legalBannerText,
                      { color: needsDisclaimer ? theme.colors.warning : theme.colors.accent },
                    ]}
                  >
                    {needsDisclaimer
                      ? t.familia.disclaimerNeeded
                      : t.familia.disclaimerAcceptedV1}
                  </Text>
                </View>
              </Reveal>
            )}

            {meds.length === 0 ? (
              <Reveal variant="up" delay={140}>
                <View style={styles.emptyBox}>
                  <Text style={styles.emptyEmoji}>💊</Text>
                  <Text style={styles.emptyTitle}>{t.familia.noMedsTitle}</Text>
                  <Text style={styles.emptyText}>{t.familia.noMedsText}</Text>
                </View>
              </Reveal>
            ) : (
              meds.map((m, i) => (
                <Reveal key={m.id} index={i} delay={140}>
                  <View style={styles.medCard}>
                    <View style={styles.medCardLeft}>
                      <Pill size={20} color={theme.colors.accent} />
                    </View>
                    <View style={styles.medCardMain}>
                      <Text style={styles.medName}>{m.nombreDisplay}</Text>
                      {m.productoPresentacion ? (
                        <Text style={styles.medPresentacion}>
                          {m.productoPresentacion}
                        </Text>
                      ) : null}
                      <View style={styles.medMetaRow}>
                        <Clock size={12} color={theme.colors.textSecondary} />
                        <Text style={styles.medMetaText}>
                          {freqText(m.frecuenciaTipo, m.frecuenciaValor)}
                        </Text>
                      </View>
                    </View>
                    <PressableScale
                      style={styles.deleteBtn}
                      scaleTo={0.9}
                      onPress={() => handleDelete(m)}
                    >
                      <Trash2 size={16} color={theme.colors.danger} />
                    </PressableScale>
                  </View>
                </Reveal>
              ))
            )}

            <Reveal variant="up" delay={200} index={meds.length}>
              <PressableScale style={styles.addButton} onPress={openAddFlow}>
                <Plus size={18} color={theme.colors.white} />
                <Text style={styles.addButtonText}>{t.familia.addMedication}</Text>
              </PressableScale>
            </Reveal>
          </>
        )}
      </ScrollView>

      {/* Modal: Agregar medicamento */}
      <Modal
        visible={addOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setAddOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t.familia.addMedication}</Text>
              <PressableScale onPress={() => setAddOpen(false)} scaleTo={0.85}>
                <X size={22} color={theme.colors.textPrimary} />
              </PressableScale>
            </View>

            <KeyboardAwareScreen
              style={styles.modalScroll}
              contentContainerStyle={styles.modalScrollContent}
            >
              <Text style={styles.modalLabel}>{t.familia.medication}</Text>
              <View style={[styles.modalInputWrap, searchFocused && styles.modalInputFocused]}>
                <Search size={18} color={searchFocused ? theme.colors.accent : theme.colors.textMuted} />
                <TextInput
                  style={styles.modalInput}
                  placeholder={t.familia.searchByNameOrIngredient}
                  placeholderTextColor={theme.colors.textMuted}
                  value={searchText}
                  onChangeText={setSearchText}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => setSearchFocused(false)}
                />
              </View>

              <View style={styles.productsList}>
                {productos.length === 0 ? (
                  <Text style={styles.modalHint}>{t.familia.noDoseProductsLong}</Text>
                ) : (
                  productos.map((p) => {
                    const active = selectedProd?.skuId === p.skuId;
                    return (
                      <PressableScale
                        key={p.skuId}
                        style={[styles.productItem, active && styles.productItemActive]}
                        scaleTo={0.97}
                        onPress={() => setSelectedProd(p)}
                      >
                        <Text
                          style={[
                            styles.productName,
                            active && styles.productNameActive,
                          ]}
                        >
                          {p.nombreComercial}
                        </Text>
                        {p.principioActivo ? (
                          <Text style={styles.productMeta}>{p.principioActivo}</Text>
                        ) : null}
                        {p.presentacion ? (
                          <Text style={styles.productMeta}>{p.presentacion}</Text>
                        ) : null}
                      </PressableScale>
                    );
                  })
                )}
              </View>

              <Text style={styles.modalLabel}>{t.familia.frequency}</Text>
              <View style={styles.frecRow}>
                {FRECUENCIA_OPTIONS.map(({ key }) => {
                  const active = frecuenciaTipo === key;
                  return (
                    <PressableScale
                      key={key}
                      style={[styles.frecChip, active && styles.frecChipActive]}
                      scaleTo={0.94}
                      onPress={() => setFrecuenciaTipo(key)}
                    >
                      <Text
                        style={[
                          styles.frecChipText,
                          active && styles.frecChipTextActive,
                        ]}
                      >
                        {freqOptLabel(key)}
                      </Text>
                    </PressableScale>
                  );
                })}
              </View>

              <Text style={styles.modalLabel}>
                {frecuenciaTipo === 'horas'
                  ? t.familia.everyHowManyHours
                  : frecuenciaTipo === 'semanal'
                  ? t.familia.timesPerWeek
                  : t.familia.timesPerDay}
              </Text>
              <View style={[styles.modalInputWrap, valorFocused && styles.modalInputFocused]}>
                <TextInput
                  style={styles.modalInput}
                  keyboardType="number-pad"
                  value={frecuenciaValor}
                  onChangeText={setFrecuenciaValor}
                  maxLength={3}
                  onFocus={() => setValorFocused(true)}
                  onBlur={() => setValorFocused(false)}
                />
              </View>
            </KeyboardAwareScreen>

            <View style={styles.modalFooter}>
              <PressableScale
                style={styles.modalCancel}
                scaleTo={0.96}
                onPress={() => setAddOpen(false)}
                disabled={submitting}
              >
                <Text style={styles.modalCancelText}>{t.familia.cancel}</Text>
              </PressableScale>
              <PressableScale
                style={[
                  styles.modalSubmit,
                  (!selectedProd || submitting) && { opacity: 0.5 },
                ]}
                disabled={!selectedProd || submitting}
                onPress={onSubmitAdd}
              >
                {submitting ? (
                  <ActivityIndicator color={theme.colors.white} />
                ) : (
                  <Text style={styles.modalSubmitText}>{t.familia.add}</Text>
                )}
              </PressableScale>
            </View>
          </View>
        </View>
      </Modal>

      {/* Disclaimer médico bloqueante */}
      {perfil ? (
        <DisclaimerModal
          visible={disclaimerOpen}
          tipo="pediatrico"
          perfilId={perfil.id}
          perfilNombre={perfil.nombre}
          onAccept={onDisclaimerAccept}
          onCancel={() => setDisclaimerOpen(false)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  scroll: {
    padding: theme.spacing.xxl,
    paddingTop: 50,
    paddingBottom: theme.spacing.huge,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
    ...theme.shadow.sm,
  },
  header: { alignItems: 'center', marginBottom: theme.spacing.xl, gap: 6 },
  heroIcon: {
    width: 64,
    height: 64,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.accentSoft,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
    ...theme.shadow.sm,
  },
  title: { ...theme.text.h1, color: theme.colors.textPrimary, textAlign: 'center' },
  subtitle: {
    ...theme.text.body,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: theme.spacing.sm,
  },
  legalBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
  },
  legalBannerOk: { backgroundColor: theme.colors.accentSofter, borderColor: theme.colors.accentSoft },
  legalBannerPending: { backgroundColor: theme.colors.warningSoft, borderColor: theme.colors.warningSoft },
  legalBannerText: { flex: 1, ...theme.text.bodyMedium, fontSize: 12, lineHeight: 17 },
  emptyBox: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xxxl,
    gap: 6,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    marginBottom: theme.spacing.md,
    ...theme.shadow.card,
  },
  emptyEmoji: { fontSize: 40 },
  emptyTitle: { ...theme.text.h3, color: theme.colors.textPrimary },
  emptyText: {
    ...theme.text.body,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: theme.spacing.lg,
  },
  medCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    ...theme.shadow.card,
  },
  medCardLeft: {
    width: 48,
    height: 48,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.accentSofter,
    justifyContent: 'center',
    alignItems: 'center',
  },
  medCardMain: { flex: 1, gap: 3 },
  medName: { ...theme.text.h3, color: theme.colors.textPrimary },
  medPresentacion: { ...theme.text.caption, color: theme.colors.textSecondary },
  medMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  medMetaText: { ...theme.text.bodyMedium, fontSize: 12, color: theme.colors.textSecondary },
  deleteBtn: {
    width: 38,
    height: 38,
    borderRadius: theme.radius.pill,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.dangerSoft,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius.pill,
    paddingVertical: theme.spacing.lg,
    marginTop: theme.spacing.sm,
    ...theme.shadow.accent,
  },
  addButtonText: {
    fontFamily: theme.font.bold,
    fontSize: 15,
    color: theme.colors.white,
    letterSpacing: 0.3,
  },
  errorText: {
    ...theme.text.bodyMedium,
    fontSize: 13,
    color: theme.colors.danger,
    textAlign: 'center',
    marginTop: theme.spacing.md,
  },

  // Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: theme.colors.overlay,
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: theme.radius.xl,
    borderTopRightRadius: theme.radius.xl,
    paddingBottom: theme.spacing.lg,
    maxHeight: '88%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
  },
  modalTitle: { ...theme.text.h2, fontFamily: theme.font.bold, color: theme.colors.textPrimary },
  modalScroll: { flexGrow: 0 },
  modalScrollContent: { padding: theme.spacing.lg },
  modalLabel: {
    ...theme.text.label,
    color: theme.colors.accent,
    marginTop: theme.spacing.md,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  modalInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    height: 50,
    backgroundColor: theme.colors.bg,
  },
  modalInputFocused: {
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.surface,
  },
  modalInput: { flex: 1, fontFamily: theme.font.body, fontSize: 14, color: theme.colors.textPrimary },
  modalHint: { ...theme.text.caption, color: theme.colors.textSecondary, padding: theme.spacing.sm },
  productsList: { marginTop: theme.spacing.sm, gap: 6 },
  productItem: {
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.bg,
  },
  productItemActive: { backgroundColor: theme.colors.accentSofter, borderColor: theme.colors.accent },
  productName: { ...theme.text.title, color: theme.colors.textPrimary },
  productNameActive: { color: theme.colors.accent },
  productMeta: { ...theme.text.caption, color: theme.colors.textSecondary, marginTop: 2 },
  frecRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  frecChip: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.bgSecondary,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
  },
  frecChipActive: { backgroundColor: theme.colors.accent, borderColor: theme.colors.accent },
  frecChipText: { ...theme.text.bodyMedium, fontSize: 13, fontFamily: theme.font.bodyBold, color: theme.colors.textSecondary },
  frecChipTextActive: { color: theme.colors.white },
  modalFooter: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderLight,
  },
  modalCancel: {
    flex: 1,
    paddingVertical: theme.spacing.lg,
    borderRadius: theme.radius.pill,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    alignItems: 'center',
  },
  modalCancelText: { ...theme.text.button, color: theme.colors.textSecondary },
  modalSubmit: {
    flex: 2,
    paddingVertical: theme.spacing.lg,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.accent,
    alignItems: 'center',
    ...theme.shadow.accent,
  },
  modalSubmitText: { fontFamily: theme.font.bold, fontSize: 15, color: theme.colors.white },
});
