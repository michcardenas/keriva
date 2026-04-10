import { Tabs } from 'expo-router';
import { Search, Map, Camera, User, ShieldCheck } from 'lucide-react-native';
import { useLanguage } from '@/lib/LanguageContext';
import { useAuth } from '@/lib/AuthContext';

export default function TabLayout() {
  const { t } = useLanguage();
  const { perfil } = useAuth();
  const rol = perfil?.rol ?? 'usuario';
  const showModeration = rol === 'admin' || rol === 'farmacia';

  const moderationLabel = rol === 'admin' ? 'Moderar' : 'Mi farmacia';

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#0F1F17',
          borderTopColor: 'rgba(126, 217, 87, 0.2)',
          borderTopWidth: 1,
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarActiveTintColor: '#7ED957',
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
        }}
      />
    </Tabs>
  );
}
