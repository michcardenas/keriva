import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Search, ScanBarcode, MapPin, TrendingUp, AlertCircle } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';

const CATEGORIES = ['Todo', 'Antidiabético', 'Antihipertensivo', 'Estatina'];

type Medication = {
  id: string;
  name: string;
  dosage: string;
  category: string;
  min_price: number;
};

export default function SearchScreen() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todo');
  const [filteredMeds, setFilteredMeds] = useState<Medication[]>([]);
  const [popularMeds, setPopularMeds] = useState<Medication[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadPopularMedications();
  }, []);

  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (!searchQuery.trim() && selectedCategory === 'Todo') {
      setFilteredMeds([]);
      setSearching(false);
      return;
    }

    searchTimeoutRef.current = setTimeout(() => {
      searchMedications();
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery, selectedCategory]);

  async function loadPopularMedications() {
    console.log('Loading popular medications...');
    try {
      setError(null);
      const { data, error } = await supabase
        .from('medications')
        .select(`
          id,
          name,
          dosage,
          category,
          prices(price)
        `)
        .order('created_at', { ascending: false })
        .limit(6);

      console.log('Popular medications response:', { data, error });

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }

      const medsWithPrices = (data || []).map((med: any) => ({
        id: med.id,
        name: med.name,
        dosage: med.dosage,
        category: med.category,
        min_price: med.prices?.length > 0
          ? Math.min(...med.prices.map((p: any) => parseFloat(p.price)))
          : 0,
      }));

      console.log('Processed medications:', medsWithPrices);
      setPopularMeds(medsWithPrices);
    } catch (error) {
      console.error('Error loading medications:', error);
      setError('Error al cargar medicamentos. Verifica la conexión.');
    } finally {
      setLoading(false);
    }
  }

  async function searchMedications() {
    console.log('Searching medications with query:', searchQuery, 'category:', selectedCategory);
    setSearching(true);
    setError(null);

    try {
      let query = supabase
        .from('medications')
        .select(`
          id,
          name,
          dosage,
          category,
          prices(price)
        `);

      if (searchQuery.trim()) {
        query = query.or(`name.ilike.%${searchQuery}%,dosage.ilike.%${searchQuery}%`);
      }

      if (selectedCategory !== 'Todo') {
        query = query.eq('category', selectedCategory);
      }

      const { data, error } = await query.limit(20);

      console.log('Search response:', { data, error });

      if (error) {
        console.error('Search error:', error);
        throw error;
      }

      const medsWithPrices = (data || []).map((med: any) => ({
        id: med.id,
        name: med.name,
        dosage: med.dosage,
        category: med.category,
        min_price: med.prices?.length > 0
          ? Math.min(...med.prices.map((p: any) => parseFloat(p.price)))
          : 0,
      }));

      console.log('Search results:', medsWithPrices.length, 'medications');
      setFilteredMeds(medsWithPrices);
    } catch (error) {
      console.error('Error searching medications:', error);
      setError('Error en la búsqueda. Intenta de nuevo.');
      setFilteredMeds([]);
    }
  }

  const handleSearchChange = (text: string) => {
    console.log('Search input changed:', text);
    setSearchQuery(text);
  };

  const testDatabaseConnection = async () => {
    console.log('Testing database connection...');
    try {
      const { data, error, count } = await supabase
        .from('medications')
        .select('*', { count: 'exact' })
        .limit(1);

      console.log('Test query result:', { data, error, count });
      if (error) {
        setError(`DB Error: ${error.message}`);
      } else {
        setError(`Conexión OK! ${count} medicamentos en total`);
      }
    } catch (err) {
      console.error('Connection test failed:', err);
      setError(`Error de conexión: ${err}`);
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#1A7A4A', '#0F1F17']}
        style={styles.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      >
        <View style={styles.locationContainer}>
          <MapPin size={16} color="#7ED957" />
          <Text style={styles.locationText}>Santiago, RD</Text>
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
                {filteredMeds.length > 0 ? (
                  <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                      <Search size={18} color="#1A7A4A" />
                      <Text style={styles.sectionTitle}>
                        {filteredMeds.length} resultado{filteredMeds.length !== 1 ? 's' : ''}
                      </Text>
                    </View>

                    {filteredMeds.map((item) => (
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
                              {item.min_price > 0 ? `Desde RD$${item.min_price.toFixed(2)}` : 'Precio no disponible'}
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
                      Intenta con otro término de búsqueda o categoría
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
                          {med.min_price > 0 ? `Desde RD$${med.min_price.toFixed(2)}` : 'Consultar precio'}
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
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
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
});
