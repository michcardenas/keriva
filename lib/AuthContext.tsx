import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { getPerfil, type PerfilCompleto } from '@/lib/api/perfiles';

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  perfil: PerfilCompleto | null;
  loading: boolean;
  refreshPerfil: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [perfil, setPerfil] = useState<PerfilCompleto | null>(null);
  const [loading, setLoading] = useState(true);

  const loadPerfilFor = useCallback(async (userId: string | undefined) => {
    if (!userId) {
      setPerfil(null);
      return;
    }
    const data = await getPerfil(userId);
    setPerfil(data);
  }, []);

  useEffect(() => {
    let mounted = true;

    supabase.auth
      .getSession()
      .then(async ({ data }) => {
        if (!mounted) return;
        setSession(data.session);
        await loadPerfilFor(data.session?.user.id);
        if (!mounted) return;
        setLoading(false);
      })
      .catch(() => {
        if (!mounted) return;
        setLoading(false);
      });

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      if (!mounted) return;
      setSession(newSession);
      await loadPerfilFor(newSession?.user.id);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [loadPerfilFor]);

  const refreshPerfil = useCallback(async () => {
    await loadPerfilFor(session?.user.id);
  }, [loadPerfilFor, session?.user.id]);

  const value: AuthContextValue = {
    session,
    user: session?.user ?? null,
    perfil,
    loading,
    refreshPerfil,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
