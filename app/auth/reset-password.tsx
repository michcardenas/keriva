import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Lock, CheckCircle2 } from 'lucide-react-native';
import { updateUserPassword, signOut } from '@/lib/api/auth';
import { supabase } from '@/lib/supabase';
import { useLanguage } from '@/lib/LanguageContext';
import { theme } from '@/lib/theme';
import PressableScale from '@/components/ui/PressableScale';
import Reveal from '@/components/ui/Reveal';
import KeyboardAwareScreen from '@/components/ui/KeyboardAwareScreen';
import PillBackground from '@/components/ui/PillBackground';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [focused, setFocused] = useState<'password' | 'confirm' | null>(null);
  // Wait for Supabase to establish a recovery session from the URL hash
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    // Supabase client (with detectSessionInUrl: true) will detect the
    // #access_token=xxx&type=recovery hash and fire PASSWORD_RECOVERY.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
        setSessionReady(true);
      }
    });

    // Also check if there's already an active session (e.g. user refreshed)
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setSessionReady(true);
    });

    // Timeout: if after 8s we still don't have a session, show error
    const timeout = setTimeout(() => {
      setSessionReady((prev) => {
        if (!prev) setError(t.auth.linkExpired);
        return prev;
      });
    }, 8000);

    return () => {
      sub.subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  async function handleSubmit() {
    setError(null);
    if (password.length < 6) {
      setError(t.auth.passwordMin6);
      return;
    }
    if (password !== confirm) {
      setError(t.auth.passwordsDontMatch);
      return;
    }
    setLoading(true);
    const result = await updateUserPassword(password);
    setLoading(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setDone(true);
  }

  async function goToLogin() {
    await signOut();
    router.replace('/auth/login');
  }

  const showWaiting = !sessionReady && !error && !done;

  return (
    <View style={styles.container}>
      <PillBackground />
      <KeyboardAwareScreen contentContainerStyle={styles.scroll}>
        {!done && (
          <Reveal variant="up" delay={60}>
            <View style={styles.header}>
              <Text style={styles.title}>{t.auth.newPassword}</Text>
              <Text style={styles.subtitle}>
                {showWaiting ? t.auth.verifyingLink : t.auth.chooseSecurePassword}
              </Text>
            </View>
          </Reveal>
        )}

        {showWaiting && (
          <Reveal variant="fade" delay={120}>
            <View style={styles.waitingBox}>
              <ActivityIndicator size="large" color={theme.colors.accent} />
              <Text style={styles.waitingText}>{t.auth.validatingLink}</Text>
            </View>
          </Reveal>
        )}

        {done && (
          <View style={styles.successBox}>
            <Reveal variant="up" delay={60}>
              <View style={styles.successBadge}>
                <CheckCircle2 color={theme.colors.white} size={48} />
              </View>
            </Reveal>
            <Reveal index={1} delay={120}>
              <Text style={styles.successTitle}>{t.auth.passwordUpdated}</Text>
            </Reveal>
            <Reveal index={2} delay={160}>
              <Text style={styles.successText}>{t.auth.canLoginNow}</Text>
            </Reveal>
            <Reveal index={3} delay={200} style={styles.stretch}>
              <PressableScale style={styles.primaryButton} onPress={goToLogin}>
                <Text style={styles.primaryButtonText}>{t.auth.goToLogin}</Text>
              </PressableScale>
            </Reveal>
          </View>
        )}

        {!showWaiting && !done && (
          <View style={styles.form}>
            {!sessionReady && error && (
              <>
                <Reveal variant="fade">
                  <Text style={styles.errorText}>{error}</Text>
                </Reveal>
                <Reveal index={1} delay={120}>
                  <PressableScale
                    style={styles.primaryButton}
                    onPress={() => router.replace('/auth/forgot-password')}
                  >
                    <Text style={styles.primaryButtonText}>{t.auth.requestNewLink}</Text>
                  </PressableScale>
                </Reveal>
              </>
            )}

            {sessionReady && (
              <>
                <Reveal index={1} delay={120}>
                  <View style={[styles.inputWrapper, focused === 'password' && styles.inputFocused]}>
                    <Lock
                      size={20}
                      color={focused === 'password' ? theme.colors.accent : theme.colors.textMuted}
                    />
                    <TextInput
                      style={styles.input}
                      placeholder={t.auth.newPassword}
                      placeholderTextColor={theme.colors.textMuted}
                      secureTextEntry
                      value={password}
                      onChangeText={setPassword}
                      editable={!loading}
                      onFocus={() => setFocused('password')}
                      onBlur={() => setFocused(null)}
                    />
                  </View>
                </Reveal>

                <Reveal index={2} delay={160}>
                  <View style={[styles.inputWrapper, focused === 'confirm' && styles.inputFocused]}>
                    <Lock
                      size={20}
                      color={focused === 'confirm' ? theme.colors.accent : theme.colors.textMuted}
                    />
                    <TextInput
                      style={styles.input}
                      placeholder={t.auth.confirmPassword}
                      placeholderTextColor={theme.colors.textMuted}
                      secureTextEntry
                      value={confirm}
                      onChangeText={setConfirm}
                      editable={!loading}
                      onFocus={() => setFocused('confirm')}
                      onBlur={() => setFocused(null)}
                    />
                  </View>
                </Reveal>

                {error && (
                  <Reveal variant="fade">
                    <Text style={styles.errorText}>{error}</Text>
                  </Reveal>
                )}

                <Reveal index={3} delay={200}>
                  <PressableScale
                    style={[styles.primaryButton, loading && styles.buttonDisabled]}
                    onPress={handleSubmit}
                    disabled={loading}
                  >
                    {loading ? (
                      <ActivityIndicator color={theme.colors.white} />
                    ) : (
                      <Text style={styles.primaryButtonText}>{t.auth.updatePassword}</Text>
                    )}
                  </PressableScale>
                </Reveal>
              </>
            )}
          </View>
        )}
      </KeyboardAwareScreen>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  scroll: { flexGrow: 1, padding: theme.spacing.xxl, paddingTop: 80 },
  header: { marginBottom: theme.spacing.huge },
  title: {
    ...theme.text.display,
    color: theme.colors.textPrimary,
  },
  subtitle: {
    ...theme.text.body,
    fontSize: 15,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.sm,
  },
  waitingBox: { alignItems: 'center', gap: theme.spacing.lg, paddingTop: theme.spacing.huge },
  waitingText: {
    ...theme.text.bodyMedium,
    color: theme.colors.textSecondary,
  },
  form: { gap: theme.spacing.lg },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.lg,
    height: 56,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
  },
  inputFocused: {
    borderColor: theme.colors.accent,
    ...theme.shadow.sm,
  },
  input: {
    flex: 1,
    fontFamily: theme.font.body,
    fontSize: 15,
    color: theme.colors.textPrimary,
    height: '100%',
  },
  errorText: {
    ...theme.text.bodyMedium,
    fontSize: 13,
    color: theme.colors.danger,
    textAlign: 'center',
  },
  primaryButton: {
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius.pill,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: theme.spacing.xs,
    ...theme.shadow.accent,
  },
  buttonDisabled: { opacity: 0.7 },
  primaryButtonText: {
    fontFamily: theme.font.bold,
    fontSize: 16,
    color: theme.colors.white,
    letterSpacing: 0.3,
  },
  successBox: {
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.huge,
  },
  successBadge: {
    width: 96,
    height: 96,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
    ...theme.shadow.accent,
  },
  successTitle: {
    ...theme.text.h1,
    color: theme.colors.textPrimary,
    textAlign: 'center',
  },
  successText: {
    ...theme.text.body,
    fontSize: 15,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: theme.spacing.lg,
  },
  stretch: { alignSelf: 'stretch' },
});
