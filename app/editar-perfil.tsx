import { useState } from 'react';
import { View, Text, StyleSheet, TextInput, ActivityIndicator, Image, Platform, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, User, Phone, MapPin, IdCard, Check, Camera, MapPinned } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '@/lib/AuthContext';
import { updatePerfil, uploadAvatar } from '@/lib/api/perfiles';
import { getUserLocation } from '@/lib/location';
import { useLanguage } from '@/lib/LanguageContext';
import { theme } from '@/lib/theme';
import PressableScale from '@/components/ui/PressableScale';
import Reveal from '@/components/ui/Reveal';
import KeyboardAwareScreen from '@/components/ui/KeyboardAwareScreen';
import PillBackground from '@/components/ui/PillBackground';

type Field = 'nombre' | 'telefono' | 'cedula' | 'direccion';

function initials(name: string | null, email: string | null): string {
  const base = (name || email || '?').trim();
  const parts = base.split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return base.slice(0, 2).toUpperCase();
}

export default function EditarPerfilScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const { user, perfil, refreshPerfil } = useAuth();

  const [nombre, setNombre] = useState(perfil?.nombre ?? '');
  const [telefono, setTelefono] = useState(perfil?.telefono ?? '');
  const [cedula, setCedula] = useState(perfil?.cedula ?? '');
  const [direccion, setDireccion] = useState(perfil?.direccion ?? '');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(perfil?.avatarUrl ?? null);
  const [lat, setLat] = useState<number | null>(perfil?.latitud ?? null);
  const [lng, setLng] = useState<number | null>(perfil?.longitud ?? null);

  const [focused, setFocused] = useState<Field | null>(null);
  const [uploading, setUploading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function pickFrom(source: 'camera' | 'library') {
    if (!user) return;
    try {
      const perm =
        source === 'camera'
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        setError(t.editProfile.permDenied);
        return;
      }
      const result =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.7 })
          : await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              allowsEditing: true,
              aspect: [1, 1],
              quality: 0.7,
            });
      if (result.canceled || !result.assets?.[0]) return;
      setUploading(true);
      setError(null);
      const url = await uploadAvatar(user.id, result.assets[0].uri);
      setUploading(false);
      if (url) setAvatarUrl(url);
      else setError(t.editProfile.uploadError);
    } catch {
      setUploading(false);
      setError(t.editProfile.pickError);
    }
  }

  function handleAvatarPress() {
    if (Platform.OS === 'web') {
      pickFrom('library');
      return;
    }
    Alert.alert(t.editProfile.photoTitle, t.editProfile.photoQuestion, [
      { text: t.editProfile.takePhoto, onPress: () => pickFrom('camera') },
      { text: t.editProfile.chooseGallery, onPress: () => pickFrom('library') },
      { text: t.editProfile.cancel, style: 'cancel' },
    ]);
  }

  async function handleMarkLocation() {
    setLocating(true);
    const loc = await getUserLocation();
    setLat(loc.lat);
    setLng(loc.lng);
    setLocating(false);
  }

  async function handleSave() {
    if (!user) return;
    setSaving(true);
    setError(null);
    const result = await updatePerfil(user.id, {
      nombre: nombre.trim() || undefined,
      telefono: telefono.trim() || undefined,
      cedula: cedula.trim() || undefined,
      direccion: direccion.trim() || undefined,
      avatarUrl: avatarUrl ?? undefined,
      latitud: lat ?? undefined,
      longitud: lng ?? undefined,
    });
    setSaving(false);
    if (!result.ok) {
      setError(result.error ?? t.editProfile.saveError);
      return;
    }
    await refreshPerfil();
    setSaved(true);
    setTimeout(() => router.back(), 700);
  }

  const inputs: Array<{ key: Field; label: string; icon: any; value: string; set: (v: string) => void; keyboard?: 'default' | 'phone-pad' }> = [
    { key: 'nombre', label: t.editProfile.fieldName, icon: User, value: nombre, set: setNombre },
    { key: 'telefono', label: t.editProfile.fieldPhone, icon: Phone, value: telefono, set: setTelefono, keyboard: 'phone-pad' },
    { key: 'cedula', label: t.editProfile.fieldCedula, icon: IdCard, value: cedula, set: setCedula },
    { key: 'direccion', label: t.editProfile.fieldAddress, icon: MapPin, value: direccion, set: setDireccion },
  ];

  return (
    <View style={styles.container}>
      <PillBackground />
      <KeyboardAwareScreen contentContainerStyle={styles.scroll}>
        <PressableScale style={styles.backButton} onPress={() => router.back()} scaleTo={0.9}>
          <ArrowLeft color={theme.colors.textPrimary} size={22} />
        </PressableScale>

        <Reveal variant="up" delay={60}>
          <Text style={styles.title}>{t.editProfile.title}</Text>
          <Text style={styles.subtitle}>{t.editProfile.subtitle}</Text>
        </Reveal>

        {/* Avatar */}
        <Reveal variant="up" delay={100}>
          <View style={styles.avatarWrap}>
            <PressableScale onPress={handleAvatarPress} scaleTo={0.95} style={styles.avatarTouchable}>
              <View style={styles.avatar}>
                {avatarUrl ? (
                  <Image source={{ uri: avatarUrl }} style={styles.avatarImg} />
                ) : (
                  <Text style={styles.avatarInitials}>{initials(nombre, perfil?.email ?? null)}</Text>
                )}
                {uploading && (
                  <View style={styles.avatarOverlay}>
                    <ActivityIndicator color={theme.colors.white} />
                  </View>
                )}
              </View>
              <View style={styles.cameraBadge}>
                <Camera size={16} color={theme.colors.white} />
              </View>
            </PressableScale>
            <Text style={styles.avatarHint}>{t.editProfile.avatarHint}</Text>
          </View>
        </Reveal>

        <View style={styles.form}>
          {inputs.map((f, idx) => (
            <Reveal key={f.key} index={idx + 1} delay={140}>
              <Text style={styles.label}>{f.label}</Text>
              <View style={[styles.inputWrapper, focused === f.key && styles.inputFocused]}>
                <f.icon size={18} color={focused === f.key ? theme.colors.accent : theme.colors.textMuted} />
                <TextInput
                  style={styles.input}
                  value={f.value}
                  onChangeText={f.set}
                  placeholder={f.label}
                  placeholderTextColor={theme.colors.textMuted}
                  keyboardType={f.keyboard ?? 'default'}
                  editable={!saving}
                  onFocus={() => setFocused(f.key)}
                  onBlur={() => setFocused(null)}
                />
              </View>
            </Reveal>
          ))}

          {/* Marcar ubicación en el mapa */}
          <Reveal index={5} delay={220}>
            <PressableScale style={styles.locationButton} onPress={handleMarkLocation} disabled={locating}>
              <MapPinned size={18} color={theme.colors.accent} />
              <Text style={styles.locationButtonText}>
                {locating ? t.editProfile.marking : lat != null && lng != null ? t.editProfile.locationMarked : t.editProfile.markLocation}
              </Text>
            </PressableScale>
            {lat != null && lng != null && (
              <Text style={styles.coordsText}>
                {lat.toFixed(5)}, {lng.toFixed(5)}
              </Text>
            )}
          </Reveal>

          {error && (
            <Reveal variant="fade">
              <Text style={styles.errorText}>{error}</Text>
            </Reveal>
          )}

          <Reveal index={6} delay={280}>
            <PressableScale
              style={[styles.saveButton, (saving || saved) && styles.saveButtonDisabled]}
              onPress={handleSave}
              disabled={saving || saved}
            >
              {saving ? (
                <ActivityIndicator color={theme.colors.white} />
              ) : saved ? (
                <>
                  <Check size={18} color={theme.colors.white} strokeWidth={2.5} />
                  <Text style={styles.saveButtonText}>{t.editProfile.saved}</Text>
                </>
              ) : (
                <Text style={styles.saveButtonText}>{t.editProfile.save}</Text>
              )}
            </PressableScale>
          </Reveal>
        </View>
      </KeyboardAwareScreen>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  scroll: { flexGrow: 1, padding: theme.spacing.xxl, paddingTop: 50 },
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
  title: { ...theme.text.h1, color: theme.colors.textPrimary },
  subtitle: { ...theme.text.body, color: theme.colors.textSecondary, marginTop: 4 },
  avatarWrap: { alignItems: 'center', marginVertical: theme.spacing.xl },
  avatarTouchable: { position: 'relative' },
  avatar: {
    width: 104,
    height: 104,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: theme.colors.surface,
    ...theme.shadow.accent,
  },
  avatarImg: { width: '100%', height: '100%' },
  avatarInitials: { fontFamily: theme.font.bold, fontSize: 36, color: theme.colors.white },
  avatarOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 34,
    height: 34,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.accentDark,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: theme.colors.bg,
  },
  avatarHint: { ...theme.text.caption, color: theme.colors.textSecondary, marginTop: theme.spacing.sm },
  form: { gap: theme.spacing.md },
  label: { ...theme.text.label, color: theme.colors.textSecondary, marginBottom: 6, marginTop: theme.spacing.sm },
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
  inputFocused: { borderColor: theme.colors.accent },
  input: { flex: 1, fontFamily: theme.font.body, fontSize: 15, color: theme.colors.textPrimary, height: '100%' },
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    height: 50,
    borderRadius: theme.radius.pill,
    borderWidth: 1.5,
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.accentSofter,
    marginTop: theme.spacing.sm,
  },
  locationButtonText: { ...theme.text.button, fontFamily: theme.font.semibold, fontSize: 14, color: theme.colors.accent },
  coordsText: { ...theme.text.caption, color: theme.colors.textMuted, textAlign: 'center', marginTop: 6 },
  errorText: { ...theme.text.bodyMedium, fontSize: 13, color: theme.colors.danger, textAlign: 'center' },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius.pill,
    height: 56,
    marginTop: theme.spacing.lg,
    ...theme.shadow.accent,
  },
  saveButtonDisabled: { opacity: 0.8 },
  saveButtonText: { fontFamily: theme.font.bold, fontSize: 16, color: theme.colors.white, letterSpacing: 0.3 },
});
