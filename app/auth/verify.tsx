import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { resendConfirmationEmail } from '@/lib/api/auth';
import { supabase } from '@/lib/supabase';

export default function VerifyScreen() {
  const router = useRouter();
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
      setError('No se encontró el correo a reenviar');
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
    setInfo('Correo de confirmación reenviado');
  }

  if (verified) {
    return (
      <LinearGradient colors={['#0F1F17', '#1A7A4A', '#0F1F17']} style={styles.container}>
        <View style={styles.inner}>
          <View style={styles.content}>
            <Text style={styles.emoji}>✅</Text>
            <Text style={styles.title}>¡Cuenta verificada!</Text>
            <Text style={styles.subtitle}>
              Tu cuenta ha sido confirmada exitosamente.
            </Text>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => router.replace('/(tabs)')}
            >
              <Text style={styles.primaryButtonText}>Comenzar a usar Keriva</Text>
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#0F1F17', '#1A7A4A', '#0F1F17']} style={styles.container}>
      <View style={styles.inner}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.replace('/auth/login')}>
          <ArrowLeft color="#FFFFFF" size={24} />
        </TouchableOpacity>

        <View style={styles.content}>
          <Text style={styles.emoji}>📬</Text>
          <Text style={styles.title}>Verifica tu correo</Text>
          <Text style={styles.subtitle}>
            Te enviamos un enlace de confirmación a{'\n'}
            <Text style={styles.emailBold}>{email}</Text>
          </Text>
          <Text style={styles.hint}>
            Haz clic en el enlace del correo para activar tu cuenta. Si no lo ves, revisa tu carpeta
            de spam.
          </Text>

          {info && <Text style={styles.infoText}>{info}</Text>}
          {error && <Text style={styles.errorText}>{error}</Text>}

          <TouchableOpacity
            style={[styles.secondaryButton, loading && styles.buttonDisabled]}
            onPress={handleResend}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.secondaryButtonText}>Reenviar correo</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => router.replace('/auth/login')}
          >
            <Text style={styles.primaryButtonText}>Ya confirmé, iniciar sesión</Text>
          </TouchableOpacity>
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  inner: { flex: 1, padding: 24, paddingTop: 60 },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
  },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, paddingHorizontal: 16 },
  emoji: { fontSize: 80 },
  title: {
    fontFamily: 'Poppins-Bold',
    fontSize: 28,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: 'DMSans-Regular',
    fontSize: 16,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    lineHeight: 24,
  },
  emailBold: {
    fontFamily: 'DMSans-Bold',
    color: '#7ED957',
  },
  hint: {
    fontFamily: 'DMSans-Regular',
    fontSize: 13,
    color: 'rgba(255,255,255,0.65)',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 12,
  },
  infoText: {
    fontFamily: 'DMSans-Medium',
    fontSize: 13,
    color: '#7ED957',
    textAlign: 'center',
  },
  errorText: {
    fontFamily: 'DMSans-Medium',
    fontSize: 13,
    color: '#FF6B6B',
    textAlign: 'center',
  },
  secondaryButton: {
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
    alignSelf: 'stretch',
    alignItems: 'center',
    marginTop: 16,
  },
  secondaryButtonText: {
    fontFamily: 'Poppins-Bold',
    fontSize: 15,
    color: '#FFFFFF',
  },
  primaryButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  primaryButtonText: {
    fontFamily: 'Poppins-Bold',
    fontSize: 15,
    color: '#1A7A4A',
  },
  buttonDisabled: { opacity: 0.7 },
});
