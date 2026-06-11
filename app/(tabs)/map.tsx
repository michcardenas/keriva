import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  TextInput,
  Keyboard,
} from 'react-native';
import { Linking } from 'react-native';
import { MapPin, Phone, Clock, Navigation, X, CircleAlert as AlertCircle, Search, Pill, Star } from 'lucide-react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { getActivePharmacies, getNearbyPharmacies, type PharmacyView } from '@/lib/api/farmacias';
import { getRatingsForPharmacies, type FarmaciaRating } from '@/lib/api/reviews';
import { getFarmaciaIdsConInventario } from '@/lib/api/inventario';
import StarRating from '@/components/StarRating';
import {
  searchMedications as searchMedsApi,
  getMedicationDetail,
  type MedicationCard,
  type MedicationDetailView,
} from '@/lib/api/medicamentos';
import LoginNudge from '@/components/LoginNudge';
import KerivaLoader from '@/components/KerivaLoader';
import PressableScale from '@/components/ui/PressableScale';
import PharmacyMapNative from '@/components/PharmacyMapNative';
import { useLanguage } from '@/lib/LanguageContext';
import { getUserLocation } from '@/lib/location';
import { captureException } from '@/lib/sentry';

const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? '';

// mapbox-gl is loaded from CDN (see public/index.html) to avoid Metro bundler issues.
// Solo en WEB. En móvil se usa Google Maps vía react-native-maps (PharmacyMapNative),
// para no depender del token secreto de descarga de Mapbox en el build.
function getMapboxGL(): any {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && (window as any).mapboxgl) {
    return (window as any).mapboxgl;
  }
  return null;
}

const SANTIAGO_CENTER: [number, number] = [-70.6970, 19.4517];
const DEFAULT_ZOOM = 13;

// Bug 2: una coordenada es "real" (navegable) si es número finito, no (0,0) y
// NO es esencialmente el centro de Santiago (fallback que se usa cuando una
// farmacia no tiene ubicación cargada → sin esto, "Cómo llegar" abría Google
// Maps/Waze apuntando a la Junta Central Electoral).
function isRealCoord(lat?: number | null, lng?: number | null): boolean {
  if (typeof lat !== 'number' || typeof lng !== 'number') return false;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (lat === 0 && lng === 0) return false;
  const nearCenter =
    Math.abs(lat - SANTIAGO_CENTER[1]) < 0.0008 && Math.abs(lng - SANTIAGO_CENTER[0]) < 0.0008;
  return !nearCenter;
}

// Una farmacia que vende el medicamento buscado, con su precio puntual.
type MedMarker = {
  key: string;
  name: string;
  address: string;
  price: number;
  latitude: number;
  longitude: number;
  cheapest: boolean;
  /** distancia al usuario en km (re-scope: orden por cercanía) */
  distanceKm?: number;
  /** true para la farmacia más cercana al usuario */
  nearest?: boolean;
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
  if (!Number.isFinite(km)) return '';
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

export default function MapScreen() {
  const router = useRouter();
  // Foco opcional: cuando se entra desde el detalle de un medicamento con
  // ?focusLat&focusLng, el mapa vuela y centra esa farmacia.
  const params = useLocalSearchParams();
  const focusLat = params.focusLat ? Number(params.focusLat) : null;
  const focusLng = params.focusLng ? Number(params.focusLng) : null;
  const hasFocus =
    focusLat != null && focusLng != null && !Number.isNaN(focusLat) && !Number.isNaN(focusLng);
  const asStr = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';
  const focusName = asStr(params.focusName);
  const focusAddr = asStr(params.focusAddr);
  const focusMed = asStr(params.focusMed);
  const focusPrice = params.focusPrice ? Number(asStr(params.focusPrice)) : 0;
  // Cuando se llega desde el detalle de un medicamento (focusNav=1) ya sabemos a
  // qué farmacia quiere ir el usuario → abrimos la ruta directa, sin pedir otra vez.
  const focusNav = asStr(params.focusNav) === '1';
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const mapInitializedRef = useRef(false);
  const bottomSheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['12%', '45%', '85%'], []);

  const [pharmacies, setPharmacies] = useState<PharmacyView[]>([]);
  // Keriva Reviews — ratings por farmacia (farmacias_osm.id → promedio/total).
  const [ratings, setRatings] = useState<Map<string, FarmaciaRating>>(new Map());
  const [selectedPharmacy, setSelectedPharmacy] = useState<PharmacyView | null>(null);
  // Al tocar "Cómo llegar" se ofrecen las apps de ruta (Google Maps / Waze).
  const [showNav, setShowNav] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [drawerSearch, setDrawerSearch] = useState('');

  // Búsqueda de MEDICAMENTO dentro del mapa (tarea #3): el turista escribe un
  // fármaco y el mapa resalta las farmacias que lo tienen, con su precio.
  const [medQuery, setMedQuery] = useState('');
  const [medSuggestions, setMedSuggestions] = useState<MedicationCard[]>([]);
  const [searchingMed, setSearchingMed] = useState(false);
  const [selectedMed, setSelectedMed] = useState<MedicationDetailView | null>(null);
  const [selectedMedMarker, setSelectedMedMarker] = useState<MedMarker | null>(null);
  // Farmacia enfocada al venir desde el detalle de un medicamento (ruta directa).
  const [focusTarget, setFocusTarget] = useState<MedMarker & { med: string } | null>(null);

  // Bug 04: ubicación del usuario (cae a Santiago si el GPS falla/denegado).
  const [usingApproxLocation, setUsingApproxLocation] = useState(false);
  // Ubicación del usuario como estado (para reordenar resultados por cercanía).
  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(null);
  const userCoordsRef = useRef<[number, number]>(SANTIAGO_CENTER);
  // U6: radio de búsqueda actual (2km → 5km → 10km al ampliar manualmente).
  const [searchRadius, setSearchRadius] = useState(2000);
  // U6: input de dirección manual cuando el GPS está denegado.
  const [manualMode, setManualMode] = useState(false);
  const [manualAddress, setManualAddress] = useState('');
  const [geocoding, setGeocoding] = useState(false);
  const [geocodeError, setGeocodeError] = useState<string | null>(null);
  // M1: toggle "solo con inventario disponible". Default off — el mapa muestra
  // todas las farmacias geo-localizadas, no solo las afiliadas a Keriva.
  const [onlyConInventario, setOnlyConInventario] = useState(false);
  const [farmaciasConInventario, setFarmaciasConInventario] = useState<Set<number>>(new Set());
  // Bug 01: ref con las farmacias actuales para los handlers de click del cluster.
  const pharmaciesRef = useRef<PharmacyView[]>([]);
  useEffect(() => {
    pharmaciesRef.current = pharmacies;
  }, [pharmacies]);

  // Farmacias que venden el medicamento seleccionado (dedup por farmacia,
  // menor precio por farmacia). Re-scope: se ordenan por CERCANÍA al usuario
  // (no por precio); la más cercana lleva la bandera "Más cercana".
  const medMarkers = useMemo<MedMarker[]>(() => {
    if (!selectedMed) return [];
    const origin = userLoc ?? { lat: userCoordsRef.current[1], lng: userCoordsRef.current[0] };
    const byKey = new Map<string, MedMarker>();
    for (const p of selectedMed.prices) {
      if (!(p.price > 0) || !p.latitude || !p.longitude) continue;
      const key = `${p.pharmacyName}|${p.latitude.toFixed(5)},${p.longitude.toFixed(5)}`;
      const prev = byKey.get(key);
      if (!prev || p.price < prev.price) {
        byKey.set(key, {
          key,
          name: p.pharmacyName,
          address: p.pharmacyAddress,
          price: p.price,
          latitude: p.latitude,
          longitude: p.longitude,
          cheapest: false,
          distanceKm: distanceKm(origin.lat, origin.lng, p.latitude, p.longitude),
        });
      }
    }
    const arr = Array.from(byKey.values()).sort(
      (a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity),
    );
    return arr.map((m, i) => ({ ...m, nearest: i === 0 }));
  }, [selectedMed, userLoc]);

  // Re-carga las farmacias para una coord + radio dados. Reusable desde el
  // arranque (auto-detección GPS) y desde la UI (ampliar radio 5/10km, fijar
  // dirección manual U6).
  const loadPharmacies = useCallback(
    async (lat: number, lng: number, radiusM: number) => {
      setLoading(true);
      setError(null);
      try {
        let data: PharmacyView[];
        try {
          data = await getNearbyPharmacies(lat, lng, radiusM);
          // Auto-ampliación solo en el radio inicial (2km). Cuando el usuario
          // ya pidió 5/10km, respetamos su elección y mostramos exactamente
          // eso (con el banner si hace falta).
          if (radiusM === 2000 && data.length < 5) {
            const wider = await getNearbyPharmacies(lat, lng, 5000);
            if (wider.length > data.length) data = wider;
          }
        } catch {
          data = await getActivePharmacies();
        }
        setPharmacies(data);
        getRatingsForPharmacies(data.map((p) => p.id))
          .then(setRatings)
          .catch(() => {});
      } catch (err) {
        captureException(err, {
          screen: 'map',
          coords: [lng, lat] as [number, number],
          radiusM,
        });
        setError(t.map.errorLoad);
      } finally {
        setLoading(false);
      }
    },
    [t],
  );

  // Load user location + pharmacies
  useEffect(() => {
    (async () => {
      // Resolver ubicación primero (nunca lanza: fallback a Santiago).
      const loc = await getUserLocation();
      userCoordsRef.current = [loc.lng, loc.lat];
      setUserLoc({ lat: loc.lat, lng: loc.lng });
      setUsingApproxLocation(loc.isFallback);
      await loadPharmacies(loc.lat, loc.lng, 2000);
      // M1: precargar el set de farmacias con inventario en background.
      getFarmaciaIdsConInventario().then(setFarmaciasConInventario).catch(() => {});
    })();
  }, [loadPharmacies]);

  // M1: lista de farmacias filtrada por el toggle. Cuando el toggle está activo,
  // solo dejamos pasar las que están vinculadas a una cuenta Keriva con stock.
  const pharmaciesFiltradas = useMemo(() => {
    if (!onlyConInventario) return pharmacies;
    return pharmacies.filter(
      (p) =>
        typeof p.farmaciaIdLegacy === 'number' &&
        farmaciasConInventario.has(p.farmaciaIdLegacy),
    );
  }, [pharmacies, onlyConInventario, farmaciasConInventario]);

  // U6: ampliar radio (5km → 10km). Re-fetch con el nuevo radio.
  const handleAmpliarRadio = useCallback(
    async (radiusM: number) => {
      setSearchRadius(radiusM);
      const loc = userLoc ?? { lat: userCoordsRef.current[1], lng: userCoordsRef.current[0] };
      await loadPharmacies(loc.lat, loc.lng, radiusM);
    },
    [loadPharmacies, userLoc],
  );

  // U6: geocodificar dirección manual (Google Geocoding). Devuelve a Santiago
  // si la dirección no se reconoce. La key es la misma del mapa nativo Android.
  const handleGeocodeManual = useCallback(async () => {
    const q = manualAddress.trim();
    if (!q) return;
    setGeocoding(true);
    setGeocodeError(null);
    try {
      const key = process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY ?? '';
      // Añadimos "Dominican Republic" al query para sesgar el resultado a RD
      // (sin esto, "Calle Duarte" matchea ciudades en muchos países).
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
        `${q}, República Dominicana`,
      )}&key=${key}`;
      const r = await fetch(url);
      const data = await r.json();
      const result = data?.results?.[0];
      if (!result?.geometry?.location) {
        setGeocodeError('No encontramos esa dirección. Intenta con una más específica.');
        return;
      }
      const { lat, lng } = result.geometry.location;
      userCoordsRef.current = [lng, lat];
      setUserLoc({ lat, lng });
      setUsingApproxLocation(false);
      setManualMode(false);
      setSearchRadius(2000);
      await loadPharmacies(lat, lng, 2000);
    } catch {
      setGeocodeError('No se pudo buscar la dirección. Intenta de nuevo.');
    } finally {
      setGeocoding(false);
    }
  }, [manualAddress, loadPharmacies]);

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

  // Bug 01 — Render con CLUSTERING nativo de Mapbox (GeoJSON source + capas),
  // en vez de un Marker DOM por farmacia (que con 839 pins era ilegible y lento).
  useEffect(() => {
    if (!mapReady || !mapRef.current || pharmaciesFiltradas.length === 0) return;
    if (Platform.OS !== 'web') return;

    const mapboxgl = getMapboxGL();
    if (!mapboxgl) return;
    const map = mapRef.current;

    const validPharmacies = pharmaciesFiltradas.filter((p) => p.latitude && p.longitude);

    const geojson = {
      type: 'FeatureCollection',
      features: validPharmacies.map((p) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [p.longitude, p.latitude] },
        properties: { id: String(p.id), cheapest: p.isCheapest ? 1 : 0 },
      })),
    };

    const SOURCE_ID = 'pharmacies';
    const existing = map.getSource(SOURCE_ID);

    if (existing) {
      // Carga progresiva: si el source ya existe, solo actualizamos los datos.
      existing.setData(geojson);
    } else {
      map.addSource(SOURCE_ID, {
        type: 'geojson',
        data: geojson,
        cluster: true,        // Capa 1 del cliente: clustering nativo
        clusterMaxZoom: 14,   // zoom donde se muestran pins individuales
        clusterRadius: 50,    // radio en píxeles para agrupar
      });

      // Círculos de cluster (tamaño/color por cantidad)
      map.addLayer({
        id: 'clusters',
        type: 'circle',
        source: SOURCE_ID,
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': ['step', ['get', 'point_count'], '#34C26A', 25, '#1E9E5A', 100, '#106B4F'],
          'circle-radius': ['step', ['get', 'point_count'], 16, 25, 22, 100, 30],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#FFFFFF',
        },
      });

      // Contador sobre el cluster
      map.addLayer({
        id: 'cluster-count',
        type: 'symbol',
        source: SOURCE_ID,
        filter: ['has', 'point_count'],
        layout: {
          'text-field': '{point_count_abbreviated}',
          'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
          'text-size': 13,
        },
        paint: { 'text-color': '#FFFFFF' },
      });

      // Pin individual (no agrupado)
      map.addLayer({
        id: 'unclustered-point',
        type: 'circle',
        source: SOURCE_ID,
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-color': ['case', ['==', ['get', 'cheapest'], 1], '#34C26A', '#106B4F'],
          'circle-radius': 8,
          'circle-stroke-width': 2,
          'circle-stroke-color': '#FFFFFF',
        },
      });

      // Click en cluster → hacer zoom para expandirlo
      map.on('click', 'clusters', (e: any) => {
        const features = map.queryRenderedFeatures(e.point, { layers: ['clusters'] });
        const clusterId = features[0]?.properties?.cluster_id;
        if (clusterId == null) return;
        const src = map.getSource(SOURCE_ID);
        src.getClusterExpansionZoom(clusterId, (err: any, zoom: number) => {
          if (err) return;
          map.easeTo({ center: features[0].geometry.coordinates, zoom });
        });
      });

      // Click en pin individual → seleccionar la farmacia
      map.on('click', 'unclustered-point', (e: any) => {
        const feature = e.features?.[0];
        if (!feature) return;
        const id = String(feature.properties?.id);
        const pharm = pharmaciesRef.current.find((p) => String(p.id) === id);
        if (pharm) {
          setSelectedPharmacy(pharm);
          setSelectedMedMarker(null);
          setFocusTarget(null);
          map.flyTo({ center: feature.geometry.coordinates, zoom: 16, duration: 800 });
        }
      });

      // Cursor pointer sobre clusters / pins
      const setPointer = () => { map.getCanvas().style.cursor = 'pointer'; };
      const clearPointer = () => { map.getCanvas().style.cursor = ''; };
      map.on('mouseenter', 'clusters', setPointer);
      map.on('mouseleave', 'clusters', clearPointer);
      map.on('mouseenter', 'unclustered-point', setPointer);
      map.on('mouseleave', 'unclustered-point', clearPointer);
    }

    // Encadrar el área de Santiago (no toda la isla) — solo si NO hay una
    // búsqueda de medicamento activa (esa controla su propio encuadre).
    if (validPharmacies.length > 1 && !selectedMed) {
      const bounds = new mapboxgl.LngLatBounds();
      validPharmacies.forEach((p) => bounds.extend([p.longitude, p.latitude]));
      const ne = bounds.getNorthEast();
      const sw = bounds.getSouthWest();
      if (Math.abs(ne.lng - sw.lng) < 0.5 && Math.abs(ne.lat - sw.lat) < 0.5) {
        map.fitBounds(bounds, { padding: 50, maxZoom: 15, duration: 1000 });
      }
    }
  }, [mapReady, pharmacies]);

  // Capa de RESULTADOS de medicamento: pines con etiqueta de precio sobre las
  // farmacias que lo venden. Se reconstruye/limpia cuando cambia la selección.
  useEffect(() => {
    if (Platform.OS !== 'web' || !mapReady || !mapRef.current) return;
    const mapboxgl = getMapboxGL();
    if (!mapboxgl) return;
    const map = mapRef.current;
    const SRC = 'med-results';
    const CIRCLE = 'med-results-circle';
    const LABEL = 'med-results-label';

    const cleanup = () => {
      [LABEL, CIRCLE].forEach((id) => { if (map.getLayer(id)) map.removeLayer(id); });
      if (map.getSource(SRC)) map.removeSource(SRC);
    };

    if (medMarkers.length === 0) {
      cleanup();
      return;
    }

    const geojson = {
      type: 'FeatureCollection',
      features: medMarkers.map((m) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [m.longitude, m.latitude] },
        properties: { key: m.key, label: `RD$${Math.round(m.price)}`, cheapest: m.cheapest ? 1 : 0 },
      })),
    };

    cleanup();
    map.addSource(SRC, { type: 'geojson', data: geojson });
    map.addLayer({
      id: CIRCLE,
      type: 'circle',
      source: SRC,
      paint: {
        'circle-radius': 18,
        'circle-color': ['case', ['==', ['get', 'cheapest'], 1], '#16A34A', '#0E5A3C'],
        'circle-stroke-width': 3,
        'circle-stroke-color': '#FFFFFF',
      },
    });
    map.addLayer({
      id: LABEL,
      type: 'symbol',
      source: SRC,
      layout: {
        'text-field': ['get', 'label'],
        'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
        'text-size': 11,
        'text-allow-overlap': true,
      },
      paint: { 'text-color': '#FFFFFF' },
    });

    const onClick = (e: any) => {
      const f = e.features?.[0];
      if (!f) return;
      const key = f.properties?.key;
      const marker = medMarkers.find((m) => m.key === key);
      if (marker) {
        setSelectedMedMarker(marker);
        setSelectedPharmacy(null);
        setFocusTarget(null);
        map.flyTo({ center: f.geometry.coordinates, zoom: 15, duration: 700 });
      }
    };
    const enter = () => { map.getCanvas().style.cursor = 'pointer'; };
    const leave = () => { map.getCanvas().style.cursor = ''; };
    map.on('click', CIRCLE, onClick);
    map.on('mouseenter', CIRCLE, enter);
    map.on('mouseleave', CIRCLE, leave);

    // Encuadrar las farmacias con el medicamento.
    if (medMarkers.length === 1) {
      map.flyTo({ center: [medMarkers[0].longitude, medMarkers[0].latitude], zoom: 15, duration: 1000 });
    } else {
      const b = new mapboxgl.LngLatBounds();
      medMarkers.forEach((m) => b.extend([m.longitude, m.latitude]));
      map.fitBounds(b, { padding: 90, maxZoom: 15, duration: 1000 });
    }

    return () => {
      map.off('click', CIRCLE, onClick);
      map.off('mouseenter', CIRCLE, enter);
      map.off('mouseleave', CIRCLE, leave);
      cleanup();
    };
  }, [medMarkers, mapReady]);

  // Volar a la farmacia enfocada (web) cuando el mapa esté listo.
  useEffect(() => {
    if (!hasFocus || Platform.OS !== 'web') return;
    if (!mapReady || !mapRef.current) return;
    mapRef.current.flyTo({
      center: [focusLng as number, focusLat as number],
      zoom: 16,
      duration: 1200,
    });
  }, [hasFocus, mapReady, focusLat, focusLng]);

  // Autocompletar medicamento (debounce 300 ms).
  useEffect(() => {
    const q = medQuery.trim();
    if (q.length < 2) {
      setMedSuggestions([]);
      setSearchingMed(false);
      return;
    }
    // No re-buscar si el texto ya corresponde al medicamento seleccionado.
    if (selectedMed && q === selectedMed.name.trim()) {
      setMedSuggestions([]);
      return;
    }
    setSearchingMed(true);
    const handle = setTimeout(async () => {
      try {
        const results = await searchMedsApi({ query: q, limit: 8 });
        setMedSuggestions(results);
      } catch {
        setMedSuggestions([]);
      } finally {
        setSearchingMed(false);
      }
    }, 300);
    return () => clearTimeout(handle);
  }, [medQuery, selectedMed]);

  const onSelectMed = useCallback(async (med: MedicationCard) => {
    setMedQuery(med.name);
    setMedSuggestions([]);
    Keyboard.dismiss();
    setSearchingMed(true);
    try {
      const detail = await getMedicationDetail(med.id);
      setSelectedMed(detail);
      setSelectedPharmacy(null);
      setSelectedMedMarker(null);
      setFocusTarget(null);
      bottomSheetRef.current?.snapToIndex(1);
    } catch (err) {
      captureException(err, { screen: 'map', action: 'getMedicationDetail', medId: med.id });
    } finally {
      setSearchingMed(false);
    }
  }, []);

  const clearMedSearch = useCallback(() => {
    setMedQuery('');
    setMedSuggestions([]);
    setSelectedMed(null);
    setSelectedMedMarker(null);
  }, []);

  const closeCard = useCallback(() => {
    setSelectedPharmacy(null);
    setSelectedMedMarker(null);
    setFocusTarget(null);
  }, []);

  // Colapsar el selector de ruta al cambiar/cerrar la selección activa.
  useEffect(() => {
    setShowNav(false);
  }, [selectedPharmacy?.id, selectedMedMarker?.key]);

  // Llegada desde el detalle de un medicamento: seleccionar esa farmacia y
  // mostrar la ruta directa (Google Maps / Waze) sin pasos extra.
  useEffect(() => {
    if (!hasFocus || !focusNav) return;
    setFocusTarget({
      key: 'focus',
      name: focusName || 'Farmacia',
      address: focusAddr,
      price: focusPrice,
      latitude: focusLat as number,
      longitude: focusLng as number,
      cheapest: false,
      med: focusMed,
    });
    setSelectedPharmacy(null);
    setSelectedMedMarker(null);
    setShowNav(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasFocus, focusNav]);

  const openGoogleMaps = useCallback((lat: number, lng: number) => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
    if (Platform.OS === 'web') {
      window.open(url, '_blank');
    } else {
      Linking.openURL(url);
    }
  }, []);

  const openWaze = useCallback((lat: number, lng: number) => {
    const url = `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`;
    if (Platform.OS === 'web') {
      window.open(url, '_blank');
    } else {
      Linking.openURL(url);
    }
  }, []);

  const flyToPharmacy = useCallback((pharm: PharmacyView) => {
    setSelectedPharmacy(pharm);
    setSelectedMedMarker(null);
    setFocusTarget(null);
    if (Platform.OS === 'web' && mapRef.current) {
      mapRef.current.flyTo({
        center: [pharm.longitude, pharm.latitude],
        zoom: 16,
        duration: 800,
      });
    }
    // En móvil, PharmacyMapNative anima hacia `selected` automáticamente.
  }, []);

  const flyToMedMarker = useCallback((m: MedMarker) => {
    setSelectedMedMarker(m);
    setSelectedPharmacy(null);
    setFocusTarget(null);
    if (Platform.OS === 'web' && mapRef.current) {
      mapRef.current.flyTo({ center: [m.longitude, m.latitude], zoom: 15, duration: 700 });
    }
  }, []);

  // Web-only fallback when the Mapbox token is missing. On native we use
  // Google Maps via react-native-maps and do not depend on MAPBOX_TOKEN.
  if (Platform.OS === 'web' && !MAPBOX_TOKEN) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <MapPin size={48} color="#34C26A" />
        <Text style={styles.loadingText}>{t.map.mapboxMissing}</Text>
      </View>
    );
  }

  // "1 farmacia" vs "N farmacias"
  const pharmWord = (n: number) => (n === 1 ? t.map.pharmacySingular : t.map.pharmacies);

  const navCandidate = focusTarget
    ? { lat: focusTarget.latitude, lng: focusTarget.longitude }
    : selectedMedMarker
    ? { lat: selectedMedMarker.latitude, lng: selectedMedMarker.longitude }
    : selectedPharmacy
    ? { lat: selectedPharmacy.latitude, lng: selectedPharmacy.longitude }
    : null;
  // Solo navegamos si la coord es real (Bug 2): evita abrir Maps/Waze hacia el
  // centro de Santiago cuando la farmacia no tiene ubicación cargada.
  const navCoords =
    navCandidate && isRealCoord(navCandidate.lat, navCandidate.lng) ? navCandidate : null;
  // ¿Hay una farmacia seleccionada pero sin ubicación real? → mostramos aviso
  // en vez de un botón de ruta que llevaría a un destino equivocado.
  const hasSelectionWithoutCoords =
    !!navCandidate && !navCoords;

  return (
    <View style={styles.container}>
      {/* Buscador de MEDICAMENTO (flotante, arriba del mapa) */}
      <View style={[styles.medSearchOverlay, { top: insets.top + 8 }]}>
        <View style={styles.medSearchBar}>
          <Search size={18} color="#106B4F" />
          <TextInput
            style={styles.medSearchInput}
            placeholder={t.map.medSearchPlaceholder}
            placeholderTextColor="#9AA3AF"
            value={medQuery}
            onChangeText={setMedQuery}
            autoCorrect={false}
            returnKeyType="search"
          />
          {(medQuery.length > 0 || selectedMed) && (
            <TouchableOpacity onPress={clearMedSearch} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={18} color="#9AA3AF" />
            </TouchableOpacity>
          )}
        </View>

        {searchingMed && medSuggestions.length === 0 && (
          <View style={styles.medSuggestBox}>
            <View style={styles.medSuggestLoading}>
              <ActivityIndicator size="small" color="#16A34A" />
              <Text style={styles.medSuggestLoadingText}>{t.map.searching}</Text>
            </View>
          </View>
        )}

        {!searchingMed && medSuggestions.length > 0 && (
          <View style={styles.medSuggestBox}>
            {medSuggestions.map((s) => (
              <TouchableOpacity key={s.id} style={styles.medSuggestItem} onPress={() => onSelectMed(s)}>
                <Pill size={16} color="#16A34A" />
                <View style={styles.medSuggestInfo}>
                  <Text style={styles.medSuggestName} numberOfLines={1}>{s.name}</Text>
                  {!!s.dosage && <Text style={styles.medSuggestDose} numberOfLines={1}>{s.dosage}</Text>}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {selectedMed && medSuggestions.length === 0 && !searchingMed && (
          <View style={styles.medResultChip}>
            <Pill size={14} color="#16A34A" />
            <Text style={styles.medResultChipText} numberOfLines={1}>
              {medMarkers.length > 0
                ? `${medMarkers.length} ${pharmWord(medMarkers.length)} ${t.map.medResultsWith} ${selectedMed.name} · ${t.map.medFrom} RD$${Math.round(medMarkers[0].price)}`
                : `${selectedMed.name} — ${t.map.noMedResults}`}
            </Text>
          </View>
        )}
      </View>

      {error && (
        <View style={[styles.errorBanner, { top: insets.top + 62 }]}>
          <AlertCircle size={18} color="#D32F2F" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {!error && !loading && usingApproxLocation && !selectedMed && !manualMode && (
        <TouchableOpacity
          style={[styles.infoBanner, { top: insets.top + 62 }]}
          onPress={() => { setManualMode(true); setGeocodeError(null); }}
          activeOpacity={0.8}
        >
          <Navigation size={16} color="#106B4F" />
          <Text style={styles.infoText}>{t.map.approxLocation}</Text>
          <Text style={styles.infoAction}>Cambiar</Text>
        </TouchableOpacity>
      )}

      {/* U6: input de dirección manual cuando el GPS está denegado. */}
      {manualMode && (
        <View style={[styles.manualBox, { top: insets.top + 62 }]}>
          <View style={styles.manualRow}>
            <Search size={16} color="#666" />
            <TextInput
              style={styles.manualInput}
              value={manualAddress}
              onChangeText={setManualAddress}
              placeholder="Ej. Av. 27 de Febrero, Santiago"
              placeholderTextColor="#999"
              autoFocus
              onSubmitEditing={handleGeocodeManual}
              returnKeyType="search"
            />
            <TouchableOpacity onPress={() => { setManualMode(false); setGeocodeError(null); }} hitSlop={{top:8,bottom:8,left:8,right:8}}>
              <X size={18} color="#666" />
            </TouchableOpacity>
          </View>
          <View style={styles.manualActions}>
            <TouchableOpacity
              style={[styles.manualBtn, geocoding && styles.manualBtnDisabled]}
              onPress={handleGeocodeManual}
              disabled={geocoding}
            >
              {geocoding ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.manualBtnText}>Buscar farmacias aquí</Text>
              )}
            </TouchableOpacity>
          </View>
          {geocodeError && <Text style={styles.manualError}>{geocodeError}</Text>}
        </View>
      )}

      {/* Map container: mapbox-gl on web, react-native-maps on native */}
      <View style={styles.mapWrapper}>
        {Platform.OS === 'web' ? (
          <div
            ref={mapContainerRef}
            style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }}
          />
        ) : (
          <PharmacyMapNative
            pharmacies={pharmaciesFiltradas}
            selected={selectedPharmacy}
            center={hasFocus ? [focusLng as number, focusLat as number] : userCoordsRef.current}
            onSelect={(pharm) => { setSelectedPharmacy(pharm); setSelectedMedMarker(null); }}
            onReady={() => setMapReady(true)}
            focusCoord={
              selectedMedMarker && isRealCoord(selectedMedMarker.latitude, selectedMedMarker.longitude)
                ? { latitude: selectedMedMarker.latitude, longitude: selectedMedMarker.longitude }
                : focusTarget && isRealCoord(focusTarget.latitude, focusTarget.longitude)
                ? { latitude: focusTarget.latitude, longitude: focusTarget.longitude }
                : null
            }
          />
        )}

        {(!mapReady || loading) && (
          <KerivaLoader
            label={loading ? t.map.loadingPharmacies : t.map.preparingMap}
          />
        )}
      </View>

      {/* Bottom sheet — native gesture handling, no conflict with MapView */}
      <BottomSheet
        ref={bottomSheetRef}
        index={1}
        snapPoints={snapPoints}
        backgroundStyle={styles.sheetBackground}
        handleIndicatorStyle={styles.sheetHandle}
        enablePanDownToClose={false}
      >
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle} numberOfLines={1}>
            {selectedMed
              ? `${medMarkers.length} ${pharmWord(medMarkers.length)} ${t.map.medResultsWith} ${selectedMed.name}`
              : loading
              ? t.map.loadingShort
              : `${pharmaciesFiltradas.length} ${pharmWord(pharmaciesFiltradas.length)}`}
          </Text>
          {selectedMed ? (
            <TouchableOpacity onPress={clearMedSearch} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.backAllLink}>{t.map.backToAll}</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.invToggle, onlyConInventario && styles.invToggleActive]}
              onPress={() => setOnlyConInventario((v) => !v)}
            >
              <Pill size={12} color={onlyConInventario ? '#fff' : '#106B4F'} />
              <Text style={[styles.invToggleText, onlyConInventario && styles.invToggleTextActive]}>
                Con inventario
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* U6: banner "ampliar radio" cuando no hay farmacias en el radio actual.
            Solo en el modo lista (sin medicamento seleccionado). */}
        {!loading && !selectedMed && pharmaciesFiltradas.length === 0 && (
          <View style={styles.widenBanner}>
            <AlertCircle size={18} color="#D97706" />
            <View style={{ flex: 1 }}>
              <Text style={styles.widenTitle}>Sin farmacias en {Math.round(searchRadius / 1000)} km</Text>
              <Text style={styles.widenText}>Amplía el radio de búsqueda:</Text>
            </View>
            {searchRadius < 5000 && (
              <TouchableOpacity style={styles.widenBtn} onPress={() => handleAmpliarRadio(5000)}>
                <Text style={styles.widenBtnText}>5 km</Text>
              </TouchableOpacity>
            )}
            {searchRadius < 10000 && (
              <TouchableOpacity style={styles.widenBtn} onPress={() => handleAmpliarRadio(10000)}>
                <Text style={styles.widenBtnText}>10 km</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Buscador de farmacia (solo en modo lista completa) */}
        {!selectedMed && (
          <View style={styles.sheetSearchWrapper}>
            <Search size={16} color="#999" />
            <TextInput
              style={styles.sheetSearchInput}
              placeholder={t.map.searchPlaceholder}
              placeholderTextColor="#999"
              value={drawerSearch}
              onChangeText={setDrawerSearch}
              autoCorrect={false}
            />
            {drawerSearch.length > 0 && (
              <TouchableOpacity onPress={() => setDrawerSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <X size={16} color="#999" />
              </TouchableOpacity>
            )}
          </View>
        )}

        <BottomSheetScrollView
          style={styles.sheetList}
          contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
          showsVerticalScrollIndicator={false}
        >
          {selectedMed ? (
            medMarkers.length === 0 ? (
              <View style={styles.emptyMed}>
                <Pill size={32} color="#C7D2CC" />
                <Text style={styles.emptyMedText}>{t.map.noMedResults}</Text>
                <TouchableOpacity onPress={clearMedSearch} style={styles.backAllBtn}>
                  <Text style={styles.backAllBtnText}>{t.map.backToAll}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              medMarkers.map((m) => (
                <TouchableOpacity
                  key={m.key}
                  style={[styles.pharmCard, selectedMedMarker?.key === m.key && styles.pharmCardActive]}
                  onPress={() => {
                    flyToMedMarker(m);
                    bottomSheetRef.current?.snapToIndex(0);
                  }}
                >
                  <View style={styles.pharmCardLeft}>
                    <View style={[styles.pharmPin, m.nearest && styles.pharmPinCheapest]}>
                      <MapPin size={16} color={m.nearest ? '#052419' : '#FFFFFF'} />
                    </View>
                    <View style={styles.pharmInfo}>
                      <Text style={styles.pharmName} numberOfLines={1}>{m.name}</Text>
                      <Text style={styles.pharmAddress} numberOfLines={1}>{m.address}</Text>
                    </View>
                  </View>
                  <View style={styles.medPriceWrap}>
                    {m.distanceKm != null && (
                      <Text style={[styles.medPriceValue, m.nearest && styles.medPriceValueBest]}>
                        {formatDistance(m.distanceKm)}
                      </Text>
                    )}
                    {m.nearest && <Text style={styles.bestBadgeText}>{t.map.nearest}</Text>}
                    {m.price > 0 && <Text style={styles.medPriceSecondary}>RD${Math.round(m.price)}</Text>}
                  </View>
                </TouchableOpacity>
              ))
            )
          ) : (
            pharmacies
              .filter((p) => {
                if (!drawerSearch.trim()) return true;
                const q = drawerSearch.toLowerCase();
                return p.name.toLowerCase().includes(q) || p.address.toLowerCase().includes(q) || p.city.toLowerCase().includes(q);
              })
              .map((pharm) => (
                <TouchableOpacity
                  key={pharm.id}
                  style={[
                    styles.pharmCard,
                    selectedPharmacy?.id === pharm.id && styles.pharmCardActive,
                  ]}
                  onPress={() => {
                    flyToPharmacy(pharm);
                    bottomSheetRef.current?.snapToIndex(0);
                  }}
                >
                  <View style={styles.pharmCardLeft}>
                    <View style={[
                      styles.pharmPin,
                      pharm.isCheapest && styles.pharmPinCheapest,
                    ]}>
                      <MapPin size={16} color={pharm.isCheapest ? '#052419' : '#FFFFFF'} />
                    </View>
                    <View style={styles.pharmInfo}>
                      <Text style={styles.pharmName}>{pharm.name}</Text>
                      <Text style={styles.pharmAddress} numberOfLines={1}>{pharm.address}</Text>
                      {(() => {
                        const rt = ratings.get(pharm.id);
                        return rt && rt.total > 0 ? (
                          <View style={styles.pharmStars}>
                            <StarRating value={rt.promedio} size={12} count={rt.total} showValue />
                          </View>
                        ) : null;
                      })()}
                    </View>
                  </View>
                  <View style={styles.pharmCardRight}>
                    {pharm.isCheapest && (
                      <View style={styles.bestBadge}>
                        <Text style={styles.bestBadgeText}>{t.map.best}</Text>
                      </View>
                    )}
                    {/* Bug 8: acceso directo a reseñas desde la lista (no depende
                        del mapa, que puede verse en blanco sin la key de Maps). */}
                    <TouchableOpacity
                      style={styles.pharmReviewsBtn}
                      onPress={() =>
                        router.push({
                          pathname: '/resenas/[farmaciaId]',
                          params: { farmaciaId: pharm.id, nombre: pharm.name },
                        })
                      }
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Star size={13} color="#F5A623" fill="#F5A623" />
                      <Text style={styles.pharmReviewsBtnText}>{t.reviews.title}</Text>
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              ))
          )}
        </BottomSheetScrollView>
      </BottomSheet>

      {/* Tarjeta de farmacia seleccionada (modo lista completa) */}
      {selectedPharmacy && !selectedMedMarker && (
        <View style={[styles.detailCard, Platform.OS !== 'web' && styles.detailCardNative]}>
          <View style={styles.detailHeader}>
            <View style={styles.detailTitleRow}>
              <MapPin size={22} color="#106B4F" />
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
            {(() => {
              // U6: botón Llamar — solo si el teléfono parece un número real.
              const raw = selectedPharmacy.phone ?? '';
              const cleaned = raw.replace(/[^\d+]/g, '');
              const isReal = cleaned.length >= 7 && raw !== 'No disponible';
              if (!isReal) {
                return (
                  <View style={styles.detailRow}>
                    <Phone size={16} color="#666" />
                    <Text style={styles.detailText}>{raw}</Text>
                  </View>
                );
              }
              return (
                <TouchableOpacity
                  style={styles.detailRow}
                  onPress={() => Linking.openURL(`tel:${cleaned}`).catch(() => {})}
                >
                  <Phone size={16} color="#106B4F" />
                  <Text style={[styles.detailText, styles.detailTextLink]}>{raw}</Text>
                  <Text style={styles.callBadge}>Llamar</Text>
                </TouchableOpacity>
              );
            })()}
          </View>

          {/* Keriva Reviews — calificación + acceso a reseñas */}
          <TouchableOpacity
            style={styles.reviewsRow}
            onPress={() =>
              router.push({
                pathname: '/resenas/[farmaciaId]',
                params: { farmaciaId: selectedPharmacy.id, nombre: selectedPharmacy.name },
              })
            }
          >
            {(() => {
              const rt = ratings.get(selectedPharmacy.id);
              return rt && rt.total > 0 ? (
                <StarRating value={rt.promedio} size={16} count={rt.total} showValue />
              ) : (
                <Text style={styles.reviewsEmpty}>{t.reviews.noReviewsYet}</Text>
              );
            })()}
            <Text style={styles.reviewsLink}>{t.reviews.seeReviews}</Text>
          </TouchableOpacity>

          {selectedPharmacy.minPrice > 0 && (
            <View style={styles.detailPrice}>
              <Text style={styles.detailPriceLabel}>{t.map.lowestPrice}</Text>
              <Text style={styles.detailPriceValue}>
                RD${selectedPharmacy.minPrice.toFixed(2)}
              </Text>
            </View>
          )}

          {renderNavRow(navCoords)}
        </View>
      )}

      {/* Tarjeta de farmacia con el medicamento buscado */}
      {selectedMedMarker && (
        <View style={[styles.detailCard, Platform.OS !== 'web' && styles.detailCardNative]}>
          <View style={styles.detailHeader}>
            <View style={styles.detailTitleRow}>
              <MapPin size={22} color="#106B4F" />
              <Text style={styles.detailTitle} numberOfLines={1}>{selectedMedMarker.name}</Text>
            </View>
            <TouchableOpacity onPress={closeCard} style={styles.closeBtn}>
              <X size={18} color="#666" />
            </TouchableOpacity>
          </View>

          <View style={styles.detailBody}>
            <View style={styles.detailRow}>
              <Pill size={16} color="#16A34A" />
              <Text style={styles.detailText}>{selectedMed?.name}{selectedMed?.dosage ? ` · ${selectedMed.dosage}` : ''}</Text>
            </View>
            <View style={styles.detailRow}>
              <MapPin size={16} color="#666" />
              <Text style={styles.detailText}>{selectedMedMarker.address}</Text>
            </View>
          </View>

          <View style={styles.detailPrice}>
            <Text style={styles.detailPriceLabel}>{t.map.priceHere}</Text>
            <Text style={styles.detailPriceValue}>RD${Math.round(selectedMedMarker.price)}</Text>
          </View>

          {renderNavRow(navCoords)}
        </View>
      )}

      {/* Tarjeta de la farmacia enfocada desde el detalle (ruta directa) */}
      {focusTarget && (
        <View style={[styles.detailCard, Platform.OS !== 'web' && styles.detailCardNative]}>
          <View style={styles.detailHeader}>
            <View style={styles.detailTitleRow}>
              <MapPin size={22} color="#106B4F" />
              <Text style={styles.detailTitle} numberOfLines={1}>{focusTarget.name}</Text>
            </View>
            <TouchableOpacity onPress={closeCard} style={styles.closeBtn}>
              <X size={18} color="#666" />
            </TouchableOpacity>
          </View>

          <View style={styles.detailBody}>
            {!!focusTarget.med && (
              <View style={styles.detailRow}>
                <Pill size={16} color="#16A34A" />
                <Text style={styles.detailText}>{focusTarget.med}</Text>
              </View>
            )}
            {!!focusTarget.address && (
              <View style={styles.detailRow}>
                <MapPin size={16} color="#666" />
                <Text style={styles.detailText}>{focusTarget.address}</Text>
              </View>
            )}
          </View>

          {focusTarget.price > 0 && (
            <View style={styles.detailPrice}>
              <Text style={styles.detailPriceLabel}>{t.map.medFrom}</Text>
              <Text style={styles.detailPriceValue}>RD${Math.round(focusTarget.price)}</Text>
            </View>
          )}

          {renderNavRow(navCoords)}
        </View>
      )}

      <LoginNudge delayMs={6000} />
    </View>
  );

  // --- Selector de ruta (Google Maps / Waze) compartido por ambas tarjetas ---
  function renderNavRow(coords: { lat: number; lng: number } | null) {
    if (!coords) {
      // Bug 2: farmacia sin ubicación real → aviso en vez de ruta equivocada.
      return hasSelectionWithoutCoords ? (
        <View style={styles.navRow}>
          <Text style={styles.navUnavailableText}>{t.map.noLocation}</Text>
        </View>
      ) : null;
    }
    if (!showNav) {
      return (
        <View style={styles.navRow}>
          <PressableScale style={styles.navBtnFull} onPress={() => setShowNav(true)}>
            <Navigation size={16} color="#FFFFFF" />
            <Text style={styles.navBtnFullText}>{t.map.getDirections}</Text>
          </PressableScale>
        </View>
      );
    }
    return (
      <>
        <Text style={styles.navChooserLabel}>{t.map.chooseRouteApp}</Text>
        <View style={styles.navRow}>
          <PressableScale
            style={[styles.routeBtn, styles.routeBtnGoogle]}
            onPress={() => { openGoogleMaps(coords.lat, coords.lng); setShowNav(false); }}
          >
            <View style={[styles.routeIconBadge, { backgroundColor: '#E8F0FE' }]}>
              <MapPin size={18} color="#1A73E8" />
            </View>
            <Text style={[styles.routeBtnText, { color: '#1A73E8' }]}>Google Maps</Text>
          </PressableScale>
          <PressableScale
            style={[styles.routeBtn, styles.routeBtnWaze]}
            onPress={() => { openWaze(coords.lat, coords.lng); setShowNav(false); }}
          >
            <View style={[styles.routeIconBadge, { backgroundColor: '#E5F8FF' }]}>
              <Navigation size={18} color="#05C7F2" />
            </View>
            <Text style={[styles.routeBtnText, { color: '#0B93C9' }]}>Waze</Text>
          </PressableScale>
        </View>
      </>
    );
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#052419' },
  centerContent: { justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { fontFamily: 'DMSans-Medium', fontSize: 14, color: '#34C26A', marginTop: 8 },

  // --- Buscador de medicamento ---
  medSearchOverlay: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 200,
  },
  medSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 48,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 8,
  },
  medSearchInput: {
    flex: 1,
    minWidth: 0,
    fontFamily: 'DMSans-Medium',
    fontSize: 15,
    color: '#111827',
    paddingVertical: 0,
  },
  medSuggestBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    marginTop: 8,
    paddingVertical: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
    overflow: 'hidden',
  },
  medSuggestLoading: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12 },
  medSuggestLoadingText: { fontFamily: 'DMSans-Medium', fontSize: 13, color: '#6B7280' },
  medSuggestItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  medSuggestInfo: { flex: 1, minWidth: 0 },
  medSuggestName: { fontFamily: 'DMSans-Medium', fontSize: 14, color: '#111827' },
  medSuggestDose: { fontFamily: 'DMSans-Regular', fontSize: 12, color: '#6B7280', marginTop: 1 },
  medResultChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#DCFCE7',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginTop: 8,
  },
  medResultChipText: { flex: 1, fontFamily: 'DMSans-Medium', fontSize: 12.5, color: '#15803D' },

  errorBanner: {
    position: 'absolute',
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
  infoBanner: {
    position: 'absolute',
    left: 16,
    right: 16,
    backgroundColor: '#E8F5E9',
    padding: 10,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    zIndex: 100,
  },
  infoText: { fontFamily: 'DMSans-Medium', fontSize: 12, color: '#106B4F', flex: 1 },
  infoAction: { fontFamily: 'DMSans-Bold', fontSize: 12, color: '#106B4F', textDecorationLine: 'underline' },

  // U6 — Input dirección manual cuando el GPS está denegado.
  manualBox: {
    position: 'absolute',
    left: 16,
    right: 16,
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 14,
    gap: 10,
    zIndex: 100,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  manualRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    height: 44,
    borderRadius: 10,
  },
  manualInput: { flex: 1, fontFamily: 'DMSans-Regular', fontSize: 14, color: '#111' },
  manualActions: { flexDirection: 'row', justifyContent: 'flex-end' },
  manualBtn: {
    backgroundColor: '#106B4F',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  manualBtnDisabled: { opacity: 0.6 },
  manualBtnText: { fontFamily: 'DMSans-Bold', fontSize: 13, color: '#fff' },
  manualError: { fontFamily: 'DMSans-Regular', fontSize: 12, color: '#DC2626', textAlign: 'center' },

  // M1 — Toggle "solo con inventario disponible"
  invToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 1.2,
    borderColor: '#106B4F',
    backgroundColor: '#E8F5E9',
  },
  invToggleActive: {
    backgroundColor: '#106B4F',
  },
  invToggleText: {
    fontFamily: 'DMSans-Bold',
    fontSize: 11,
    color: '#106B4F',
  },
  invToggleTextActive: {
    color: '#fff',
  },

  // U6 — Banner "ampliar radio" cuando no hay farmacias en el radio actual.
  widenBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 12,
    backgroundColor: '#FFFBEB',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  widenTitle: { fontFamily: 'DMSans-Bold', fontSize: 13, color: '#92400E' },
  widenText: { fontFamily: 'DMSans-Regular', fontSize: 12, color: '#92400E' },
  widenBtn: {
    backgroundColor: '#D97706',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  widenBtnText: { fontFamily: 'DMSans-Bold', fontSize: 12, color: '#fff' },

  // U6 — fila de teléfono clickeable con badge "Llamar".
  detailTextLink: { color: '#106B4F', textDecorationLine: 'underline' },
  callBadge: {
    fontFamily: 'DMSans-Bold',
    fontSize: 11,
    color: '#106B4F',
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },

  mapWrapper: { flex: 1, position: 'relative' },
  nativePin: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#106B4F',
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 6,
  },
  nativePinCheapest: { backgroundColor: '#34C26A' },
  mapLoading: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#052419',
  },
  sheetBackground: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 16,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    backgroundColor: '#D0D0D0',
    borderRadius: 2,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 4,
  },
  sheetTitle: {
    flex: 1,
    fontFamily: 'Poppins-SemiBold',
    fontSize: 16,
    color: '#052419',
  },
  backAllLink: { fontFamily: 'DMSans-Medium', fontSize: 13, color: '#16A34A' },
  sheetSearchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F0F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 40,
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 10,
  },
  sheetSearchInput: {
    flex: 1,
    fontFamily: 'DMSans-Regular',
    fontSize: 14,
    color: '#052419',
    paddingVertical: 0,
  },
  sheetList: { paddingHorizontal: 16 },
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
    borderColor: '#106B4F',
  },
  pharmCardLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 },
  pharmPin: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#106B4F',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pharmPinCheapest: { backgroundColor: '#34C26A' },
  pharmInfo: { flex: 1 },
  pharmName: { fontFamily: 'DMSans-Medium', fontSize: 14, color: '#052419' },
  pharmAddress: { fontFamily: 'DMSans-Regular', fontSize: 12, color: '#666', marginTop: 2 },
  pharmStars: { marginTop: 4 },
  medPriceWrap: { alignItems: 'flex-end', marginLeft: 8 },
  medPriceValue: { fontFamily: 'Poppins-Bold', fontSize: 15, color: '#106B4F' },
  medPriceValueBest: { color: '#16A34A' },
  medPriceSecondary: { fontFamily: 'DMSans-Medium', fontSize: 11, color: '#6B7280', marginTop: 1 },
  bestBadge: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    marginLeft: 8,
  },
  bestBadgeText: { fontFamily: 'DMSans-Bold', fontSize: 9, color: '#106B4F' },
  pharmCardRight: { alignItems: 'flex-end', justifyContent: 'center', gap: 4, marginLeft: 8 },
  pharmReviewsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF7E6',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
  },
  pharmReviewsBtnText: { fontFamily: 'DMSans-Bold', fontSize: 11, color: '#B26A00' },
  emptyMed: { alignItems: 'center', paddingVertical: 32, gap: 12 },
  emptyMedText: { fontFamily: 'DMSans-Medium', fontSize: 14, color: '#6B7280', textAlign: 'center', paddingHorizontal: 24 },
  backAllBtn: {
    backgroundColor: '#16A34A',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
  },
  backAllBtnText: { fontFamily: 'Poppins-SemiBold', fontSize: 13, color: '#FFFFFF' },
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
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 10,
    zIndex: 50,
  },
  detailCardNative: {
    bottom: undefined,
    top: 60,
  },
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  detailTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  detailTitle: { fontFamily: 'Poppins-SemiBold', fontSize: 17, color: '#052419', flex: 1 },
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
  reviewsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    marginTop: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E7ECEA',
  },
  reviewsEmpty: { fontFamily: 'DMSans-Regular', fontSize: 13, color: '#9AA3AF' },
  reviewsLink: { fontFamily: 'DMSans-Bold', fontSize: 13, color: '#16A34A' },
  detailPrice: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
  },
  detailPriceLabel: { fontFamily: 'DMSans-Medium', fontSize: 13, color: '#106B4F' },
  detailPriceValue: { fontFamily: 'Poppins-Bold', fontSize: 18, color: '#106B4F' },
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
    color: '#106B4F',
  },
  navBtnFull: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#16A34A',
    paddingVertical: 13,
    borderRadius: 999,
    gap: 8,
  },
  navBtnFullText: {
    fontFamily: 'Poppins-Bold',
    fontSize: 15,
    color: '#FFFFFF',
  },
  navUnavailableText: {
    flex: 1,
    fontFamily: 'DMSans-Medium',
    fontSize: 12,
    color: '#9AA3AF',
    textAlign: 'center',
    paddingVertical: 6,
  },
  navChooserLabel: {
    fontFamily: 'DMSans-Medium',
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  routeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    paddingVertical: 10,
    borderRadius: 14,
    gap: 8,
  },
  routeBtnGoogle: { borderColor: '#D2E3FC' },
  routeBtnWaze: { borderColor: '#BEE9F7' },
  routeIconBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  routeBtnText: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 13,
  },
});
