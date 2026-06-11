import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, ActivityIndicator, Image } from 'react-native';
import { ArrowLeft, Store, Camera as CameraIcon, Mail } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '@/lib/AuthContext';
import { theme } from '@/lib/theme';
import PressableScale from '@/components/ui/PressableScale';
import PillBackground from '@/components/ui/PillBackground';
import { getMiFarmacia, actualizarCuentaFarmacia } from '@/lib/api/farmacias';
import { uploadAvatar } from '@/lib/api/perfiles';

export default function CuentaFarmaciaScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, perfil } = useAuth();
  const farmaciaId = perfil?.farmaciaId ?? null;

  const [loading, setLoading] = useState(true);
  const [nombre, setNombre] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!farmaciaId) {
      setLoading(false);
      return;
    }
    const f = await getMiFarmacia();
    if (f) {
      setNombre(f.nombre);
      setLogoUrl(f.logoUrl);
    }
    setLoading(false);
  }, [farmaciaId]);

  useEffect(() => {
    load();
  }, [load]);

  const pickLogo = async () => {
    if (!user) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.85 });
    if (result.canceled || !result.assets[0]) return;
    setUploading(true);
    const url = await uploadAvatar(user.id, result.assets[0].uri);
    setUploading(false);
    if (url) setLogoUrl(url);
    else setError('No se pudo subir el logo.');
  };

  const handleSave = async () => {
    setError(null);
    if (!nombre.trim()) return setError('El nombre comercial es obligatorio.');
    setSaving(true);
    const res = await actualizarCuentaFarmacia(nombre, logoUrl);
    setSaving(false);
    if (!res.ok) return setError(res.error ?? 'No se pudo guardar.');
    setToast('Cuenta actualizada');
    setTimeout(() => setToast(null), 2400);
  };

  const inicial = (nombre || 'F').charAt(0).toUpperCase();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <PillBackground opacity={0.55} />
      <View style={styles.header}>
        <PressableScale onPress={() => router.back()} style={styles.iconBtn}>
          <ArrowLeft size={22} color={theme.colors.textPrimary} />
        </PressableScale>
        <Text style={styles.headerTitle}>Perfil de la cuenta</Text>
        <View style={styles.iconBtn} />
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={theme.colors.accent} /></View>
      ) : !farmaciaId ? (
        <View style={styles.center}><Text style={styles.muted}>Esta cuenta no es una farmacia.</Text></View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: insets.bottom + 40 }}>
          {/* Logo */}
          <View style={styles.logoWrap}>
            <PressableScale onPress={pickLogo} style={styles.logoCircle}>
              {logoUrl ? (
                <Image source={{ uri: logoUrl }} style={styles.logoImg} />
              ) : (
                <Text style={styles.logoInicial}>{inicial}</Text>
              )}
              <View style={styles.logoCam}>
                {uploading ? <ActivityIndicator size="small" color={theme.colors.white} /> : <CameraIcon size={16} color={theme.colors.white} />}
              </View>
            </PressableScale>
            <Text style={styles.logoHint}>Toca para cambiar el logo</Text>
          </View>

          <Text style={styles.fieldLabel}>Nombre comercial</Text>
          <View style={styles.inputRow}>
            <Store size={20} color={theme.colors.textMuted} />
            <TextInput
              style={styles.input}
              value={nombre}
              onChangeText={setNombre}
              placeholder="Ej. Farmacia Carol"
              placeholderTextColor={theme.colors.textMuted}
            />
          </View>

          <Text style={styles.fieldLabel}>Correo de la cuenta</Text>
          <View style={[styles.inputRow, styles.readonly]}>
            <Mail size={20} color={theme.colors.textMuted} />
            <Text style={styles.readonlyText}>{user?.email ?? '—'}</Text>
          </View>

          {error && <Text style={styles.errorText}>{error}</Text>}

          <PressableScale onPress={handleSave} style={[styles.saveBtn, saving && { opacity: 0.6 }]}>
            <Text style={styles.saveBtnText}>{saving ? 'Guardando…' : 'Guardar cambios'}</Text>
          </PressableScale>

          <Text style={styles.note}>
            El nombre comercial es la marca que ven los usuarios. Los datos de cada sede (dirección, teléfono, horario) se editan en Sucursales.
          </Text>
        </ScrollView>
      )}

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
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border, backgroundColor: theme.colors.surface },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { ...theme.text.h3, color: theme.colors.textPrimary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  muted: { ...theme.text.body, color: theme.colors.textSecondary, textAlign: 'center' },

  logoWrap: { alignItems: 'center', marginTop: theme.spacing.md, marginBottom: theme.spacing.xl, gap: theme.spacing.sm },
  logoCircle: { width: 104, height: 104, borderRadius: 52, backgroundColor: theme.colors.accent, alignItems: 'center', justifyContent: 'center', ...theme.shadow.card },
  logoImg: { width: 104, height: 104, borderRadius: 52 },
  logoInicial: { fontFamily: theme.font.bold, fontSize: 40, color: theme.colors.accentText },
  logoCam: { position: 'absolute', bottom: 2, right: 2, width: 32, height: 32, borderRadius: 16, backgroundColor: theme.colors.accentDark, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: theme.colors.surface },
  logoHint: { ...theme.text.caption, color: theme.colors.textSecondary },

  fieldLabel: { ...theme.text.label, color: theme.colors.textSecondary, marginBottom: theme.spacing.xs, marginTop: theme.spacing.md },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md, backgroundColor: theme.colors.surface, borderRadius: theme.radius.md, paddingHorizontal: theme.spacing.lg, height: 56, borderWidth: 1.5, borderColor: theme.colors.border },
  input: { flex: 1, ...theme.text.body, color: theme.colors.textPrimary },
  readonly: { backgroundColor: theme.colors.bgSecondary, borderColor: theme.colors.borderLight },
  readonlyText: { flex: 1, ...theme.text.body, color: theme.colors.textSecondary },
  errorText: { ...theme.text.caption, color: theme.colors.danger, marginTop: theme.spacing.md },
  saveBtn: { backgroundColor: theme.colors.accent, borderRadius: theme.radius.pill, paddingVertical: theme.spacing.md, alignItems: 'center', marginTop: theme.spacing.xl, ...theme.shadow.accent },
  saveBtnText: { ...theme.text.button, color: theme.colors.accentText },
  note: { ...theme.text.caption, color: theme.colors.textMuted, marginTop: theme.spacing.lg, lineHeight: 18 },

  toast: { position: 'absolute', alignSelf: 'center', backgroundColor: theme.colors.textPrimary, paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md, borderRadius: theme.radius.pill, ...theme.shadow.md },
  toastText: { ...theme.text.bodyMedium, color: theme.colors.white },
});
