import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { MapPin, Navigation, Filter, Maximize2 } from 'lucide-react-native';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

const FILTERS = ['Abierto ahora', 'Más cercano', 'Acepta seguro'];

type Pharmacy = {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  min_price: number;
  isCheapest: boolean;
  left: string;
  top: string;
};

export default function MapScreen() {
  const [selectedFilters, setSelectedFilters] = useState<string[]>([]);
  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPharmacies();
  }, []);

  async function loadPharmacies() {
    try {
      const { data, error } = await supabase
        .from('pharmacies')
        .select(`
          id,
          name,
          address,
          latitude,
          longitude,
          prices(price)
        `);

      if (error) throw error;

      const positions = [
        { left: '30%', top: '40%' },
        { left: '60%', top: '30%' },
        { left: '45%', top: '60%' },
        { left: '25%', top: '55%' },
        { left: '70%', top: '50%' },
      ];

      const pharmaciesWithPrices = data.map((pharm: any, index: number) => {
        const minPrice = pharm.prices?.length > 0
          ? Math.min(...pharm.prices.map((p: any) => parseFloat(p.price)))
          : 0;
        return {
          id: pharm.id,
          name: pharm.name,
          address: pharm.address,
          latitude: parseFloat(pharm.latitude),
          longitude: parseFloat(pharm.longitude),
          min_price: minPrice,
          isCheapest: false,
          ...positions[index % positions.length],
        };
      });

      if (pharmaciesWithPrices.length > 0) {
        const minPrice = Math.min(...pharmaciesWithPrices.map(p => p.min_price));
        pharmaciesWithPrices.forEach(p => {
          p.isCheapest = p.min_price === minPrice;
        });
      }

      setPharmacies(pharmaciesWithPrices);
    } catch (error) {
      console.error('Error loading pharmacies:', error);
    } finally {
      setLoading(false);
    }
  }

  const toggleFilter = (filter: string) => {
    if (selectedFilters.includes(filter)) {
      setSelectedFilters(selectedFilters.filter((f) => f !== filter));
    } else {
      setSelectedFilters([...selectedFilters, filter]);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color="#7ED957" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.mapContainer}>
        <View style={styles.mapPlaceholder}>
          <View style={styles.mapGrid}>
            {Array.from({ length: 12 }).map((_, i) => (
              <View key={i} style={styles.gridLine} />
            ))}
          </View>

          {pharmacies.map((pin) => (
            <TouchableOpacity
              key={pin.id}
              style={[styles.pin, { left: pin.left, top: pin.top }]}
            >
              <View
                style={[
                  styles.pinMarker,
                  pin.isCheapest && styles.pinMarkerCheapest,
                ]}
              >
                <MapPin
                  size={20}
                  color={pin.isCheapest ? '#0F1F17' : '#FFFFFF'}
                  fill={pin.isCheapest ? '#7ED957' : '#1A7A4A'}
                />
              </View>
              {pin.isCheapest && (
                <View style={styles.cheapestBadge}>
                  <Text style={styles.cheapestBadgeText}>MÁS BARATO</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.mapControls}>
          <View style={styles.filterChipsContainer}>
            {FILTERS.map((filter) => (
              <TouchableOpacity
                key={filter}
                style={[
                  styles.filterChip,
                  selectedFilters.includes(filter) && styles.filterChipActive,
                ]}
                onPress={() => toggleFilter(filter)}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    selectedFilters.includes(filter) && styles.filterChipTextActive,
                  ]}
                >
                  {filter}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity style={styles.expandButton}>
            <Maximize2 size={20} color="#0F1F17" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.drawer}>
        <View style={styles.drawerHandle} />
        <Text style={styles.drawerTitle}>
          {pharmacies.length} farmacias encontradas
        </Text>

        <ScrollView style={styles.resultsList} showsVerticalScrollIndicator={false}>
          {pharmacies.map((pharmacy) => (
            <TouchableOpacity key={pharmacy.id} style={styles.resultCard}>
              <View style={styles.resultLeft}>
                <View
                  style={[
                    styles.resultPin,
                    pharmacy.isCheapest && styles.resultPinCheapest,
                  ]}
                >
                  <MapPin
                    size={18}
                    color={pharmacy.isCheapest ? '#0F1F17' : '#FFFFFF'}
                  />
                </View>
                <View style={styles.resultInfo}>
                  <Text style={styles.resultName}>{pharmacy.name}</Text>
                  <Text style={styles.resultAddress}>{pharmacy.address}</Text>
                </View>
              </View>
              <View style={styles.resultRight}>
                {pharmacy.isCheapest && (
                  <View style={styles.resultBestBadge}>
                    <Text style={styles.resultBestBadgeText}>MEJOR PRECIO</Text>
                  </View>
                )}
                <Text style={styles.resultPrice}>RD${pharmacy.min_price.toFixed(2)}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F1F17',
  },
  mapContainer: {
    flex: 1,
  },
  mapPlaceholder: {
    flex: 1,
    backgroundColor: '#1A2E23',
    position: 'relative',
  },
  mapGrid: {
    flex: 1,
    opacity: 0.1,
  },
  gridLine: {
    height: 1,
    backgroundColor: '#7ED957',
    marginVertical: 20,
  },
  pin: {
    position: 'absolute',
    alignItems: 'center',
  },
  pinMarker: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1A7A4A',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  pinMarkerCheapest: {
    backgroundColor: '#7ED957',
    borderColor: '#0F1F17',
  },
  cheapestBadge: {
    backgroundColor: '#0F1F17',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginTop: 4,
  },
  cheapestBadgeText: {
    fontFamily: 'DMSans-Bold',
    fontSize: 9,
    color: '#7ED957',
    letterSpacing: 0.5,
  },
  mapControls: {
    position: 'absolute',
    top: 60,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  filterChipsContainer: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginRight: 12,
  },
  filterChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },
  filterChipActive: {
    backgroundColor: '#7ED957',
    borderColor: '#7ED957',
  },
  filterChipText: {
    fontFamily: 'DMSans-Medium',
    fontSize: 13,
    color: '#0F1F17',
  },
  filterChipTextActive: {
    color: '#0F1F17',
  },
  expandButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  drawer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingHorizontal: 20,
    maxHeight: '45%',
  },
  drawerHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  drawerTitle: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 18,
    color: '#0F1F17',
    marginBottom: 16,
  },
  resultsList: {
    flex: 1,
  },
  resultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  resultLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  resultPin: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1A7A4A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  resultPinCheapest: {
    backgroundColor: '#7ED957',
  },
  resultInfo: {
    flex: 1,
  },
  resultName: {
    fontFamily: 'DMSans-Medium',
    fontSize: 15,
    color: '#0F1F17',
    marginBottom: 4,
  },
  resultAddress: {
    fontFamily: 'DMSans-Regular',
    fontSize: 13,
    color: '#666666',
  },
  resultRight: {
    alignItems: 'flex-end',
  },
  resultBestBadge: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginBottom: 4,
  },
  resultBestBadgeText: {
    fontFamily: 'DMSans-Bold',
    fontSize: 10,
    color: '#1A7A4A',
  },
  resultPrice: {
    fontFamily: 'Poppins-Bold',
    fontSize: 18,
    color: '#1A7A4A',
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});
