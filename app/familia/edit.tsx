import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Save, Scale, Baby, User as UserIcon, Lock } from 'lucide-react-native';
import { useAuth } from '@/lib/AuthContext';
import AuthRequiredPlaceholder from '@/components/AuthRequiredPlaceholder';
import DateField from '@/components/DateField';
import { useLanguage } from '@/lib/LanguageContext';
import {
  createDependiente,
  getPerfilFamilia,
  updatePerfilFamilia,
  AVATAR_OPTIONS,
  type TipoPerfil,
  type KerivaPerfil,
} from '@/lib/api/familia';
import { theme } from '@/lib/theme';
import PressableScale from '@/components/ui/PressableScale';
import Reveal from '@/components/ui/Reveal';
import KeyboardAwareScreen from '@/components/ui/KeyboardAwareScreen';
import PillBackground from '@/components/ui/PillBackground';

type Mode = 'create' | 'edit';
type FocusField = 'nombre' | 'apellido' | 'peso' | null;

// Rango permitido para fecha de nacimiento: desde 1900 (soporta adultos
// mayores) hasta hoy. Se calcula una sola vez al cargar el módulo.
const MIN_BIRTH_DATE = new Date(1900, 0, 1);
const MAX_BIRTH_DATE = new Date();

export default function EditFamiliaScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const { user, session } = useAuth();
  const params = useLocalSearchParams<{ id?: string }>();
  const perfilId = typeof params.id === 'string' ? params.id : undefined;
  const mode: Mode = perfilId ? 'edit' : 'create';

  const [loading, setLoading] = useState<boolean>(mode === 'edit');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [existing, setExisting] = useState<KerivaPerfil | null>(null);
  const [focused, setFocused] = useState<FocusField>(null);

  // Form state
  const [tipoPerfil, setTipoPerfil] = useState<TipoPerfil>('dependiente_pediatrico');
  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [fechaNacimiento, setFechaNacimiento] = useState('');
  const [pesoLb, setPesoLb] = useState('');
  const [avatarEmoji, setAvatarEmoji] = useState('👶');

  const isTitular = existing?.tipoPerfil === 'titular';

  useEffect(() => {
    if (mode !== 'edit' || !perfilId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const p = await getPerfilFamilia(perfilId);
      if (cancelled) return;
      if (!p) {
        setError(t.familia.profileNotFound);
        setLoading(false);
        return;
      }
      setExisting(p);
      setTipoPerfil(p.tipoPerfil);
      setNombre(p.nombre ?? '');
      setApellido(p.apellido ?? '');
      setFechaNacimiento(p.fechaNacimiento ?? '');
      setPesoLb(p.pesoLb != null ? String(p.pesoLb) : '');
      setAvatarEmoji(p.avatarEmoji ?? '👤');
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [mode, perfilId]);

  const onPickTipo = useCallback((t: TipoPerfil) => {
    setTipoPerfil(t);
    // Update suggested emoji if user hasn't customized
    if (t === 'dependiente_pediatrico' && avatarEmoji === '👤') setAvatarEmoji('👶');
    if (t === 'dependiente_adulto' && avatarEmoji === '👤') setAvatarEmoji('🧓');
  }, [avatarEmoji]);

  const validate = useCallback((): string | null => {
    if (!nombre.trim()) return t.familia.nameRequired;
    // El formato de fecha ya está garantizado por el selector (DateField),
    // así que solo validamos presencia cuando es obligatoria (pediátrico).
    if (pesoLb) {
      const n = Number(pesoLb);
      if (!Number.isFinite(n) || n <= 0 || n > 1000) {
        return t.familia.weightInvalid;
      }
    }
    if (tipoPerfil === 'dependiente_pediatrico' && !fechaNacimiento) {
      return t.familia.birthDateRequired;
    }
    return null;
  }, [nombre, fechaNacimiento, pesoLb, tipoPerfil, t]);

  const onSubmit = useCallback(async () => {
    setError(null);
    const v = validate();
    if (v) {
      setError(v);
      return;
    }
    if (!user) {
      setError(t.familia.sessionNotFound);
      return;
    }
    setSubmitting(true);
    try {
      const pesoNum = pesoLb ? Number(pesoLb) : undefined;
      if (mode === 'create') {
        const res = await createDependiente(user.id, {
          nombre: nombre.trim(),
          apellido: apellido.trim() || undefined,
          tipoPerfil:
            tipoPerfil === 'titular' ? 'dependiente_adulto' : tipoPerfil,
          fechaNacimiento: fechaNacimiento || undefined,
          pesoLb: pesoNum,
          avatarEmoji,
        });
        if (!res.ok) {
          setError(res.error ?? t.familia.createError);
          return;
        }
      } else if (perfilId) {
        const res = await updatePerfilFamilia(perfilId, {
          nombre: nombre.trim(),
          apellido: apellido.trim() || null,
          fechaNacimiento: fechaNacimiento || null,
          pesoLb: pesoNum ?? null,
          avatarEmoji,
        });
        if (!res.ok) {
          setError(res.error ?? t.familia.saveError);
          return;
        }
      }
      router.back();
    } finally {
      setSubmitting(false);
    }
  }, [mode, perfilId, user, nombre, apellido, fechaNacimiento, pesoLb, tipoPerfil, avatarEmoji, validate, router]);

  const tipoOptions = useMemo(
    () =>
      isTitular
        ? ([{ key: 'titular' as const, label: t.familia.typeTitular, icon: UserIcon }])
        : ([
            { key: 'dependiente_pediatrico' as const, label: t.familia.typePediatrico, icon: Baby },
            { key: 'dependiente_adulto' as const, label: t.familia.typeAdulto, icon: UserIcon },
          ]),
    [isTitular, t],
  );

  if (!session) {
    return (
      <AuthRequiredPlaceholder
        icon={<Lock size={48} color={theme.colors.accent} />}
        title={t.familia.authTitleShort}
        description={t.familia.authDescEdit}
      />
    );
  }

  return (
    <View style={styles.container}>
      <PillBackground />
      <KeyboardAwareScreen contentContainerStyle={styles.scroll}>
        <PressableScale style={styles.backButton} onPress={() => router.back()} scaleTo={0.9}>
          <ArrowLeft size={22} color={theme.colors.textPrimary} />
        </PressableScale>

        <Reveal variant="up" delay={60}>
          <View style={styles.header}>
            <Text style={styles.title}>
              {mode === 'edit'
                ? isTitular
                  ? t.familia.myProfile
                  : t.familia.editProfile
                : t.familia.newDependent}
            </Text>
            <Text style={styles.subtitle}>
              {isTitular ? t.familia.subtitleTitular : t.familia.subtitleDependent}
            </Text>
          </View>
        </Reveal>

        {loading ? (
          <ActivityIndicator color={theme.colors.accent} style={{ marginTop: theme.spacing.huge }} />
        ) : (
          <View style={styles.form}>
            {/* Tipo de perfil */}
            {!isTitular && (
              <Reveal index={0} delay={120}>
                <Text style={styles.sectionLabel}>{t.familia.profileType}</Text>
                <View style={styles.tipoRow}>
                  {tipoOptions.map(({ key, label, icon: Icon }) => {
                    const active = tipoPerfil === key;
                    return (
                      <PressableScale
                        key={key}
                        style={[styles.tipoCard, active && styles.tipoCardActive]}
                        scaleTo={0.96}
                        onPress={() => onPickTipo(key)}
                      >
                        <Icon size={18} color={active ? theme.colors.white : theme.colors.accent} />
                        <Text
                          style={[
                            styles.tipoCardText,
                            active && styles.tipoCardTextActive,
                          ]}
                        >
                          {label}
                        </Text>
                      </PressableScale>
                    );
                  })}
                </View>
              </Reveal>
            )}

            {/* Avatar */}
            <Reveal index={1} delay={140}>
              <Text style={styles.sectionLabel}>{t.familia.avatar}</Text>
              <View style={styles.emojiRow}>
                {AVATAR_OPTIONS.map((e) => (
                  <PressableScale
                    key={e}
                    style={[styles.emojiBtn, avatarEmoji === e && styles.emojiBtnActive]}
                    scaleTo={0.88}
                    onPress={() => setAvatarEmoji(e)}
                  >
                    <Text style={styles.emojiText}>{e}</Text>
                  </PressableScale>
                ))}
              </View>
            </Reveal>

            {/* Nombre */}
            <Reveal index={2} delay={160}>
              <Text style={styles.sectionLabel}>{t.familia.name} *</Text>
              <View style={[styles.inputWrapper, focused === 'nombre' && styles.inputFocused]}>
                <TextInput
                  style={styles.input}
                  placeholder={t.familia.namePlaceholder}
                  placeholderTextColor={theme.colors.textMuted}
                  value={nombre}
                  onChangeText={setNombre}
                  maxLength={60}
                  onFocus={() => setFocused('nombre')}
                  onBlur={() => setFocused(null)}
                />
              </View>
            </Reveal>

            <Reveal index={3} delay={180}>
              <Text style={styles.sectionLabel}>{t.familia.lastName}</Text>
              <View style={[styles.inputWrapper, focused === 'apellido' && styles.inputFocused]}>
                <TextInput
                  style={styles.input}
                  placeholder={t.familia.lastNamePlaceholder}
                  placeholderTextColor={theme.colors.textMuted}
                  value={apellido}
                  onChangeText={setApellido}
                  maxLength={60}
                  onFocus={() => setFocused('apellido')}
                  onBlur={() => setFocused(null)}
                />
              </View>
            </Reveal>

            <Reveal index={4} delay={200}>
              <Text style={styles.sectionLabel}>
                {t.familia.birthDate} {tipoPerfil === 'dependiente_pediatrico' ? '*' : ''}
              </Text>
              <DateField
                value={fechaNacimiento || null}
                onChange={(iso) => setFechaNacimiento(iso ?? '')}
                minimumDate={MIN_BIRTH_DATE}
                maximumDate={MAX_BIRTH_DATE}
                placeholder={t.familia.pickDate}
              />
            </Reveal>

            <Reveal index={5} delay={220}>
              <Text style={styles.sectionLabel}>{t.familia.weightLb}</Text>
              <Text style={styles.hint}>{t.familia.weightHint}</Text>
              <View style={[styles.inputWrapper, focused === 'peso' && styles.inputFocused]}>
                <Scale size={18} color={focused === 'peso' ? theme.colors.accent : theme.colors.textMuted} />
                <TextInput
                  style={styles.input}
                  placeholder={t.familia.weightPlaceholder}
                  placeholderTextColor={theme.colors.textMuted}
                  value={pesoLb}
                  onChangeText={setPesoLb}
                  keyboardType="decimal-pad"
                  maxLength={6}
                  onFocus={() => setFocused('peso')}
                  onBlur={() => setFocused(null)}
                />
                <Text style={styles.suffix}>lb</Text>
              </View>
            </Reveal>

            {error ? (
              <Reveal variant="fade">
                <Text style={styles.errorText}>{error}</Text>
              </Reveal>
            ) : null}

            <Reveal index={6} delay={240}>
              <PressableScale
                style={[styles.primaryButton, submitting && styles.buttonDisabled]}
                onPress={onSubmit}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color={theme.colors.white} />
                ) : (
                  <>
                    <Save size={18} color={theme.colors.white} />
                    <Text style={styles.primaryButtonText}>
                      {mode === 'edit' ? t.familia.saveChanges : t.familia.createDependent}
                    </Text>
                  </>
                )}
              </PressableScale>
            </Reveal>
          </View>
        )}
      </KeyboardAwareScreen>
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
  header: { alignItems: 'center', marginBottom: theme.spacing.xl, gap: 6 },
  title: { ...theme.text.h1, color: theme.colors.textPrimary, textAlign: 'center' },
  subtitle: {
    ...theme.text.body,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  form: { gap: theme.spacing.xs },
  sectionLabel: {
    ...theme.text.label,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    textTransform: 'uppercase',
  },
  hint: {
    ...theme.text.caption,
    color: theme.colors.textMuted,
    marginBottom: 6,
    marginTop: -2,
  },
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
  suffix: { fontFamily: theme.font.bodyBold, fontSize: 13, color: theme.colors.textSecondary },
  tipoRow: { flexDirection: 'row', gap: theme.spacing.md },
  tipoCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.lg,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    ...theme.shadow.sm,
  },
  tipoCardActive: {
    backgroundColor: theme.colors.accent,
    borderColor: theme.colors.accent,
    ...theme.shadow.accent,
  },
  tipoCardText: { ...theme.text.title, color: theme.colors.textPrimary },
  tipoCardTextActive: { color: theme.colors.white },
  emojiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
  emojiBtn: {
    width: 48,
    height: 48,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: theme.colors.border,
  },
  emojiBtnActive: {
    backgroundColor: theme.colors.accentSofter,
    borderColor: theme.colors.accent,
  },
  emojiText: { fontSize: 22 },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius.pill,
    height: 56,
    marginTop: theme.spacing.xxl,
    ...theme.shadow.accent,
  },
  primaryButtonText: {
    fontFamily: theme.font.bold,
    fontSize: 16,
    color: theme.colors.white,
    letterSpacing: 0.3,
  },
  buttonDisabled: { opacity: 0.7 },
  errorText: {
    ...theme.text.bodyMedium,
    fontSize: 13,
    color: theme.colors.danger,
    textAlign: 'center',
    marginTop: theme.spacing.md,
  },
});
