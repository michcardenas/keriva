import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { translations } from './translations';

type LanguageCode = 'EN' | 'ZH' | 'HI' | 'ES' | 'FR' | 'AR' | 'BN' | 'PT' | 'RU' | 'JA' | 'PA' | 'DE' | 'JV' | 'KO' | 'TE' | 'TR' | 'TA' | 'IT' | 'VI' | 'PL';

interface LanguageContextType {
  language: LanguageCode;
  setLanguage: (lang: LanguageCode) => void;
  t: typeof translations.ES;
}

/**
 * Deep-merge del idioma seleccionado sobre el español base. El español (ES)
 * es la traducción más completa y actúa como respaldo: si un idioma no define
 * una clave, se muestra el texto en español en vez de `undefined`. Esto permite
 * ir internacionalizando la app sin tener que traducir las 20 lenguas de golpe.
 */
function deepMerge<T>(base: T, override: any): T {
  if (Array.isArray(base)) {
    return (Array.isArray(override) ? override : base) as T;
  }
  if (base === null || typeof base !== 'object') {
    return (override ?? base) as T;
  }
  const out: any = { ...base };
  for (const key of Object.keys(base as object)) {
    if (override && key in override) {
      out[key] = deepMerge((base as any)[key], override[key]);
    }
  }
  if (override) {
    for (const key of Object.keys(override)) {
      if (!(key in out)) out[key] = override[key];
    }
  }
  return out as T;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<LanguageCode>('ES');
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    loadLanguage();
  }, []);

  const loadLanguage = async () => {
    try {
      const savedLanguage = await AsyncStorage.getItem('userLanguage');
      if (savedLanguage) {
        setLanguageState(savedLanguage as LanguageCode);
      }
    } catch (error) {
      console.log('Error loading language:', error);
    } finally {
      setIsLoaded(true);
    }
  };

  const setLanguage = async (lang: LanguageCode) => {
    try {
      await AsyncStorage.setItem('userLanguage', lang);
      setLanguageState(lang);
    } catch (error) {
      console.log('Error saving language:', error);
    }
  };

  // Memoiza el merge para no recalcularlo en cada render; solo cambia cuando
  // cambia el idioma. ES es la base; el idioma activo se superpone encima.
  const t = useMemo(
    () => deepMerge(translations.ES, translations[language]),
    [language],
  );

  if (!isLoaded) {
    return null;
  }

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        t,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
}
