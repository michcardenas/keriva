import type { PharmacyView } from '@/lib/api/farmacias';

// Stub para web: el mapa en web usa mapbox-gl directamente (ver map.tsx).
// Este archivo evita que Metro intente empaquetar react-native-maps en web.
type Props = {
  pharmacies: PharmacyView[];
  selected: PharmacyView | null;
  center: [number, number];
  onSelect: (p: PharmacyView) => void;
  onReady?: () => void;
  focusCoord?: { latitude: number; longitude: number } | null;
};

export default function PharmacyMapNative(_props: Props) {
  return null;
}
