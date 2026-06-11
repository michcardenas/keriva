import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, Mail, MailCheck } from 'lucide-react-native';
import { sendPasswordResetEmail } from '@/lib/api/auth';
import { useLanguage } from '@/lib/LanguageContext';
import { theme } from '@/lib/theme';
import PressableScale from '@/components/ui/PressableScale';
import Reveal from '@/components/ui/Reveal';
import KeyboardAwareScreen from '@/components/ui/KeyboardAwareScreen';
import PillBackground from '@/components/ui/PillBackground';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [focused, setFocused] = useState(false);

  async function handleSubmit() {
    setError(null);
    if (!email.trim()) {
      setError(t.auth.enterEmail);
      return;
    }
    setLoading(true);
    const result = await sendPasswordResetEmail(email);
    setLoading(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setSent(true);
  }

  return (
    <View style={styles.container}>
      <PillBackground />
      <KeyboardAwareScreen contentContainerStyle={styles.scroll}>
        <PressableScale style={styles.backButton} onPress={() => router.back()} scaleTo={0.9}>
          <ArrowLeft color={theme.colors.textPrimary} size={22} />
        </PressableScale>

        {sent ? (
          <View style={styles.successBox}>
            <Reveal variant="up" delay={60}>
              <View style={styles.successBadge}>
                <MailCheck color={theme.colors.white} size={44} />
              </View>
            </Reveal>
            <Reveal index={1} delay={120}>
              <Text style={styles.successTitle}>{t.auth.emailSent}</Text>
            </Reveal>
            <Reveal index={2} delay={160}>
              <Text style={styles.successText}>
                {t.auth.checkInbox} <Text style={styles.emailBold}>{email}</Text>
                {t.auth.checkSpam}
              </Text>
            </Reveal>
            <Reveal index={3} delay={200} style={styles.successButtonWrap}>
              <PressableScale
                style={styles.primaryButton}
                onPress={() => router.replace('/auth/login')}
              >
                <Text style={styles.primaryButtonText}>{t.auth.backToLogin}</Text>
              </PressableScale>
            </Reveal>
          </View>
        ) : (
          <>
            <Reveal variant="up" delay={60}>
              <View style={styles.header}>
                <Text style={styles.title}>{t.auth.recoverPassword}</Text>
                <Text style={styles.subtitle}>{t.auth.recoverSubtitle}</Text>
              </View>
            </Reveal>

            <View style={styles.form}>
              <Reveal index={1} delay={120}>
                <View style={[styles.inputWrapper, focused && styles.inputFocused]}>
                  <Mail size={20} color={focused ? theme.colors.accent : theme.colors.textMuted} />
                  <TextInput
                    style={styles.input}
                    placeholder={t.auth.email}
                    placeholderTextColor={theme.colors.textMuted}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                    value={email}
                    onChangeText={setEmail}
                    editable={!loading}
                    onFocus={() => setFocused(true)}
                    onBlur={() => setFocused(false)}
                  />
                </View>
              </Reveal>

              {error && (
                <Reveal variant="fade">
                  <Text style={styles.errorText}>{error}</Text>
                </Reveal>
              )}

              <Reveal index={2} delay={160}>
                <PressableScale
                  style={[styles.primaryButton, loading && styles.buttonDisabled]}
                  onPress={handleSubmit}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color={theme.colors.white} />
                  ) : (
                    <Text style={styles.primaryButtonText}>{t.auth.sendLink}</Text>
                  )}
                </PressableScale>
              </Reveal>

              <Reveal index={3} delay={200}>
                <PressableScale
                  style={styles.linkButton}
                  onPress={() => router.replace('/auth/login')}
                  disabled={loading}
                >
                  <Text style={styles.linkText}>
                    {t.auth.rememberedPassword}
                    <Text style={styles.linkTextBold}>{t.auth.signIn}</Text>
                  </Text>
                </PressableScale>
              </Reveal>
            </View>
          </>
        )}
      </KeyboardAwareScreen>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  scroll: { flexGrow: 1, padding: theme.spacing.xxl, paddingTop: 50 },
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
  linkButton: { alignItems: 'center', paddingVertical: theme.spacing.md },
  linkText: {
    ...theme.text.body,
    color: theme.colors.textSecondary,
  },
  linkTextBold: {
    fontFamily: theme.font.bodyBold,
    color: theme.colors.accent,
  },
  successBox: {
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.xxl,
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
  emailBold: {
    fontFamily: theme.font.bodyBold,
    color: theme.colors.accent,
  },
  successButtonWrap: { alignSelf: 'stretch' },
});
