import { Tabs } from 'expo-router';
import { Search, Map, Camera, User, Store } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLanguage } from '@/lib/LanguageContext';
import { useAuth } from '@/lib/AuthContext';
import { featureFlags } from '@/lib/feature-flags';
import { theme } from '@/lib/theme';

export default function TabLayout() {
  const { t } = useLanguage();
  const { perfil, session } = useAuth();
  const insets = useSafeAreaInsets();
  const rol = perfil?.rol ?? 'usuario';
  const isGuest = !session;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: true,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
          borderTopWidth: 1,
          height: 80 + insets.bottom,
          paddingBottom: 18 + insets.bottom,
          paddingTop: 8,
          ...theme.shadow.sm,
        },
        tabBarActiveTintColor: theme.colors.accent,
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarLabelStyle: {
          fontFamily: theme.font.bodyMedium,
          fontSize: 11,
          lineHeight: 14,
          marginTop: 4,
          paddingBottom: 2,
        },
        tabBarIconStyle: {
          marginTop: 0,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t.tabs.search,
          tabBarIcon: ({ size, color }) => <Search size={22} color={color} />,
          // Buscar es para el usuario; la farmacia no lo necesita.
          href: rol === 'farmacia' ? null : '/(tabs)',
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: t.tabs.map,
          tabBarIcon: ({ size, color }) => <Map size={22} color={color} />,
          // El mapa es para el usuario; oculto para farmacia.
          href: rol === 'farmacia' ? null : '/(tabs)/map',
        }}
      />
      <Tabs.Screen
        name="report"
        options={{
          title: t.tabs.report,
          tabBarIcon: ({ size, color }) => <Camera size={22} color={color} />,
          // Hide if feature flag off OR guest. El flujo de reporte directo de
          // precio se desactiva en Fase 1 (adendum v2.1 §3.3) — los usuarios
          // ahora auditan precios con votos ✅/❌ en PriceRangeCard.
          href:
            featureFlags.reportTabEnabled && !isGuest
              ? '/(tabs)/report'
              : null,
        }}
      />
      <Tabs.Screen
        name="farmacia"
        options={{
          title: t.nav.myPharmacy,
          tabBarIcon: ({ size, color }) => <Store size={22} color={color} />,
          // Hub de gestión, solo para el rol farmacia.
          href: rol === 'farmacia' ? '/(tabs)/farmacia' : null,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t.tabs.profile,
          tabBarIcon: ({ size, color }) => <User size={22} color={color} />,
          // Hide this tab for guests — same rationale as the report tab.
          href: isGuest ? null : '/(tabs)/profile',
        }}
      />
    </Tabs>
  );
}
