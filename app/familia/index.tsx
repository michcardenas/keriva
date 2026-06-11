import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import {
  ArrowLeft,
  UserPlus,
  Pencil,
  Trash2,
  Users,
  Pill,
  ShieldCheck,
  ShieldAlert,
  Lock,
  Baby,
} from 'lucide-react-native';
import { useAuth } from '@/lib/AuthContext';
import AuthRequiredPlaceholder from '@/components/AuthRequiredPlaceholder';
import {
  listFamilia,
  softDeleteDependiente,
  FAMILIA_LIMIT,
  type FamiliaDashboardRow,
  type TipoPerfil,
} from '@/lib/api/familia';
import { useLanguage } from '@/lib/LanguageContext';
import { theme } from '@/lib/theme';
import PressableScale from '@/components/ui/PressableScale';
import Reveal from '@/components/ui/Reveal';
import PillBackground from '@/components/ui/PillBackground';

function webConfirm(message: string): boolean {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return window.confirm(message);
  }
  return true;
}

export default function FamiliaScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const { session, loading: authLoading } = useAuth();
  const tipoLabel = (tipo: TipoPerfil) =>
    tipo === 'titular'
      ? t.familia.typeTitular
      : tipo === 'dependiente_pediatrico'
      ? t.familia.typePediatrico
      : t.familia.typeAdulto;
  const [familia, setFamilia] = useState<FamiliaDashboardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const rows = await listFamilia();
      setFamilia(rows);
    } catch (e: any) {
      setError(e?.message ?? t.familia.loadError);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (session) load();
    else setLoading(false);
  }, [authLoading, session, load]);

  useFocusEffect(
    useCallback(() => {
      if (session) load();
    }, [session, load]),
  );

  const handleDelete = useCallback(
    (perfil: FamiliaDashboardRow) => {
      const msg = t.familia.deleteConfirm.replace('{name}', perfil.nombre);
      const proceed = async () => {
        const res = await softDeleteDependiente(perfil.id);
        if (!res.ok) {
          Alert.alert(t.familia.errorTitle, res.error ?? t.familia.deleteError);
          return;
        }
        await load();
      };
      if (Platform.OS === 'web') {
        if (webConfirm(msg)) proceed();
      } else {
        Alert.alert(t.familia.deleteProfileTitle, msg, [
          { text: t.familia.cancel, style: 'cancel' },
          { text: t.familia.delete, style: 'destructive', onPress: proceed },
        ]);
      }
    },
    [load, t],
  );

  if (authLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.centerContent}>
          <ActivityIndicator color={theme.colors.accent} />
        </View>
      </View>
    );
  }

  if (!session) {
    return (
      <AuthRequiredPlaceholder
        icon={<Lock size={48} color={theme.colors.accent} />}
        title={t.familia.authTitle}
        description={t.familia.authDesc}
      />
    );
  }

  return (
    <View style={styles.container}>
      <PillBackground />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <PressableScale style={styles.backButton} onPress={() => router.back()} scaleTo={0.9}>
          <ArrowLeft size={22} color={theme.colors.textPrimary} />
        </PressableScale>

        <Reveal variant="up" delay={60}>
          <View style={styles.header}>
            <View style={styles.heroIcon}>
              <Users size={28} color={theme.colors.accent} />
            </View>
            <Text style={styles.title}>{t.familia.title}</Text>
            <Text style={styles.subtitle}>{t.familia.subtitle}</Text>
          </View>
        </Reveal>

        {loading ? (
          <View style={styles.centerContent}>
            <ActivityIndicator color={theme.colors.accent} />
          </View>
        ) : error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : (
          <>
            <Reveal variant="fade" delay={120}>
              <View style={styles.countRow}>
                <Text style={styles.countText}>
                  {familia.length} / {FAMILIA_LIMIT} {t.familia.activeProfiles}
                </Text>
              </View>
            </Reveal>

            {familia.map((p, i) => (
              <Reveal key={p.id} index={i} delay={140}>
                <View style={styles.card}>
                  <View style={styles.cardLeft}>
                    <Text style={styles.avatar}>{p.avatarEmoji ?? '👤'}</Text>
                  </View>
                  <View style={styles.cardMain}>
                    <View style={styles.cardHeader}>
                      <Text style={styles.cardName} numberOfLines={1}>
                        {p.nombre}
                        {p.apellido ? ` ${p.apellido}` : ''}
                      </Text>
                      <View
                        style={[
                          styles.badge,
                          p.tipoPerfil === 'titular' && styles.badgeTitular,
                          p.tipoPerfil === 'dependiente_pediatrico' &&
                            styles.badgePediatrico,
                        ]}
                      >
                        <Text
                          style={[
                            styles.badgeText,
                            p.tipoPerfil === 'titular' && styles.badgeTextTitular,
                            p.tipoPerfil === 'dependiente_pediatrico' &&
                              styles.badgeTextPediatrico,
                          ]}
                        >
                          {tipoLabel(p.tipoPerfil)}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.metaRow}>
                      {p.edadAnios !== null ? (
                        <Text style={styles.metaText}>{p.edadAnios} {t.familia.years}</Text>
                      ) : null}
                      {p.pesoLb !== null ? (
                        <Text style={styles.metaText}>{p.pesoLb} lb</Text>
                      ) : null}
                      <View style={styles.metaInline}>
                        <Pill size={12} color={theme.colors.textSecondary} />
                        <Text style={styles.metaText}>{p.medicamentosActivos} {t.familia.meds}</Text>
                      </View>
                      {p.disclaimerAceptado ? (
                        <View style={styles.metaInline}>
                          <ShieldCheck size={12} color={theme.colors.accent} />
                          <Text style={[styles.metaText, { color: theme.colors.accent }]}>
                            {t.familia.disclaimerOk}
                          </Text>
                        </View>
                      ) : p.tipoPerfil === 'dependiente_pediatrico' ? (
                        <View style={styles.metaInline}>
                          <ShieldAlert size={12} color={theme.colors.warning} />
                          <Text style={[styles.metaText, { color: theme.colors.warning }]}>
                            {t.familia.disclaimerPending}
                          </Text>
                        </View>
                      ) : null}
                    </View>

                    <View style={styles.actionsRow}>
                      <PressableScale
                        style={styles.actionBtn}
                        scaleTo={0.94}
                        onPress={() => router.push(`/familia/edit?id=${p.id}` as any)}
                      >
                        <Pencil size={14} color={theme.colors.accent} />
                        <Text style={styles.actionText}>{t.familia.edit}</Text>
                      </PressableScale>
                      <PressableScale
                        style={styles.actionBtn}
                        scaleTo={0.94}
                        onPress={() =>
                          router.push(`/familia/medicamentos?perfilId=${p.id}` as any)
                        }
                      >
                        <Pill size={14} color={theme.colors.accent} />
                        <Text style={styles.actionText}>{t.familia.medications}</Text>
                      </PressableScale>
                      {p.tipoPerfil === 'dependiente_pediatrico' ? (
                        <PressableScale
                          style={[styles.actionBtn, styles.actionKids]}
                          scaleTo={0.94}
                          onPress={() =>
                            router.push(`/familia/kids?perfilId=${p.id}` as any)
                          }
                        >
                          <Baby size={14} color={theme.colors.warning} />
                          <Text style={[styles.actionText, { color: theme.colors.warning }]}>
                            {t.familia.kids}
                          </Text>
                        </PressableScale>
                      ) : null}
                      {p.tipoPerfil !== 'titular' ? (
                        <PressableScale
                          style={[styles.actionBtn, styles.actionDelete]}
                          scaleTo={0.94}
                          onPress={() => handleDelete(p)}
                        >
                          <Trash2 size={14} color={theme.colors.danger} />
                          <Text style={[styles.actionText, { color: theme.colors.danger }]}>
                            {t.familia.delete}
                          </Text>
                        </PressableScale>
                      ) : null}
                    </View>
                  </View>
                </View>
              </Reveal>
            ))}

            {familia.length < FAMILIA_LIMIT ? (
              <Reveal variant="up" delay={200} index={familia.length}>
                <PressableScale
                  style={styles.addButton}
                  onPress={() => router.push('/familia/edit' as any)}
                >
                  <UserPlus size={18} color={theme.colors.white} />
                  <Text style={styles.addButtonText}>{t.familia.addDependent}</Text>
                </PressableScale>
              </Reveal>
            ) : (
              <Text style={styles.limitText}>
                {t.familia.limitReached.replace('{limit}', String(FAMILIA_LIMIT))}
              </Text>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  scroll: {
    padding: theme.spacing.xxl,
    paddingTop: 50,
    paddingBottom: theme.spacing.huge,
  },
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
  header: { alignItems: 'center', gap: theme.spacing.sm, marginBottom: theme.spacing.xl },
  heroIcon: {
    width: 64,
    height: 64,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.accentSoft,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
    ...theme.shadow.sm,
  },
  title: { ...theme.text.h1, color: theme.colors.textPrimary, textAlign: 'center' },
  subtitle: {
    ...theme.text.body,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: theme.spacing.sm,
  },
  countRow: { marginBottom: theme.spacing.md, alignItems: 'flex-end' },
  countText: { ...theme.text.bodyMedium, fontSize: 12, color: theme.colors.textSecondary },
  card: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    gap: theme.spacing.md,
    ...theme.shadow.card,
  },
  cardLeft: {
    width: 52,
    height: 52,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.accentSofter,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatar: { fontSize: 26 },
  cardMain: { flex: 1, gap: 6 },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
  },
  cardName: { flex: 1, ...theme.text.h3, color: theme.colors.textPrimary },
  badge: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 3,
    borderRadius: theme.radius.xs,
    backgroundColor: theme.colors.bgSecondary,
  },
  badgeTitular: { backgroundColor: theme.colors.accentSoft },
  badgePediatrico: { backgroundColor: theme.colors.warningSoft },
  badgeText: {
    ...theme.text.label,
    fontSize: 10,
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
  },
  badgeTextTitular: { color: theme.colors.accent },
  badgeTextPediatrico: { color: theme.colors.warning },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm, alignItems: 'center' },
  metaInline: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { ...theme.text.caption, color: theme.colors.textSecondary },
  actionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: theme.spacing.xs },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 7,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.accentSofter,
    borderWidth: 1,
    borderColor: theme.colors.accentSoft,
  },
  actionDelete: { backgroundColor: theme.colors.dangerSoft, borderColor: theme.colors.dangerSoft },
  actionKids: { backgroundColor: theme.colors.warningSoft, borderColor: theme.colors.warningSoft },
  actionText: { ...theme.text.label, fontSize: 12, letterSpacing: 0, color: theme.colors.accent },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius.pill,
    paddingVertical: theme.spacing.lg,
    marginTop: theme.spacing.xs,
    ...theme.shadow.accent,
  },
  addButtonText: {
    fontFamily: theme.font.bold,
    fontSize: 15,
    color: theme.colors.white,
    letterSpacing: 0.3,
  },
  limitText: {
    ...theme.text.body,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: theme.spacing.md,
  },
  centerContent: { paddingVertical: theme.spacing.huge, alignItems: 'center' },
  errorText: {
    ...theme.text.bodyMedium,
    fontSize: 13,
    color: theme.colors.danger,
    textAlign: 'center',
    marginVertical: theme.spacing.md,
  },
});
