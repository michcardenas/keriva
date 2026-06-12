import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Share, ActivityIndicator, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  ArrowLeft, Award, TrendingUp, Share2, Trophy, Sparkles, Info,
} from 'lucide-react-native';
import { useAuth } from '@/lib/AuthContext';
import AuthRequiredPlaceholder from '@/components/AuthRequiredPlaceholder';
import PillBackground from '@/components/ui/PillBackground';
import PressableScale from '@/components/ui/PressableScale';
import Reveal from '@/components/ui/Reveal';
import { useTheme } from '@/lib/ThemeContext';
import type { Theme } from '@/lib/theme';
import { getMyPoints } from '@/lib/api/precios';
import { getMisReservas } from '@/lib/api/reservas';
import { ganarPtsCompartir } from '@/lib/api/wallet';
import {
  getMedallasConEstado, evaluarMisMedallas, getMiCodigoReferido,
  type MedallaConEstado,
} from '@/lib/api/medallas';
import {
  nivelActual, siguienteNivel, progresoNivel,
  calcularAhorro, buildShareMessage, type AhorroEstimado,
} from '@/lib/wallet';

// =====================================================================
// Keriva Wallet (A1) — panel personal del usuario
// =====================================================================
// Muestra: puntos totales, nivel calculado + barra de progreso al siguiente,
// ahorro estimado en rango ±5%, placeholders de medallas y botón compartir.
// El compartir se valida con cooldown semanal vía lib/wallet.canEarnShareReward.
// =====================================================================

export default function WalletScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, perfil, session } = useAuth();
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [loading, setLoading] = useState(true);
  const [puntos, setPuntos] = useState(0);
  const [ahorro, setAhorro] = useState<AhorroEstimado>({ centro: 0, min: 0, max: 0, base: 'vacio', reservas: 0 });
  const [medallas, setMedallas] = useState<MedallaConEstado[]>([]);
  const [codigoReferido, setCodigoReferido] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [shareToast, setShareToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Pide al server reevaluar medallas antes de leerlas (idempotente).
      await evaluarMisMedallas();
      const [pts, reservas, meds, codigo] = await Promise.all([
        getMyPoints(user.id),
        getMisReservas(user.id),
        getMedallasConEstado(user.id),
        getMiCodigoReferido(user.id),
      ]);
      setPuntos(pts);
      const confirmadas = reservas.filter((r) => r.estado === 'confirmada').length;
      setAhorro(calcularAhorro(confirmadas));
      setMedallas(meds);
      setCodigoReferido(codigo);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  async function handleShare() {
    if (!user) return;
    const nivel = nivelActual(puntos);
    const message = buildShareMessage({
      nombre: perfil?.nombre ?? null,
      nivel,
      puntos,
    });
    setSharing(true);
    try {
      if (Platform.OS === 'web') {
        if (navigator?.share) {
          await navigator.share({ text: message, title: 'Keriva' });
        } else if (navigator?.clipboard?.writeText) {
          await navigator.clipboard.writeText(message);
          setShareToast('Copiado al portapapeles');
        }
      } else {
        await Share.share({ message });
      }
      // W2 server-side: la RPC valida cooldown 7 días + suma +15 puntos.
      const res = await ganarPtsCompartir();
      if (res.ok) {
        setShareToast(`¡Compartiste! +${res.puntos} puntos`);
        // Refresca para reflejar los puntos nuevos
        await load();
      } else if (res.error === 'cooldown') {
        setShareToast('Ya compartiste esta semana — vuelve a intentar en unos días');
      } else {
        setShareToast('Compartido. La recompensa no se pudo aplicar ahora.');
      }
      setTimeout(() => setShareToast(null), 2800);
    } catch {
      // share cancel = no-op
    } finally {
      setSharing(false);
    }
  }

  if (!session) {
    return (
      <AuthRequiredPlaceholder
        icon={<Award size={56} color={theme.colors.accent} />}
        title="Inicia sesión"
        description="Tu Wallet te muestra puntos, ahorro estimado y medallas."
      />
    );
  }

  const nivel = nivelActual(puntos);
  const next = siguienteNivel(puntos);
  const progreso = progresoNivel(puntos);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <PillBackground />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: theme.spacing.xl, paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topBar}>
          <PressableScale onPress={() => router.back()} style={styles.iconBtn} scaleTo={0.9}>
            <ArrowLeft size={22} color={theme.colors.textPrimary} />
          </PressableScale>
          <Text style={styles.headerTitle}>Keriva Wallet</Text>
          <View style={styles.iconBtn} />
        </View>

        {loading ? (
          <View style={styles.center}><ActivityIndicator color={theme.colors.accent} /></View>
        ) : (
          <>
            {/* Hero — puntos y nivel */}
            <Reveal variant="up" delay={60}>
              <View style={styles.heroCard}>
                <View style={styles.heroTopRow}>
                  <Text style={styles.heroNivelEmoji}>{nivel.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.heroNivelLabel}>Nivel {nivel.numero}</Text>
                    <Text style={styles.heroNivelName}>{nivel.nombre}</Text>
                  </View>
                </View>
                <Text style={styles.heroPuntos}>{puntos.toLocaleString('es-DO')}</Text>
                <Text style={styles.heroPuntosLabel}>puntos acumulados</Text>

                {/* Barra de progreso al siguiente nivel */}
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${Math.round(progreso * 100)}%` }]} />
                </View>
                <Text style={styles.progressHint}>
                  {next
                    ? `Te faltan ${(next.minPuntos - puntos).toLocaleString('es-DO')} puntos para ${next.nombre} ${next.emoji}`
                    : 'Llegaste al nivel máximo. ¡Eres un Embajador! 👑'}
                </Text>
              </View>
            </Reveal>

            {/* Ahorro estimado */}
            <Reveal variant="up" delay={120}>
              <View style={styles.ahorroCard}>
                <View style={styles.ahorroHeader}>
                  <View style={styles.ahorroIconBubble}>
                    <TrendingUp size={22} color={theme.colors.accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.ahorroLabel}>Ahorro estimado</Text>
                    {ahorro.base === 'vacio' ? (
                      <Text style={styles.ahorroVacio}>
                        Empieza a reservar medicamentos para ver tu ahorro acumulado.
                      </Text>
                    ) : (
                      <>
                        <Text style={styles.ahorroRango}>
                          RD$ {ahorro.min.toLocaleString('es-DO')} – {ahorro.max.toLocaleString('es-DO')}
                        </Text>
                        <Text style={styles.ahorroBase}>
                          basado en {ahorro.reservas} reserva{ahorro.reservas === 1 ? '' : 's'} confirmada{ahorro.reservas === 1 ? '' : 's'}
                        </Text>
                      </>
                    )}
                  </View>
                </View>
                <View style={styles.disclaimerRow}>
                  <Info size={12} color={theme.colors.textMuted} />
                  <Text style={styles.disclaimerText}>
                    Estimación referencial con rango ±5%. Cotiza el precio exacto con la farmacia.
                  </Text>
                </View>
              </View>
            </Reveal>

            {/* Medallas */}
            <Reveal variant="up" delay={180}>
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Trophy size={18} color={theme.colors.accent} />
                  <Text style={styles.sectionTitle}>
                    Medallas ({medallas.filter((m) => m.obtenida).length}/{medallas.length})
                  </Text>
                </View>
                <View style={styles.medallasRow}>
                  {medallas.map((m) => (
                    <View
                      key={m.id}
                      style={[styles.medallaItem, m.obtenida ? styles.medallaEarned : styles.medallaLocked]}
                    >
                      <Text style={[styles.medallaEmoji, !m.obtenida && styles.medallaEmojiLocked]}>
                        {m.emoji}
                      </Text>
                      <Text style={styles.medallaNombre} numberOfLines={2}>{m.nombre}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </Reveal>

            {/* Código de referido */}
            {codigoReferido && (
              <Reveal variant="up" delay={210}>
                <View style={styles.refCard}>
                  <Text style={styles.refLabel}>Tu código de invitación</Text>
                  <Text style={styles.refCode}>{codigoReferido}</Text>
                  <Text style={styles.refHint}>
                    Cuando un amigo se registre con tu código, ganas +30 puntos.
                  </Text>
                </View>
              </Reveal>
            )}

            {/* Botón compartir */}
            <Reveal variant="up" delay={240}>
              <PressableScale
                style={[styles.shareBtn, sharing && { opacity: 0.7 }]}
                onPress={handleShare}
                disabled={sharing}
              >
                <Share2 size={20} color={theme.colors.accentText} />
                <Text style={styles.shareBtnText}>
                  {sharing ? 'Compartiendo…' : 'Compartir mi progreso'}
                </Text>
              </PressableScale>
              <Text style={styles.shareHint}>
                Gana +15 puntos al compartir tu progreso (una vez por semana).
              </Text>
            </Reveal>

            {/* Cómo ganar más puntos */}
            <Reveal variant="up" delay={300}>
              <View style={styles.howCard}>
                <Text style={styles.howTitle}>¿Cómo ganar más puntos?</Text>
                <PressableScale
                  style={styles.howRow}
                  onPress={() => router.push('/(tabs)/report' as any)}
                >
                  <Text style={styles.howRowEmoji}>📷</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.howRowTitle}>Reporta un precio</Text>
                    <Text style={styles.howRowDesc}>+10 al reportar, +20 al verificarse</Text>
                  </View>
                </PressableScale>
                <PressableScale
                  style={styles.howRow}
                  onPress={() => router.push('/(tabs)')}
                >
                  <Text style={styles.howRowEmoji}>🛒</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.howRowTitle}>Reserva en una farmacia afiliada</Text>
                    <Text style={styles.howRowDesc}>+5 puntos por cada reserva confirmada</Text>
                  </View>
                </PressableScale>
                <View style={styles.howRow}>
                  <Text style={styles.howRowEmoji}>⭐</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.howRowTitle}>Califica una farmacia</Text>
                    <Text style={styles.howRowDesc}>+5 puntos por reseña</Text>
                  </View>
                </View>
                <View style={styles.howRow}>
                  <Text style={styles.howRowEmoji}>📣</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.howRowTitle}>Invita un amigo</Text>
                    <Text style={styles.howRowDesc}>+30 cuando se registre con tu código</Text>
                  </View>
                </View>
              </View>
            </Reveal>
          </>
        )}

        {shareToast && (
          <View style={styles.toast}>
            <Text style={styles.toastText}>{shareToast}</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const makeStyles = (theme: Theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  center: { padding: theme.spacing.huge, alignItems: 'center' },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.lg,
  },
  iconBtn: {
    width: 44, height: 44, borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surface,
    borderWidth: 1, borderColor: theme.colors.border,
    alignItems: 'center', justifyContent: 'center',
    ...theme.shadow.sm,
  },
  headerTitle: { ...theme.text.h2, color: theme.colors.textPrimary },

  heroCard: {
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.xl,
    ...theme.shadow.accent,
  },
  heroTopRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md, marginBottom: theme.spacing.lg },
  heroNivelEmoji: { fontSize: 36 },
  heroNivelLabel: {
    fontFamily: theme.font.bodyMedium, fontSize: 12,
    color: theme.colors.accentText, opacity: 0.8, letterSpacing: 0.4, textTransform: 'uppercase',
  },
  heroNivelName: { fontFamily: theme.font.bold, fontSize: 20, color: theme.colors.accentText },
  heroPuntos: { fontFamily: theme.font.bold, fontSize: 48, color: theme.colors.accentText, letterSpacing: -1 },
  heroPuntosLabel: { fontFamily: theme.font.body, fontSize: 13, color: theme.colors.accentText, opacity: 0.85, marginBottom: theme.spacing.lg },
  progressTrack: {
    height: 8, borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.25)',
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: theme.colors.accentText, borderRadius: 4 },
  progressHint: { fontFamily: theme.font.body, fontSize: 12, color: theme.colors.accentText, opacity: 0.9, marginTop: theme.spacing.sm, textAlign: 'center' },

  ahorroCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    marginTop: theme.spacing.lg,
    ...theme.shadow.card,
  },
  ahorroHeader: { flexDirection: 'row', gap: theme.spacing.md, alignItems: 'center' },
  ahorroIconBubble: {
    width: 48, height: 48, borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.accentSofter,
    alignItems: 'center', justifyContent: 'center',
  },
  ahorroLabel: { ...theme.text.caption, color: theme.colors.textSecondary, marginBottom: 2 },
  ahorroRango: { fontFamily: theme.font.bold, fontSize: 22, color: theme.colors.textPrimary },
  ahorroBase: { ...theme.text.caption, color: theme.colors.textSecondary, marginTop: 2 },
  ahorroVacio: { ...theme.text.body, color: theme.colors.textSecondary, lineHeight: 19 },
  disclaimerRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: theme.spacing.md,
    paddingTop: theme.spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
  },
  disclaimerText: { fontFamily: theme.font.body, fontSize: 11, color: theme.colors.textMuted, lineHeight: 14, flex: 1 },

  section: { marginTop: theme.spacing.xl },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, marginBottom: theme.spacing.md },
  sectionTitle: { ...theme.text.h3, color: theme.colors.textPrimary },
  medallasRow: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm, marginTop: theme.spacing.xs },
  medallaItem: {
    width: 84, alignItems: 'center', justifyContent: 'flex-start',
    paddingVertical: theme.spacing.sm, paddingHorizontal: 4,
    borderRadius: theme.radius.md,
    gap: 4,
  },
  medallaEarned: {
    backgroundColor: theme.colors.accentSofter,
    borderWidth: 1, borderColor: theme.colors.accentSoft,
  },
  medallaLocked: {
    backgroundColor: theme.colors.bgSecondary,
    borderWidth: 1, borderColor: theme.colors.borderLight,
    opacity: 0.55,
  },
  medallaEmoji: { fontSize: 30 },
  medallaEmojiLocked: { opacity: 0.5 },
  medallaNombre: {
    fontFamily: theme.font.bodyBold, fontSize: 10,
    color: theme.colors.textPrimary, textAlign: 'center', lineHeight: 13,
  },
  refCard: {
    marginTop: theme.spacing.lg,
    backgroundColor: theme.colors.accentSofter,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    borderWidth: 1.5, borderColor: theme.colors.accentSoft,
    alignItems: 'center',
  },
  refLabel: { ...theme.text.label, color: theme.colors.accent, marginBottom: 4 },
  refCode: {
    fontFamily: theme.font.bold, fontSize: 28, letterSpacing: 4,
    color: theme.colors.textPrimary, marginVertical: theme.spacing.xs,
  },
  refHint: { ...theme.text.caption, color: theme.colors.textSecondary, textAlign: 'center' },

  shareBtn: {
    flexDirection: 'row', gap: theme.spacing.sm, alignItems: 'center', justifyContent: 'center',
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius.pill,
    paddingVertical: theme.spacing.md,
    marginTop: theme.spacing.xl,
    ...theme.shadow.accent,
  },
  shareBtnText: { fontFamily: theme.font.bold, fontSize: 15, color: theme.colors.accentText },
  shareHint: { ...theme.text.caption, color: theme.colors.textSecondary, textAlign: 'center', marginTop: theme.spacing.sm },

  howCard: {
    marginTop: theme.spacing.xl,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    ...theme.shadow.card,
  },
  howTitle: { ...theme.text.h3, color: theme.colors.textPrimary, marginBottom: theme.spacing.md },
  howRow: {
    flexDirection: 'row', gap: theme.spacing.md, alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.borderLight,
  },
  howRowEmoji: { fontSize: 22 },
  howRowTitle: { fontFamily: theme.font.bodyBold, fontSize: 14, color: theme.colors.textPrimary },
  howRowDesc: { ...theme.text.caption, color: theme.colors.textSecondary, marginTop: 2 },

  toast: {
    position: 'absolute', alignSelf: 'center', bottom: 32,
    backgroundColor: theme.colors.textPrimary,
    paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.pill,
    ...theme.shadow.md,
  },
  toastText: { ...theme.text.bodyMedium, color: theme.colors.white },
});
