import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Linking, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, MapPin, Navigation, ExternalLink } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useState, useEffect } from 'react';
import { getMedicationDetail, type MedicationDetailView } from '@/lib/api/medicamentos';
import {
  findProductoByMedicamentoName,
  getAffiliatedPharmacies,
} from '@/lib/api/precios';
import KerivaLoader from '@/components/KerivaLoader';
import PriceRangeCard from '@/components/PriceRangeCard';

const AVAILABILITY_DAYS = [
  { day: 'L', available: true },
  { day: 'M', available: true },
  { day: 'M', available: true },
  { day: 'J', available: true },
  { day: 'V', available: true },
  { day: 'S', available: false },
  { day: 'D', available: false },
];

type AffiliatedPharmacy = {
  farmaciaId: number;
  nombre: string;
  direccion: string;
  descuento: number | null;
};

export default function DetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const [medication, setMedication] = useState<MedicationDetailView | null>(null);
  const [loading, setLoading] = useState(true);
  // Adendum v2.1 — producto matcheado y farmacias afiliadas
  const [skuId, setSkuId] = useState<string | null>(null);
  const [nombreComercial, setNombreComercial] = useState<string | null>(null);
  const [affiliated, setAffiliated] = useState<AffiliatedPharmacy[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const medicationId = params.id as string | undefined;
        if (!medicationId) {
          if (!cancelled) setLoading(false);
          return;
        }
        const data = await getMedicationDetail(medicationId);
        if (!cancelled) setMedication(data);

        if (data) {
          // Intenta matchear el medicamento a un producto del adendum
          const producto = await findProductoByMedicamentoName(data.name, data.genericName);
          if (!cancelled && producto) {
            setSkuId(producto.id);
            setNombreComercial(producto.nombreComercial);
          }

          // Farmacias afiliadas (max 5) para mostrar rangos
          const afiliadas = await getAffiliatedPharmacies(5);
          if (!cancelled) setAffiliated(afiliadas);
        }
      } catch {
        if (!cancelled) setMedication(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  if (loading) {
    return <KerivaLoader label="Cargando detalle…" />;
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

  const { minPrice, avgPrice } = medication;
  const savings = avgPrice > minPrice ? avgPrice - minPrice : 0;
  const cheapestPharmacy = medication.prices[0] ?? null;

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#106B4F', '#052419']}
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
        {/* Adendum v2.1 §3.3 — Rango estimado + auditoría comunitaria */}
        {skuId && affiliated.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Precio estimado en farmacias afiliadas</Text>
            {affiliated.map((f) => (
              <View key={f.farmaciaId} style={styles.pharmacyBlock}>
                <View style={styles.pharmacyBlockHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.pharmacyBlockName}>{f.nombre}</Text>
                    <View style={styles.locationRow}>
                      <MapPin size={12} color="#666" />
                      <Text style={styles.pharmacyBlockAddr} numberOfLines={1}>
                        {f.direccion}
                      </Text>
                    </View>
                  </View>
                  {f.descuento !== null && f.descuento > 0 && (
                    <View style={styles.descuentoBadge}>
                      <Text style={styles.descuentoText}>-{Math.round(f.descuento)}%</Text>
                    </View>
                  )}
                </View>
                <PriceRangeCard
                  skuId={skuId}
                  farmaciaId={f.farmaciaId}
                  medicamentoNombre={nombreComercial ?? medication.name}
                />
              </View>
            ))}
          </View>
        )}

        {/* Estado: no hay producto matcheado todavía */}
        {!skuId && (
          <View style={styles.infoBanner}>
            <Text style={styles.infoBannerTitle}>Precio de referencia próximamente</Text>
            <Text style={styles.infoBannerText}>
              Estamos calibrando el precio de este medicamento. Mientras tanto, consulta
              directamente con las farmacias.
            </Text>
          </View>
        )}

        {/* Estado: producto matcheado pero sin farmacias afiliadas */}
        {skuId && affiliated.length === 0 && (
          <View style={styles.infoBanner}>
            <Text style={styles.infoBannerTitle}>Sin farmacias afiliadas aún</Text>
            <Text style={styles.infoBannerText}>
              Pronto tendremos farmacias afiliadas con precios estimados y reserva por WhatsApp.
            </Text>
          </View>
        )}

        {/* Legado: card compacto del mejor precio reportado (se mantiene como referencia
            histórica hasta que se depreque el flujo viejo en Fase 2). */}
        {!skuId && cheapestPharmacy && (
          <View style={styles.pharmacyCard}>
            <View style={styles.pharmacyHeader}>
              <View>
                <Text style={styles.pharmacyName}>{cheapestPharmacy.pharmacyName}</Text>
                <View style={styles.locationRow}>
                  <MapPin size={14} color="#666666" />
                  <Text style={styles.locationText}>{cheapestPharmacy.pharmacyAddress}</Text>
                </View>
              </View>
            </View>

            <View style={styles.priceContainer}>
              <Text style={styles.priceLabel}>Mejor precio reportado</Text>
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

        {medication.genericName && medication.genericName !== medication.name && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Opción genérica disponible</Text>
            <View style={styles.genericCard}>
              <View style={styles.genericLeft}>
                <Text style={styles.genericBadge}>GENÉRICO</Text>
                <Text style={styles.genericName}>{medication.genericName}</Text>
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
            {medication.prices.slice(1).map((priceData, index) => (
              <View key={index} style={styles.otherPharmacyCard}>
                <View style={styles.otherPharmacyLeft}>
                  <Text style={styles.otherPharmacyName}>
                    {priceData.pharmacyName}
                  </Text>
                  <Text style={styles.otherPharmacyAddress}>
                    {priceData.pharmacyAddress}
                  </Text>
                </View>
                <Text style={styles.otherPharmacyPrice}>
                  RD${priceData.price.toFixed(2)}
                </Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sobre este medicamento</Text>
          <Text style={styles.description}>
            {medication.category} - {medication.name}
            {medication.genericName && ` (${medication.genericName})`}
          </Text>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: 20 + insets.bottom }]}>
        <View style={styles.directionsRow}>
          <TouchableOpacity
            style={styles.directionsButton}
            onPress={() => {
              const lat = medication.prices[0]?.latitude;
              const lng = medication.prices[0]?.longitude;
              if (!lat || !lng) return;
              const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
              if (Platform.OS === 'web') {
                window.open(url, '_blank');
              } else {
                Linking.openURL(url);
              }
            }}
          >
            <Navigation size={18} color="#FFFFFF" />
            <Text style={styles.directionsButtonText}>Google Maps</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.wazeButton}
            onPress={() => {
              const lat = medication.prices[0]?.latitude;
              const lng = medication.prices[0]?.longitude;
              if (!lat || !lng) return;
              const url = `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`;
              if (Platform.OS === 'web') {
                window.open(url, '_blank');
              } else {
                Linking.openURL(url);
              }
            }}
          >
            <ExternalLink size={18} color="#106B4F" />
            <Text style={styles.wazeButtonText}>Waze</Text>
          </TouchableOpacity>
        </View>
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
    color: '#052419',
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
    color: '#106B4F',
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
    color: '#052419',
    marginBottom: 12,
  },
  pharmacyBlock: {
    marginBottom: 4,
  },
  pharmacyBlockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
    marginBottom: 6,
  },
  pharmacyBlockName: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 14,
    color: '#052419',
  },
  pharmacyBlockAddr: {
    fontFamily: 'DMSans-Regular',
    fontSize: 12,
    color: '#666',
    flex: 1,
  },
  descuentoBadge: {
    backgroundColor: '#34C26A',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginLeft: 8,
  },
  descuentoText: {
    fontFamily: 'Poppins-Bold',
    fontSize: 11,
    color: '#FFFFFF',
  },
  infoBanner: {
    backgroundColor: 'rgba(52, 194, 106, 0.08)',
    borderLeftWidth: 3,
    borderLeftColor: '#34C26A',
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 14,
    borderRadius: 8,
  },
  infoBannerTitle: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 14,
    color: '#106B4F',
    marginBottom: 4,
  },
  infoBannerText: {
    fontFamily: 'DMSans-Regular',
    fontSize: 13,
    color: '#052419',
    lineHeight: 18,
  },
  genericCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#34C26A',
  },
  genericLeft: {
    flex: 1,
  },
  genericBadge: {
    fontFamily: 'DMSans-Bold',
    fontSize: 10,
    color: '#106B4F',
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
    color: '#052419',
  },
  genericPrice: {
    fontFamily: 'Poppins-Bold',
    fontSize: 24,
    color: '#106B4F',
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
    backgroundColor: '#34C26A',
  },
  availabilityDayText: {
    fontFamily: 'DMSans-Bold',
    fontSize: 14,
    color: '#999999',
  },
  availabilityDayTextActive: {
    color: '#052419',
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
  directionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  directionsButton: {
    flex: 1,
    backgroundColor: '#106B4F',
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  directionsButtonText: {
    fontFamily: 'Poppins-Bold',
    fontSize: 14,
    color: '#FFFFFF',
  },
  wazeButton: {
    flex: 1,
    backgroundColor: '#F0F7F2',
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#D4E8DA',
  },
  wazeButtonText: {
    fontFamily: 'Poppins-Bold',
    fontSize: 14,
    color: '#106B4F',
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyStateTitle: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 18,
    color: '#052419',
    marginBottom: 16,
  },
  backButtonEmpty: {
    backgroundColor: '#106B4F',
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
    color: '#052419',
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
    color: '#106B4F',
  },
});
