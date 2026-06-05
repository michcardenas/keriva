import { Tabs } from 'expo-router';
import { Search, Map, Camera, User, ShieldCheck } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLanguage } from '@/lib/LanguageContext';
import { useAuth } from '@/lib/AuthContext';
import { featureFlags } from '@/lib/feature-flags';

export default function TabLayout() {
  const { t } = useLanguage();
  const { perfil, session } = useAuth();
  const insets = useSafeAreaInsets();
  const rol = perfil?.rol ?? 'usuario';
  const showModeration = rol === 'admin' || rol === 'farmacia';
  const isGuest = !session;

  const moderationLabel = rol === 'admin' ? 'Moderar' : 'Mi farmacia';

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#052419',
          borderTopColor: 'rgba(52, 194, 106, 0.2)',
          borderTopWidth: 1,
          height: 60 + insets.bottom,
          paddingBottom: 8 + insets.bottom,
          paddingTop: 8,
        },
        tabBarActiveTintColor: '#34C26A',
        tabBarInactiveTintColor: 'rgba(255, 255, 255, 0.5)',
        tabBarLabelStyle: {
          fontFamily: 'DMSans-Medium',
          fontSize: 11,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t.tabs.search,
          tabBarIcon: ({ size, color }) => <Search size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: t.tabs.map,
          tabBarIcon: ({ size, color }) => <Map size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="report"
        options={{
          title: t.tabs.report,
          tabBarIcon: ({ size, color }) => <Camera size={size} color={color} />,
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
        name="moderation"
        options={{
          title: moderationLabel,
          tabBarIcon: ({ size, color }) => <ShieldCheck size={size} color={color} />,
          // Hide the tab entirely for regular users. The screen is still
          // accessible by direct URL but it renders an info placeholder.
          href: showModeration ? '/(tabs)/moderation' : null,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t.tabs.profile,
          tabBarIcon: ({ size, color }) => <User size={size} color={color} />,
          // Hide this tab for guests — same rationale as the report tab.
          href: isGuest ? null : '/(tabs)/profile',
        }}
      />
    </Tabs>
  );
}
