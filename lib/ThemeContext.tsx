import React, { createContext, useContext, useEffect, useState, useMemo, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// =====================================================================
// ThemeContext — modo claro/oscuro persistente (T1)
// =====================================================================
// El theme estático (lib/theme.ts) sigue exportando los tokens de la paleta
// CLARA y de la paleta `night*`. Este context decide cuál de las dos se está
// usando "ahora" y permite alternarlo desde la UI. La preferencia se persiste
// en AsyncStorage.
//
// Aplicación progresiva: el dark mode visual completo requiere que cada
// componente lea sus colores via `useColorMode()` en vez de leer `theme.colors`
// directo. Por el alcance de esta entrega aplicamos el modo al StatusBar y al
// fondo raíz; el refactor exhaustivo queda para una pasada dedicada.
// =====================================================================

export type ColorMode = 'light' | 'dark';

interface ThemeContextValue {
  mode: ColorMode;
  setMode: (m: ColorMode) => void;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);
const STORAGE_KEY = 'keriva_color_mode';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ColorMode>('light');
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored === 'light' || stored === 'dark') setModeState(stored);
      } catch {
        // ignore
      } finally {
        setIsLoaded(true);
      }
    })();
  }, []);

  const setMode = async (m: ColorMode) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, m);
    } catch {
      // ignore
    }
    setModeState(m);
  };

  const toggle = () => setMode(mode === 'light' ? 'dark' : 'light');

  const value = useMemo<ThemeContextValue>(() => ({ mode, setMode, toggle }), [mode]);

  // Evitamos el flash de modo incorrecto al boot: esperamos a leer de storage.
  if (!isLoaded) return null;

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useColorMode(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useColorMode must be used within ThemeProvider');
  return ctx;
}
