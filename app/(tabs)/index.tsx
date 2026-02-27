import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Search, ScanBarcode, MapPin, Clock } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

const CATEGORIES = ['Todo', 'Diabetes', 'Presión', 'Antibióticos'];

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
  const [medications, setMedications] = useState<Medication[]>([]);
  const [popularMeds, setPopularMeds] = useState<Medication[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMedications();
  }, []);

  async function loadMedications() {
    try {
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

      if (error) throw error;

      const medsWithPrices = data.map((med: any) => ({
        id: med.id,
        name: med.name,
        dosage: med.dosage,
        category: med.category,
        min_price: med.prices?.length > 0
          ? Math.min(...med.prices.map((p: any) => parseFloat(p.price)))
          : 0,
      }));

      setMedications(medsWithPrices.slice(0, 3));
      setPopularMeds(medsWithPrices.slice(3, 7));
    } catch (error) {
      console.error('Error loading medications:', error);
    } finally {
      setLoading(false);
    }
  }

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
            onChangeText={setSearchQuery}
          />
          <TouchableOpacity style={styles.barcodeButton}>
            <ScanBarcode size={20} color="#7ED957" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#1A7A4A" />
          </View>
        ) : (
          <>
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Clock size={18} color="#1A7A4A" />
                <Text style={styles.sectionTitle}>Búsquedas recientes</Text>
              </View>

              {medications.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.recentItem}
                  onPress={() => router.push('/detail')}
                >
                  <View style={styles.recentItemLeft}>
                    <View style={styles.pillIcon}>
                      <Text style={styles.pillIconText}>💊</Text>
                    </View>
                    <View>
                      <Text style={styles.recentItemName}>
                        {item.name} {item.dosage}
                      </Text>
                      <Text style={styles.recentItemPrice}>
                        Desde RD${item.min_price.toFixed(2)}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.arrow}>
                    <Text style={styles.arrowText}>→</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

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

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Medicamentos populares</Text>
              <View style={styles.popularGrid}>
                {popularMeds.map((med) => (
                  <TouchableOpacity key={med.id} style={styles.popularCard}>
                    <Text style={styles.popularCardEmoji}>💊</Text>
                    <Text style={styles.popularCardName}>{med.name}</Text>
                    <Text style={styles.popularCardPrice}>
                      Desde RD${med.min_price.toFixed(2)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
        </View>
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
});
