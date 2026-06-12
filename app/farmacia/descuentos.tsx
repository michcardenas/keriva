import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, ActivityIndicator, Switch, Modal } from 'react-native';
import { ArrowLeft, Plus, Tag, Trash2, X, Search, Pill } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/AuthContext';
import { theme } from '@/lib/theme';
import PressableScale from '@/components/ui/PressableScale';
import PillBackground from '@/components/ui/PillBackground';
import DateField from '@/components/DateField';
import { getSucursales, type Sucursal } from '@/lib/api/sucursales';
import { searchProductos, type ProductoLite } from '@/lib/api/inventario';
import {
  getDescuentos,
  createDescuento,
  updateDescuento,
  toggleDescuentoActivo,
  deleteDescuento,
  type Descuento,
  type DescuentoTipo,
} from '@/lib/api/descuentos';

function fmtDate(iso: string | null): string {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

export default function DescuentosScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { perfil } = useAuth();
  const farmaciaId = perfil?.farmaciaId ?? null;

  const [items, setItems] = useState<Descuento[]>([]);
  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  // Form
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [tipo, setTipo] = useState<DescuentoTipo>('porcentaje');
  const [valor, setValor] = useState('');
  const [sucursalId, setSucursalId] = useState<string | null>(null); // null = todas
  const [producto, setProducto] = useState<ProductoLite | null>(null); // null = todos
  const [desde, setDesde] = useState<string | null>(null);
  const [hasta, setHasta] = useState<string | null>(null);
  const [descripcion, setDescripcion] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Búsqueda de producto
  const [prodQuery, setProdQuery] = useState('');
  const [prodResults, setProdResults] = useState<ProductoLite[]>([]);

  const load = useCallback(async () => {
    if (!farmaciaId) {
      setLoading(false);
      return;
    }
    const [d, s] = await Promise.all([getDescuentos(farmaciaId), getSucursales(farmaciaId)]);
    setItems(d);
    setSucursales(s.filter((x) => x.activa));
    setLoading(false);
  }, [farmaciaId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const h = setTimeout(async () => {
      if (prodQuery.trim().length < 2) return setProdResults([]);
      setProdResults(await searchProductos(prodQuery));
    }, 300);
    return () => clearTimeout(h);
  }, [prodQuery, open]);

  const openCreate = () => {
    setEditId(null);
    setTipo('porcentaje');
    setValor('');
    setSucursalId(null);
    setProducto(null);
    setDesde(null);
    setHasta(null);
    setDescripcion('');
    setProdQuery('');
    setProdResults([]);
    setError(null);
    setOpen(true);
  };

  const handleSave = async () => {
    if (!farmaciaId) return;
    setError(null);
    const v = parseFloat(valor.replace(',', '.'));
    if (!Number.isFinite(v) || v <= 0) return setError('Ingresa un valor mayor a 0.');
    if (tipo === 'porcentaje' && v > 100) return setError('El porcentaje no puede pasar de 100.');
    setSaving(true);
    const input = {
      tipo,
      valor: v,
      sucursalId: sucursalId,
      productoId: producto?.id ?? null,
      descripcion: descripcion || null,
      vigenteDesde: desde ?? undefined,
      vigenteHasta: hasta ?? null,
    };
    const res = editId ? await updateDescuento(editId, input) : await createDescuento(farmaciaId, input);
    setSaving(false);
    if (!res.ok) return setError(res.error ?? 'No se pudo guardar.');
    setOpen(false);
    await load();
  };

  const handleToggle = async (d: Descuento) => {
    await toggleDescuentoActivo(d.id, !d.activo);
    await load();
  };
  const handleDelete = async (id: string) => {
    await deleteDescuento(id);
    setConfirmDelete(null);
    await load();
  };

  const valorLabel = (d: Descuento) => (d.tipo === 'porcentaje' ? `${d.valor}% OFF` : `RD$${d.valor} OFF`);
  const alcance = (d: Descuento) =>
    `${d.sucursalNombre ?? 'Todas las sucursales'} · ${d.productoNombre ?? 'Todos los productos'}`;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <PillBackground opacity={0.55} />
      <View style={styles.header}>
        <PressableScale onPress={() => router.back()} style={styles.iconBtn}>
          <ArrowLeft size={22} color={theme.colors.textPrimary} />
        </PressableScale>
        <Text style={styles.headerTitle}>Descuentos</Text>
        <PressableScale onPress={openCreate} style={styles.iconBtn}>
          <Plus size={22} color={theme.colors.accent} />
        </PressableScale>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={theme.colors.accent} /></View>
      ) : !farmaciaId ? (
        <View style={styles.center}><Text style={styles.muted}>Esta cuenta no es una farmacia.</Text></View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: insets.bottom + 60 }}>
          {items.length === 0 ? (
            <View style={styles.empty}>
              <Tag size={36} color={theme.colors.textMuted} />
              <Text style={styles.muted}>Aún no tienes descuentos.</Text>
              <PressableScale onPress={openCreate} style={styles.emptyBtn}>
                <Plus size={16} color={theme.colors.accentText} />
                <Text style={styles.emptyBtnText}>Crear descuento</Text>
              </PressableScale>
            </View>
          ) : (
            items.map((d) => (
              <View key={d.id} style={[styles.card, !d.activo && { opacity: 0.55 }]}>
                <View style={styles.cardTop}>
                  <View style={styles.tagBadge}><Text style={styles.tagBadgeText}>{valorLabel(d)}</Text></View>
                  <Switch
                    value={d.activo}
                    onValueChange={() => handleToggle(d)}
                    trackColor={{ true: theme.colors.accentSoft, false: theme.colors.border }}
                    thumbColor={d.activo ? theme.colors.accent : '#f4f3f4'}
                  />
                </View>
                <Text style={styles.cardScope}>{alcance(d)}</Text>
                <Text style={styles.cardDates}>
                  Desde {fmtDate(d.vigenteDesde)}{d.vigenteHasta ? ` hasta ${fmtDate(d.vigenteHasta)}` : ' · sin fin'}
                </Text>
                {!!d.descripcion && <Text style={styles.cardDesc}>{d.descripcion}</Text>}
                <View style={styles.cardActions}>
                  {confirmDelete === d.id ? (
                    <PressableScale onPress={() => handleDelete(d.id)} style={styles.delConfirm}>
                      <Text style={styles.delConfirmText}>Eliminar</Text>
                    </PressableScale>
                  ) : (
                    <PressableScale onPress={() => setConfirmDelete(d.id)} style={styles.delBtn}>
                      <Trash2 size={15} color={theme.colors.danger} />
                    </PressableScale>
                  )}
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}

      {/* Modal crear */}
      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.modalHead}>
              <Text style={styles.modalTitle}>Nuevo descuento</Text>
              <PressableScale onPress={() => setOpen(false)} style={styles.iconBtn}>
                <X size={20} color={theme.colors.textSecondary} />
              </PressableScale>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={styles.fieldLabel}>Tipo</Text>
              <View style={styles.segment}>
                <PressableScale onPress={() => setTipo('porcentaje')} style={[styles.segBtn, tipo === 'porcentaje' && styles.segOn]}>
                  <Text style={[styles.segText, tipo === 'porcentaje' && styles.segTextOn]}>Porcentaje %</Text>
                </PressableScale>
                <PressableScale onPress={() => setTipo('monto')} style={[styles.segBtn, tipo === 'monto' && styles.segOn]}>
                  <Text style={[styles.segText, tipo === 'monto' && styles.segTextOn]}>Monto RD$</Text>
                </PressableScale>
              </View>

              <Text style={styles.fieldLabel}>{tipo === 'porcentaje' ? 'Porcentaje (%)' : 'Monto (RD$)'}</Text>
              <TextInput style={styles.input} value={valor} onChangeText={setValor} placeholder={tipo === 'porcentaje' ? '10' : '50.00'} placeholderTextColor={theme.colors.textMuted} keyboardType="decimal-pad" />

              <Text style={styles.fieldLabel}>Aplica a sucursal</Text>
              <PressableScale onPress={() => setSucursalId(null)} style={[styles.radioRow, sucursalId === null && styles.radioOn]}>
                <Text style={styles.radioText}>Todas las sucursales</Text>
              </PressableScale>
              {sucursales.map((s) => (
                <PressableScale key={s.id} onPress={() => setSucursalId(s.id)} style={[styles.radioRow, sucursalId === s.id && styles.radioOn]}>
                  <Text style={styles.radioText} numberOfLines={1}>{s.nombre}</Text>
                </PressableScale>
              ))}

              <Text style={styles.fieldLabel}>Aplica a producto</Text>
              {producto ? (
                <View style={styles.selProd}>
                  <Pill size={16} color={theme.colors.accent} />
                  <Text style={styles.selProdText}>{producto.nombreComercial}</Text>
                  <PressableScale onPress={() => { setProducto(null); setProdQuery(''); }}>
                    <Text style={styles.clearProd}>Quitar</Text>
                  </PressableScale>
                </View>
              ) : (
                <>
                  <View style={styles.searchBar}>
                    <Search size={16} color={theme.colors.textMuted} />
                    <TextInput style={styles.searchInput} value={prodQuery} onChangeText={setProdQuery} placeholder="Todos (o busca un producto)" placeholderTextColor={theme.colors.textMuted} />
                  </View>
                  {prodResults.map((p) => (
                    <PressableScale key={p.id} style={styles.resRow} onPress={() => { setProducto(p); setProdResults([]); }}>
                      <Text style={styles.resName} numberOfLines={1}>{p.nombreComercial}</Text>
                      <Text style={styles.resMeta}>{[p.concentracion, p.presentacion].filter(Boolean).join(' · ')}</Text>
                    </PressableScale>
                  ))}
                </>
              )}

              <Text style={styles.fieldLabel}>Vigencia desde</Text>
              <DateField value={desde} onChange={setDesde} placeholder="Hoy (por defecto)" />
              <Text style={[styles.fieldLabel, { marginTop: theme.spacing.md }]}>Vigencia hasta (opcional)</Text>
              <DateField value={hasta} onChange={setHasta} placeholder="Sin fecha de fin" />

              <Text style={[styles.fieldLabel, { marginTop: theme.spacing.md }]}>Descripción (opcional)</Text>
              <TextInput style={styles.input} value={descripcion} onChangeText={setDescripcion} placeholder="Ej. Promo de temporada" placeholderTextColor={theme.colors.textMuted} />

              {error && <Text style={styles.errorText}>{error}</Text>}

              <PressableScale onPress={handleSave} style={[styles.saveBtn, saving && { opacity: 0.6 }]}>
                <Text style={styles.saveBtnText}>{saving ? 'Guardando…' : 'Crear descuento'}</Text>
              </PressableScale>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border, backgroundColor: theme.colors.surface },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { ...theme.text.h3, color: theme.colors.textPrimary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  muted: { ...theme.text.body, color: theme.colors.textSecondary, textAlign: 'center', marginTop: theme.spacing.md },
  empty: { alignItems: 'center', gap: theme.spacing.md, marginTop: theme.spacing.huge },
  emptyBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: theme.colors.accent, paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.sm, borderRadius: theme.radius.pill },
  emptyBtnText: { ...theme.text.button, color: theme.colors.accentText },

  card: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, padding: theme.spacing.lg, marginBottom: theme.spacing.md, ...theme.shadow.card },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tagBadge: { backgroundColor: theme.colors.accentSoft, paddingHorizontal: theme.spacing.md, paddingVertical: 5, borderRadius: theme.radius.pill },
  tagBadgeText: { ...theme.text.title, color: theme.colors.accentDark },
  cardScope: { ...theme.text.bodyMedium, color: theme.colors.textPrimary, marginTop: theme.spacing.sm },
  cardDates: { ...theme.text.caption, color: theme.colors.textSecondary, marginTop: 2 },
  cardDesc: { ...theme.text.caption, color: theme.colors.textSecondary, marginTop: 4, fontStyle: 'italic' },
  cardActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: theme.spacing.sm },
  delBtn: { width: 32, height: 32, borderRadius: theme.radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.dangerSoft },
  delConfirm: { paddingHorizontal: theme.spacing.md, paddingVertical: 7, borderRadius: theme.radius.pill, backgroundColor: theme.colors.danger },
  delConfirmText: { ...theme.text.label, color: theme.colors.white },

  modalBackdrop: { flex: 1, backgroundColor: theme.colors.overlay, justifyContent: 'flex-end', alignItems: 'center' },
  modalCard: { backgroundColor: theme.colors.bg, borderTopLeftRadius: theme.radius.xl, borderTopRightRadius: theme.radius.xl, padding: theme.spacing.lg, maxHeight: '92%', width: '100%', maxWidth: 480 },
  modalHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: theme.spacing.sm },
  modalTitle: { ...theme.text.h2, color: theme.colors.textPrimary },
  fieldLabel: { ...theme.text.label, color: theme.colors.textSecondary, marginBottom: theme.spacing.xs, marginTop: theme.spacing.sm },
  input: { ...theme.text.body, color: theme.colors.textPrimary, backgroundColor: theme.colors.surface, borderRadius: theme.radius.md, paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.md, borderWidth: 1, borderColor: theme.colors.border },
  segment: { flexDirection: 'row', backgroundColor: theme.colors.bgSecondary, borderRadius: theme.radius.pill, padding: 4 },
  segBtn: { flex: 1, alignItems: 'center', paddingVertical: theme.spacing.sm, borderRadius: theme.radius.pill },
  segOn: { backgroundColor: theme.colors.accent },
  segText: { ...theme.text.button, color: theme.colors.textSecondary },
  segTextOn: { color: theme.colors.accentText },
  radioRow: { paddingVertical: theme.spacing.sm, paddingHorizontal: theme.spacing.md, borderRadius: theme.radius.md, marginTop: 4, borderWidth: 1, borderColor: theme.colors.border },
  radioOn: { borderColor: theme.colors.accent, backgroundColor: theme.colors.accentSofter },
  radioText: { ...theme.text.body, color: theme.colors.textPrimary },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, backgroundColor: theme.colors.surface, borderRadius: theme.radius.md, paddingHorizontal: theme.spacing.md, borderWidth: 1, borderColor: theme.colors.border },
  searchInput: { flex: 1, ...theme.text.body, color: theme.colors.textPrimary, paddingVertical: theme.spacing.md },
  resRow: { paddingVertical: theme.spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border },
  resName: { ...theme.text.title, color: theme.colors.textPrimary },
  resMeta: { ...theme.text.caption, color: theme.colors.textSecondary },
  selProd: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, backgroundColor: theme.colors.accentSofter, borderRadius: theme.radius.md, padding: theme.spacing.md },
  selProdText: { ...theme.text.bodyMedium, color: theme.colors.textPrimary, flex: 1 },
  clearProd: { ...theme.text.label, color: theme.colors.danger },
  errorText: { ...theme.text.caption, color: theme.colors.danger, marginTop: theme.spacing.sm },
  saveBtn: { backgroundColor: theme.colors.accent, borderRadius: theme.radius.pill, paddingVertical: theme.spacing.md, alignItems: 'center', marginTop: theme.spacing.lg, ...theme.shadow.accent },
  saveBtnText: { ...theme.text.button, color: theme.colors.accentText },
});
