import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, MapPin, Navigation } from 'lucide-react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

const AVAILABILITY_DAYS = [
  { day: 'L', available: true },
  { day: 'M', available: true },
  { day: 'M', available: true },
  { day: 'J', available: true },
  { day: 'V', available: true },
  { day: 'S', available: false },
  { day: 'D', available: false },
];

type MedicationDetail = {
  id: string;
  name: string;
  dosage: string;
  category: string;
  generic_name: string | null;
  prices: Array<{
    price: string;
    pharmacy: {
      name: string;
      address: string;
    };
  }>;
};

export default function DetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [medication, setMedication] = useState<MedicationDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMedicationDetail();
  }, []);

  async function loadMedicationDetail() {
    try {
      const { data, error } = await supabase
        .from('medications')
        .select(`
          id,
          name,
          dosage,
          category,
          generic_name,
          prices(
            price,
            pharmacies(name, address)
          )
        `)
        .limit(1)
        .single();

      if (error) throw error;
      setMedication(data as any);
    } catch (error) {
      console.error('Error loading medication:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color="#1A7A4A" />
      </View>
    );
  }

  if (!medication) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <Text style={styles.emptyStateTitle}>Medicamento no encontrado</Text>
        <TouchableOpacity
          style={styles.backButtonEmpty}
          onPress={() => router.push('/(tabs)')}
        >
          <Text style={styles.backButtonText}>Volver</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const prices = medication.prices.map((p: any) => parseFloat(p.price));
  const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
  const avgPrice = prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : 0;
  const savings = avgPrice > minPrice ? avgPrice - minPrice : 0;

  const cheapestPharmacy = medication.prices.find(
    (p: any) => parseFloat(p.price) === minPrice
  )?.pharmacies;

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#1A7A4A', '#0F1F17']}
        style={styles.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      >
        <TouchableOpacity style={styles.backButton} onPress={() => router.push('/(tabs)')}>
          <ArrowLeft size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {medication.name} {medication.dosage}
        </Text>
        <Text style={styles.headerSubtitle}>{medication.category}</Text>
      </LinearGradient>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {cheapestPharmacy && (
          <View style={styles.pharmacyCard}>
            <View style={styles.pharmacyHeader}>
              <View>
                <Text style={styles.pharmacyName}>{cheapestPharmacy.name}</Text>
                <View style={styles.locationRow}>
                  <MapPin size={14} color="#666666" />
                  <Text style={styles.locationText}>{cheapestPharmacy.address}</Text>
                </View>
              </View>
            </View>

            <View style={styles.priceContainer}>
              <Text style={styles.priceLabel}>Mejor precio</Text>
              <Text style={styles.price}>RD${minPrice.toFixed(2)}</Text>
            </View>

            {savings > 0 && (
              <View style={styles.savingsBadge}>
                <Text style={styles.savingsBadgeText}>
                  💰 Ahorras RD${savings.toFixed(2)} vs promedio
                </Text>
              </View>
            )}
          </View>
        )}

        {medication.generic_name && medication.generic_name !== medication.name && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Opción genérica disponible</Text>
            <View style={styles.genericCard}>
              <View style={styles.genericLeft}>
                <Text style={styles.genericBadge}>GENÉRICO</Text>
                <Text style={styles.genericName}>{medication.generic_name}</Text>
              </View>
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Disponibilidad</Text>
          <View style={styles.availabilityGrid}>
            {AVAILABILITY_DAYS.map((item, index) => (
              <View
                key={index}
                style={[
                  styles.availabilityDay,
                  item.available && styles.availabilityDayActive,
                ]}
              >
                <Text
                  style={[
                    styles.availabilityDayText,
                    item.available && styles.availabilityDayTextActive,
                  ]}
                >
                  {item.day}
                </Text>
              </View>
            ))}
          </View>
          <Text style={styles.availabilityNote}>
            Lunes a Viernes: 8:00 AM - 8:00 PM
          </Text>
        </View>

        {medication.prices.length > 1 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Otras farmacias</Text>
            {medication.prices.slice(1).map((priceData: any, index: number) => (
              <View key={index} style={styles.otherPharmacyCard}>
                <View style={styles.otherPharmacyLeft}>
                  <Text style={styles.otherPharmacyName}>
                    {priceData.pharmacies.name}
                  </Text>
                  <Text style={styles.otherPharmacyAddress}>
                    {priceData.pharmacies.address}
                  </Text>
                </View>
                <Text style={styles.otherPharmacyPrice}>
                  RD${parseFloat(priceData.price).toFixed(2)}
                </Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sobre este medicamento</Text>
          <Text style={styles.description}>
            {medication.category} - {medication.name}
            {medication.generic_name && ` (${medication.generic_name})`}
          </Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.directionsButton}>
          <Navigation size={20} color="#FFFFFF" />
          <Text style={styles.directionsButtonText}>Cómo llegar</Text>
        </TouchableOpacity>
      </View>
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
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerTitle: {
    fontFamily: 'Poppins-Bold',
    fontSize: 28,
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontFamily: 'DMSans-Regular',
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 4,
  },
  content: {
    flex: 1,
  },
  pharmacyCard: {
    backgroundColor: '#FFFFFF',
    margin: 20,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  pharmacyHeader: {
    marginBottom: 16,
  },
  pharmacyName: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 18,
    color: '#0F1F17',
    marginBottom: 4,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  locationText: {
    fontFamily: 'DMSans-Regular',
    fontSize: 13,
    color: '#666666',
  },
  priceContainer: {
    paddingVertical: 20,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#F0F0F0',
    alignItems: 'center',
  },
  priceLabel: {
    fontFamily: 'DMSans-Regular',
    fontSize: 14,
    color: '#666666',
    marginBottom: 4,
  },
  price: {
    fontFamily: 'Poppins-Bold',
    fontSize: 42,
    color: '#1A7A4A',
  },
  savingsBadge: {
    backgroundColor: '#FFF3E0',
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
  },
  savingsBadgeText: {
    fontFamily: 'DMSans-Medium',
    fontSize: 14,
    color: '#F57C00',
    textAlign: 'center',
  },
  insuranceBadge: {
    backgroundColor: '#E3F2FD',
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  insuranceBadgeIcon: {
    fontSize: 28,
  },
  insuranceBadgeContent: {
    flex: 1,
  },
  insuranceBadgeTitle: {
    fontFamily: 'DMSans-Medium',
    fontSize: 14,
    color: '#1976D2',
    marginBottom: 2,
  },
  insuranceBadgeSubtitle: {
    fontFamily: 'DMSans-Regular',
    fontSize: 13,
    color: '#1976D2',
    opacity: 0.8,
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 16,
    color: '#0F1F17',
    marginBottom: 12,
  },
  genericCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#7ED957',
  },
  genericLeft: {
    flex: 1,
  },
  genericBadge: {
    fontFamily: 'DMSans-Bold',
    fontSize: 10,
    color: '#1A7A4A',
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  genericName: {
    fontFamily: 'DMSans-Medium',
    fontSize: 14,
    color: '#0F1F17',
  },
  genericPrice: {
    fontFamily: 'Poppins-Bold',
    fontSize: 24,
    color: '#1A7A4A',
  },
  availabilityGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  availabilityDay: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  availabilityDayActive: {
    backgroundColor: '#7ED957',
  },
  availabilityDayText: {
    fontFamily: 'DMSans-Bold',
    fontSize: 14,
    color: '#999999',
  },
  availabilityDayTextActive: {
    color: '#0F1F17',
  },
  availabilityNote: {
    fontFamily: 'DMSans-Regular',
    fontSize: 13,
    color: '#666666',
  },
  description: {
    fontFamily: 'DMSans-Regular',
    fontSize: 14,
    color: '#666666',
    lineHeight: 22,
  },
  footer: {
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  directionsButton: {
    backgroundColor: '#1A7A4A',
    borderRadius: 12,
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  directionsButtonText: {
    fontFamily: 'Poppins-Bold',
    fontSize: 16,
    color: '#FFFFFF',
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyStateTitle: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 18,
    color: '#0F1F17',
    marginBottom: 16,
  },
  backButtonEmpty: {
    backgroundColor: '#1A7A4A',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  backButtonText: {
    fontFamily: 'DMSans-Bold',
    fontSize: 14,
    color: '#FFFFFF',
  },
  otherPharmacyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  otherPharmacyLeft: {
    flex: 1,
    marginRight: 12,
  },
  otherPharmacyName: {
    fontFamily: 'DMSans-Medium',
    fontSize: 15,
    color: '#0F1F17',
    marginBottom: 4,
  },
  otherPharmacyAddress: {
    fontFamily: 'DMSans-Regular',
    fontSize: 13,
    color: '#666666',
  },
  otherPharmacyPrice: {
    fontFamily: 'Poppins-Bold',
    fontSize: 18,
    color: '#1A7A4A',
  },
});
