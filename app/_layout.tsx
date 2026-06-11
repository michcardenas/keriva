import '../global.css';
import { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SplashScreen } from 'expo-router';
import { useFonts } from 'expo-font';
import {
  Poppins_400Regular,
  Poppins_600SemiBold,
  Poppins_700Bold,
  Poppins_900Black,
} from '@expo-google-fonts/poppins';
import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_700Bold,
} from '@expo-google-fonts/dm-sans';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { LanguageProvider } from '@/lib/LanguageContext';
import { AuthProvider, useAuth } from '@/lib/AuthContext';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useFrameworkReady();

  const [fontsLoaded, fontError] = useFonts({
    'Poppins-Regular': Poppins_400Regular,
    'Poppins-SemiBold': Poppins_600SemiBold,
    'Poppins-Bold': Poppins_700Bold,
    'Poppins-Black': Poppins_900Black,
    'DMSans-Regular': DMSans_400Regular,
    'DMSans-Medium': DMSans_500Medium,
    'DMSans-Bold': DMSans_700Bold,
  });

  // Fallback de seguridad: si las fuentes no resuelven a tiempo (p. ej. en un
  // navegador sin acceso a los assets), no dejamos la app en blanco para
  // siempre. Tras 1.5s renderizamos igual; las fuentes aparecen al cargar.
  const [fontTimeout, setFontTimeout] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setFontTimeout(true), 1500);
    return () => clearTimeout(id);
  }, []);

  const ready = fontsLoaded || fontError || fontTimeout;

  useEffect(() => {
    if (ready) {
      SplashScreen.hideAsync();
    }
  }, [ready]);

  if (!ready) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <LanguageProvider>
          <AuthProvider>
            <RootNavigator />
            <StatusBar style="light" />
          </AuthProvider>
        </LanguageProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/**
 * Navigator + route guard.
 *
 * Guest-friendly: Search, Map and Detail are public — anyone can browse
 * medications and pharmacies without logging in.
 *
 * Protected: Report, Profile and Moderation require authentication.
 * Authenticated users on auth/splash screens are sent to tabs.
 */
const PROTECTED_TABS = new Set(['report', 'profile', 'moderation']);

function RootNavigator() {
  const { session, loading, perfil } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const first = segments[0] as string | undefined;
    const second = segments[1] as string | undefined;
    const inAuthGroup = first === 'auth';
    const onSplash = first === undefined;

    if (!session) {
      // Guest: only block protected tabs, allow everything else
      const isProtectedTab =
        first === '(tabs)' && typeof second === 'string' && PROTECTED_TABS.has(second);
      if (isProtectedTab) {
        // Guests hitting a protected tab go to LOGIN (no al registro). El login
        // tiene enlace a "crear cuenta" para quienes aún no tienen una. Esto
        // también arregla que tras cerrar sesión cayeras en el registro.
        router.replace('/auth/login');
      }
    } else if (inAuthGroup || onSplash) {
      // Logged in → a sus tabs. La farmacia aterriza en su hub "Mi Farmacia"
      // (Buscar/Mapa están ocultos para ese rol).
      router.replace(perfil?.rol === 'farmacia' ? '/(tabs)/farmacia' : '/(tabs)');
    } else if (
      perfil?.rol === 'farmacia' &&
      first === '(tabs)' &&
      (second === undefined || second === 'map')
    ) {
      // El perfil carga async: si la farmacia quedó en Buscar/Mapa (ocultos
      // para su rol), reencauzar a su hub.
      router.replace('/(tabs)/farmacia');
    }
  }, [session, loading, segments, router, perfil?.rol]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="auth" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="detail" />
      <Stack.Screen name="registro-farmacia" />
      <Stack.Screen name="familia" />
      <Stack.Screen name="farmacia/sucursales" />
      <Stack.Screen name="farmacia/inventario" />
      <Stack.Screen name="farmacia/carga-masiva" />
      <Stack.Screen name="farmacia/descuentos" />
      <Stack.Screen name="farmacia/reservas" />
      <Stack.Screen name="farmacia/metricas" />
      <Stack.Screen name="farmacia/cuenta" />
      <Stack.Screen name="resenas/[farmaciaId]" />
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}
