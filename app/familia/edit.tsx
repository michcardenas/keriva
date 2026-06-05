import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Save, Calendar, Scale, Baby, User as UserIcon, Lock } from 'lucide-react-native';
import { useAuth } from '@/lib/AuthContext';
import AuthRequiredPlaceholder from '@/components/AuthRequiredPlaceholder';
import {
  createDependiente,
  getPerfilFamilia,
  updatePerfilFamilia,
  AVATAR_OPTIONS,
  type TipoPerfil,
  type KerivaPerfil,
} from '@/lib/api/familia';

type Mode = 'create' | 'edit';

function isValidDate(s: string): boolean {
  // YYYY-MM-DD
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s);
  return !isNaN(d.getTime()) && d.toISOString().startsWith(s);
}

export default function EditFamiliaScreen() {
  const router = useRouter();
  const { user, session } = useAuth();
  const params = useLocalSearchParams<{ id?: string }>();
  const perfilId = typeof params.id === 'string' ? params.id : undefined;
  const mode: Mode = perfilId ? 'edit' : 'create';

  const [loading, setLoading] = useState<boolean>(mode === 'edit');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [existing, setExisting] = useState<KerivaPerfil | null>(null);

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
        setError('Perfil no encontrado');
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
    if (!nombre.trim()) return 'El nombre es obligatorio';
    if (fechaNacimiento && !isValidDate(fechaNacimiento)) {
      return 'Fecha inválida. Usa el formato AAAA-MM-DD';
    }
    if (pesoLb) {
      const n = Number(pesoLb);
      if (!Number.isFinite(n) || n <= 0 || n > 1000) {
        return 'El peso (lb) no es válido';
      }
    }
    if (tipoPerfil === 'dependiente_pediatrico' && !fechaNacimiento) {
      return 'La fecha de nacimiento es obligatoria para perfiles pediátricos';
    }
    return null;
  }, [nombre, fechaNacimiento, pesoLb, tipoPerfil]);

  const onSubmit = useCallback(async () => {
    setError(null);
    const v = validate();
    if (v) {
      setError(v);
      return;
    }
    if (!user) {
      setError('Sesión no encontrada');
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
          setError(res.error ?? 'No se pudo crear el perfil');
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
          setError(res.error ?? 'No se pudo guardar');
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
        ? ([{ key: 'titular' as const, label: 'Titular', icon: UserIcon }])
        : ([
            { key: 'dependiente_pediatrico' as const, label: 'Pediátrico', icon: Baby },
            { key: 'dependiente_adulto' as const, label: 'Adulto', icon: UserIcon },
          ]),
    [isTitular],
  );

  if (!session) {
    return (
      <AuthRequiredPlaceholder
        icon={<Lock size={48} color="#34C26A" />}
        title="Inicia sesión"
        description="Necesitas iniciar sesión para gestionar tu familia."
      />
    );
  }

  return (
    <LinearGradient colors={['#052419', '#106B4F', '#052419']} style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <ArrowLeft size={20} color="#FFFFFF" />
          </TouchableOpacity>

          <View style={styles.header}>
            <Text style={styles.title}>
              {mode === 'edit'
                ? isTitular
                  ? 'Mi perfil'
                  : 'Editar perfil'
                : 'Nuevo dependiente'}
            </Text>
            <Text style={styles.subtitle}>
              {isTitular
                ? 'Datos del titular de la cuenta.'
                : 'Información del dependiente (hijo, adulto mayor) para que Keriva personalice recordatorios y cálculos.'}
            </Text>
          </View>

          {loading ? (
            <ActivityIndicator color="#34C26A" style={{ marginTop: 40 }} />
          ) : (
            <>
              {/* Tipo de perfil */}
              {!isTitular && (
                <>
                  <Text style={styles.sectionLabel}>Tipo de perfil</Text>
                  <View style={styles.tipoRow}>
                    {tipoOptions.map(({ key, label, icon: Icon }) => (
                      <TouchableOpacity
                        key={key}
                        style={[styles.tipoCard, tipoPerfil === key && styles.tipoCardActive]}
                        onPress={() => onPickTipo(key)}
                      >
                        <Icon size={18} color={tipoPerfil === key ? '#106B4F' : '#FFFFFF'} />
                        <Text
                          style={[
                            styles.tipoCardText,
                            tipoPerfil === key && styles.tipoCardTextActive,
                          ]}
                        >
                          {label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}

              {/* Avatar */}
              <Text style={styles.sectionLabel}>Avatar</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.emojiRow}
                contentContainerStyle={{ gap: 8, paddingRight: 8 }}
              >
                {AVATAR_OPTIONS.map((e) => (
                  <TouchableOpacity
                    key={e}
                    style={[styles.emojiBtn, avatarEmoji === e && styles.emojiBtnActive]}
                    onPress={() => setAvatarEmoji(e)}
                  >
                    <Text style={styles.emojiText}>{e}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Nombre */}
              <Text style={styles.sectionLabel}>Nombre *</Text>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.input}
                  placeholder="Nombre"
                  placeholderTextColor="rgba(255,255,255,0.4)"
                  value={nombre}
                  onChangeText={setNombre}
                  maxLength={60}
                />
              </View>

              <Text style={styles.sectionLabel}>Apellido</Text>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.input}
                  placeholder="Apellido (opcional)"
                  placeholderTextColor="rgba(255,255,255,0.4)"
                  value={apellido}
                  onChangeText={setApellido}
                  maxLength={60}
                />
              </View>

              <Text style={styles.sectionLabel}>
                Fecha de nacimiento {tipoPerfil === 'dependiente_pediatrico' ? '*' : ''}
              </Text>
              <View style={styles.inputWrapper}>
                <Calendar size={16} color="rgba(255,255,255,0.5)" />
                <TextInput
                  style={styles.input}
                  placeholder="AAAA-MM-DD"
                  placeholderTextColor="rgba(255,255,255,0.4)"
                  value={fechaNacimiento}
                  onChangeText={setFechaNacimiento}
                  maxLength={10}
                  keyboardType="numbers-and-punctuation"
                  autoCapitalize="none"
                />
              </View>

              <Text style={styles.sectionLabel}>Peso (libras)</Text>
              <Text style={styles.hint}>
                Necesario para cálculos pediátricos (Keriva Kids).
              </Text>
              <View style={styles.inputWrapper}>
                <Scale size={16} color="rgba(255,255,255,0.5)" />
                <TextInput
                  style={styles.input}
                  placeholder="Ej. 44"
                  placeholderTextColor="rgba(255,255,255,0.4)"
                  value={pesoLb}
                  onChangeText={setPesoLb}
                  keyboardType="decimal-pad"
                  maxLength={6}
                />
                <Text style={styles.suffix}>lb</Text>
              </View>

              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              <TouchableOpacity
                style={[styles.primaryButton, submitting && styles.buttonDisabled]}
                onPress={onSubmit}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="#106B4F" />
                ) : (
                  <>
                    <Save size={18} color="#106B4F" />
                    <Text style={styles.primaryButtonText}>
                      {mode === 'edit' ? 'Guardar cambios' : 'Crear dependiente'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 24, paddingTop: 50, paddingBottom: 60 },
  backButton: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 16,
  },
  header: { alignItems: 'center', marginBottom: 20, gap: 6 },
  title: { fontFamily: 'Poppins-Bold', fontSize: 26, color: '#FFFFFF', textAlign: 'center' },
  subtitle: { fontFamily: 'DMSans-Regular', fontSize: 14, color: 'rgba(255,255,255,0.7)', textAlign: 'center', lineHeight: 20 },
  sectionLabel: { fontFamily: 'DMSans-Bold', fontSize: 12, color: '#34C26A', marginTop: 14, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 },
  hint: { fontFamily: 'DMSans-Regular', fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 6, marginTop: -4 },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12,
    paddingHorizontal: 14, height: 50,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
  },
  input: { flex: 1, fontFamily: 'DMSans-Regular', fontSize: 15, color: '#FFFFFF' },
  suffix: { fontFamily: 'DMSans-Bold', fontSize: 13, color: 'rgba(255,255,255,0.6)' },
  tipoRow: { flexDirection: 'row', gap: 10 },
  tipoCard: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
  },
  tipoCardActive: { backgroundColor: '#FFFFFF', borderColor: '#FFFFFF' },
  tipoCardText: { fontFamily: 'DMSans-Bold', fontSize: 14, color: '#FFFFFF' },
  tipoCardTextActive: { color: '#106B4F' },
  emojiRow: { marginBottom: 4 },
  emojiBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
  },
  emojiBtnActive: { backgroundColor: 'rgba(52, 194, 106, 0.3)', borderColor: '#34C26A' },
  emojiText: { fontSize: 22 },
  primaryButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#FFFFFF', borderRadius: 12,
    paddingVertical: 16, marginTop: 22,
  },
  primaryButtonText: { fontFamily: 'Poppins-Bold', fontSize: 16, color: '#106B4F' },
  buttonDisabled: { opacity: 0.7 },
  errorText: { fontFamily: 'DMSans-Medium', fontSize: 13, color: '#FF6B6B', textAlign: 'center', marginTop: 12 },
});
