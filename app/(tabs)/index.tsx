import { View, Text, StyleSheet, TextInput, ScrollView, FlatList, Alert, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Search, ScanBarcode, MapPin, TrendingUp, CircleAlert as AlertCircle, Database, BookOpen, Heart, Pill, Thermometer, Brain, Droplets, Bone, Shield, Zap, Leaf, Syringe, Baby, Wind, Flame, ChevronRight } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useState, useEffect, useRef } from 'react';
import {
  getPopularMedicationsCached,
  searchMedications as apiSearchMedications,
  type MedicationCard,
} from '@/lib/api/medicamentos';
import {
  searchMedications as advancedSearch,
  type SearchResult,
} from '@/lib/api/search';
import { getSponsoredPin, categoriaSlug, type SponsoredPin } from '@/lib/api/sponsored';
import LanguageSelector from '@/components/LanguageSelector';
import LoginNudge from '@/components/LoginNudge';
import KerivaLoader from '@/components/KerivaLoader';
import PressableScale from '@/components/ui/PressableScale';
import Reveal from '@/components/ui/Reveal';
import PillBackground from '@/components/ui/PillBackground';
import { useLanguage } from '@/lib/LanguageContext';
import { theme } from '@/lib/theme';
import { capture } from '@/lib/analytics';
import { logBusquedaSinResultado } from '@/lib/api/eventos';

const CATEGORIES: Array<{ label: string; icon: any; color: string }> = [
  { label: 'Todo', icon: Pill, color: theme.colors.accent },
  { label: 'Presión arterial', icon: Heart, color: '#E53935' },
  { label: 'Analgésico', icon: Zap, color: '#FF6F00' },
  { label: 'Antibiótico', icon: Shield, color: '#1565C0' },
  { label: 'Diabetes', icon: Droplets, color: '#6A1B9A' },
  { label: 'Gastro', icon: Flame, color: '#EF6C00' },
  { label: 'Vitaminas', icon: Leaf, color: '#2E7D32' },
  { label: 'Colesterol', icon: Heart, color: '#AD1457' },
  { label: 'Alérgico', icon: Wind, color: '#00838F' },
  { label: 'Antiinflamatorio', icon: Thermometer, color: '#D84315' },
  { label: 'Diurético', icon: Droplets, color: '#0277BD' },
  { label: 'Respiratorio', icon: Wind, color: '#00695C' },
  { label: 'Antidepresivo', icon: Brain, color: '#4527A0' },
  { label: 'Gota', icon: Droplets, color: '#283593' },
  { label: 'Neurológico', icon: Brain, color: '#1A237E' },
  { label: 'Tiroides', icon: Syringe, color: '#4E342E' },
  { label: 'Anticoagulante', icon: Droplets, color: '#B71C1C' },
];

export default function SearchScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todo');
  const [filteredMeds, setFilteredMeds] = useState<MedicationCard[]>([]);
  const [advancedResults, setAdvancedResults] = useState<SearchResult[]>([]);
  const [popularMeds, setPopularMeds] = useState<MedicationCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [useAdvanced, setUseAdvanced] = useState(false);
  const [sponsoredPin, setSponsoredPin] = useState<SponsoredPin | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setError(null);
        const meds = await getPopularMedicationsCached();
        if (!cancelled) setPopularMeds(meds);
      } catch {
        if (!cancelled) {
          setError(t.home.loadError);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    const trimmed = searchQuery.trim();

    if (!trimmed && selectedCategory === 'Todo') {
      setFilteredMeds([]);
      setAdvancedResults([]);
      setSearching(false);
      setUseAdvanced(false);
      return;
    }

    searchTimeoutRef.current = setTimeout(() => {
      // Analítica: solo el length del query y la categoría — nunca el texto
      // (puede contener nombre propio o condición de salud).
      if (trimmed.length >= 2) {
        capture('search_med', {
          query_length: trimmed.length,
          category: selectedCategory,
        });
      }
      runSearch(trimmed);
    }, 350);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery, selectedCategory]);

  // Pin Patrocinado (adendum §3.1): solo al buscar dentro de una categoría
  // específica no restringida. La vista ya filtra vigencia + restricted.
  useEffect(() => {
    let cancelled = false;
    if (selectedCategory === 'Todo') {
      setSponsoredPin(null);
      return;
    }
    (async () => {
      const pin = await getSponsoredPin(categoriaSlug(selectedCategory));
      if (!cancelled) setSponsoredPin(pin);
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedCategory]);

  async function runSearch(trimmed: string) {
    setSearching(true);
    setError(null);
    try {
      if (trimmed.length >= 2) {
        const results = await advancedSearch(trimmed, 30);
        setAdvancedResults(results);
        setFilteredMeds([]);
        setUseAdvanced(true);
        // U4: si la búsqueda explícita (≥3 chars) no trajo resultados, lo
        // capturamos como demanda insatisfecha para el admin.
        if (trimmed.length >= 3 && results.length === 0) {
          void logBusquedaSinResultado(trimmed, { categoria: selectedCategory });
        }
      } else {
        const meds = await apiSearchMedications({
          query: trimmed,
          category: selectedCategory,
        });
        setFilteredMeds(meds);
        setAdvancedResults([]);
        setUseAdvanced(false);
      }
    } catch {
      setError(t.home.searchError);
      setFilteredMeds([]);
      setAdvancedResults([]);
    }
  }

  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
  };

  // El escaneo de código de barras (GS1 / Digital Shield) es Fase 2 en el brief.
  const handleScanPress = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.alert(`${t.home.scanSoonTitle}\n\n${t.home.scanSoonMsg}`);
    } else {
      Alert.alert(t.home.scanSoonTitle, t.home.scanSoonMsg);
    }
  };

  const totalResults = useAdvanced ? advancedResults.length : filteredMeds.length;
  const heroTitle = t.home.heroTitle;
  const heroSubtitle = t.home.heroSubtitle;
  // En modo búsqueda (input enfocado o con texto) colapsamos el header para
  // que los resultados tengan casi toda la pantalla y no los tape el teclado.
  const compact = focused || searchQuery.trim().length > 0;

  return (
    <View style={styles.container}>
      <PillBackground />
      <LinearGradient
        colors={theme.gradient.header}
        style={[styles.header, compact && styles.headerCompact]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        {!compact && (
          <>
            <View style={styles.topBar}>
              <View style={styles.locationChip}>
                <MapPin size={14} color={theme.colors.brandGreenLight} />
                <Text style={styles.locationText} numberOfLines={1}>{t.home.location}</Text>
              </View>
              <LanguageSelector />
            </View>

            <Text style={styles.heroTitle}>{heroTitle}</Text>
            <Text style={styles.heroSubtitle}>{heroSubtitle}</Text>
          </>
        )}

        <View style={[styles.searchContainer, focused && styles.searchContainerFocused]}>
          <Search size={20} color={theme.colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder={t.home.searchPlaceholder}
            placeholderTextColor={theme.colors.textMuted}
            value={searchQuery}
            onChangeText={handleSearchChange}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            autoCorrect={false}
            autoCapitalize="none"
          />
          <PressableScale style={styles.barcodeButton} onPress={handleScanPress} scaleTo={0.9}>
            <ScanBarcode size={20} color={theme.colors.white} />
          </PressableScale>
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentInner}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        {error && (
          <View style={styles.errorBanner}>
            <AlertCircle size={20} color={theme.colors.danger} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {loading ? (
          <KerivaLoader label={t.home.loading} fullscreen={false} size={80} />
        ) : (
          <>
            <View style={styles.categorySection}>
              <FlatList
                data={CATEGORIES}
                keyExtractor={(item) => item.label}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.categoryList}
                renderItem={({ item }) => {
                  const isActive = selectedCategory === item.label;
                  const Icon = item.icon;
                  return (
                    <PressableScale
                      style={[
                        styles.categoryChip,
                        isActive && { backgroundColor: item.color, borderColor: item.color },
                      ]}
                      scaleTo={0.94}
                      onPress={() => setSelectedCategory(item.label)}
                    >
                      <Icon size={15} color={isActive ? theme.colors.white : item.color} />
                      <Text
                        style={[
                          styles.categoryChipText,
                          isActive && styles.categoryChipTextActive,
                        ]}
                      >
                        {(t.categories as Record<string, string>)[item.label] ?? item.label}
                      </Text>
                    </PressableScale>
                  );
                }}
              />
            </View>

            {searching && (
              <>
                {totalResults > 0 ? (
                  <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                      <View style={styles.sectionTitleRow}>
                        <Search size={18} color={theme.colors.accent} />
                        <Text style={styles.sectionTitle}>
                          {totalResults}{' '}
                          {totalResults !== 1 ? t.home.resultsMany : t.home.resultsOne}
                        </Text>
                      </View>
                      {useAdvanced && (
                        <View style={styles.catalogBadge}>
                          <Database size={11} color={theme.colors.accent} />
                          <Text style={styles.catalogBadgeText}>{t.home.catalogBadge}</Text>
                        </View>
                      )}
                    </View>

                    {/* Pin Patrocinado — resultado #1 (adendum §3.1) */}
                    {sponsoredPin && (
                      <Reveal index={0}>
                        <PressableScale
                          style={[styles.resultCard, styles.sponsoredCard]}
                          onPress={
                            sponsoredPin.medicamentoId
                              ? () => router.push(`/detail?id=${sponsoredPin.medicamentoId}`)
                              : undefined
                          }
                        >
                          <View style={styles.resultLeft}>
                            <View style={[styles.pillIcon, styles.sponsoredIcon]}>
                              <Text style={styles.pillIconText}>💊</Text>
                            </View>
                            <View style={styles.resultInfo}>
                              <Text style={styles.resultName} numberOfLines={1}>
                                {sponsoredPin.nombreComercial}
                              </Text>
                              <Text style={styles.resultIngredient} numberOfLines={1}>
                                {sponsoredPin.laboratorioNombre}
                              </Text>
                            </View>
                          </View>
                          <View style={styles.sponsoredBadge}>
                            <Text style={styles.sponsoredBadgeText}>{t.home.sponsored}</Text>
                          </View>
                        </PressableScale>
                      </Reveal>
                    )}

                    {/* Advanced results (RPC full-text search) */}
                    {useAdvanced && advancedResults.map((item, idx) => (
                      <Reveal key={`${item.source}-${item.id ?? idx}`} index={idx}>
                        <PressableScale
                          style={styles.resultCard}
                          onPress={item.id ? () => router.push(`/detail?id=${item.id}`) : undefined}
                        >
                          <View style={styles.resultLeft}>
                            <View style={[
                              styles.pillIcon,
                              item.source === 'catalogo' && styles.pillIconCatalog,
                            ]}>
                              {item.source === 'curado' ? (
                                <Text style={styles.pillIconText}>💊</Text>
                              ) : (
                                <BookOpen size={18} color={theme.colors.accent} />
                              )}
                            </View>
                            <View style={styles.resultInfo}>
                              <Text style={styles.resultName} numberOfLines={1}>
                                {item.commercialName}
                                {item.dosage ? ` ${item.dosage}` : ''}
                              </Text>
                              {item.activeIngredient && (
                                <Text style={styles.resultIngredient} numberOfLines={1}>
                                  {item.activeIngredient}
                                </Text>
                              )}
                              <View style={styles.resultMetaRow}>
                                {item.category ? (
                                  <Text style={styles.resultCategory} numberOfLines={1}>{item.category}</Text>
                                ) : null}
                                {item.manufacturer ? (
                                  <Text style={styles.resultCategory} numberOfLines={1}>
                                    {item.manufacturer}
                                  </Text>
                                ) : null}
                              </View>
                              {item.referencePrice != null && item.referencePrice > 0 ? (
                                <Text style={styles.resultPrice}>
                                  {t.home.referencePrice} RD${item.referencePrice.toFixed(2)}
                                </Text>
                              ) : null}
                            </View>
                          </View>
                          <View style={styles.sourceTag}>
                            <Text style={[
                              styles.sourceTagText,
                              item.source === 'curado' ? styles.sourceTagCurado : styles.sourceTagCatalog,
                            ]}>
                              {item.source === 'curado' ? t.home.sourceKeriva : t.home.sourceDigemaps}
                            </Text>
                          </View>
                        </PressableScale>
                      </Reveal>
                    ))}

                    {/* Simple filtered results (category-only) */}
                    {!useAdvanced && filteredMeds.map((item, idx) => (
                      <Reveal key={item.id} index={idx}>
                        <PressableScale
                          style={styles.resultCard}
                          onPress={() => router.push(`/detail?id=${item.id}`)}
                        >
                          <View style={styles.resultLeft}>
                            <View style={styles.pillIcon}>
                              <Text style={styles.pillIconText}>💊</Text>
                            </View>
                            <View style={styles.resultInfo}>
                              <Text style={styles.resultName} numberOfLines={1}>
                                {item.name} {item.dosage}
                              </Text>
                              <Text style={styles.resultCategory}>{item.category}</Text>
                              <Text style={styles.resultPrice}>
                                {item.minPrice > 0
                                  ? `${t.home.fromPrice} RD$${item.minPrice.toFixed(2)}`
                                  : t.home.priceUnavailable}
                              </Text>
                            </View>
                          </View>
                          <View style={styles.chevron}>
                            <ChevronRight size={18} color={theme.colors.accent} />
                          </View>
                        </PressableScale>
                      </Reveal>
                    ))}
                  </View>
                ) : (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyStateEmoji}>🔍</Text>
                    <Text style={styles.emptyStateTitle}>{t.home.noResultsTitle}</Text>
                    <Text style={styles.emptyStateText}>{t.home.noResultsText}</Text>
                  </View>
                )}
              </>
            )}

            {!searching && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionTitleRow}>
                    <TrendingUp size={18} color={theme.colors.accent} />
                    <Text style={styles.sectionTitle}>{t.home.popular}</Text>
                  </View>
                </View>

                {popularMeds.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyStateEmoji}>💊</Text>
                    <Text style={styles.emptyStateTitle}>{t.home.noMedsTitle}</Text>
                    <Text style={styles.emptyStateText}>{t.home.noMedsText}</Text>
                  </View>
                ) : (
                  <View style={styles.popularGrid}>
                    {popularMeds.map((med, idx) => (
                      <Reveal key={med.id} index={idx} style={styles.popularCardWrap}>
                        <PressableScale
                          style={styles.popularCard}
                          onPress={() => router.push(`/detail?id=${med.id}`)}
                        >
                          <View style={styles.popularIconWrap}>
                            <Text style={styles.popularCardEmoji}>💊</Text>
                          </View>
                          <Text style={styles.popularCardName} numberOfLines={1}>{med.name}</Text>
                          <Text style={styles.popularCardDosage} numberOfLines={1}>{med.dosage}</Text>
                          <Text style={styles.popularCardPrice} numberOfLines={1}>
                            {med.minPrice > 0
                              ? `${t.home.fromPrice} RD$${med.minPrice.toFixed(2)}`
                              : t.home.priceConsult}
                          </Text>
                        </PressableScale>
                      </Reveal>
                    ))}
                  </View>
                )}
              </View>
            )}
          </>
        )}
      </ScrollView>

      <LoginNudge delayMs={5000} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },
  header: {
    paddingTop: 58,
    paddingBottom: theme.spacing.xxl,
    paddingHorizontal: theme.spacing.xl,
    borderBottomLeftRadius: theme.radius.xl,
    borderBottomRightRadius: theme.radius.xl,
    ...theme.shadow.md,
  },
  headerCompact: {
    paddingTop: 46,
    paddingBottom: theme.spacing.md,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
  },
  locationChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 6,
    borderRadius: theme.radius.pill,
    maxWidth: 220,
  },
  locationText: {
    ...theme.text.caption,
    fontFamily: theme.font.bodyMedium,
    color: theme.colors.white,
  },
  heroTitle: {
    ...theme.text.h1,
    color: theme.colors.white,
  },
  heroSubtitle: {
    ...theme.text.bodyMedium,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 4,
    marginBottom: theme.spacing.lg,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    backgroundColor: theme.colors.white,
    borderRadius: theme.radius.lg,
    paddingLeft: theme.spacing.lg,
    paddingRight: 6,
    height: 56,
    ...theme.shadow.md,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  searchContainerFocused: {
    borderColor: theme.colors.brandGreenLight,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    fontFamily: theme.font.body,
    fontSize: 15,
    color: theme.colors.textPrimary,
    height: '100%',
  },
  barcodeButton: {
    width: 44,
    height: 44,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  contentInner: {
    // Espacio extra abajo para poder desplazar los resultados por encima del
    // teclado al buscar (que no queden tapados).
    paddingBottom: 320,
  },
  categorySection: {
    paddingTop: theme.spacing.xl,
    paddingBottom: theme.spacing.xs,
  },
  categoryList: {
    paddingHorizontal: theme.spacing.xl,
    gap: theme.spacing.sm,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surface,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    ...theme.shadow.sm,
  },
  categoryChipText: {
    ...theme.text.bodyMedium,
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  categoryChipTextActive: {
    color: theme.colors.white,
  },
  section: {
    paddingHorizontal: theme.spacing.xl,
    paddingTop: theme.spacing.xl,
    paddingBottom: theme.spacing.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.lg,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  sectionTitle: {
    ...theme.text.h2,
    color: theme.colors.textPrimary,
  },
  resultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    ...theme.shadow.card,
  },
  sponsoredCard: {
    borderWidth: 1.5,
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.accentSofter,
  },
  sponsoredIcon: {
    backgroundColor: theme.colors.accentSoft,
  },
  sponsoredBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.accent,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: theme.radius.pill,
    alignSelf: 'flex-start',
  },
  sponsoredBadgeText: {
    fontFamily: theme.font.bold,
    fontSize: 9,
    letterSpacing: 0.5,
    color: theme.colors.accentText,
    textTransform: 'uppercase',
  },
  resultLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    flex: 1,
  },
  resultInfo: {
    flex: 1,
  },
  pillIcon: {
    width: 48,
    height: 48,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.accentSofter,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pillIconCatalog: {
    backgroundColor: theme.colors.infoSoft,
  },
  pillIconText: {
    fontSize: 22,
  },
  resultName: {
    ...theme.text.title,
    color: theme.colors.textPrimary,
  },
  resultIngredient: {
    ...theme.text.caption,
    color: theme.colors.accent,
    marginTop: 1,
  },
  resultCategory: {
    ...theme.text.caption,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  resultMetaRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginTop: 2,
    flexWrap: 'wrap',
  },
  resultPrice: {
    ...theme.text.caption,
    fontFamily: theme.font.bodyBold,
    color: theme.colors.accent,
    marginTop: 4,
  },
  chevron: {
    width: 32,
    height: 32,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.accentSofter,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sourceTag: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 3,
    borderRadius: theme.radius.xs,
    backgroundColor: theme.colors.bgSecondary,
    alignSelf: 'flex-start',
  },
  sourceTagText: {
    ...theme.text.label,
    fontSize: 9,
  },
  sourceTagCurado: {
    color: theme.colors.accent,
  },
  sourceTagCatalog: {
    color: theme.colors.info,
  },
  catalogBadge: {
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
    backgroundColor: theme.colors.accentSoft,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: theme.radius.sm,
  },
  catalogBadgeText: {
    ...theme.text.label,
    fontSize: 9,
    color: theme.colors.accent,
  },
  popularGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
  },
  popularCardWrap: {
    width: '47.5%',
  },
  popularCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.xl,
    alignItems: 'center',
    ...theme.shadow.card,
  },
  popularIconWrap: {
    width: 56,
    height: 56,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.accentSofter,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  popularCardEmoji: {
    fontSize: 28,
  },
  popularCardName: {
    ...theme.text.title,
    color: theme.colors.textPrimary,
    textAlign: 'center',
  },
  popularCardDosage: {
    ...theme.text.caption,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: 2,
  },
  popularCardPrice: {
    ...theme.text.caption,
    fontFamily: theme.font.bodyBold,
    color: theme.colors.accent,
    textAlign: 'center',
    marginTop: 6,
  },
  errorBanner: {
    backgroundColor: theme.colors.dangerSoft,
    marginHorizontal: theme.spacing.xl,
    marginTop: theme.spacing.lg,
    padding: theme.spacing.lg,
    borderRadius: theme.radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  errorText: {
    ...theme.text.bodyMedium,
    color: theme.colors.danger,
    flex: 1,
  },
  emptyState: {
    padding: theme.spacing.huge,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateEmoji: {
    fontSize: 48,
    marginBottom: theme.spacing.lg,
  },
  emptyStateTitle: {
    ...theme.text.h2,
    color: theme.colors.textPrimary,
    textAlign: 'center',
    marginBottom: theme.spacing.sm,
  },
  emptyStateText: {
    ...theme.text.body,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
});
