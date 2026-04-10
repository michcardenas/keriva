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
import { ArrowLeft, Mail, Lock, User, Phone, IdCard, Search } from 'lucide-react-native';
import { signUpWithEmail } from '@/lib/api/auth';

export default function RegisterScreen() {
  const router = useRouter();
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [telefono, setTelefono] = useState('');
  const [cedula, setCedula] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setError(null);
    if (!email.trim() || !password) {
      setError('Ingresa tu correo y contraseña');
      return;
    }
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
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
    if (result.data.needsConfirmation) {
      router.replace({
        pathname: '/auth/verify',
        params: { email: result.data.email },
      });
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
              <Search color="#7ED957" size={28} strokeWidth={3} />
            </View>
            <Text style={styles.logoText}>keriva</Text>
          </View>

          <View style={styles.header}>
            <Text style={styles.title}>Únete a Keriva</Text>
            <Text style={styles.subtitle}>
              Compara precios, reporta y gana puntos ayudando a tu comunidad
            </Text>
          </View>

          <View style={styles.form}>
            <View style={styles.inputWrapper}>
              <User size={20} color="rgba(255,255,255,0.6)" />
              <TextInput
                style={styles.input}
                placeholder="Nombre completo"
                placeholderTextColor="rgba(255,255,255,0.5)"
                value={nombre}
                onChangeText={setNombre}
                editable={!loading}
              />
            </View>

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
              <Phone size={20} color="rgba(255,255,255,0.6)" />
              <TextInput
                style={styles.input}
                placeholder="Teléfono (809-000-0000)"
                placeholderTextColor="rgba(255,255,255,0.5)"
                keyboardType="phone-pad"
                value={telefono}
                onChangeText={setTelefono}
                editable={!loading}
              />
            </View>

            <View style={styles.inputWrapper}>
              <IdCard size={20} color="rgba(255,255,255,0.6)" />
              <TextInput
                style={styles.input}
                placeholder="Cédula (opcional, 000-0000000-0)"
                placeholderTextColor="rgba(255,255,255,0.5)"
                keyboardType="number-pad"
                value={cedula}
                onChangeText={setCedula}
                editable={!loading}
              />
            </View>

            <View style={styles.inputWrapper}>
              <Lock size={20} color="rgba(255,255,255,0.6)" />
              <TextInput
                style={styles.input}
                placeholder="Contraseña (mínimo 6)"
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
                <Text style={styles.primaryButtonText}>Crear cuenta</Text>
              )}
            </TouchableOpacity>

            <Text style={styles.disclaimer}>
              Al registrarte aceptas los términos de uso y la política de privacidad de Keriva.
            </Text>

            <TouchableOpacity
              style={styles.linkButton}
              onPress={() => router.replace('/auth/login')}
              disabled={loading}
            >
              <Text style={styles.linkText}>
                ¿Ya tienes cuenta? <Text style={styles.linkTextBold}>Inicia sesión</Text>
              </Text>
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
    marginBottom: 12,
  },
  branding: {
    alignItems: 'center',
    marginBottom: 16,
  },
  logoCircle: {
    position: 'relative',
    width: 60,
    height: 60,
    backgroundColor: 'rgba(126, 217, 87, 0.1)',
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  pillDot: {
    position: 'absolute',
    width: 12,
    height: 6,
    flexDirection: 'row',
    borderRadius: 3,
    overflow: 'hidden',
  },
  pillHalf: {
    width: 6,
    height: 6,
    backgroundColor: '#7ED957',
  },
  pillHalfWhite: {
    backgroundColor: '#FFFFFF',
  },
  logoText: {
    fontFamily: 'Poppins-Black',
    fontSize: 30,
    color: '#FFFFFF',
    letterSpacing: -1,
  },
  header: { marginBottom: 18, alignItems: 'center' },
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
  form: { gap: 12 },
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
    marginTop: 8,
  },
  buttonDisabled: { opacity: 0.7 },
  primaryButtonText: {
    fontFamily: 'Poppins-Bold',
    fontSize: 16,
    color: '#1A7A4A',
  },
  disclaimer: {
    fontFamily: 'DMSans-Regular',
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    lineHeight: 16,
    marginTop: 4,
    paddingHorizontal: 12,
  },
  linkButton: { alignItems: 'center', paddingVertical: 12 },
  linkText: {
    fontFamily: 'DMSans-Regular',
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
  },
  linkTextBold: {
    fontFamily: 'DMSans-Bold',
    color: '#7ED957',
  },
});
