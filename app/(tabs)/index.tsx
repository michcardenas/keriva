import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Search, ScanBarcode, MapPin, TrendingUp, CircleAlert as AlertCircle, Database, BookOpen } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useState, useEffect, useRef } from 'react';
import {
  getPopularMedications,
  searchMedications as apiSearchMedications,
  type MedicationCard,
} from '@/lib/api/medicamentos';
import {
  searchMedications as advancedSearch,
  type SearchResult,
} from '@/lib/api/search';
import LanguageSelector from '@/components/LanguageSelector';
import LoginNudge from '@/components/LoginNudge';

const CATEGORIES = ['Todo', 'Antidiabético', 'Antihipertensivo', 'Estatina'];

export default function SearchScreen() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todo');
  const [filteredMeds, setFilteredMeds] = useState<MedicationCard[]>([]);
  const [advancedResults, setAdvancedResults] = useState<SearchResult[]>([]);
  const [popularMeds, setPopularMeds] = useState<MedicationCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [useAdvanced, setUseAdvanced] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setError(null);
        const meds = await getPopularMedications(6);
        if (!cancelled) setPopularMeds(meds);
      } catch {
        if (!cancelled) {
          setError('Error al cargar medicamentos. Verifica la conexión.');
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
      runSearch(trimmed);
    }, 350);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery, selectedCategory]);

  async function runSearch(trimmed: string) {
    setSearching(true);
    setError(null);
    try {
      // Use advanced full-text search (25k DIGEMAPS + 83 curated) when
      // there's a text query of 2+ chars. Fall back to simple category
      // filtering for category-only searches.
      if (trimmed.length >= 2) {
        const results = await advancedSearch(trimmed, 30);
        setAdvancedResults(results);
        setFilteredMeds([]);
        setUseAdvanced(true);
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
      setError('Error en la búsqueda. Intenta de nuevo.');
      setFilteredMeds([]);
      setAdvancedResults([]);
    }
  }

  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
  };

  const totalResults = useAdvanced ? advancedResults.length : filteredMeds.length;

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#1A7A4A', '#0F1F17']}
        style={styles.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      >
        <View style={styles.topBar}>
          <View style={styles.locationContainer}>
            <MapPin size={16} color="#7ED957" />
            <Text style={styles.locationText}>Santiago, RD</Text>
          </View>
          <LanguageSelector />
        </View>

        <View style={styles.searchContainer}>
          <Search size={20} color="rgba(255, 255, 255, 0.5)" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar medicamento..."
            placeholderTextColor="rgba(255, 255, 255, 0.5)"
            value={searchQuery}
            onChangeText={handleSearchChange}
            autoCorrect={false}
            autoCapitalize="none"
          />
          <TouchableOpacity style={styles.barcodeButton}>
            <ScanBarcode size={20} color="#7ED957" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {error && (
          <View style={styles.errorBanner}>
            <AlertCircle size={20} color="#D32F2F" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#1A7A4A" />
            <Text style={styles.loadingText}>Cargando medicamentos...</Text>
          </View>
        ) : (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Categorías</Text>
              <View style={styles.categoryGrid}>
                {CATEGORIES.map((category) => (
                  <TouchableOpacity
                    key={category}
                    style={[
                      styles.categoryChip,
                      selectedCategory === category && styles.categoryChipActive,
                    ]}
                    onPress={() => setSelectedCategory(category)}
                  >
                    <Text
                      style={[
                        styles.categoryChipText,
                        selectedCategory === category && styles.categoryChipTextActive,
                      ]}
                    >
                      {category}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {searching && (
              <>
                {totalResults > 0 ? (
                  <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                      <Search size={18} color="#1A7A4A" />
                      <Text style={styles.sectionTitle}>
                        {totalResults} resultado{totalResults !== 1 ? 's' : ''}
                      </Text>
                      {useAdvanced && (
                        <View style={styles.catalogBadge}>
                          <Database size={12} color="#1A7A4A" />
                          <Text style={styles.catalogBadgeText}>
                            DIGEMAPS + Keriva
                          </Text>
                        </View>
                      )}
                    </View>

                    {/* Advanced results (from RPC full-text search) */}
                    {useAdvanced && advancedResults.map((item, idx) => (
                      <TouchableOpacity
                        key={`${item.source}-${item.id ?? idx}`}
                        style={styles.recentItem}
                        onPress={item.id ? () => router.push(`/detail?id=${item.id}`) : undefined}
                        activeOpacity={item.id ? 0.7 : 1}
                      >
                        <View style={styles.recentItemLeft}>
                          <View style={[
                            styles.pillIcon,
                            item.source === 'catalogo' && styles.pillIconCatalog,
                          ]}>
                            {item.source === 'curado' ? (
                              <Text style={styles.pillIconText}>💊</Text>
                            ) : (
                              <BookOpen size={18} color="#1A7A4A" />
                            )}
                          </View>
                          <View style={styles.recentItemInfo}>
                            <Text style={styles.recentItemName}>
                              {item.commercialName}
                              {item.dosage ? ` ${item.dosage}` : ''}
                            </Text>
                            {item.activeIngredient && (
                              <Text style={styles.recentItemIngredient} numberOfLines={1}>
                                {item.activeIngredient}
                              </Text>
                            )}
                            <View style={styles.resultMetaRow}>
                              {item.category ? (
                                <Text style={styles.recentItemCategory}>{item.category}</Text>
                              ) : null}
                              {item.manufacturer ? (
                                <Text style={styles.recentItemCategory} numberOfLines={1}>
                                  {item.manufacturer}
                                </Text>
                              ) : null}
                            </View>
                            {item.referencePrice != null && item.referencePrice > 0 ? (
                              <Text style={styles.recentItemPrice}>
                                Ref. RD${item.referencePrice.toFixed(2)}
                              </Text>
                            ) : null}
                          </View>
                        </View>
                        <View style={styles.sourceTag}>
                          <Text style={[
                            styles.sourceTagText,
                            item.source === 'curado' ? styles.sourceTagCurado : styles.sourceTagCatalog,
                          ]}>
                            {item.source === 'curado' ? 'Keriva' : 'DIGEMAPS'}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ))}

                    {/* Simple filtered results (category-only search) */}
                    {!useAdvanced && filteredMeds.map((item) => (
                      <TouchableOpacity
                        key={item.id}
                        style={styles.recentItem}
                        onPress={() => router.push(`/detail?id=${item.id}`)}
                      >
                        <View style={styles.recentItemLeft}>
                          <View style={styles.pillIcon}>
                            <Text style={styles.pillIconText}>💊</Text>
                          </View>
                          <View style={styles.recentItemInfo}>
                            <Text style={styles.recentItemName}>
                              {item.name} {item.dosage}
                            </Text>
                            <Text style={styles.recentItemCategory}>
                              {item.category}
                            </Text>
                            <Text style={styles.recentItemPrice}>
                              {item.minPrice > 0 ? `Desde RD$${item.minPrice.toFixed(2)}` : 'Precio no disponible'}
                            </Text>
                          </View>
                        </View>
                        <View style={styles.arrow}>
                          <Text style={styles.arrowText}>→</Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyStateEmoji}>🔍</Text>
                    <Text style={styles.emptyStateTitle}>No se encontraron medicamentos</Text>
                    <Text style={styles.emptyStateText}>
                      Intenta con otro término de búsqueda o categoría.{'\n'}
                      Se busca en 25,785 registros del catálogo DIGEMAPS.
                    </Text>
                  </View>
                )}
              </>
            )}

            {!searching && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <TrendingUp size={18} color="#1A7A4A" />
                  <Text style={styles.sectionTitle}>Medicamentos populares</Text>
                </View>

                {popularMeds.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyStateEmoji}>💊</Text>
                    <Text style={styles.emptyStateTitle}>No hay medicamentos disponibles</Text>
                    <Text style={styles.emptyStateText}>
                      Los medicamentos aparecerán aquí pronto
                    </Text>
                  </View>
                ) : (
                  <View style={styles.popularGrid}>
                    {popularMeds.map((med) => (
                      <TouchableOpacity
                        key={med.id}
                        style={styles.popularCard}
                        onPress={() => router.push(`/detail?id=${med.id}`)}
                      >
                        <Text style={styles.popularCardEmoji}>💊</Text>
                        <Text style={styles.popularCardName}>{med.name}</Text>
                        <Text style={styles.popularCardDosage}>{med.dosage}</Text>
                        <Text style={styles.popularCardPrice}>
                          {med.minPrice > 0 ? `Desde RD$${med.minPrice.toFixed(2)}` : 'Consultar precio'}
                        </Text>
                      </TouchableOpacity>
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
    backgroundColor: '#F8F9FA',
  },
  header: {
    paddingTop: 60,
    paddingBottom: 24,
    paddingHorizontal: 20,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  locationText: {
    fontFamily: 'DMSans-Medium',
    fontSize: 14,
    color: '#FFFFFF',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 50,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontFamily: 'DMSans-Regular',
    fontSize: 16,
    color: '#FFFFFF',
  },
  barcodeButton: {
    padding: 8,
  },
  content: {
    flex: 1,
  },
  section: {
    padding: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  sectionTitle: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 18,
    color: '#0F1F17',
  },
  recentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  recentItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  recentItemInfo: {
    flex: 1,
  },
  pillIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F0F9F4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pillIconText: {
    fontSize: 20,
  },
  recentItemName: {
    fontFamily: 'DMSans-Medium',
    fontSize: 15,
    color: '#0F1F17',
  },
  recentItemCategory: {
    fontFamily: 'DMSans-Regular',
    fontSize: 12,
    color: '#666666',
    marginTop: 2,
  },
  recentItemPrice: {
    fontFamily: 'DMSans-Regular',
    fontSize: 13,
    color: '#1A7A4A',
    marginTop: 2,
  },
  arrow: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F0F9F4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  arrowText: {
    fontSize: 16,
    color: '#1A7A4A',
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  categoryChipActive: {
    backgroundColor: '#1A7A4A',
    borderColor: '#1A7A4A',
  },
  categoryChipText: {
    fontFamily: 'DMSans-Medium',
    fontSize: 14,
    color: '#666666',
  },
  categoryChipTextActive: {
    color: '#FFFFFF',
  },
  popularGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 12,
  },
  popularCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  popularCardEmoji: {
    fontSize: 32,
    marginBottom: 8,
  },
  popularCardName: {
    fontFamily: 'DMSans-Medium',
    fontSize: 14,
    color: '#0F1F17',
    textAlign: 'center',
  },
  popularCardDosage: {
    fontFamily: 'DMSans-Regular',
    fontSize: 12,
    color: '#666666',
    textAlign: 'center',
    marginTop: 2,
  },
  popularCardPrice: {
    fontFamily: 'DMSans-Regular',
    fontSize: 12,
    color: '#1A7A4A',
    textAlign: 'center',
    marginTop: 4,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontFamily: 'DMSans-Medium',
    fontSize: 14,
    color: '#1A7A4A',
    marginTop: 12,
  },
  errorBanner: {
    backgroundColor: '#FFEBEE',
    margin: 20,
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  errorText: {
    fontFamily: 'DMSans-Medium',
    fontSize: 14,
    color: '#D32F2F',
    flex: 1,
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyStateTitle: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 18,
    color: '#0F1F17',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptyStateText: {
    fontFamily: 'DMSans-Regular',
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
  },
  pillIconCatalog: {
    backgroundColor: '#E3F2FD',
  },
  recentItemIngredient: {
    fontFamily: 'DMSans-Regular',
    fontSize: 11,
    color: '#1A7A4A',
    marginTop: 1,
  },
  resultMetaRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
    flexWrap: 'wrap',
  },
  sourceTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: '#F0F0F0',
    alignSelf: 'flex-start',
  },
  sourceTagText: {
    fontFamily: 'DMSans-Bold',
    fontSize: 9,
  },
  sourceTagCurado: {
    color: '#1A7A4A',
  },
  sourceTagCatalog: {
    color: '#0D47A1',
  },
  catalogBadge: {
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginLeft: 8,
  },
  catalogBadgeText: {
    fontFamily: 'DMSans-Bold',
    fontSize: 9,
    color: '#1A7A4A',
  },
});
