import { useState } from 'react';
import { View, Text, StyleSheet, Modal, ScrollView, ActivityIndicator } from 'react-native';
import { ShieldCheck, Lock, X } from 'lucide-react-native';
import { theme } from '@/lib/theme';
import PressableScale from '@/components/ui/PressableScale';
import { aceptarConsentimiento172_13 } from '@/lib/api/perfiles';
import { setUser as sentrySetUser } from '@/lib/sentry';
import { identifyUser as analyticsIdentify } from '@/lib/analytics';

// =====================================================================
// Modal de consentimiento Ley 172-13 (RD, datos de salud)
// =====================================================================
// Se muestra al primer login del rol usuario. Es OPT-IN: la app funciona
// igual si rechazan — solo no identificamos al user_id en Sentry/PostHog.
// Aceptar: registra timestamp via RPC + vincula identidad en obs.
// =====================================================================

type Props = {
  visible: boolean;
  userId: string;
  onAccepted: () => void;
  onDismissed: () => void;
};

export default function ConsentModal({ visible, userId, onAccepted, onDismissed }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAccept() {
    setError(null);
    setLoading(true);
    const res = await aceptarConsentimiento172_13();
    setLoading(false);
    if (!res.ok) {
      setError(res.error ?? 'No se pudo registrar tu consentimiento. Intenta de nuevo.');
      return;
    }
    // Identidad en observabilidad solo después del consentimiento.
    sentrySetUser(userId);
    analyticsIdentify(userId);
    onAccepted();
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismissed}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.header}>
            <View style={styles.iconBubble}>
              <ShieldCheck size={28} color={theme.colors.accent} />
            </View>
            <PressableScale style={styles.closeBtn} onPress={onDismissed} scaleTo={0.9}>
              <X size={20} color={theme.colors.textSecondary} />
            </PressableScale>
          </View>

          <Text style={styles.title}>Tu privacidad importa</Text>
          <Text style={styles.subtitle}>
            Ley 172-13 · Protección de datos personales (RD)
          </Text>

          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
            <Text style={styles.paragraph}>
              Keriva maneja información relacionada con medicamentos y farmacias.
              Para mejorar el servicio queremos registrar errores y métricas de uso
              vinculadas a tu cuenta.
            </Text>

            <View style={styles.bulletRow}>
              <Lock size={16} color={theme.colors.accent} />
              <Text style={styles.bulletText}>
                <Text style={styles.bulletStrong}>Nunca</Text> compartimos tus datos
                con terceros para fines comerciales.
              </Text>
            </View>
            <View style={styles.bulletRow}>
              <Lock size={16} color={theme.colors.accent} />
              <Text style={styles.bulletText}>
                Solo guardamos tu identificador interno —
                <Text style={styles.bulletStrong}> nunca</Text> email, teléfono ni
                cédula en reportes de errores.
              </Text>
            </View>
            <View style={styles.bulletRow}>
              <Lock size={16} color={theme.colors.accent} />
              <Text style={styles.bulletText}>
                Puedes usar Keriva sin aceptar — la app funciona igual y los
                reportes quedan anónimos.
              </Text>
            </View>
          </ScrollView>

          {error && <Text style={styles.errorText}>{error}</Text>}

          <PressableScale
            style={[styles.primaryBtn, loading && styles.btnDisabled]}
            onPress={handleAccept}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={theme.colors.accentText} />
            ) : (
              <Text style={styles.primaryBtnText}>Acepto y continuar</Text>
            )}
          </PressableScale>

          <PressableScale style={styles.secondaryBtn} onPress={onDismissed} disabled={loading}>
            <Text style={styles.secondaryBtnText}>Ahora no</Text>
          </PressableScale>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.xl,
    ...theme.shadow.card,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  iconBubble: {
    width: 56,
    height: 56,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.accentSofter,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.bgSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    ...theme.text.h2,
    color: theme.colors.textPrimary,
  },
  subtitle: {
    ...theme.text.caption,
    color: theme.colors.textSecondary,
    marginTop: 2,
    marginBottom: theme.spacing.md,
  },
  scroll: { maxHeight: 280 },
  scrollContent: { gap: theme.spacing.md, paddingBottom: theme.spacing.sm },
  paragraph: {
    ...theme.text.body,
    color: theme.colors.textPrimary,
    lineHeight: 21,
  },
  bulletRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    alignItems: 'flex-start',
  },
  bulletText: {
    ...theme.text.body,
    color: theme.colors.textSecondary,
    flex: 1,
    lineHeight: 20,
  },
  bulletStrong: {
    fontFamily: theme.font.bodyBold,
    color: theme.colors.textPrimary,
  },
  errorText: {
    ...theme.text.caption,
    color: theme.colors.danger,
    marginTop: theme.spacing.md,
    textAlign: 'center',
  },
  primaryBtn: {
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius.pill,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: theme.spacing.lg,
    ...theme.shadow.accent,
  },
  primaryBtnText: {
    fontFamily: theme.font.bold,
    fontSize: 15,
    color: theme.colors.accentText,
  },
  btnDisabled: { opacity: 0.6 },
  secondaryBtn: {
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: theme.spacing.sm,
  },
  secondaryBtnText: {
    ...theme.text.bodyMedium,
    fontSize: 13,
    color: theme.colors.textSecondary,
    textDecorationLine: 'underline',
  },
});
