import { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, UserPlus, Users, Trash2, Mail } from 'lucide-react-native';
import { theme } from '@/lib/theme';
import PressableScale from '@/components/ui/PressableScale';
import PillBackground from '@/components/ui/PillBackground';
import {
  getEncargados,
  invitarEncargado,
  quitarEncargado,
  type Encargado,
} from '@/lib/api/encargados';

// =====================================================================
// Gestión de encargados de una sucursal (F4)
// =====================================================================

export default function EncargadosScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ sucursalId?: string; nombre?: string }>();
  const sucursalId = typeof params.sucursalId === 'string' ? params.sucursalId : null;
  const nombre = typeof params.nombre === 'string' ? params.nombre : 'Sucursal';

  const [loading, setLoading] = useState(true);
  const [encargados, setEncargados] = useState<Encargado[]>([]);
  const [email, setEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!sucursalId) { setLoading(false); return; }
    const rows = await getEncargados(sucursalId);
    setEncargados(rows);
    setLoading(false);
  }, [sucursalId]);

  useEffect(() => { load(); }, [load]);

  async function handleInvite() {
    setError(null);
    if (!sucursalId) return;
    const trimmed = email.trim();
    if (!trimmed.includes('@')) {
      setError('Ingresa un correo válido.');
      return;
    }
    setInviting(true);
    const res = await invitarEncargado(sucursalId, trimmed);
    setInviting(false);
    if (!res.ok) {
      setError(res.error ?? 'No se pudo invitar.');
      return;
    }
    setEmail('');
    setToast('Encargado invitado');
    setTimeout(() => setToast(null), 1800);
    await load();
  }

  async function handleRemove(id: string) {
    const res = await quitarEncargado(id);
    if (res.ok) {
      setConfirmDelete(null);
      await load();
    }
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <PillBackground opacity={0.55} />
      <View style={styles.header}>
        <PressableScale onPress={() => router.back()} style={styles.iconBtn}>
          <ArrowLeft size={22} color={theme.colors.textPrimary} />
        </PressableScale>
        <Text style={styles.headerTitle} numberOfLines={1}>Encargados · {nombre}</Text>
        <View style={styles.iconBtn} />
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={theme.colors.accent} /></View>
      ) : !sucursalId ? (
        <View style={styles.center}><Text style={styles.muted}>Sucursal no encontrada.</Text></View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: insets.bottom + 80 }}>
          <View style={styles.tipCard}>
            <Users size={18} color={theme.colors.accent} />
            <Text style={styles.tipText}>
              Los encargados pueden gestionar el inventario, descuentos y reservas de
              esta sucursal. Deben tener una cuenta en Keriva previa.
            </Text>
          </View>

          <Text style={styles.sectionLabel}>Invitar encargado</Text>
          <View style={styles.inviteRow}>
            <View style={styles.inputWrap}>
              <Mail size={16} color={theme.colors.textMuted} />
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="correo@ejemplo.com"
                placeholderTextColor={theme.colors.textMuted}
                autoCapitalize="none"
                keyboardType="email-address"
                onSubmitEditing={handleInvite}
              />
            </View>
            <PressableScale
              style={[styles.inviteBtn, inviting && { opacity: 0.6 }]}
              onPress={handleInvite}
              disabled={inviting}
            >
              {inviting ? (
                <ActivityIndicator size="small" color={theme.colors.accentText} />
              ) : (
                <>
                  <UserPlus size={16} color={theme.colors.accentText} />
                  <Text style={styles.inviteBtnText}>Invitar</Text>
                </>
              )}
            </PressableScale>
          </View>
          {error && <Text style={styles.errorText}>{error}</Text>}

          <Text style={[styles.sectionLabel, { marginTop: theme.spacing.xl }]}>
            Encargados activos ({encargados.length})
          </Text>
          {encargados.length === 0 ? (
            <Text style={styles.empty}>
              Aún no hay encargados. Solo el dueño puede acceder a esta sucursal.
            </Text>
          ) : (
            encargados.map((e) => (
              <View key={e.id} style={styles.row}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarInit}>
                    {(e.nombre ?? e.email ?? '?').slice(0, 1).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowName} numberOfLines={1}>
                    {e.nombre ?? '(sin nombre)'}
                  </Text>
                  <Text style={styles.rowEmail} numberOfLines={1}>
                    {e.email ?? '—'}
                  </Text>
                </View>
                {confirmDelete === e.id ? (
                  <PressableScale style={styles.confirmBtn} onPress={() => handleRemove(e.id)}>
                    <Text style={styles.confirmBtnText}>Quitar</Text>
                  </PressableScale>
                ) : (
                  <PressableScale style={styles.iconAction} onPress={() => setConfirmDelete(e.id)}>
                    <Trash2 size={16} color={theme.colors.danger} />
                  </PressableScale>
                )}
              </View>
            ))
          )}
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
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { ...theme.text.h3, color: theme.colors.textPrimary, flex: 1, textAlign: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  muted: { ...theme.text.body, color: theme.colors.textSecondary, textAlign: 'center' },

  tipCard: {
    flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm,
    backgroundColor: theme.colors.accentSofter, padding: theme.spacing.md,
    borderRadius: theme.radius.md, marginBottom: theme.spacing.lg,
  },
  tipText: { ...theme.text.caption, color: theme.colors.textPrimary, flex: 1, lineHeight: 17 },

  sectionLabel: { ...theme.text.label, color: theme.colors.textSecondary, marginBottom: theme.spacing.sm },

  inviteRow: { flexDirection: 'row', gap: theme.spacing.sm },
  inputWrap: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm,
    backgroundColor: theme.colors.surface, borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md, height: 48,
    borderWidth: 1.2, borderColor: theme.colors.border,
  },
  input: { flex: 1, ...theme.text.body, color: theme.colors.textPrimary },
  inviteBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: theme.colors.accent, paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.radius.md, ...theme.shadow.accent,
  },
  inviteBtnText: { fontFamily: theme.font.bold, fontSize: 13, color: theme.colors.accentText },
  errorText: { ...theme.text.caption, color: theme.colors.danger, marginTop: theme.spacing.sm },

  empty: {
    ...theme.text.caption, color: theme.colors.textMuted, fontStyle: 'italic',
    textAlign: 'center', marginTop: theme.spacing.sm,
  },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md,
    backgroundColor: theme.colors.surface, padding: theme.spacing.md,
    borderRadius: theme.radius.md, marginBottom: theme.spacing.sm,
    borderWidth: 1, borderColor: theme.colors.border,
  },
  avatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: theme.colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarInit: { fontFamily: theme.font.bold, fontSize: 16, color: theme.colors.accentText },
  rowName: { ...theme.text.title, color: theme.colors.textPrimary },
  rowEmail: { ...theme.text.caption, color: theme.colors.textSecondary, marginTop: 2 },
  iconAction: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: theme.colors.dangerSoft,
    alignItems: 'center', justifyContent: 'center',
  },
  confirmBtn: {
    backgroundColor: theme.colors.danger,
    paddingHorizontal: theme.spacing.md, paddingVertical: 8,
    borderRadius: theme.radius.md,
  },
  confirmBtnText: { fontFamily: theme.font.bold, fontSize: 12, color: theme.colors.white },

  toast: {
    position: 'absolute', alignSelf: 'center',
    backgroundColor: theme.colors.textPrimary,
    paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.pill, ...theme.shadow.md,
  },
  toastText: { ...theme.text.bodyMedium, color: theme.colors.white },
});
