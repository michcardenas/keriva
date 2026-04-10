import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { ArrowLeft, Mail, Lock, Search } from 'lucide-react-native';
import { signInWithEmail } from '@/lib/api/auth';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setError(null);
    if (!email.trim() || !password) {
      setError('Ingresa tu correo y contraseña');
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
    <LinearGradient colors={['#0F1F17', '#1A7A4A', '#0F1F17']} style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <ArrowLeft color="#FFFFFF" size={24} />
          </TouchableOpacity>

          {/* Logo + branding */}
          <View style={styles.branding}>
            <View style={styles.logoCircle}>
              <Search color="#7ED957" size={32} strokeWidth={3} />
            </View>
            <Text style={styles.logoText}>keriva</Text>
            <Text style={styles.tagline}>busca.compara.ahorra.</Text>
          </View>

          <View style={styles.header}>
            <Text style={styles.title}>Bienvenido de vuelta</Text>
            <Text style={styles.subtitle}>
              Inicia sesión para reportar precios y ganar puntos
            </Text>
          </View>

          <View style={styles.form}>
            <View style={styles.inputWrapper}>
              <Mail size={20} color="rgba(255,255,255,0.6)" />
              <TextInput
                style={styles.input}
                placeholder="Correo electrónico"
                placeholderTextColor="rgba(255,255,255,0.5)"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
                editable={!loading}
              />
            </View>

            <View style={styles.inputWrapper}>
              <Lock size={20} color="rgba(255,255,255,0.6)" />
              <TextInput
                style={styles.input}
                placeholder="Contraseña"
                placeholderTextColor="rgba(255,255,255,0.5)"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
                editable={!loading}
              />
            </View>

            {error && <Text style={styles.errorText}>{error}</Text>}

            <TouchableOpacity
              style={[styles.primaryButton, loading && styles.buttonDisabled]}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#1A7A4A" />
              ) : (
                <Text style={styles.primaryButtonText}>Entrar</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.forgotButton}
              onPress={() => router.push('/auth/forgot-password')}
              disabled={loading}
            >
              <Text style={styles.forgotText}>¿Olvidaste tu contraseña?</Text>
            </TouchableOpacity>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>o</Text>
              <View style={styles.dividerLine} />
            </View>

            <TouchableOpacity
              style={styles.registerButton}
              onPress={() => router.replace('/auth/register')}
              disabled={loading}
            >
              <Text style={styles.registerButtonText}>Crear cuenta gratis</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.exploreLink}
              onPress={() => router.replace('/(tabs)')}
              disabled={loading}
            >
              <Text style={styles.exploreLinkText}>Explorar sin cuenta</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, padding: 24, paddingTop: 50 },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  branding: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoCircle: {
    position: 'relative',
    width: 72,
    height: 72,
    backgroundColor: 'rgba(126, 217, 87, 0.1)',
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  pillDot: {
    position: 'absolute',
    width: 14,
    height: 7,
    flexDirection: 'row',
    borderRadius: 4,
    overflow: 'hidden',
  },
  pillHalf: {
    width: 7,
    height: 7,
    backgroundColor: '#7ED957',
  },
  pillHalfWhite: {
    backgroundColor: '#FFFFFF',
  },
  logoText: {
    fontFamily: 'Poppins-Black',
    fontSize: 36,
    color: '#FFFFFF',
    letterSpacing: -1,
  },
  tagline: {
    fontFamily: 'DMSans-Medium',
    fontSize: 13,
    color: '#7ED957',
    marginTop: -2,
  },
  header: { marginBottom: 24, alignItems: 'center' },
  title: {
    fontFamily: 'Poppins-Bold',
    fontSize: 24,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: 'DMSans-Regular',
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 6,
    textAlign: 'center',
  },
  form: { gap: 14 },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 54,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  input: {
    flex: 1,
    fontFamily: 'DMSans-Regular',
    fontSize: 16,
    color: '#FFFFFF',
  },
  errorText: {
    fontFamily: 'DMSans-Medium',
    fontSize: 13,
    color: '#FF6B6B',
    textAlign: 'center',
  },
  primaryButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  buttonDisabled: { opacity: 0.7 },
  primaryButtonText: {
    fontFamily: 'Poppins-Bold',
    fontSize: 16,
    color: '#1A7A4A',
  },
  forgotButton: { alignItems: 'center', paddingVertical: 6 },
  forgotText: {
    fontFamily: 'DMSans-Medium',
    fontSize: 13,
    color: '#7ED957',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 4,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  dividerText: {
    fontFamily: 'DMSans-Regular',
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
  },
  registerButton: {
    borderWidth: 2,
    borderColor: '#7ED957',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  registerButtonText: {
    fontFamily: 'Poppins-Bold',
    fontSize: 15,
    color: '#7ED957',
  },
  exploreLink: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  exploreLinkText: {
    fontFamily: 'DMSans-Medium',
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    textDecorationLine: 'underline',
  },
});
