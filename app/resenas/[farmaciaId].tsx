import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { ArrowLeft, Trash2, MapPin } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { useLanguage } from '@/lib/LanguageContext';
import { theme } from '@/lib/theme';
import StarRating from '@/components/StarRating';
import PressableScale from '@/components/ui/PressableScale';
import PillBackground from '@/components/ui/PillBackground';
import {
  getFarmaciaRating,
  getReviews,
  getMyReview,
  upsertReview,
  deleteReview,
  type FarmaciaRating,
  type Review,
} from '@/lib/api/reviews';

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '';
  }
}

export default function ReviewsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const { user, perfil } = useAuth();
  const params = useLocalSearchParams();

  const farmaciaId = String(params.farmaciaId ?? '');
  const paramNombre = typeof params.nombre === 'string' ? params.nombre : '';

  const [pharmName, setPharmName] = useState(paramNombre);
  const [rating, setRating] = useState<FarmaciaRating | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [myReview, setMyReview] = useState<Review | null>(null);
  const [loading, setLoading] = useState(true);

  // Form state
  const [formStars, setFormStars] = useState(0);
  const [formComment, setFormComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const load = useCallback(async () => {
    if (!farmaciaId) {
      setLoading(false);
      return;
    }
    const [r, list, mine] = await Promise.all([
      getFarmaciaRating(farmaciaId),
      getReviews(farmaciaId),
      user ? getMyReview(farmaciaId, user.id) : Promise.resolve(null),
    ]);
    setRating(r);
    setReviews(list);
    setMyReview(mine);
    if (mine) {
      setFormStars(mine.calificacion);
      setFormComment(mine.comentario ?? '');
    }
    // Resolver el nombre de la farmacia si no vino por params.
    if (!paramNombre) {
      const { data } = await supabase
        .from('farmacias_osm')
        .select('nombre')
        .eq('id', farmaciaId)
        .maybeSingle();
      if (data?.nombre) setPharmName(data.nombre as string);
    }
    setLoading(false);
  }, [farmaciaId, user, paramNombre]);

  useEffect(() => {
    load();
  }, [load]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  }, []);

  const handleSubmit = async () => {
    setFormError(null);
    if (!user) {
      setFormError(t.reviews.loginRequired);
      return;
    }
    if (formStars < 1) {
      setFormError(t.reviews.errorRatingRequired);
      return;
    }
    setSaving(true);
    const res = await upsertReview({
      farmaciaId,
      userId: user.id,
      calificacion: formStars,
      comentario: formComment,
      autorNombre: perfil?.nombre ?? null,
      autorAvatarUrl: perfil?.avatarUrl ?? null,
    });
    setSaving(false);
    if (!res.ok) {
      setFormError(res.error ?? t.reviews.errorSave);
      return;
    }
    showToast(myReview ? t.reviews.thanksUpdate : t.reviews.thanks);
    await load();
  };

  const handleDelete = async () => {
    if (!myReview) return;
    setSaving(true);
    const res = await deleteReview(myReview.id);
    setSaving(false);
    setConfirmDelete(false);
    if (!res.ok) {
      setFormError(res.error ?? t.reviews.errorSave);
      return;
    }
    setMyReview(null);
    setFormStars(0);
    setFormComment('');
    showToast(t.reviews.deleted);
    await load();
  };

  const total = rating?.total ?? 0;
  const promedio = rating?.promedio ?? 0;
  // Otras reseñas (excluye la propia, que se muestra en el formulario).
  const others = reviews.filter((r) => r.usuarioId !== user?.id);

  const basedOnText =
    total === 1
      ? t.reviews.oneReview
      : t.reviews.basedOn.replace('{n}', String(total));

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <PillBackground opacity={0.55} />
      {/* Header */}
      <View style={styles.header}>
        <PressableScale onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={22} color={theme.colors.textPrimary} />
        </PressableScale>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {t.reviews.title}
        </Text>
        <View style={styles.backBtn} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.accent} />
          <Text style={styles.muted}>{t.reviews.loading}</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: insets.bottom + 40 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Nombre de farmacia */}
          {!!pharmName && (
            <View style={styles.pharmRow}>
              <MapPin size={18} color={theme.colors.accent} />
              <Text style={styles.pharmName} numberOfLines={2}>
                {pharmName}
              </Text>
            </View>
          )}

          {/* Resumen de calificación */}
          <View style={styles.summary}>
            <View style={styles.summaryLeft}>
              <Text style={styles.bigAvg}>{total > 0 ? promedio.toFixed(1) : '—'}</Text>
              <StarRating value={promedio} size={18} />
              <Text style={styles.summaryCount}>
                {total > 0 ? basedOnText : t.reviews.noReviewsYet}
              </Text>
            </View>
            {total > 0 && rating && (
              <View style={styles.breakdown}>
                {[5, 4, 3, 2, 1].map((star) => {
                  const c = rating.distribucion[star - 1];
                  const pct = total > 0 ? (c / total) * 100 : 0;
                  return (
                    <View key={star} style={styles.breakRow}>
                      <Text style={styles.breakStar}>{star}</Text>
                      <View style={styles.breakTrack}>
                        <View style={[styles.breakFill, { width: `${pct}%` }]} />
                      </View>
                      <Text style={styles.breakCount}>{c}</Text>
                    </View>
                  );
                })}
              </View>
            )}
          </View>

          {/* Formulario: escribir / editar mi reseña */}
          {user ? (
            <View style={styles.formCard}>
              <Text style={styles.formTitle}>
                {myReview ? t.reviews.yourReview : t.reviews.writeReview}
              </Text>
              <Text style={styles.formHint}>{t.reviews.tapToRate}</Text>
              <View style={styles.formStars}>
                <StarRating value={formStars} onChange={setFormStars} size={34} />
              </View>
              <Text style={styles.fieldLabel}>{t.reviews.commentLabel}</Text>
              <TextInput
                style={styles.input}
                value={formComment}
                onChangeText={setFormComment}
                placeholder={t.reviews.commentPlaceholder}
                placeholderTextColor={theme.colors.textMuted}
                multiline
                maxLength={1000}
              />
              {formError && <Text style={styles.errorText}>{formError}</Text>}

              <View style={styles.formActions}>
                <PressableScale
                  onPress={handleSubmit}
                  style={[styles.submitBtn, saving && styles.btnDisabled]}
                >
                  <Text style={styles.submitText}>
                    {saving
                      ? t.reviews.submitting
                      : myReview
                        ? t.reviews.update
                        : t.reviews.submit}
                  </Text>
                </PressableScale>
                {myReview && !confirmDelete && (
                  <PressableScale onPress={() => setConfirmDelete(true)} style={styles.deleteBtn}>
                    <Trash2 size={18} color={theme.colors.danger} />
                  </PressableScale>
                )}
              </View>

              {confirmDelete && (
                <View style={styles.confirmBox}>
                  <Text style={styles.confirmText}>{t.reviews.deleteConfirm}</Text>
                  <View style={styles.confirmActions}>
                    <PressableScale onPress={() => setConfirmDelete(false)} style={styles.cancelBtn}>
                      <Text style={styles.cancelText}>{t.reviews.cancel}</Text>
                    </PressableScale>
                    <PressableScale onPress={handleDelete} style={styles.confirmDeleteBtn}>
                      <Text style={styles.confirmDeleteText}>{t.reviews.delete}</Text>
                    </PressableScale>
                  </View>
                </View>
              )}
            </View>
          ) : (
            <PressableScale onPress={() => router.push('/auth/login')} style={styles.loginCard}>
              <Text style={styles.loginText}>{t.reviews.loginRequired}</Text>
              <Text style={styles.loginCta}>{t.reviews.login}</Text>
            </PressableScale>
          )}

          {/* Lista de reseñas (otras personas) */}
          {others.length > 0 ? (
            <View style={styles.list}>
              {others.map((r) => (
                <View key={r.id} style={styles.reviewItem}>
                  <View style={styles.reviewHead}>
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>
                        {(r.autorNombre ?? t.reviews.anon).charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.reviewMeta}>
                      <Text style={styles.reviewAuthor} numberOfLines={1}>
                        {r.autorNombre ?? t.reviews.anon}
                      </Text>
                      <Text style={styles.reviewDate}>
                        {formatDate(r.createdAt)}
                        {r.updatedAt !== r.createdAt ? ` · ${t.reviews.edited}` : ''}
                      </Text>
                    </View>
                    <StarRating value={r.calificacion} size={14} />
                  </View>
                  {!!r.comentario && <Text style={styles.reviewBody}>{r.comentario}</Text>}
                </View>
              ))}
            </View>
          ) : (
            total === 0 && (
              <Text style={styles.emptyHint}>{t.reviews.beTheFirst}</Text>
            )
          )}
        </ScrollView>
      )}

      {/* Toast */}
      {toast && (
        <View style={[styles.toast, { bottom: insets.bottom + 24 }]}>
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { ...theme.text.h3, color: theme.colors.textPrimary, flex: 1, textAlign: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: theme.spacing.sm },
  muted: { ...theme.text.body, color: theme.colors.textSecondary },

  pharmRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, marginBottom: theme.spacing.md },
  pharmName: { ...theme.text.h2, color: theme.colors.textPrimary, flex: 1 },

  summary: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    gap: theme.spacing.lg,
    ...theme.shadow.card,
  },
  summaryLeft: { alignItems: 'center', justifyContent: 'center', gap: theme.spacing.xs, minWidth: 96 },
  bigAvg: { fontFamily: theme.font.bold, fontSize: 40, lineHeight: 44, color: theme.colors.textPrimary },
  summaryCount: { ...theme.text.caption, color: theme.colors.textSecondary, textAlign: 'center' },
  breakdown: { flex: 1, justifyContent: 'center', gap: 4 },
  breakRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  breakStar: { ...theme.text.caption, color: theme.colors.textSecondary, width: 10, textAlign: 'center' },
  breakTrack: { flex: 1, height: 7, borderRadius: theme.radius.pill, backgroundColor: theme.colors.bgSecondary, overflow: 'hidden' },
  breakFill: { height: '100%', borderRadius: theme.radius.pill, backgroundColor: theme.colors.gold },
  breakCount: { ...theme.text.caption, color: theme.colors.textSecondary, width: 22, textAlign: 'right' },

  formCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    marginTop: theme.spacing.lg,
    ...theme.shadow.card,
  },
  formTitle: { ...theme.text.h3, color: theme.colors.textPrimary },
  formHint: { ...theme.text.caption, color: theme.colors.textSecondary, marginTop: 2 },
  formStars: { alignItems: 'center', marginVertical: theme.spacing.md },
  fieldLabel: { ...theme.text.label, color: theme.colors.textSecondary, marginBottom: theme.spacing.xs },
  input: {
    ...theme.text.body,
    color: theme.colors.textPrimary,
    backgroundColor: theme.colors.bgSecondary,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  errorText: { ...theme.text.caption, color: theme.colors.danger, marginTop: theme.spacing.sm },
  formActions: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, marginTop: theme.spacing.md },
  submitBtn: {
    flex: 1,
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius.pill,
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
    ...theme.shadow.accent,
  },
  btnDisabled: { opacity: 0.6 },
  submitText: { ...theme.text.button, color: theme.colors.accentText },
  deleteBtn: {
    width: 48,
    height: 48,
    borderRadius: theme.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.dangerSoft,
  },
  confirmBox: {
    marginTop: theme.spacing.md,
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.dangerSoft,
  },
  confirmText: { ...theme.text.bodyMedium, color: theme.colors.textPrimary, marginBottom: theme.spacing.sm },
  confirmActions: { flexDirection: 'row', gap: theme.spacing.sm },
  cancelBtn: { flex: 1, alignItems: 'center', paddingVertical: theme.spacing.sm, borderRadius: theme.radius.pill, backgroundColor: theme.colors.surface },
  cancelText: { ...theme.text.button, color: theme.colors.textSecondary },
  confirmDeleteBtn: { flex: 1, alignItems: 'center', paddingVertical: theme.spacing.sm, borderRadius: theme.radius.pill, backgroundColor: theme.colors.danger },
  confirmDeleteText: { ...theme.text.button, color: theme.colors.white },

  loginCard: {
    marginTop: theme.spacing.lg,
    padding: theme.spacing.lg,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.accentSofter,
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  loginText: { ...theme.text.body, color: theme.colors.textSecondary },
  loginCta: { ...theme.text.button, color: theme.colors.accent },

  list: { marginTop: theme.spacing.xl, gap: theme.spacing.md },
  reviewItem: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    ...theme.shadow.sm,
  },
  reviewHead: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontFamily: theme.font.bodyBold, fontSize: 15, color: theme.colors.accentDark },
  reviewMeta: { flex: 1 },
  reviewAuthor: { ...theme.text.title, color: theme.colors.textPrimary },
  reviewDate: { ...theme.text.caption, color: theme.colors.textMuted },
  reviewBody: { ...theme.text.body, color: theme.colors.textPrimary, marginTop: theme.spacing.sm },

  emptyHint: { ...theme.text.body, color: theme.colors.textSecondary, textAlign: 'center', marginTop: theme.spacing.xl },

  toast: {
    position: 'absolute',
    alignSelf: 'center',
    backgroundColor: theme.colors.textPrimary,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.pill,
    ...theme.shadow.md,
  },
  toastText: { ...theme.text.bodyMedium, color: theme.colors.white },
});
