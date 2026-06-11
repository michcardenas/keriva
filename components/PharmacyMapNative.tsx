import { useEffect, useRef } from 'react';
import { StyleSheet } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import type { PharmacyView } from '@/lib/api/farmacias';

// =====================================================================
// Mapa nativo (Android/iOS) — Google Maps vía react-native-maps.
// =====================================================================
// En móvil usamos Google Maps (la llave ya está en app.json android.config),
// así el build NO necesita el token secreto de descarga de Mapbox.
// En web se usa mapbox-gl directamente (ver app/(tabs)/map.tsx); allí se carga
// PharmacyMapNative.web.tsx (un stub que no importa react-native-maps).
// =====================================================================

type Props = {
  pharmacies: PharmacyView[];
  selected: PharmacyView | null;
  /** centro inicial en [lng, lat] (formato del resto del código). */
  center: [number, number];
  onSelect: (p: PharmacyView) => void;
  onReady?: () => void;
  /**
   * Bug 3: coordenada a la que centrar el mapa cuando NO hay una farmacia
   * `selected` (p. ej. el resultado de la búsqueda de medicamento o la llegada
   * desde el detalle). También se dibuja como pin destacado.
   */
  focusCoord?: { latitude: number; longitude: number } | null;
};

export default function PharmacyMapNative({
  pharmacies,
  selected,
  center,
  onSelect,
  onReady,
  focusCoord,
}: Props) {
  const ref = useRef<MapView>(null);

  // Animar hacia la farmacia seleccionada (desde el pin o desde la lista).
  useEffect(() => {
    if (selected && ref.current) {
      ref.current.animateToRegion(
        {
          latitude: selected.latitude,
          longitude: selected.longitude,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        },
        600,
      );
    }
  }, [selected]);

  // Bug 3: animar al punto de foco (med marker / llegada desde detalle) cuando
  // no hay una farmacia seleccionada.
  useEffect(() => {
    if (!selected && focusCoord && ref.current) {
      ref.current.animateToRegion(
        {
          latitude: focusCoord.latitude,
          longitude: focusCoord.longitude,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        },
        600,
      );
    }
  }, [focusCoord, selected]);

  return (
    <MapView
      ref={ref}
      provider={PROVIDER_GOOGLE}
      style={StyleSheet.absoluteFillObject}
      showsUserLocation
      showsMyLocationButton
      onMapReady={onReady}
      initialRegion={{
        latitude: center[1],
        longitude: center[0],
        latitudeDelta: 0.08,
        longitudeDelta: 0.08,
      }}
    >
      {pharmacies
        .filter((p) => p.latitude && p.longitude)
        .map((p) => (
          <Marker
            key={p.id}
            coordinate={{ latitude: p.latitude, longitude: p.longitude }}
            pinColor={p.isCheapest ? '#34C26A' : '#106B4F'}
            onPress={() => onSelect(p)}
          />
        ))}
      {focusCoord && (
        <Marker
          key="focus-marker"
          coordinate={focusCoord}
          pinColor="#F5A623"
        />
      )}
    </MapView>
  );
}
