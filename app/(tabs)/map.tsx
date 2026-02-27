import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Animated } from 'react-native';
import { MapPin, Phone, Clock, ArrowLeft, AlertCircle } from 'lucide-react-native';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';

const FILTERS = ['Abierto ahora', 'Más cercano', 'Acepta seguro'];

const SANTIAGO_BOUNDS = {
  minLat: 19.430,
  maxLat: 19.480,
  minLng: -70.720,
  maxLng: -70.670,
};

type Pharmacy = {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  phone: string;
  hours: string;
  active: boolean;
  min_price: number;
  isCheapest: boolean;
};

export default function MapScreen() {
  const router = useRouter();
  const [selectedFilters, setSelectedFilters] = useState<string[]>([]);
  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([]);
  const [selectedPharmacy, setSelectedPharmacy] = useState<Pharmacy | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const slideAnim = useRef(new Animated.Value(300)).current;

  useEffect(() => {
    loadPharmacies();
  }, []);

  useEffect(() => {
    if (selectedPharmacy) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 50,
        friction: 8,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: 300,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [selectedPharmacy]);

  async function loadPharmacies() {
    console.log('Loading pharmacies from database...');
    try {
      setError(null);
      const { data, error } = await supabase
        .from('pharmacies')
        .select(`
          id,
          name,
          address,
          latitude,
          longitude,
          phone,
          hours,
          active,
          prices(price)
        `)
        .eq('active', true);

      console.log('Pharmacies query response:', { data, error });

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }

      const pharmaciesWithPrices = (data || []).map((pharm: any) => {
        const minPrice = pharm.prices?.length > 0
          ? Math.min(...pharm.prices.map((p: any) => parseFloat(p.price)))
          : 0;
        return {
          id: pharm.id,
          name: pharm.name,
          address: pharm.address,
          latitude: parseFloat(pharm.latitude),
          longitude: parseFloat(pharm.longitude),
          phone: pharm.phone || 'No disponible',
          hours: pharm.hours || 'Consultar horario',
          active: pharm.active,
          min_price: minPrice,
          isCheapest: false,
        };
      });

      if (pharmaciesWithPrices.length > 0) {
        const minPrice = Math.min(...pharmaciesWithPrices.filter(p => p.min_price > 0).map(p => p.min_price));
        pharmaciesWithPrices.forEach(p => {
          p.isCheapest = p.min_price === minPrice && p.min_price > 0;
        });
      }

      console.log('Processed pharmacies:', pharmaciesWithPrices);
      setPharmacies(pharmaciesWithPrices);
    } catch (error) {
      console.error('Error loading pharmacies:', error);
      setError('Error al cargar farmacias. Verifica la conexión.');
    } finally {
      setLoading(false);
    }
  }

  const latLngToPosition = (lat: number, lng: number) => {
    const x = ((lng - SANTIAGO_BOUNDS.minLng) / (SANTIAGO_BOUNDS.maxLng - SANTIAGO_BOUNDS.minLng)) * 100;
    const y = ((SANTIAGO_BOUNDS.maxLat - lat) / (SANTIAGO_BOUNDS.maxLat - SANTIAGO_BOUNDS.minLat)) * 100;

    return {
      left: `${Math.max(5, Math.min(95, x))}%`,
      top: `${Math.max(5, Math.min(95, y))}%`,
    };
  };

  const toggleFilter = (filter: string) => {
    if (selectedFilters.includes(filter)) {
      setSelectedFilters(selectedFilters.filter((f) => f !== filter));
    } else {
      setSelectedFilters([...selectedFilters, filter]);
    }
  };

  const handlePinPress = (pharmacy: Pharmacy) => {
    console.log('Pharmacy selected:', pharmacy.name);
    setSelectedPharmacy(pharmacy);
  };

  const closePharmacyCard = () => {
    setSelectedPharmacy(null);
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color="#7ED957" />
        <Text style={styles.loadingText}>Cargando farmacias...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => router.push('/(tabs)')}
      >
        <ArrowLeft size={24} color="#FFFFFF" />
      </TouchableOpacity>

      {error && (
        <View style={styles.errorBanner}>
          <AlertCircle size={20} color="#D32F2F" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <View style={styles.mapContainer}>
        <View style={styles.mapPlaceholder}>
          <View style={styles.mapGrid}>
            {Array.from({ length: 12 }).map((_, i) => (
              <View key={i} style={styles.gridLine} />
            ))}
          </View>

          {pharmacies.length === 0 ? (
            <View style={styles.emptyMapState}>
              <Text style={styles.emptyMapEmoji}>🏥</Text>
              <Text style={styles.emptyMapText}>No hay farmacias disponibles</Text>
            </View>
          ) : (
            pharmacies.map((pharmacy) => {
              const position = latLngToPosition(pharmacy.latitude, pharmacy.longitude);
              return (
                <TouchableOpacity
                  key={pharmacy.id}
                  style={[styles.pin, { left: position.left, top: position.top }]}
                  onPress={() => handlePinPress(pharmacy)}
                >
                  <View
                    style={[
                      styles.pinMarker,
                      pharmacy.isCheapest && styles.pinMarkerCheapest,
                      selectedPharmacy?.id === pharmacy.id && styles.pinMarkerSelected,
                    ]}
                  >
                    <MapPin
                      size={20}
                      color={pharmacy.isCheapest ? '#0F1F17' : '#FFFFFF'}
                      fill={pharmacy.isCheapest ? '#7ED957' : '#1A7A4A'}
                    />
                  </View>
                  <View style={styles.pinLabel}>
                    <Text style={styles.pinLabelText} numberOfLines={1}>
                      {pharmacy.name}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
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
        </View>
      </View>

      <View style={styles.drawer}>
        <View style={styles.drawerHandle} />
        <Text style={styles.drawerTitle}>
          {pharmacies.length} farmacias encontradas
        </Text>

        <ScrollView style={styles.resultsList} showsVerticalScrollIndicator={false}>
          {pharmacies.map((pharmacy) => (
            <TouchableOpacity
              key={pharmacy.id}
              style={styles.resultCard}
              onPress={() => handlePinPress(pharmacy)}
            >
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
                {pharmacy.min_price > 0 && (
                  <Text style={styles.resultPrice}>RD${pharmacy.min_price.toFixed(2)}</Text>
                )}
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {selectedPharmacy && (
        <Animated.View
          style={[
            styles.pharmacyDetailCard,
            { transform: [{ translateY: slideAnim }] },
          ]}
        >
          <View style={styles.pharmacyDetailHeader}>
            <View style={styles.pharmacyDetailTitleRow}>
              <MapPin size={24} color="#1A7A4A" />
              <Text style={styles.pharmacyDetailTitle}>{selectedPharmacy.name}</Text>
            </View>
            <TouchableOpacity onPress={closePharmacyCard} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.pharmacyDetailInfo}>
            <View style={styles.pharmacyDetailRow}>
              <MapPin size={18} color="#666" />
              <Text style={styles.pharmacyDetailText}>{selectedPharmacy.address}</Text>
            </View>

            <View style={styles.pharmacyDetailRow}>
              <Clock size={18} color="#666" />
              <Text style={styles.pharmacyDetailText}>{selectedPharmacy.hours}</Text>
            </View>

            <View style={styles.pharmacyDetailRow}>
              <Phone size={18} color="#666" />
              <Text style={styles.pharmacyDetailText}>{selectedPharmacy.phone}</Text>
            </View>

            {selectedPharmacy.min_price > 0 && (
              <View style={styles.pharmacyPriceRow}>
                <Text style={styles.pharmacyPriceLabel}>Precio más bajo:</Text>
                <Text style={styles.pharmacyPriceValue}>
                  RD${selectedPharmacy.min_price.toFixed(2)}
                </Text>
              </View>
            )}
          </View>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F1F17',
  },
  backButton: {
    position: 'absolute',
    top: 60,
    left: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(26, 122, 74, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1001,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
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
  pinMarkerSelected: {
    transform: [{ scale: 1.2 }],
    borderWidth: 4,
  },
  pinLabel: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 6,
    maxWidth: 120,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  pinLabelText: {
    fontFamily: 'DMSans-Medium',
    fontSize: 11,
    color: '#0F1F17',
    textAlign: 'center',
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
  loadingText: {
    fontFamily: 'DMSans-Medium',
    fontSize: 14,
    color: '#7ED957',
    marginTop: 12,
  },
  errorBanner: {
    position: 'absolute',
    top: 60,
    left: 20,
    right: 20,
    backgroundColor: '#FFEBEE',
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    zIndex: 1000,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  errorText: {
    fontFamily: 'DMSans-Medium',
    fontSize: 14,
    color: '#D32F2F',
    flex: 1,
  },
  pharmacyDetailCard: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  pharmacyDetailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  pharmacyDetailTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  pharmacyDetailTitle: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 20,
    color: '#0F1F17',
    flex: 1,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontFamily: 'DMSans-Bold',
    fontSize: 18,
    color: '#666',
  },
  pharmacyDetailInfo: {
    gap: 16,
  },
  pharmacyDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  pharmacyDetailText: {
    fontFamily: 'DMSans-Regular',
    fontSize: 15,
    color: '#333',
    flex: 1,
  },
  pharmacyPriceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  pharmacyPriceLabel: {
    fontFamily: 'DMSans-Medium',
    fontSize: 14,
    color: '#1A7A4A',
  },
  pharmacyPriceValue: {
    fontFamily: 'Poppins-Bold',
    fontSize: 20,
    color: '#1A7A4A',
  },
  emptyMapState: {
    position: 'absolute',
    top: '40%',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyMapEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyMapText: {
    fontFamily: 'DMSans-Medium',
    fontSize: 16,
    color: '#7ED957',
    textAlign: 'center',
  },
});
