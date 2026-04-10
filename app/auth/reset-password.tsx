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
import { Lock } from 'lucide-react-native';
import { updateUserPassword, signOut } from '@/lib/api/auth';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit() {
    setError(null);
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return;
    }
    if (password !== confirm) {
      setError('Las contraseñas no coinciden');
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
          <View style={styles.header}>
            <Text style={styles.title}>Nueva contraseña</Text>
            <Text style={styles.subtitle}>Elige una contraseña segura</Text>
          </View>

          {done ? (
            <View style={styles.successBox}>
              <Text style={styles.successEmoji}>✅</Text>
              <Text style={styles.successTitle}>Contraseña actualizada</Text>
              <Text style={styles.successText}>
                Ya puedes iniciar sesión con tu nueva contraseña.
              </Text>
              <TouchableOpacity style={styles.primaryButton} onPress={goToLogin}>
                <Text style={styles.primaryButtonText}>Ir al inicio de sesión</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.form}>
              <View style={styles.inputWrapper}>
                <Lock size={20} color="rgba(255,255,255,0.6)" />
                <TextInput
                  style={styles.input}
                  placeholder="Nueva contraseña"
                  placeholderTextColor="rgba(255,255,255,0.5)"
                  secureTextEntry
                  value={password}
                  onChangeText={setPassword}
                  editable={!loading}
                />
              </View>

              <View style={styles.inputWrapper}>
                <Lock size={20} color="rgba(255,255,255,0.6)" />
                <TextInput
                  style={styles.input}
                  placeholder="Confirmar contraseña"
                  placeholderTextColor="rgba(255,255,255,0.5)"
                  secureTextEntry
                  value={confirm}
                  onChangeText={setConfirm}
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
                  <Text style={styles.primaryButtonText}>Actualizar contraseña</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, padding: 24, paddingTop: 80 },
  header: { marginBottom: 40 },
  title: { fontFamily: 'Poppins-Bold', fontSize: 32, color: '#FFFFFF' },
  subtitle: {
    fontFamily: 'DMSans-Regular',
    fontSize: 15,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 8,
  },
  form: { gap: 16 },
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
  successBox: { alignItems: 'center', gap: 12, paddingHorizontal: 16 },
  successEmoji: { fontSize: 64 },
  successTitle: {
    fontFamily: 'Poppins-Bold',
    fontSize: 22,
    color: '#FFFFFF',
  },
  successText: {
    fontFamily: 'DMSans-Regular',
    fontSize: 15,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 16,
  },
});
