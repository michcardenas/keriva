import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { getPerfil, type PerfilCompleto } from '@/lib/api/perfiles';
import { clearUser as sentryClearUser } from '@/lib/sentry';
import { clearIdentity as analyticsClearIdentity } from '@/lib/analytics';

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

    // Synchronous hydration from localStorage: supabase.auth.getSession()
    // can hang in some HMR/dev states. The persisted token is the same data
    // we'd get from getSession(), just read directly. This guarantees the UI
    // can render protected routes immediately while supabase-js settles.
    if (typeof window !== 'undefined') {
      try {
        const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
        const ref = url.replace(/^https?:\/\//, '').split('.')[0];
        const raw = window.localStorage.getItem(`sb-${ref}-auth-token`);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed?.access_token && parsed?.user) {
            setSession(parsed as Session);
          }
        }
      } catch {
        // ignore parse errors
      }
    }

    // Safety timer: flip loading=false within 1s so the UI is never blocked
    // on auth bootstrap. onAuthStateChange (INITIAL_SESSION) populates the
    // session asynchronously and updates the UI when it arrives.
    const safetyTimer = setTimeout(() => {
      if (mounted) setLoading(false);
    }, 800);

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!mounted) return;
        clearTimeout(safetyTimer);
        setSession(data.session);
        setLoading(false);
        setTimeout(() => {
          if (!mounted) return;
          void loadPerfilFor(data.session?.user.id);
        }, 0);
      })
      .catch(() => {
        if (!mounted) return;
        clearTimeout(safetyTimer);
        setLoading(false);
      });

    // NOTE: do NOT await supabase queries inside this callback — it blocks
    // the auth lock in supabase-js v2 and causes signInWithPassword to hang.
    // We defer the perfil fetch with setTimeout(0) so the callback returns
    // immediately and the lock is released.
    // See: https://github.com/supabase/supabase-js/issues/845
    const { data: sub } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (!mounted) return;
      setSession(newSession);

      if (event === 'SIGNED_OUT') {
        setPerfil(null);
        sentryClearUser();
        analyticsClearIdentity();
        return;
      }

      setTimeout(() => {
        if (!mounted) return;
        void loadPerfilFor(newSession?.user.id);
      }, 0);
    });

    return () => {
      mounted = false;
      clearTimeout(safetyTimer);
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
