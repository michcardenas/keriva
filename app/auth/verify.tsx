import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, MailOpen, CheckCircle2 } from 'lucide-react-native';
import { resendConfirmationEmail } from '@/lib/api/auth';
import { supabase } from '@/lib/supabase';
import { useLanguage } from '@/lib/LanguageContext';
import { theme } from '@/lib/theme';
import PressableScale from '@/components/ui/PressableScale';
import Reveal from '@/components/ui/Reveal';
import PillBackground from '@/components/ui/PillBackground';

export default function VerifyScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const params = useLocalSearchParams<{ email?: string }>();
  const email = params.email ?? '';
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);

  // Listen for the signup confirmation callback.
  // When the user clicks the confirmation link, Supabase detects the
  // #access_token=xxx&type=signup hash and fires SIGNED_IN.
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        setVerified(true);
      }
    });

    // Also check if there's already an active session (user may have
    // already confirmed via another tab/device)
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setVerified(true);
    });

    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  async function handleResend() {
    if (!email) {
      setError(t.auth.noEmailToResend);
      return;
    }
    setLoading(true);
    setInfo(null);
    setError(null);
    const result = await resendConfirmationEmail(email);
    setLoading(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setInfo(t.auth.confirmationResent);
  }

  if (verified) {
    return (
      <View style={styles.container}>
        <PillBackground />
        <View style={styles.inner}>
          <View style={styles.content}>
            <Reveal variant="up" delay={60}>
              <View style={styles.badge}>
                <CheckCircle2 color={theme.colors.white} size={56} />
              </View>
            </Reveal>
            <Reveal index={1} delay={120}>
              <Text style={styles.title}>{t.auth.accountVerified}</Text>
            </Reveal>
            <Reveal index={2} delay={160}>
              <Text style={styles.subtitle}>{t.auth.accountConfirmed}</Text>
            </Reveal>
            <Reveal index={3} delay={200} style={styles.stretch}>
              <PressableScale
                style={styles.primaryButton}
                onPress={() => router.replace('/(tabs)')}
              >
                <Text style={styles.primaryButtonText}>{t.auth.startUsingKeriva}</Text>
              </PressableScale>
            </Reveal>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <PillBackground />
      <View style={styles.inner}>
        <PressableScale
          style={styles.backButton}
          onPress={() => router.replace('/auth/login')}
          scaleTo={0.9}
        >
          <ArrowLeft color={theme.colors.textPrimary} size={22} />
        </PressableScale>

        <View style={styles.content}>
          <Reveal variant="up" delay={60}>
            <View style={styles.badge}>
              <MailOpen color={theme.colors.white} size={52} />
            </View>
          </Reveal>
          <Reveal index={1} delay={120}>
            <Text style={styles.title}>{t.auth.verifyEmail}</Text>
          </Reveal>
          <Reveal index={2} delay={160}>
            <Text style={styles.subtitle}>
              {t.auth.confirmationSentTo}{'\n'}
              <Text style={styles.emailBold}>{email}</Text>
            </Text>
          </Reveal>
          <Reveal index={3} delay={200}>
            <Text style={styles.hint}>{t.auth.verifyHint}</Text>
          </Reveal>

          {info && (
            <Reveal variant="fade">
              <Text style={styles.infoText}>{info}</Text>
            </Reveal>
          )}
          {error && (
            <Reveal variant="fade">
              <Text style={styles.errorText}>{error}</Text>
            </Reveal>
          )}

          <Reveal index={4} delay={240} style={styles.stretch}>
            <PressableScale
              style={[styles.secondaryButton, loading && styles.buttonDisabled]}
              onPress={handleResend}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={theme.colors.accent} />
              ) : (
                <Text style={styles.secondaryButtonText}>{t.auth.resendEmail}</Text>
              )}
            </PressableScale>
          </Reveal>

          <Reveal index={5} delay={280} style={styles.stretch}>
            <PressableScale
              style={styles.primaryButton}
              onPress={() => router.replace('/auth/login')}
            >
              <Text style={styles.primaryButtonText}>{t.auth.alreadyConfirmed}</Text>
            </PressableScale>
          </Reveal>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  inner: { flex: 1, padding: theme.spacing.xxl, paddingTop: 50 },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.xxl,
    ...theme.shadow.sm,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.lg,
    paddingHorizontal: theme.spacing.lg,
  },
  badge: {
    width: 112,
    height: 112,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
    ...theme.shadow.accent,
  },
  title: {
    ...theme.text.h1,
    fontSize: 26,
    color: theme.colors.textPrimary,
    textAlign: 'center',
  },
  subtitle: {
    ...theme.text.body,
    fontSize: 16,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  emailBold: {
    fontFamily: theme.font.bodyBold,
    color: theme.colors.accent,
  },
  hint: {
    ...theme.text.caption,
    fontSize: 13,
    color: theme.colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: theme.spacing.md,
  },
  infoText: {
    ...theme.text.bodyMedium,
    fontSize: 13,
    color: theme.colors.accent,
    textAlign: 'center',
  },
  errorText: {
    ...theme.text.bodyMedium,
    fontSize: 13,
    color: theme.colors.danger,
    textAlign: 'center',
  },
  secondaryButton: {
    borderWidth: 2,
    borderColor: theme.colors.accent,
    borderRadius: theme.radius.pill,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.accentSofter,
    marginTop: theme.spacing.lg,
  },
  secondaryButtonText: {
    fontFamily: theme.font.bold,
    fontSize: 15,
    color: theme.colors.accent,
  },
  primaryButton: {
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius.pill,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadow.accent,
  },
  primaryButtonText: {
    fontFamily: theme.font.bold,
    fontSize: 16,
    color: theme.colors.white,
    letterSpacing: 0.3,
  },
  buttonDisabled: { opacity: 0.7 },
  stretch: { alignSelf: 'stretch' },
});
