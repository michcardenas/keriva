import { View, Text, StyleSheet, ScrollView, Linking, Platform } from 'react-native';
import { ArrowLeft, MapPin, Map as MapIcon, Navigation, ShoppingBag, Check, Clock } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { getUserLocation } from '@/lib/location';
import { getSucursalesConProducto, type SucursalDisponible } from '@/lib/api/inventario';
import { createReserva } from '@/lib/api/reservas';
import { getMedicationDetail, type MedicationDetailView } from '@/lib/api/medicamentos';
import {
  findProductoByMedicamentoName,
  getAffiliatedPharmacies,
} from '@/lib/api/precios';
import KerivaLoader from '@/components/KerivaLoader';
import PriceRangeCard from '@/components/PriceRangeCard';
import PressableScale from '@/components/ui/PressableScale';
import Reveal from '@/components/ui/Reveal';
import PillBackground from '@/components/ui/PillBackground';
import { useLanguage } from '@/lib/LanguageContext';
import { theme } from '@/lib/theme';
import { capture } from '@/lib/analytics';
import { isOpenNow } from '@/lib/horarios';
import { logSinDisponibilidad } from '@/lib/api/eventos';

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
  latitud: number | null;
  longitud: number | null;
};

// Distancia Haversine en km entre dos puntos.
function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

export default function DetailScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const [medication, setMedication] = useState<MedicationDetailView | null>(null);
  const [loading, setLoading] = useState(true);
  // Adendum v2.1 — producto matcheado y farmacias afiliadas
  const [skuId, setSkuId] = useState<string | null>(null);
  const [nombreComercial, setNombreComercial] = useState<string | null>(null);
  const [affiliated, setAffiliated] = useState<AffiliatedPharmacy[]>([]);
  // Ubicación del usuario para calcular la distancia a cada farmacia (#30).
  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(null);
  // Sucursales (farmacias aprobadas) que tienen el producto disponible.
  const { user } = useAuth();
  const [sucursales, setSucursales] = useState<(SucursalDisponible & { distanceKm: number | null })[]>([]);
  const [reservando, setReservando] = useState<string | null>(null);
  const [reservadaEn, setReservadaEn] = useState<string | null>(null);
  // U2: toggle "Abierta ahora" — solo aparece si al menos una sucursal tiene
  // horarios estructurados (sino el filtro engañaría al usuario al ocultarlas).
  const [onlyOpenNow, setOnlyOpenNow] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getUserLocation().then((loc) => {
      if (!cancelled) setUserLoc({ lat: loc.lat, lng: loc.lng });
    });
    const medId = typeof params.id === 'string' ? params.id : null;
    if (medId) capture('pharmacy_view', { medication_id: medId });
    return () => {
      cancelled = true;
    };
  }, []);

  // Disponibilidad por sucursal: cuando hay producto matcheado, traer las
  // sucursales que lo tienen y ordenarlas por cercanía.
  useEffect(() => {
    let cancelled = false;
    if (!skuId) {
      setSucursales([]);
      return;
    }
    getSucursalesConProducto(skuId).then((rows) => {
      if (cancelled) return;
      const withDist = rows.map((s) => ({
        ...s,
        distanceKm:
          userLoc && s.latitud != null && s.longitud != null
            ? distanceKm(userLoc.lat, userLoc.lng, s.latitud, s.longitud)
            : null,
      }));
      withDist.sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
      setSucursales(withDist);
      // U4: si hay producto matcheado y ningún punto de venta, lo registramos
      // como demanda insatisfecha (sin_disponibilidad). Útil para que el admin
      // vea qué meds debería incentivar a tener en stock.
      if (rows.length === 0) {
        void logSinDisponibilidad(skuId, { medicamento: medication?.name ?? null });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [skuId, userLoc]);

  const abrirRuta = useCallback((s: SucursalDisponible) => {
    if (s.latitud == null || s.longitud == null) return;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${s.latitud},${s.longitud}&travelmode=driving`;
    if (Platform.OS === 'web') window.open(url, '_blank');
    else Linking.openURL(url);
  }, []);

  const reservar = useCallback(
    async (s: SucursalDisponible) => {
      if (!user) {
        router.push('/auth/login');
        return;
      }
      setReservando(s.sucursalId);
      const res = await createReserva({
        usuarioId: user.id,
        sucursalId: s.sucursalId,
        productoId: skuId as string,
        precio: s.precio,
      });
      setReservando(null);
      if (res.ok) setReservadaEn(s.sucursalId);
    },
    [user, skuId, router],
  );

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
    return <KerivaLoader label={t.detail.loadingDetail} />;
  }

  if (!medication) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <PillBackground />
        <Reveal variant="up">
          <Text style={styles.emptyStateTitle}>{t.detail.notFound}</Text>
          <PressableScale
            style={styles.backButtonEmpty}
            onPress={() => router.push('/(tabs)')}
          >
            <Text style={styles.backButtonText}>{t.detail.back}</Text>
          </PressableScale>
        </Reveal>
      </View>
    );
  }

  const { minPrice, avgPrice } = medication;
  const savings = avgPrice > minPrice ? avgPrice - minPrice : 0;
  const cheapestPharmacy = medication.prices[0] ?? null;

  // Coordenadas para el botón "Ver en el mapa": primero una farmacia afiliada
  // con coordenadas, si no, la del primer reporte de precio.
  const affWithCoords = affiliated.find((a) => a.latitud != null && a.longitud != null);
  const priceWithCoords = medication.prices.find((p) => p.latitude && p.longitude);
  const mapCoords = affWithCoords
    ? {
        lat: affWithCoords.latitud as number,
        lng: affWithCoords.longitud as number,
        name: affWithCoords.nombre,
        addr: affWithCoords.direccion ?? '',
        price: minPrice,
      }
    : priceWithCoords
    ? {
        lat: priceWithCoords.latitude as number,
        lng: priceWithCoords.longitude as number,
        name: priceWithCoords.pharmacyName,
        addr: priceWithCoords.pharmacyAddress ?? '',
        price: priceWithCoords.price,
      }
    : null;

  return (
    <View style={styles.container}>
      <PillBackground />

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentInner}
        showsVerticalScrollIndicator={false}
      >
        {/* Encabezado */}
        <Reveal variant="up" delay={40}>
          <View style={[styles.header, { paddingTop: 16 + insets.top }]}>
            <PressableScale
              style={styles.backButton}
              onPress={() => router.push('/(tabs)')}
              scaleTo={0.9}
            >
              <ArrowLeft size={22} color={theme.colors.textPrimary} />
            </PressableScale>
            <Text style={styles.headerTitle}>
              {medication.name} {medication.dosage}
            </Text>
            <View style={styles.categoryChip}>
              <Text style={styles.categoryChipText}>{medication.category}</Text>
            </View>
          </View>
        </Reveal>

        {/* Adendum v2.1 §3.3 — Rango estimado + auditoría comunitaria */}
        {skuId && affiliated.length > 0 && (
          <Reveal index={1} delay={80}>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t.detail.estimatedAffiliated}</Text>
              {affiliated.map((f, idx) => {
                const dist =
                  userLoc && f.latitud != null && f.longitud != null
                    ? distanceKm(userLoc.lat, userLoc.lng, f.latitud, f.longitud)
                    : null;
                const hasCoords = f.latitud != null && f.longitud != null;
                return (
                  <Reveal key={f.farmaciaId} index={idx} delay={120}>
                    <View style={styles.pharmacyBlock}>
                      <View style={styles.pharmacyBlockHeader}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.pharmacyBlockName}>{f.nombre}</Text>
                          <View style={styles.locationRow}>
                            <MapPin size={12} color={theme.colors.textSecondary} />
                            <Text style={styles.pharmacyBlockAddr} numberOfLines={1}>
                              {f.direccion}
                            </Text>
                          </View>
                          {dist !== null && (
                            <View style={styles.distanceRow}>
                              <Navigation size={12} color={theme.colors.accent} />
                              <Text style={styles.distanceText}>{formatDistance(dist)} {t.detail.away}</Text>
                            </View>
                          )}
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
                  </Reveal>
                );
              })}
            </View>
          </Reveal>
        )}

        {/* Disponibilidad real por sucursal (farmacias aprobadas) */}
        {skuId && sucursales.length > 0 && (() => {
          const tieneHorarios = sucursales.some((s) => s.horarios !== null);
          const filtradas = onlyOpenNow
            ? sucursales.filter((s) => isOpenNow(s.horarios))
            : sucursales;
          return (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Disponible cerca de ti</Text>
              {tieneHorarios && (
                <PressableScale
                  style={[styles.openNowToggle, onlyOpenNow && styles.openNowToggleActive]}
                  onPress={() => setOnlyOpenNow((v) => !v)}
                  scaleTo={0.94}
                >
                  <Clock size={13} color={onlyOpenNow ? theme.colors.accentText : theme.colors.accent} />
                  <Text style={[styles.openNowToggleText, onlyOpenNow && styles.openNowToggleTextActive]}>
                    Abierta ahora
                  </Text>
                </PressableScale>
              )}
            </View>
            {filtradas.length === 0 && (
              <Text style={styles.emptyHint}>
                Ninguna sucursal abierta ahora mismo. Quita el filtro para ver todas.
              </Text>
            )}
            {filtradas.map((s) => {
              const reservada = reservadaEn === s.sucursalId;
              const abierta = isOpenNow(s.horarios);
              return (
                <View key={s.sucursalId} style={styles.dispCard}>
                  <View style={styles.dispHead}>
                    <View style={{ flex: 1 }}>
                      <View style={styles.dispNameRow}>
                        <Text style={styles.dispName} numberOfLines={1}>{s.nombre}</Text>
                        {abierta && (
                          <View style={styles.openBadge}>
                            <View style={styles.openDot} />
                            <Text style={styles.openBadgeText}>Abierta</Text>
                          </View>
                        )}
                      </View>
                      <View style={styles.locationRow}>
                        <MapPin size={12} color={theme.colors.textSecondary} />
                        <Text style={styles.pharmacyBlockAddr} numberOfLines={1}>{s.direccion}</Text>
                      </View>
                      {s.distanceKm != null && (
                        <View style={styles.distanceRow}>
                          <Navigation size={12} color={theme.colors.accent} />
                          <Text style={styles.distanceText}>{formatDistance(s.distanceKm)} {t.detail.away}</Text>
                        </View>
                      )}
                    </View>
                    {s.precio != null && <Text style={styles.dispPrice}>RD${s.precio.toFixed(2)}</Text>}
                  </View>
                  <View style={styles.dispActions}>
                    <PressableScale style={styles.dispRoute} onPress={() => abrirRuta(s)}>
                      <Navigation size={15} color={theme.colors.accent} />
                      <Text style={styles.dispRouteText}>Cómo llegar</Text>
                    </PressableScale>
                    {reservada ? (
                      <View style={styles.dispReservada}>
                        <Check size={15} color={theme.colors.success} />
                        <Text style={styles.dispReservadaText}>Reservado</Text>
                      </View>
                    ) : (
                      <PressableScale
                        style={[styles.dispReservar, reservando === s.sucursalId && { opacity: 0.6 }]}
                        onPress={() => reservar(s)}
                      >
                        <ShoppingBag size={15} color={theme.colors.accentText} />
                        <Text style={styles.dispReservarText}>{reservando === s.sucursalId ? 'Reservando…' : 'Reservar'}</Text>
                      </PressableScale>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
          );
        })()}

        {/* Estado: no hay producto matcheado todavía */}
        {!skuId && (
          <Reveal index={1} delay={80}>
            <View style={styles.infoBanner}>
              <Text style={styles.infoBannerTitle}>{t.detail.refSoonTitle}</Text>
              <Text style={styles.infoBannerText}>{t.detail.refSoonText}</Text>
            </View>
          </Reveal>
        )}

        {/* Estado: producto matcheado pero sin farmacias afiliadas */}
        {skuId && affiliated.length === 0 && (
          <Reveal index={1} delay={80}>
            <View style={styles.infoBanner}>
              <Text style={styles.infoBannerTitle}>{t.detail.noAffiliatedTitle}</Text>
              <Text style={styles.infoBannerText}>{t.detail.noAffiliatedText}</Text>
            </View>
          </Reveal>
        )}

        {/* Legado: card compacto del mejor precio reportado (se mantiene como referencia
            histórica hasta que se depreque el flujo viejo en Fase 2). */}
        {!skuId && cheapestPharmacy && (
          <Reveal index={2} delay={120}>
            <View style={styles.pharmacyCard}>
              <View style={styles.pharmacyHeader}>
                <View>
                  <Text style={styles.pharmacyName}>{cheapestPharmacy.pharmacyName}</Text>
                  <View style={styles.locationRow}>
                    <MapPin size={14} color={theme.colors.textSecondary} />
                    <Text style={styles.locationText}>{cheapestPharmacy.pharmacyAddress}</Text>
                  </View>
                </View>
              </View>

              <View style={styles.priceContainer}>
                <Text style={styles.priceLabel}>{t.detail.bestReported}</Text>
                <Text style={styles.price}>RD${minPrice.toFixed(2)}</Text>
              </View>

              {savings > 0 && (
                <View style={styles.savingsBadge}>
                  <Text style={styles.savingsBadgeText}>
                    💰 {t.detail.savings} RD${savings.toFixed(2)} {t.detail.vsAverage}
                  </Text>
                </View>
              )}
            </View>
          </Reveal>
        )}

        {medication.genericName && medication.genericName !== medication.name && (
          <Reveal index={3} delay={140}>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t.detail.genericAvailable}</Text>
              <View style={styles.genericCard}>
                <View style={styles.genericLeft}>
                  <Text style={styles.genericBadge}>{t.detail.generic}</Text>
                  <Text style={styles.genericName}>{medication.genericName}</Text>
                </View>
              </View>
            </View>
          </Reveal>
        )}

        <Reveal index={4} delay={160}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t.detail.availability}</Text>
            <View style={styles.card}>
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
              <Text style={styles.availabilityNote}>{t.detail.schedule}</Text>
            </View>
          </View>
        </Reveal>

        {medication.prices.length > 1 && (
          <Reveal index={5} delay={180}>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t.detail.otherPharmacies}</Text>
              {medication.prices.slice(1).map((priceData, index) => (
                <View key={index} style={styles.otherPharmacyCard}>
                  <View style={styles.otherPharmacyLeft}>
                    <Text style={styles.otherPharmacyName}>
                      {priceData.pharmacyName}
                    </Text>
                    <Text style={styles.otherPharmacyAddress}>
                      {priceData.pharmacyAddress}
                    </Text>
                    {userLoc && priceData.latitude && priceData.longitude && (
                      <View style={styles.distanceRow}>
                        <Navigation size={12} color={theme.colors.accent} />
                        <Text style={styles.distanceText}>
                          {formatDistance(distanceKm(userLoc.lat, userLoc.lng, priceData.latitude, priceData.longitude))} {t.detail.away}
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.otherPharmacyPrice}>
                    RD${priceData.price.toFixed(2)}
                  </Text>
                </View>
              ))}
            </View>
          </Reveal>
        )}

        <Reveal index={6} delay={200}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t.detail.aboutThis}</Text>
            <View style={styles.card}>
              <Text style={styles.description}>
                {medication.category} - {medication.name}
                {medication.genericName && ` (${medication.genericName})`}
              </Text>
            </View>
          </View>
        </Reveal>
      </ScrollView>

      {mapCoords && (
        <View style={[styles.footer, { paddingBottom: 16 + insets.bottom }]}>
          <PressableScale
            style={styles.mapButton}
            onPress={() =>
              router.push({
                pathname: '/(tabs)/map',
                params: {
                  focusLat: String(mapCoords.lat),
                  focusLng: String(mapCoords.lng),
                  focusName: mapCoords.name,
                  focusAddr: mapCoords.addr,
                  focusMed: medication.name,
                  focusPrice: String(mapCoords.price ?? 0),
                  focusNav: '1',
                },
              })
            }
          >
            <MapIcon size={18} color={theme.colors.white} />
            <Text style={styles.mapButtonText}>{t.detail.seeOnMap}</Text>
          </PressableScale>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },
  content: {
    flex: 1,
  },
  contentInner: {
    paddingBottom: theme.spacing.xl,
  },
  header: {
    paddingHorizontal: theme.spacing.xl,
    paddingBottom: theme.spacing.lg,
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
  headerTitle: {
    ...theme.text.h1,
    color: theme.colors.textPrimary,
  },
  categoryChip: {
    alignSelf: 'flex-start',
    backgroundColor: theme.colors.accentSoft,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 5,
    borderRadius: theme.radius.pill,
    marginTop: theme.spacing.sm,
  },
  categoryChipText: {
    ...theme.text.label,
    color: theme.colors.accent,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    ...theme.shadow.card,
  },
  pharmacyCard: {
    backgroundColor: theme.colors.surface,
    marginHorizontal: theme.spacing.xl,
    marginBottom: theme.spacing.xxl,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    ...theme.shadow.card,
  },
  pharmacyHeader: {
    marginBottom: theme.spacing.lg,
  },
  pharmacyName: {
    ...theme.text.h3,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.xs,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  locationText: {
    ...theme.text.caption,
    color: theme.colors.textSecondary,
  },
  priceContainer: {
    paddingVertical: theme.spacing.xl,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
  },
  priceLabel: {
    ...theme.text.bodyMedium,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xs,
  },
  price: {
    fontFamily: theme.font.bold,
    fontSize: 42,
    color: theme.colors.accent,
  },
  savingsBadge: {
    backgroundColor: theme.colors.warningSoft,
    borderRadius: theme.radius.sm,
    padding: theme.spacing.md,
    marginTop: theme.spacing.lg,
  },
  savingsBadgeText: {
    ...theme.text.bodyMedium,
    color: theme.colors.warning,
    textAlign: 'center',
  },
  section: {
    paddingHorizontal: theme.spacing.xl,
    marginBottom: theme.spacing.xxl,
  },
  sectionTitle: {
    ...theme.text.h2,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.md,
  },
  // U2 — "Abierta ahora"
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.md,
    gap: theme.spacing.md,
  },
  openNowToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 6,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.accentSofter,
    borderWidth: 1,
    borderColor: theme.colors.accentSoft,
  },
  openNowToggleActive: {
    backgroundColor: theme.colors.accent,
    borderColor: theme.colors.accent,
  },
  openNowToggleText: {
    fontFamily: theme.font.bodyBold,
    fontSize: 12,
    color: theme.colors.accent,
  },
  openNowToggleTextActive: {
    color: theme.colors.accentText,
  },
  emptyHint: {
    ...theme.text.caption,
    color: theme.colors.textSecondary,
    fontStyle: 'italic',
    marginBottom: theme.spacing.md,
  },
  dispNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  openBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.accentSoft,
  },
  openDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.accent,
  },
  openBadgeText: {
    fontFamily: theme.font.bodyBold,
    fontSize: 10,
    color: theme.colors.accent,
  },
  pharmacyBlock: {
    marginBottom: theme.spacing.xs,
  },
  pharmacyBlockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
    marginBottom: 6,
  },
  pharmacyBlockName: {
    ...theme.text.title,
    color: theme.colors.textPrimary,
  },
  pharmacyBlockAddr: {
    ...theme.text.caption,
    color: theme.colors.textSecondary,
    flex: 1,
  },
  distanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    marginTop: 4,
  },
  distanceText: {
    ...theme.text.caption,
    fontFamily: theme.font.bodyBold,
    color: theme.colors.accent,
  },
  dispCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    ...theme.shadow.card,
  },
  dispHead: { flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing.sm },
  dispName: { ...theme.text.h3, color: theme.colors.textPrimary },
  dispPrice: { ...theme.text.h3, color: theme.colors.accent },
  dispActions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.md,
    paddingTop: theme.spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
  },
  dispRoute: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    flex: 1,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.pill,
    borderWidth: 1.5,
    borderColor: theme.colors.accent,
  },
  dispRouteText: { ...theme.text.button, color: theme.colors.accent, fontSize: 13 },
  dispReservar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    flex: 1,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.accent,
    ...theme.shadow.accent,
  },
  dispReservarText: { ...theme.text.button, color: theme.colors.accentText, fontSize: 13 },
  dispReservada: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    flex: 1,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.successSoft,
  },
  dispReservadaText: { ...theme.text.button, color: theme.colors.success, fontSize: 13 },
  mapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    height: 54,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.accent,
    ...theme.shadow.accent,
  },
  mapButtonText: {
    ...theme.text.button,
    fontFamily: theme.font.bold,
    fontSize: 16,
    color: theme.colors.white,
  },
  descuentoBadge: {
    backgroundColor: theme.colors.accent,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 3,
    borderRadius: theme.radius.sm,
    marginLeft: theme.spacing.sm,
  },
  descuentoText: {
    ...theme.text.label,
    color: theme.colors.white,
  },
  infoBanner: {
    backgroundColor: theme.colors.accentSofter,
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.accent,
    marginHorizontal: theme.spacing.xl,
    marginBottom: theme.spacing.xl,
    padding: theme.spacing.lg,
    borderRadius: theme.radius.md,
    ...theme.shadow.sm,
  },
  infoBannerTitle: {
    ...theme.text.h3,
    color: theme.colors.accent,
    marginBottom: theme.spacing.xs,
  },
  infoBannerText: {
    ...theme.text.body,
    color: theme.colors.textSecondary,
  },
  genericCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: theme.colors.accent,
    ...theme.shadow.card,
  },
  genericLeft: {
    flex: 1,
  },
  genericBadge: {
    ...theme.text.label,
    color: theme.colors.accent,
    backgroundColor: theme.colors.accentSoft,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radius.xs,
    alignSelf: 'flex-start',
    marginBottom: 6,
    overflow: 'hidden',
  },
  genericName: {
    ...theme.text.bodyMedium,
    color: theme.colors.textPrimary,
  },
  availabilityGrid: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  availabilityDay: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.bgSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  availabilityDayActive: {
    backgroundColor: theme.colors.accent,
  },
  availabilityDayText: {
    ...theme.text.title,
    color: theme.colors.textMuted,
  },
  availabilityDayTextActive: {
    color: theme.colors.white,
  },
  availabilityNote: {
    ...theme.text.caption,
    color: theme.colors.textSecondary,
  },
  description: {
    ...theme.text.body,
    color: theme.colors.textSecondary,
  },
  footer: {
    paddingHorizontal: theme.spacing.xl,
    paddingTop: theme.spacing.lg,
    backgroundColor: theme.colors.surface,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    ...theme.shadow.md,
  },
  directionsRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  directionsButton: {
    flex: 1,
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius.pill,
    paddingVertical: theme.spacing.lg,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: theme.spacing.sm,
    ...theme.shadow.accent,
  },
  directionsButtonText: {
    fontFamily: theme.font.bold,
    fontSize: 14,
    color: theme.colors.white,
  },
  wazeButton: {
    flex: 1,
    backgroundColor: theme.colors.accentSofter,
    borderRadius: theme.radius.pill,
    paddingVertical: theme.spacing.lg,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: theme.spacing.sm,
    borderWidth: 2,
    borderColor: theme.colors.accent,
  },
  wazeButtonText: {
    fontFamily: theme.font.bold,
    fontSize: 14,
    color: theme.colors.accent,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.xl,
  },
  emptyStateTitle: {
    ...theme.text.h2,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.lg,
    textAlign: 'center',
  },
  backButtonEmpty: {
    backgroundColor: theme.colors.accent,
    paddingHorizontal: theme.spacing.xxl,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.pill,
    alignSelf: 'center',
    ...theme.shadow.accent,
  },
  backButtonText: {
    fontFamily: theme.font.bold,
    fontSize: 14,
    color: theme.colors.white,
  },
  otherPharmacyCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    ...theme.shadow.card,
  },
  otherPharmacyLeft: {
    flex: 1,
    marginRight: theme.spacing.md,
  },
  otherPharmacyName: {
    ...theme.text.title,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.xs,
  },
  otherPharmacyAddress: {
    ...theme.text.caption,
    color: theme.colors.textSecondary,
  },
  otherPharmacyPrice: {
    fontFamily: theme.font.bold,
    fontSize: 18,
    color: theme.colors.accent,
  },
});
