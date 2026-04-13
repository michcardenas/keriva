import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Linking } from 'react-native';
import { MapPin, Phone, Clock, Navigation, X, CircleAlert as AlertCircle, ExternalLink } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { getActivePharmacies, type PharmacyView } from '@/lib/api/farmacias';
import LoginNudge from '@/components/LoginNudge';

const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? '';

// mapbox-gl is loaded from CDN (see public/index.html) to avoid Metro bundler issues
function getMapboxGL(): any {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && (window as any).mapboxgl) {
    return (window as any).mapboxgl;
  }
  return null;
}

const SANTIAGO_CENTER: [number, number] = [-70.6970, 19.4517];
const DEFAULT_ZOOM = 13;

export default function MapScreen() {
  const router = useRouter();
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const mapInitializedRef = useRef(false);

  const [pharmacies, setPharmacies] = useState<PharmacyView[]>([]);
  const [selectedPharmacy, setSelectedPharmacy] = useState<PharmacyView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);

  // Load pharmacies
  useEffect(() => {
    (async () => {
      try {
        setError(null);
        const data = await getActivePharmacies();
        setPharmacies(data);
      } catch {
        setError('Error al cargar farmacias');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Init Mapbox map ONCE when the container div is available
  useEffect(() => {
    if (Platform.OS !== 'web' || !MAPBOX_TOKEN) return;
    if (mapInitializedRef.current) return;

    // Wait for the container to be in the DOM
    const tryInit = () => {
      const container = mapContainerRef.current;
      if (!container || mapInitializedRef.current) return;

      const mapboxgl = getMapboxGL();
      if (!mapboxgl) return;

      mapInitializedRef.current = true;
      mapboxgl.accessToken = MAPBOX_TOKEN;

      const map = new mapboxgl.Map({
        container,
        style: 'mapbox://styles/mapbox/dark-v11',
        center: SANTIAGO_CENTER,
        zoom: DEFAULT_ZOOM,
        attributionControl: false,
      });

      map.addControl(new mapboxgl.NavigationControl(), 'top-right');
      map.addControl(
        new mapboxgl.GeolocateControl({
          positionOptions: { enableHighAccuracy: true },
          trackUserLocation: true,
          showUserHeading: true,
        }),
        'top-right',
      );

      map.on('load', () => {
        setMapReady(true);
      });

      mapRef.current = map;
    };

    // Try immediately, then poll briefly for the container
    tryInit();
    if (!mapInitializedRef.current) {
      const interval = setInterval(() => {
        tryInit();
        if (mapInitializedRef.current) clearInterval(interval);
      }, 200);
      // Stop polling after 10s
      const timeout = setTimeout(() => clearInterval(interval), 10000);
      return () => {
        clearInterval(interval);
        clearTimeout(timeout);
      };
    }
  }, [loading]); // re-check when loading changes (container appears)

  // Add pharmacy markers when map + data are ready — runs only ONCE
  useEffect(() => {
    if (!mapReady || !mapRef.current || pharmacies.length === 0) return;
    if (Platform.OS !== 'web') return;

    const mapboxgl = getMapboxGL();
    if (!mapboxgl) return;
    const map = mapRef.current;

    // Clear old markers (safety)
    markersRef.current.forEach((m: any) => m.remove());
    markersRef.current = [];

    // Only use pharmacies that have coordinates
    const validPharmacies = pharmacies.filter((p) => p.latitude && p.longitude);

    validPharmacies.forEach((pharm) => {
      const el = document.createElement('div');
      el.style.cssText = `
        width: 32px; height: 32px; border-radius: 50%;
        background: ${pharm.isCheapest ? '#7ED957' : '#1A7A4A'};
        border: 2px solid #FFFFFF;
        cursor: pointer;
        display: flex; align-items: center; justify-content: center;
        box-shadow: 0 2px 6px rgba(0,0,0,0.35);
      `;
      el.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${pharm.isCheapest ? '#0F1F17' : '#FFFFFF'}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>`;

      const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
        .setLngLat([pharm.longitude, pharm.latitude])
        .addTo(map);

      el.addEventListener('click', () => {
        setSelectedPharmacy(pharm);
        map.flyTo({
          center: [pharm.longitude, pharm.latitude],
          zoom: 16,
          duration: 800,
        });
      });

      markersRef.current.push(marker);
    });

    // Fit bounds only to Santiago-area pharmacies (not the whole country)
    if (validPharmacies.length > 1) {
      const bounds = new mapboxgl.LngLatBounds();
      validPharmacies.forEach((p) => {
        bounds.extend([p.longitude, p.latitude]);
      });

      // Only fitBounds if the area is reasonable (not spanning the whole island)
      const ne = bounds.getNorthEast();
      const sw = bounds.getSouthWest();
      const lngSpan = Math.abs(ne.lng - sw.lng);
      const latSpan = Math.abs(ne.lat - sw.lat);

      if (lngSpan < 0.5 && latSpan < 0.5) {
        // Small area — fit to show all markers
        map.fitBounds(bounds, { padding: 50, maxZoom: 15, duration: 1000 });
      } else {
        // Large area — just center on Santiago with default zoom
        map.flyTo({ center: SANTIAGO_CENTER, zoom: DEFAULT_ZOOM, duration: 1000 });
      }
    }
  }, [mapReady, pharmacies]);

  const closeCard = useCallback(() => setSelectedPharmacy(null), []);

  const openGoogleMaps = useCallback((pharm: PharmacyView) => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${pharm.latitude},${pharm.longitude}&travelmode=driving`;
    if (Platform.OS === 'web') {
      window.open(url, '_blank');
    } else {
      Linking.openURL(url);
    }
  }, []);

  const openWaze = useCallback((pharm: PharmacyView) => {
    const url = `https://waze.com/ul?ll=${pharm.latitude},${pharm.longitude}&navigate=yes`;
    if (Platform.OS === 'web') {
      window.open(url, '_blank');
    } else {
      Linking.openURL(url);
    }
  }, []);

  const flyToPharmacy = useCallback((pharm: PharmacyView) => {
    setSelectedPharmacy(pharm);
    if (mapRef.current) {
      mapRef.current.flyTo({
        center: [pharm.longitude, pharm.latitude],
        zoom: 16,
        duration: 800,
      });
    }
  }, []);

  // Fallback for non-web or missing token
  if (Platform.OS !== 'web' || !MAPBOX_TOKEN) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <MapPin size={48} color="#7ED957" />
        <Text style={styles.loadingText}>
          {!MAPBOX_TOKEN ? 'Token de Mapbox no configurado' : 'Mapa disponible solo en web por ahora'}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {error && (
        <View style={styles.errorBanner}>
          <AlertCircle size={18} color="#D32F2F" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Mapbox container — ALWAYS rendered so the ref is stable */}
      <View style={styles.mapWrapper}>
        <div
          ref={mapContainerRef}
          style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }}
        />

        {(!mapReady || loading) && (
          <View style={styles.mapLoading}>
            <ActivityIndicator size="large" color="#7ED957" />
            <Text style={styles.loadingText}>
              {loading ? 'Cargando farmacias...' : 'Cargando mapa...'}
            </Text>
          </View>
        )}
      </View>

      {/* Bottom drawer */}
      <View style={styles.drawer}>
        <View style={styles.drawerHandle} />
        <Text style={styles.drawerTitle}>
          {loading ? 'Cargando...' : `${pharmacies.length} farmacias en Santiago`}
        </Text>
        <ScrollView style={styles.drawerList} showsVerticalScrollIndicator={false}>
          {pharmacies.map((pharm) => (
            <TouchableOpacity
              key={pharm.id}
              style={[
                styles.pharmCard,
                selectedPharmacy?.id === pharm.id && styles.pharmCardActive,
              ]}
              onPress={() => flyToPharmacy(pharm)}
            >
              <View style={styles.pharmCardLeft}>
                <View style={[
                  styles.pharmPin,
                  pharm.isCheapest && styles.pharmPinCheapest,
                ]}>
                  <MapPin size={16} color={pharm.isCheapest ? '#0F1F17' : '#FFFFFF'} />
                </View>
                <View style={styles.pharmInfo}>
                  <Text style={styles.pharmName}>{pharm.name}</Text>
                  <Text style={styles.pharmAddress} numberOfLines={1}>{pharm.address}</Text>
                </View>
              </View>
              {pharm.isCheapest && (
                <View style={styles.bestBadge}>
                  <Text style={styles.bestBadgeText}>MEJOR</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Selected pharmacy detail card */}
      {selectedPharmacy && (
        <View style={styles.detailCard}>
          <View style={styles.detailHeader}>
            <View style={styles.detailTitleRow}>
              <MapPin size={22} color="#1A7A4A" />
              <Text style={styles.detailTitle} numberOfLines={1}>{selectedPharmacy.name}</Text>
            </View>
            <TouchableOpacity onPress={closeCard} style={styles.closeBtn}>
              <X size={18} color="#666" />
            </TouchableOpacity>
          </View>

          <View style={styles.detailBody}>
            <View style={styles.detailRow}>
              <MapPin size={16} color="#666" />
              <Text style={styles.detailText}>{selectedPharmacy.address}</Text>
            </View>
            <View style={styles.detailRow}>
              <Clock size={16} color="#666" />
              <Text style={styles.detailText}>{selectedPharmacy.hours}</Text>
            </View>
            <View style={styles.detailRow}>
              <Phone size={16} color="#666" />
              <Text style={styles.detailText}>{selectedPharmacy.phone}</Text>
            </View>
          </View>

          {selectedPharmacy.minPrice > 0 && (
            <View style={styles.detailPrice}>
              <Text style={styles.detailPriceLabel}>Precio más bajo:</Text>
              <Text style={styles.detailPriceValue}>
                RD${selectedPharmacy.minPrice.toFixed(2)}
              </Text>
            </View>
          )}

          <View style={styles.navRow}>
            <TouchableOpacity
              style={styles.navBtn}
              onPress={() => openGoogleMaps(selectedPharmacy)}
            >
              <Navigation size={14} color="#1A7A4A" />
              <Text style={styles.navBtnText}>Google Maps</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.navBtn}
              onPress={() => openWaze(selectedPharmacy)}
            >
              <ExternalLink size={14} color="#1A7A4A" />
              <Text style={styles.navBtnText}>Waze</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <LoginNudge delayMs={6000} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F1F17' },
  centerContent: { justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { fontFamily: 'DMSans-Medium', fontSize: 14, color: '#7ED957', marginTop: 8 },
  errorBanner: {
    position: 'absolute',
    top: 50,
    left: 16,
    right: 16,
    backgroundColor: '#FFEBEE',
    padding: 12,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    zIndex: 100,
  },
  errorText: { fontFamily: 'DMSans-Medium', fontSize: 13, color: '#D32F2F', flex: 1 },
  mapWrapper: { flex: 1, position: 'relative' },
  mapLoading: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0F1F17',
  },
  drawer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 10,
    paddingHorizontal: 16,
    maxHeight: '38%',
  },
  drawerHandle: {
    width: 36,
    height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 12,
  },
  drawerTitle: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 16,
    color: '#0F1F17',
    marginBottom: 12,
  },
  drawerList: { flex: 1 },
  pharmCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  pharmCardActive: {
    backgroundColor: '#E8F5E9',
    borderWidth: 1,
    borderColor: '#1A7A4A',
  },
  pharmCardLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 },
  pharmPin: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1A7A4A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pharmPinCheapest: { backgroundColor: '#7ED957' },
  pharmInfo: { flex: 1 },
  pharmName: { fontFamily: 'DMSans-Medium', fontSize: 14, color: '#0F1F17' },
  pharmAddress: { fontFamily: 'DMSans-Regular', fontSize: 12, color: '#666', marginTop: 2 },
  bestBadge: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    marginLeft: 8,
  },
  bestBadgeText: { fontFamily: 'DMSans-Bold', fontSize: 9, color: '#1A7A4A' },
  detailCard: {
    position: 'absolute',
    bottom: '40%',
    left: 12,
    right: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
    zIndex: 50,
  },
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  detailTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  detailTitle: { fontFamily: 'Poppins-SemiBold', fontSize: 17, color: '#0F1F17', flex: 1 },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailBody: { gap: 10 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  detailText: { fontFamily: 'DMSans-Regular', fontSize: 14, color: '#333', flex: 1 },
  detailPrice: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
  },
  detailPriceLabel: { fontFamily: 'DMSans-Medium', fontSize: 13, color: '#1A7A4A' },
  detailPriceValue: { fontFamily: 'Poppins-Bold', fontSize: 18, color: '#1A7A4A' },
  navRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  navBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0F7F2',
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D4E8DA',
    gap: 6,
  },
  navBtnText: {
    fontFamily: 'DMSans-Medium',
    fontSize: 13,
    color: '#1A7A4A',
  },
});
