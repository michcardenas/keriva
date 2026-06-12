import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Switch,
  Modal,
} from 'react-native';
import { ArrowLeft, Plus, Store, MapPin, Phone, Clock, Pencil, Trash2, X, Crosshair, Upload, Tag, Users } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/AuthContext';
import { theme } from '@/lib/theme';
import PressableScale from '@/components/ui/PressableScale';
import PillBackground from '@/components/ui/PillBackground';
import { getUserLocation } from '@/lib/location';
import {
  getSucursales,
  createSucursal,
  updateSucursal,
  toggleSucursalActiva,
  deleteSucursal,
  type Sucursal,
  type SucursalInput,
} from '@/lib/api/sucursales';

type FormState = SucursalInput & { id?: string };

const EMPTY_FORM: FormState = {
  nombre: '',
  direccion: '',
  ciudad: '',
  telefono: '',
  whatsapp: '',
  horario: '',
  latitud: null,
  longitud: null,
  esPrincipal: false,
};

export default function SucursalesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { perfil } = useAuth();
  const farmaciaId = perfil?.farmaciaId ?? null;

  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);

  const load = useCallback(async () => {
    if (!farmaciaId) {
      setLoading(false);
      return;
    }
    const data = await getSucursales(farmaciaId);
    setSucursales(data);
    setLoading(false);
  }, [farmaciaId]);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setError(null);
    setFormOpen(true);
  };
  const openEdit = (s: Sucursal) => {
    setForm({
      id: s.id,
      nombre: s.nombre,
      direccion: s.direccion,
      ciudad: s.ciudad ?? '',
      telefono: s.telefono ?? '',
      whatsapp: s.whatsapp ?? '',
      horario: s.horario ?? '',
      latitud: s.latitud,
      longitud: s.longitud,
      esPrincipal: s.esPrincipal,
    });
    setError(null);
    setFormOpen(true);
  };

  const setField = (k: keyof FormState, v: string | boolean) =>
    setForm((f) => ({ ...f, [k]: v }));

  const useMyLocation = async () => {
    setLocating(true);
    try {
      const loc = await getUserLocation();
      setForm((f) => ({ ...f, latitud: loc.lat, longitud: loc.lng }));
    } finally {
      setLocating(false);
    }
  };

  const handleSave = async () => {
    if (!farmaciaId) return;
    setError(null);
    if (!form.nombre?.trim()) return setError('El nombre es obligatorio.');
    if (!form.direccion?.trim()) return setError('La dirección es obligatoria.');
    setSaving(true);
    const payload: SucursalInput = {
      nombre: form.nombre,
      direccion: form.direccion,
      ciudad: form.ciudad || null,
      telefono: form.telefono || null,
      whatsapp: form.whatsapp || null,
      horario: form.horario || null,
      latitud: form.latitud ?? null,
      longitud: form.longitud ?? null,
      esPrincipal: form.esPrincipal,
    };
    const res = form.id
      ? await updateSucursal(form.id, payload)
      : await createSucursal(farmaciaId, payload);
    setSaving(false);
    if (!res.ok) return setError(res.error ?? 'No se pudo guardar.');
    setFormOpen(false);
    await load();
  };

  const handleToggle = async (s: Sucursal) => {
    await toggleSucursalActiva(s.id, !s.activa);
    await load();
  };

  const handleDelete = async (id: string) => {
    await deleteSucursal(id);
    setConfirmDelete(null);
    await load();
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <PillBackground opacity={0.55} />
      <View style={styles.header}>
        <PressableScale onPress={() => router.back()} style={styles.iconBtn}>
          <ArrowLeft size={22} color={theme.colors.textPrimary} />
        </PressableScale>
        <Text style={styles.headerTitle}>Mis sucursales</Text>
        <PressableScale onPress={openCreate} style={styles.iconBtn}>
          <Plus size={22} color={theme.colors.accent} />
        </PressableScale>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.accent} />
        </View>
      ) : !farmaciaId ? (
        <View style={styles.center}>
          <Text style={styles.muted}>Esta cuenta no es una farmacia.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: insets.bottom + 80 }}>
          {sucursales.length > 0 && (
            <View style={styles.toolsRow}>
              <PressableScale onPress={() => router.push('/farmacia/carga-masiva')} style={styles.toolBtn}>
                <Upload size={16} color={theme.colors.accent} />
                <Text style={styles.toolBtnText}>Carga masiva</Text>
              </PressableScale>
              <PressableScale onPress={() => router.push('/farmacia/descuentos')} style={styles.toolBtn}>
                <Tag size={16} color={theme.colors.accent} />
                <Text style={styles.toolBtnText}>Descuentos</Text>
              </PressableScale>
            </View>
          )}
          {sucursales.length === 0 ? (
            <View style={styles.empty}>
              <Store size={36} color={theme.colors.textMuted} />
              <Text style={styles.muted}>Aún no tienes sucursales.</Text>
              <PressableScale onPress={openCreate} style={styles.emptyBtn}>
                <Plus size={16} color={theme.colors.accentText} />
                <Text style={styles.emptyBtnText}>Agregar sucursal</Text>
              </PressableScale>
            </View>
          ) : (
            sucursales.map((s) => (
              <View key={s.id} style={[styles.card, !s.activa && styles.cardInactive]}>
                <View style={styles.cardHead}>
                  <Text style={styles.cardName} numberOfLines={1}>{s.nombre}</Text>
                  {s.esPrincipal && (
                    <View style={styles.badge}><Text style={styles.badgeText}>Principal</Text></View>
                  )}
                </View>
                <View style={styles.cardRow}>
                  <MapPin size={14} color={theme.colors.textSecondary} />
                  <Text style={styles.cardText} numberOfLines={2}>{s.direccion}{s.ciudad ? ` · ${s.ciudad}` : ''}</Text>
                </View>
                {!!s.telefono && (
                  <View style={styles.cardRow}>
                    <Phone size={14} color={theme.colors.textSecondary} />
                    <Text style={styles.cardText}>{s.telefono}</Text>
                  </View>
                )}
                {!!s.horario && (
                  <View style={styles.cardRow}>
                    <Clock size={14} color={theme.colors.textSecondary} />
                    <Text style={styles.cardText}>{s.horario}</Text>
                  </View>
                )}
                <View style={styles.cardActions}>
                  <View style={styles.activaRow}>
                    <Switch
                      value={s.activa}
                      onValueChange={() => handleToggle(s)}
                      trackColor={{ true: theme.colors.accentSoft, false: theme.colors.border }}
                      thumbColor={s.activa ? theme.colors.accent : '#f4f3f4'}
                    />
                    <Text style={styles.activaLabel}>{s.activa ? 'Activa' : 'Inactiva'}</Text>
                  </View>
                  <View style={styles.actionBtns}>
                    <PressableScale
                      onPress={() =>
                        router.push({
                          pathname: '/farmacia/inventario',
                          params: { sucursalId: s.id, nombre: s.nombre },
                        })
                      }
                      style={styles.invBtn}
                    >
                      <Text style={styles.invBtnText}>Inventario</Text>
                    </PressableScale>
                    <PressableScale
                      onPress={() => router.push({
                        pathname: '/farmacia/horarios' as any,
                        params: { sucursalId: s.id, nombre: s.nombre },
                      })}
                      style={styles.actionBtn}
                    >
                      <Clock size={16} color={theme.colors.accent} />
                    </PressableScale>
                    <PressableScale
                      onPress={() => router.push({
                        pathname: '/farmacia/encargados' as any,
                        params: { sucursalId: s.id, nombre: s.nombre },
                      })}
                      style={styles.actionBtn}
                    >
                      <Users size={16} color={theme.colors.accent} />
                    </PressableScale>
                    <PressableScale onPress={() => openEdit(s)} style={styles.actionBtn}>
                      <Pencil size={16} color={theme.colors.accent} />
                    </PressableScale>
                    {confirmDelete === s.id ? (
                      <PressableScale onPress={() => handleDelete(s.id)} style={[styles.actionBtn, styles.delConfirm]}>
                        <Text style={styles.delConfirmText}>Eliminar</Text>
                      </PressableScale>
                    ) : (
                      <PressableScale onPress={() => setConfirmDelete(s.id)} style={[styles.actionBtn, styles.delBtn]}>
                        <Trash2 size={16} color={theme.colors.danger} />
                      </PressableScale>
                    )}
                  </View>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}

      {/* Formulario crear/editar */}
      <Modal visible={formOpen} animationType="slide" transparent onRequestClose={() => setFormOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.modalHead}>
              <Text style={styles.modalTitle}>{form.id ? 'Editar sucursal' : 'Nueva sucursal'}</Text>
              <PressableScale onPress={() => setFormOpen(false)} style={styles.iconBtn}>
                <X size={20} color={theme.colors.textSecondary} />
              </PressableScale>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Field label="Nombre *" value={form.nombre} onChange={(v) => setField('nombre', v)} placeholder="Ej. Sucursal Centro" />
              <Field label="Dirección *" value={form.direccion} onChange={(v) => setField('direccion', v)} placeholder="Calle, número, sector" />
              <Field label="Ciudad" value={form.ciudad ?? ''} onChange={(v) => setField('ciudad', v)} placeholder="Santiago" />
              <Field label="Teléfono" value={form.telefono ?? ''} onChange={(v) => setField('telefono', v)} placeholder="809-000-0000" keyboardType="phone-pad" />
              <Field label="WhatsApp" value={form.whatsapp ?? ''} onChange={(v) => setField('whatsapp', v)} placeholder="809-000-0000" keyboardType="phone-pad" />
              <Field label="Horario" value={form.horario ?? ''} onChange={(v) => setField('horario', v)} placeholder="Lun-Sáb 8:00am - 8:00pm" />

              <PressableScale onPress={useMyLocation} style={styles.locBtn}>
                <Crosshair size={16} color={theme.colors.accent} />
                <Text style={styles.locBtnText}>
                  {form.latitud != null ? 'Ubicación marcada ✓' : locating ? 'Obteniendo…' : 'Usar mi ubicación actual'}
                </Text>
              </PressableScale>

              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Sucursal principal</Text>
                <Switch
                  value={!!form.esPrincipal}
                  onValueChange={(v) => setField('esPrincipal', v)}
                  trackColor={{ true: theme.colors.accentSoft, false: theme.colors.border }}
                  thumbColor={form.esPrincipal ? theme.colors.accent : '#f4f3f4'}
                />
              </View>

              {error && <Text style={styles.errorText}>{error}</Text>}

              <PressableScale onPress={handleSave} style={[styles.saveBtn, saving && { opacity: 0.6 }]}>
                <Text style={styles.saveBtnText}>{saving ? 'Guardando…' : form.id ? 'Guardar cambios' : 'Crear sucursal'}</Text>
              </PressableScale>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function Field({ label, value, onChange, placeholder, keyboardType }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; keyboardType?: 'default' | 'phone-pad' }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.textMuted}
        keyboardType={keyboardType ?? 'default'}
      />
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
  headerTitle: { ...theme.text.h3, color: theme.colors.textPrimary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: theme.spacing.sm },
  muted: { ...theme.text.body, color: theme.colors.textSecondary, textAlign: 'center' },
  empty: { alignItems: 'center', gap: theme.spacing.md, marginTop: theme.spacing.huge },
  emptyBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: theme.colors.accent, paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.sm, borderRadius: theme.radius.pill },
  emptyBtnText: { ...theme.text.button, color: theme.colors.accentText },

  card: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, padding: theme.spacing.lg, marginBottom: theme.spacing.md, ...theme.shadow.card },
  cardInactive: { opacity: 0.6 },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: theme.spacing.sm },
  cardName: { ...theme.text.h3, color: theme.colors.textPrimary, flex: 1 },
  badge: { backgroundColor: theme.colors.accentSoft, paddingHorizontal: 8, paddingVertical: 3, borderRadius: theme.radius.pill },
  badgeText: { ...theme.text.label, color: theme.colors.accentDark },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, marginTop: 4 },
  cardText: { ...theme.text.body, color: theme.colors.textSecondary, flex: 1 },
  cardActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: theme.spacing.md, paddingTop: theme.spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.border },
  activaRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  activaLabel: { ...theme.text.caption, color: theme.colors.textSecondary },
  actionBtns: { flexDirection: 'row', gap: theme.spacing.sm, alignItems: 'center' },
  invBtn: { paddingHorizontal: theme.spacing.md, height: 38, borderRadius: theme.radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.accent },
  invBtnText: { ...theme.text.label, color: theme.colors.accentText },
  toolsRow: { flexDirection: 'row', gap: theme.spacing.md, marginBottom: theme.spacing.md },
  toolBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1.5, borderColor: theme.colors.accent, borderRadius: theme.radius.pill, paddingVertical: theme.spacing.md, backgroundColor: theme.colors.surface },
  toolBtnText: { ...theme.text.button, color: theme.colors.accent, fontSize: 13 },
  actionBtn: { width: 38, height: 38, borderRadius: theme.radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.accentSofter },
  delBtn: { backgroundColor: theme.colors.dangerSoft },
  delConfirm: { width: 'auto', paddingHorizontal: theme.spacing.md, backgroundColor: theme.colors.danger },
  delConfirmText: { ...theme.text.button, color: theme.colors.white, fontSize: 12 },

  modalBackdrop: { flex: 1, backgroundColor: theme.colors.overlay, justifyContent: 'flex-end', alignItems: 'center' },
  modalCard: { backgroundColor: theme.colors.bg, borderTopLeftRadius: theme.radius.xl, borderTopRightRadius: theme.radius.xl, padding: theme.spacing.lg, maxHeight: '90%', width: '100%', maxWidth: 480 },
  modalHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: theme.spacing.md },
  modalTitle: { ...theme.text.h2, color: theme.colors.textPrimary },
  field: { marginBottom: theme.spacing.md },
  fieldLabel: { ...theme.text.label, color: theme.colors.textSecondary, marginBottom: theme.spacing.xs },
  input: { ...theme.text.body, color: theme.colors.textPrimary, backgroundColor: theme.colors.surface, borderRadius: theme.radius.md, paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.md, borderWidth: 1, borderColor: theme.colors.border },
  locBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: theme.colors.accentSofter, paddingVertical: theme.spacing.md, borderRadius: theme.radius.md, marginBottom: theme.spacing.md },
  locBtnText: { ...theme.text.button, color: theme.colors.accent },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: theme.spacing.sm, marginBottom: theme.spacing.sm },
  switchLabel: { ...theme.text.bodyMedium, color: theme.colors.textPrimary },
  errorText: { ...theme.text.caption, color: theme.colors.danger, marginBottom: theme.spacing.sm },
  saveBtn: { backgroundColor: theme.colors.accent, borderRadius: theme.radius.pill, paddingVertical: theme.spacing.md, alignItems: 'center', marginTop: theme.spacing.sm, ...theme.shadow.accent },
  saveBtnText: { ...theme.text.button, color: theme.colors.accentText },
});
