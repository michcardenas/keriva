import { Platform } from 'react-native';

// =====================================================================
// Geolocalización con fallback — Bug 04
// =====================================================================
// El documento del cliente (20 may 2026) pide que cuando el GPS devuelve
// coordenadas nulas o el permiso está denegado, el mapa NO se rompa: debe
// caer a Santiago de los Caballeros como punto de partida.
//
// expo-location está instalado pero no se usaba. Aquí se integra de forma
// segura: cualquier fallo (permiso denegado, timeout, GPS sin señal) cae al
// fallback en vez de lanzar excepción.
// =====================================================================

/** Centro de Santiago de los Caballeros (fallback oficial del cliente). */
export const SANTIAGO_COORDS = { lat: 19.4517, lng: -70.697 } as const;

// Caja envolvente (bounding box) aproximada de República Dominicana, con un
// pequeño margen. Keriva es una app SOLO para RD y todas las farmacias están
// dentro del país, así que si el GPS del usuario cae fuera de esta caja (p.ej.
// un tester en Colombia, o alguien usando la web fuera del país), usamos el
// fallback de Santiago en vez de mostrar un mapa vacío.
const RD_BOUNDS = {
  minLat: 17.3,
  maxLat: 20.2,
  minLng: -72.2,
  maxLng: -68.0,
} as const;

function isInsideRD(lat: number, lng: number): boolean {
  return (
    lat >= RD_BOUNDS.minLat &&
    lat <= RD_BOUNDS.maxLat &&
    lng >= RD_BOUNDS.minLng &&
    lng <= RD_BOUNDS.maxLng
  );
}

export type UserLocation = {
  lat: number;
  lng: number;
  /** true si se usó el fallback (GPS no disponible / denegado). */
  isFallback: boolean;
};

/**
 * Devuelve la ubicación del usuario. Nunca lanza: si el GPS falla por
 * cualquier motivo, retorna Santiago con isFallback=true.
 */
export async function getUserLocation(): Promise<UserLocation> {
  try {
    // En web usamos la Geolocation API del navegador (expo-location la
    // envuelve, pero el acceso directo evita issues de bundling en web).
    if (Platform.OS === 'web') {
      return await getWebLocation();
    }

    const Location = require('expo-location');
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      return { ...SANTIAGO_COORDS, isFallback: true };
    }
    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    const { latitude, longitude } = pos.coords ?? {};
    if (!isValidCoord(latitude) || !isValidCoord(longitude)) {
      return { ...SANTIAGO_COORDS, isFallback: true };
    }
    // Fuera de RD (ej. tester en Colombia) → fallback a Santiago.
    if (!isInsideRD(latitude, longitude)) {
      return { ...SANTIAGO_COORDS, isFallback: true };
    }
    return { lat: latitude, lng: longitude, isFallback: false };
  } catch {
    return { ...SANTIAGO_COORDS, isFallback: true };
  }
}

function isValidCoord(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n !== 0;
}

function getWebLocation(): Promise<UserLocation> {
  return new Promise((resolve) => {
    if (
      typeof navigator === 'undefined' ||
      !navigator.geolocation ||
      typeof navigator.geolocation.getCurrentPosition !== 'function'
    ) {
      resolve({ ...SANTIAGO_COORDS, isFallback: true });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        if (!isValidCoord(latitude) || !isValidCoord(longitude)) {
          resolve({ ...SANTIAGO_COORDS, isFallback: true });
          return;
        }
        // Fuera de RD (ej. tester en Colombia) → fallback a Santiago.
        if (!isInsideRD(latitude, longitude)) {
          resolve({ ...SANTIAGO_COORDS, isFallback: true });
          return;
        }
        resolve({ lat: latitude, lng: longitude, isFallback: false });
      },
      () => resolve({ ...SANTIAGO_COORDS, isFallback: true }),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 },
    );
  });
}
