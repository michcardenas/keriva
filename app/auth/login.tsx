import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Platform,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, Mail, Lock, Eye, EyeOff } from 'lucide-react-native';
import { signInWithEmail } from '@/lib/api/auth';
import { useLanguage } from '@/lib/LanguageContext';
import { theme } from '@/lib/theme';
import PressableScale from '@/components/ui/PressableScale';
import Reveal from '@/components/ui/Reveal';
import KeyboardAwareScreen from '@/components/ui/KeyboardAwareScreen';
import PillBackground from '@/components/ui/PillBackground';

export default function LoginScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focused, setFocused] = useState<'email' | 'password' | null>(null);

  async function handleSubmit() {
    setError(null);
    if (!email.trim() || !password) {
      setError(t.auth.enterEmailAndPassword);
      return;
    }
    setLoading(true);
    const result = await signInWithEmail({ email, password });
    setLoading(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    router.replace('/(tabs)');
  }

  return (
    <View style={styles.container}>
      <PillBackground />
      <KeyboardAwareScreen contentContainerStyle={styles.scroll}>
        <PressableScale style={styles.backButton} onPress={() => router.back()} scaleTo={0.9}>
          <ArrowLeft color={theme.colors.textPrimary} size={22} />
        </PressableScale>

        {/* Logo + branding */}
        <Reveal variant="up" delay={60}>
          <View style={styles.branding}>
            <View style={styles.logoBadge}>
              <Image
                source={require('@/assets/images/logo.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.title}>{t.auth.welcomeBack}</Text>
            <Text style={styles.subtitle}>{t.auth.loginSubtitle}</Text>
          </View>
        </Reveal>

        <View style={styles.form}>
          <Reveal index={1} delay={120}>
            <View style={[styles.inputWrapper, focused === 'email' && styles.inputFocused]}>
              <Mail size={20} color={focused === 'email' ? theme.colors.accent : theme.colors.textMuted} />
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
                onFocus={() => setFocused('email')}
                onBlur={() => setFocused(null)}
              />
            </View>
          </Reveal>

          <Reveal index={2} delay={160}>
            <View style={[styles.inputWrapper, focused === 'password' && styles.inputFocused]}>
              <Lock size={20} color={focused === 'password' ? theme.colors.accent : theme.colors.textMuted} />
              <TextInput
                style={styles.input}
                placeholder={t.auth.password}
                placeholderTextColor={theme.colors.textMuted}
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
                editable={!loading}
                onFocus={() => setFocused('password')}
                onBlur={() => setFocused(null)}
              />
              <PressableScale
                onPress={() => setShowPassword(!showPassword)}
                scaleTo={0.85}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                {showPassword ? (
                  <EyeOff size={20} color={theme.colors.textMuted} />
                ) : (
                  <Eye size={20} color={theme.colors.textMuted} />
                )}
              </PressableScale>
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
                <Text style={styles.primaryButtonText}>{t.auth.enter}</Text>
              )}
            </PressableScale>
          </Reveal>

          <Reveal index={4} delay={240}>
            <PressableScale
              style={styles.forgotButton}
              onPress={() => router.push('/auth/forgot-password')}
              disabled={loading}
            >
              <Text style={styles.forgotText}>{t.auth.forgotPassword}</Text>
            </PressableScale>
          </Reveal>

          <Reveal index={5} delay={280}>
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>{t.auth.or}</Text>
              <View style={styles.dividerLine} />
            </View>
          </Reveal>

          <Reveal index={6} delay={320}>
            <PressableScale
              style={styles.registerButton}
              onPress={() => router.replace('/auth/register')}
              disabled={loading}
            >
              <Text style={styles.registerButtonText}>{t.auth.createFreeAccount}</Text>
            </PressableScale>
          </Reveal>

          <Reveal index={7} delay={350}>
            <PressableScale
              style={styles.exploreLink}
              onPress={() => router.replace('/(tabs)')}
              disabled={loading}
            >
              <Text style={styles.exploreLinkText}>{t.auth.exploreNoAccount}</Text>
            </PressableScale>
          </Reveal>
        </View>
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
    marginBottom: theme.spacing.lg,
    ...theme.shadow.sm,
  },
  branding: {
    alignItems: 'center',
    marginBottom: theme.spacing.xxl,
  },
  logoBadge: {
    width: 104,
    height: 104,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
    ...theme.shadow.accent,
  },
  logoImage: {
    width: 74,
    height: 74,
  },
  title: {
    ...theme.text.h1,
    color: theme.colors.textPrimary,
    textAlign: 'center',
  },
  subtitle: {
    ...theme.text.body,
    color: theme.colors.textSecondary,
    marginTop: 6,
    textAlign: 'center',
  },
  form: { gap: theme.spacing.md },
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
  forgotButton: { alignItems: 'center', paddingVertical: 6 },
  forgotText: {
    ...theme.text.bodyMedium,
    fontSize: 13,
    color: theme.colors.accent,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    marginVertical: theme.spacing.xs,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: theme.colors.border,
  },
  dividerText: {
    ...theme.text.caption,
    color: theme.colors.textMuted,
  },
  registerButton: {
    borderWidth: 2,
    borderColor: theme.colors.accent,
    borderRadius: theme.radius.pill,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.accentSofter,
  },
  registerButtonText: {
    fontFamily: theme.font.bold,
    fontSize: 15,
    color: theme.colors.accent,
  },
  exploreLink: {
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
  },
  exploreLinkText: {
    ...theme.text.bodyMedium,
    fontSize: 13,
    color: theme.colors.textMuted,
    textDecorationLine: 'underline',
  },
});
