import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ArrowLeft,
  Search,
  Baby,
  Scale,
  AlertTriangle,
  Lock,
  Pill,
} from 'lucide-react-native';
import { useAuth } from '@/lib/AuthContext';
import AuthRequiredPlaceholder from '@/components/AuthRequiredPlaceholder';
import DisclaimerModal from '@/components/DisclaimerModal';
import { getPerfilFamilia, type KerivaPerfil } from '@/lib/api/familia';
import {
  calcularDosisPediatrica,
  listProductosPediatricos,
  type CalcularDosisResult,
  type ProductoPediatrico,
} from '@/lib/api/dosis';
import { hasActiveDisclaimer } from '@/lib/api/disclaimer';
import { useLanguage } from '@/lib/LanguageContext';
import { theme } from '@/lib/theme';
import PressableScale from '@/components/ui/PressableScale';
import Reveal from '@/components/ui/Reveal';
import KeyboardAwareScreen from '@/components/ui/KeyboardAwareScreen';
import PillBackground from '@/components/ui/PillBackground';

function ageMonthsFrom(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  let months = (now.getFullYear() - d.getFullYear()) * 12;
  months += now.getMonth() - d.getMonth();
  if (now.getDate() < d.getDate()) months -= 1;
  return Math.max(0, months);
}

export default function KidsScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const { session } = useAuth();
  const params = useLocalSearchParams<{ perfilId?: string }>();
  const perfilId = typeof params.perfilId === 'string' ? params.perfilId : undefined;

  const [perfil, setPerfil] = useState<KerivaPerfil | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [productos, setProductos] = useState<ProductoPediatrico[]>([]);
  const [searchText, setSearchText] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [selectedProd, setSelectedProd] = useState<ProductoPediatrico | null>(null);
  const [result, setResult] = useState<CalcularDosisResult | null>(null);

  // Disclaimer state — Brief §5 lo exige bloqueante ANTES de mostrar el cálculo
  const [disclaimerOk, setDisclaimerOk] = useState<boolean | null>(null);
  const [disclaimerOpen, setDisclaimerOpen] = useState(false);

  // Cargar perfil + estado del disclaimer
  useEffect(() => {
    if (!session || !perfilId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setError(null);
      try {
        const p = await getPerfilFamilia(perfilId);
        if (cancelled) return;
        setPerfil(p);

        if (!p) {
          setError(t.familia.profileNotFound);
          return;
        }
        if (p.tipoPerfil !== 'dependiente_pediatrico') {
          setError(t.familia.kidsOnlyPediatric);
          return;
        }

        const has = await hasActiveDisclaimer(p.id, 'pediatrico');
        if (cancelled) return;
        setDisclaimerOk(has);
        if (!has) setDisclaimerOpen(true);
      } catch (e: any) {
        setError(e?.message ?? t.familia.loadGenericError);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session, perfilId]);

  // Cargar productos (lista) — solo si el disclaimer está OK
  useEffect(() => {
    if (!disclaimerOk) return;
    let cancelled = false;
    (async () => {
      const list = await listProductosPediatricos(searchText);
      if (!cancelled) setProductos(list);
    })();
    return () => {
      cancelled = true;
    };
  }, [disclaimerOk, searchText]);

  // Recalcular cuando cambia el producto seleccionado o el peso
  const pesoLb = perfil?.pesoLb ?? null;
  const edadMeses = useMemo(
    () => (perfil?.fechaNacimiento ? ageMonthsFrom(perfil.fechaNacimiento) : null),
    [perfil?.fechaNacimiento],
  );

  useEffect(() => {
    if (!selectedProd || pesoLb == null) {
      setResult(null);
      return;
    }
    const r = calcularDosisPediatrica({
      pesoLb,
      edadMeses,
      producto: selectedProd,
    });
    setResult(r);
  }, [selectedProd, pesoLb, edadMeses]);

  const onAcceptDisclaimer = useCallback(() => {
    setDisclaimerOpen(false);
    setDisclaimerOk(true);
  }, []);

  const onCancelDisclaimer = useCallback(() => {
    setDisclaimerOpen(false);
    router.back();
  }, [router]);

  if (!session) {
    return (
      <AuthRequiredPlaceholder
        icon={<Lock size={48} color={theme.colors.accent} />}
        title={t.familia.authTitleShort}
        description={t.familia.kidsAuthDesc}
      />
    );
  }

  return (
    <View style={styles.container}>
      <PillBackground />
      <KeyboardAwareScreen contentContainerStyle={styles.scroll}>
        <PressableScale style={styles.backButton} onPress={() => router.back()} scaleTo={0.9}>
          <ArrowLeft size={22} color={theme.colors.textPrimary} />
        </PressableScale>

        <Reveal variant="up" delay={60}>
          <View style={styles.header}>
            <View style={styles.heroIcon}>
              <Baby size={28} color={theme.colors.warning} />
            </View>
            <Text style={styles.title}>{t.familia.kidsTitle}</Text>
            <Text style={styles.subtitle}>
              {t.familia.kidsSubtitle}
              {perfil ? ` · ${perfil.nombre}` : ''}
            </Text>
          </View>
        </Reveal>

        {loading ? (
          <ActivityIndicator color={theme.colors.accent} style={{ marginTop: theme.spacing.huge }} />
        ) : error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : !disclaimerOk ? (
          <Reveal variant="up" delay={120}>
            <View style={styles.lockedBox}>
              <View style={styles.lockedIcon}>
                <Lock size={28} color={theme.colors.warning} />
              </View>
              <Text style={styles.lockedText}>
                {t.familia.acceptDisclaimerToAccess}
              </Text>
              <PressableScale
                style={styles.primaryButton}
                onPress={() => setDisclaimerOpen(true)}
              >
                <Text style={styles.primaryButtonText}>{t.familia.readDisclaimer}</Text>
              </PressableScale>
            </View>
          </Reveal>
        ) : (
          <>
            {/* Resumen del perfil */}
            <Reveal variant="up" delay={120}>
              <View style={styles.perfilCard}>
                <Text style={styles.perfilLabel}>{t.familia.profileData}</Text>
                <View style={styles.perfilRow}>
                  <View style={styles.perfilMeta}>
                    <Scale size={14} color={theme.colors.accent} />
                    <Text style={styles.perfilMetaText}>
                      {pesoLb != null ? `${pesoLb} lb` : t.familia.noWeight}
                    </Text>
                  </View>
                  <View style={styles.perfilMeta}>
                    <Baby size={14} color={theme.colors.accent} />
                    <Text style={styles.perfilMetaText}>
                      {edadMeses != null
                        ? edadMeses < 24
                          ? `${edadMeses} ${t.familia.months}`
                          : `${Math.floor(edadMeses / 12)} ${t.familia.years}`
                        : t.familia.noAge}
                    </Text>
                  </View>
                </View>
                {pesoLb == null ? (
                  <PressableScale
                    style={styles.editPesoBtn}
                    scaleTo={0.96}
                    onPress={() =>
                      router.push(`/familia/edit?id=${perfilId}` as any)
                    }
                  >
                    <Text style={styles.editPesoText}>{t.familia.editWeight}</Text>
                  </PressableScale>
                ) : null}
              </View>
            </Reveal>

            {/* Buscador */}
            <Reveal variant="up" delay={160}>
              <Text style={styles.sectionLabel}>{t.familia.medication}</Text>
              <View style={[styles.inputWrap, searchFocused && styles.inputFocused]}>
                <Search size={18} color={searchFocused ? theme.colors.accent : theme.colors.textMuted} />
                <TextInput
                  style={styles.input}
                  placeholder={t.familia.searchByNameOrIngredient}
                  placeholderTextColor={theme.colors.textMuted}
                  value={searchText}
                  onChangeText={setSearchText}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => setSearchFocused(false)}
                />
              </View>
            </Reveal>

            <View style={styles.productsList}>
              {productos.length === 0 ? (
                <Text style={styles.hintText}>{t.familia.noDoseProducts}</Text>
              ) : (
                productos.map((p, i) => {
                  const active = selectedProd?.skuId === p.skuId;
                  return (
                    <Reveal key={p.skuId} index={i}>
                      <PressableScale
                        style={[styles.productItem, active && styles.productItemActive]}
                        scaleTo={0.97}
                        onPress={() => setSelectedProd(p)}
                      >
                        <View style={styles.productItemIcon}>
                          <Pill size={16} color={theme.colors.accent} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.productName}>{p.nombreComercial}</Text>
                          {p.principioActivo ? (
                            <Text style={styles.productMeta}>{p.principioActivo}</Text>
                          ) : null}
                          <Text style={styles.productMetaSmall}>
                            {p.dosisMgPorKg} mg/kg · {t.familia.every} {p.frecuenciaHoras}h
                          </Text>
                        </View>
                      </PressableScale>
                    </Reveal>
                  );
                })
              )}
            </View>

            {/* Resultado del cálculo */}
            {selectedProd && result ? (
              <Reveal variant="up">
                <View
                  style={[
                    styles.resultCard,
                    !result.ok && styles.resultCardError,
                  ]}
                >
                  {!result.ok ? (
                    <>
                      <View style={styles.resultHeaderRow}>
                        <AlertTriangle size={20} color={theme.colors.danger} />
                        <Text style={styles.resultErrorTitle}>
                          {result.reason === 'contraindicado'
                            ? t.familia.contraindicated
                            : result.reason === 'fuera_rango_edad'
                            ? t.familia.outOfAgeRange
                            : result.reason === 'sin_peso'
                            ? t.familia.missingWeight
                            : t.familia.notAvailable}
                        </Text>
                      </View>
                      <Text style={styles.resultErrorText}>{result.message}</Text>
                    </>
                  ) : (
                    <>
                      <Text style={styles.resultLabel}>{t.familia.estimatedDose}</Text>
                      <Text style={styles.resultDosis}>
                        {result.dosisMg.toFixed(1)} mg
                      </Text>
                      <Text style={styles.resultFrecuencia}>
                        {t.familia.everyHours.replace('{n}', String(result.frecuenciaHoras))}
                      </Text>
                      <View style={styles.resultMetaRow}>
                        <Text style={styles.resultMetaText}>
                          {t.familia.weightLabel.replace('{n}', String(result.pesoLb))}
                        </Text>
                        {result.topeAplicado ? (
                          <Text style={[styles.resultMetaText, { color: theme.colors.warning }]}>
                            {t.familia.safetyCapApplied}
                          </Text>
                        ) : null}
                      </View>

                      {result.advertencia ? (
                        <View style={styles.warningBox}>
                          <AlertTriangle size={14} color={theme.colors.warning} />
                          <Text style={styles.warningText}>{result.advertencia}</Text>
                        </View>
                      ) : null}

                      {result.notas ? (
                        <Text style={styles.notesText}>{result.notas}</Text>
                      ) : null}

                      <Text style={styles.disclaimerFooter}>{t.familia.kidsFooter}</Text>
                    </>
                  )}
                </View>
              </Reveal>
            ) : null}
          </>
        )}
      </KeyboardAwareScreen>

      {perfil ? (
        <DisclaimerModal
          visible={disclaimerOpen}
          tipo="pediatrico"
          perfilId={perfil.id}
          perfilNombre={perfil.nombre}
          onAccept={onAcceptDisclaimer}
          onCancel={onCancelDisclaimer}
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
    backgroundColor: theme.colors.warningSoft,
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
  perfilCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
    gap: theme.spacing.sm,
    ...theme.shadow.card,
  },
  perfilLabel: {
    ...theme.text.label,
    color: theme.colors.accent,
    textTransform: 'uppercase',
  },
  perfilRow: { flexDirection: 'row', gap: theme.spacing.lg },
  perfilMeta: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  perfilMetaText: { ...theme.text.bodyMedium, fontSize: 13, color: theme.colors.textPrimary },
  editPesoBtn: { paddingVertical: theme.spacing.xs },
  editPesoText: { ...theme.text.label, fontSize: 12, letterSpacing: 0, color: theme.colors.warning },
  sectionLabel: {
    ...theme.text.label,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
    marginBottom: theme.spacing.sm,
    textTransform: 'uppercase',
  },
  inputWrap: {
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
  inputFocused: {
    borderColor: theme.colors.accent,
    ...theme.shadow.sm,
  },
  input: {
    flex: 1,
    fontFamily: theme.font.body,
    fontSize: 15,
    color: theme.colors.textPrimary,
    height: '100%',
  },
  productsList: { marginTop: theme.spacing.md, gap: theme.spacing.sm },
  productItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    ...theme.shadow.sm,
  },
  productItemActive: {
    backgroundColor: theme.colors.accentSofter,
    borderColor: theme.colors.accent,
  },
  productItemIcon: {
    width: 36,
    height: 36,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.accentSoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  productName: { ...theme.text.title, color: theme.colors.textPrimary },
  productMeta: { ...theme.text.caption, color: theme.colors.textSecondary, marginTop: 2 },
  productMetaSmall: { ...theme.text.caption, fontSize: 11, color: theme.colors.textMuted, marginTop: 2 },
  hintText: {
    ...theme.text.body,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    paddingVertical: theme.spacing.lg,
  },
  resultCard: {
    marginTop: theme.spacing.xl,
    padding: theme.spacing.xl,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surface,
    borderWidth: 2,
    borderColor: theme.colors.accent,
    gap: 6,
    ...theme.shadow.card,
  },
  resultCardError: { borderColor: theme.colors.danger, backgroundColor: theme.colors.dangerSoft },
  resultHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  resultErrorTitle: { ...theme.text.h3, fontFamily: theme.font.bold, color: theme.colors.danger },
  resultErrorText: { ...theme.text.body, color: theme.colors.danger, lineHeight: 19 },
  resultLabel: {
    ...theme.text.label,
    color: theme.colors.accent,
    textTransform: 'uppercase',
  },
  resultDosis: { fontFamily: theme.font.display, fontSize: 36, color: theme.colors.textPrimary, marginVertical: -2 },
  resultFrecuencia: { ...theme.text.title, color: theme.colors.accent },
  resultMetaRow: { flexDirection: 'row', gap: 6, marginTop: theme.spacing.xs },
  resultMetaText: { ...theme.text.caption, color: theme.colors.textSecondary },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: theme.spacing.md,
    padding: theme.spacing.md,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.warningSoft,
  },
  warningText: { flex: 1, ...theme.text.bodyMedium, fontSize: 12, color: theme.colors.warning, lineHeight: 17 },
  notesText: { ...theme.text.caption, color: theme.colors.textSecondary, marginTop: theme.spacing.sm, lineHeight: 17 },
  disclaimerFooter: {
    ...theme.text.label,
    fontSize: 11,
    letterSpacing: 0,
    color: theme.colors.textMuted,
    marginTop: theme.spacing.md,
    textAlign: 'center',
  },
  lockedBox: {
    alignItems: 'center',
    gap: theme.spacing.lg,
    padding: theme.spacing.xxl,
    marginTop: theme.spacing.xl,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    ...theme.shadow.card,
  },
  lockedIcon: {
    width: 64,
    height: 64,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.warningSoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  lockedText: {
    ...theme.text.body,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  primaryButton: {
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius.pill,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.xxl,
    ...theme.shadow.accent,
  },
  primaryButtonText: { fontFamily: theme.font.bold, fontSize: 15, color: theme.colors.white },
  errorText: {
    ...theme.text.bodyMedium,
    fontSize: 14,
    color: theme.colors.danger,
    textAlign: 'center',
    marginTop: theme.spacing.lg,
  },
});
