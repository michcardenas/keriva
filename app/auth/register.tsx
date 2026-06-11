import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, Mail, Lock, User, Phone, IdCard, Eye, EyeOff } from 'lucide-react-native';
import { signUpWithEmail } from '@/lib/api/auth';
import { capture } from '@/lib/analytics';
import { useLanguage } from '@/lib/LanguageContext';
import { theme } from '@/lib/theme';
import PressableScale from '@/components/ui/PressableScale';
import Reveal from '@/components/ui/Reveal';
import KeyboardAwareScreen from '@/components/ui/KeyboardAwareScreen';
import PillBackground from '@/components/ui/PillBackground';

type Field = 'nombre' | 'email' | 'telefono' | 'cedula' | 'password';

export default function RegisterScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [telefono, setTelefono] = useState('');
  const [cedula, setCedula] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focused, setFocused] = useState<Field | null>(null);

  async function handleSubmit() {
    setError(null);
    if (!email.trim() || !password) {
      setError(t.auth.enterEmailAndPassword);
      return;
    }
    if (password.length < 6) {
      setError(t.auth.passwordMin6);
      return;
    }
    setLoading(true);
    const result = await signUpWithEmail({
      email,
      password,
      nombre: nombre.trim() || undefined,
      telefono: telefono.trim() || undefined,
      cedula: cedula.trim() || undefined,
    });
    setLoading(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    capture('signup_completed', { needs_confirmation: result.data.needsConfirmation });
    if (result.data.needsConfirmation) {
      router.replace({
        pathname: '/auth/verify',
        params: { email: result.data.email },
      });
      return;
    }
    router.replace('/(tabs)');
  }

  const iconColor = (field: Field) =>
    focused === field ? theme.colors.accent : theme.colors.textMuted;

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
            <Text style={styles.title}>{t.auth.joinKeriva}</Text>
            <Text style={styles.subtitle}>{t.auth.registerSubtitle}</Text>
          </View>
        </Reveal>

        <View style={styles.form}>
          <Reveal index={1} delay={120}>
            <View style={[styles.inputWrapper, focused === 'nombre' && styles.inputFocused]}>
              <User size={20} color={iconColor('nombre')} />
              <TextInput
                style={styles.input}
                placeholder={t.auth.fullName}
                placeholderTextColor={theme.colors.textMuted}
                value={nombre}
                onChangeText={setNombre}
                editable={!loading}
                onFocus={() => setFocused('nombre')}
                onBlur={() => setFocused(null)}
              />
            </View>
          </Reveal>

          <Reveal index={2} delay={160}>
            <View style={[styles.inputWrapper, focused === 'email' && styles.inputFocused]}>
              <Mail size={20} color={iconColor('email')} />
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

          <Reveal index={3} delay={200}>
            <View style={[styles.inputWrapper, focused === 'telefono' && styles.inputFocused]}>
              <Phone size={20} color={iconColor('telefono')} />
              <TextInput
                style={styles.input}
                placeholder={t.auth.phonePlaceholder}
                placeholderTextColor={theme.colors.textMuted}
                keyboardType="phone-pad"
                value={telefono}
                onChangeText={setTelefono}
                editable={!loading}
                onFocus={() => setFocused('telefono')}
                onBlur={() => setFocused(null)}
              />
            </View>
          </Reveal>

          <Reveal index={4} delay={240}>
            <View style={[styles.inputWrapper, focused === 'cedula' && styles.inputFocused]}>
              <IdCard size={20} color={iconColor('cedula')} />
              <TextInput
                style={styles.input}
                placeholder={t.auth.cedulaPlaceholder}
                placeholderTextColor={theme.colors.textMuted}
                keyboardType="number-pad"
                value={cedula}
                onChangeText={setCedula}
                editable={!loading}
                onFocus={() => setFocused('cedula')}
                onBlur={() => setFocused(null)}
              />
            </View>
          </Reveal>

          <Reveal index={5} delay={280}>
            <View style={[styles.inputWrapper, focused === 'password' && styles.inputFocused]}>
              <Lock size={20} color={iconColor('password')} />
              <TextInput
                style={styles.input}
                placeholder={t.auth.passwordMin6Placeholder}
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

          <Reveal index={6} delay={320}>
            <PressableScale
              style={[styles.primaryButton, loading && styles.buttonDisabled]}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={theme.colors.white} />
              ) : (
                <Text style={styles.primaryButtonText}>{t.auth.createAccount}</Text>
              )}
            </PressableScale>
          </Reveal>

          <Reveal index={7} delay={350}>
            <Text style={styles.disclaimer}>{t.auth.termsDisclaimer}</Text>
          </Reveal>

          <Reveal index={8} delay={380}>
            <PressableScale
              style={styles.linkButton}
              onPress={() => router.replace('/auth/login')}
              disabled={loading}
            >
              <Text style={styles.linkText}>
                {t.auth.alreadyHaveAccount}
                <Text style={styles.linkTextBold}>{t.auth.signIn}</Text>
              </Text>
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
    width: 88,
    height: 88,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
    ...theme.shadow.accent,
  },
  logoImage: {
    width: 62,
    height: 62,
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
  disclaimer: {
    ...theme.text.caption,
    fontSize: 11,
    color: theme.colors.textMuted,
    textAlign: 'center',
    lineHeight: 16,
    marginTop: theme.spacing.xs,
    paddingHorizontal: theme.spacing.md,
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
});
