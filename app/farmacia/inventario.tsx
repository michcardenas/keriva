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
import { ArrowLeft, Plus, Search, Pill, Trash2, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { theme } from '@/lib/theme';
import PressableScale from '@/components/ui/PressableScale';
import PillBackground from '@/components/ui/PillBackground';
import {
  getInventario,
  searchProductos,
  upsertInventario,
  toggleDisponible,
  deleteInventario,
  type InventarioItem,
  type ProductoLite,
} from '@/lib/api/inventario';

function prodLabel(p: { concentracion: string | null; presentacion: string | null; principioActivo: string | null }): string {
  return [p.concentracion, p.presentacion || p.principioActivo].filter(Boolean).join(' · ');
}

export default function InventarioScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const sucursalId = String(params.sucursalId ?? '');
  const sucursalNombre = typeof params.nombre === 'string' ? params.nombre : 'Sucursal';

  const [items, setItems] = useState<InventarioItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  // Modal de agregar/editar
  const [addOpen, setAddOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ProductoLite[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<ProductoLite | null>(null);
  const [precio, setPrecio] = useState('');
  const [disponible, setDisponible] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!sucursalId) {
      setLoading(false);
      return;
    }
    const data = await getInventario(sucursalId);
    setItems(data);
    setLoading(false);
  }, [sucursalId]);

  useEffect(() => {
    load();
  }, [load]);

  // Búsqueda en el catálogo (debounce)
  useEffect(() => {
    if (!addOpen) return;
    const h = setTimeout(async () => {
      if (query.trim().length < 2) {
        setResults([]);
        return;
      }
      setSearching(true);
      const r = await searchProductos(query);
      setResults(r);
      setSearching(false);
    }, 300);
    return () => clearTimeout(h);
  }, [query, addOpen]);

  const openAdd = () => {
    setSelected(null);
    setQuery('');
    setResults([]);
    setPrecio('');
    setDisponible(true);
    setError(null);
    setAddOpen(true);
  };

  const openEdit = (it: InventarioItem) => {
    if (!it.producto) return;
    setSelected(it.producto);
    setQuery(it.producto.nombreComercial);
    setResults([]);
    setPrecio(it.precio != null ? String(it.precio) : '');
    setDisponible(it.disponible);
    setError(null);
    setAddOpen(true);
  };

  const handleSave = async () => {
    setError(null);
    if (!selected) return setError('Selecciona un producto del catálogo.');
    const precioNum = precio.trim() ? parseFloat(precio.replace(',', '.')) : null;
    if (precio.trim() && (precioNum === null || !Number.isFinite(precioNum) || precioNum < 0)) {
      return setError('Precio inválido.');
    }
    setSaving(true);
    const res = await upsertInventario(sucursalId, selected.id, disponible, precioNum);
    setSaving(false);
    if (!res.ok) return setError(res.error ?? 'No se pudo guardar.');
    setAddOpen(false);
    await load();
  };

  const handleToggle = async (it: InventarioItem) => {
    await toggleDisponible(it.id, !it.disponible);
    await load();
  };

  const handleDelete = async (id: string) => {
    await deleteInventario(id);
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
        <View style={styles.headerTitleBox}>
          <Text style={styles.headerTitle} numberOfLines={1}>Inventario</Text>
          <Text style={styles.headerSub} numberOfLines={1}>{sucursalNombre}</Text>
        </View>
        <PressableScale onPress={openAdd} style={styles.iconBtn}>
          <Plus size={22} color={theme.colors.accent} />
        </PressableScale>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={theme.colors.accent} /></View>
      ) : !sucursalId ? (
        <View style={styles.center}><Text style={styles.muted}>Sucursal no especificada.</Text></View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: insets.bottom + 80 }}>
          {items.length === 0 ? (
            <View style={styles.empty}>
              <Pill size={36} color={theme.colors.textMuted} />
              <Text style={styles.muted}>Esta sucursal aún no tiene productos.</Text>
              <PressableScale onPress={openAdd} style={styles.emptyBtn}>
                <Plus size={16} color={theme.colors.accentText} />
                <Text style={styles.emptyBtnText}>Agregar producto</Text>
              </PressableScale>
            </View>
          ) : (
            items.map((it) => (
              <View key={it.id} style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowName} numberOfLines={1}>{it.producto?.nombreComercial ?? 'Producto'}</Text>
                  {!!it.producto && <Text style={styles.rowMeta} numberOfLines={1}>{prodLabel(it.producto)}</Text>}
                  <Text style={styles.rowPrice}>{it.precio != null ? `RD$${it.precio.toFixed(2)}` : 'Sin precio'}</Text>
                </View>
                <View style={styles.rowRight}>
                  <View style={styles.dispBox}>
                    <Switch
                      value={it.disponible}
                      onValueChange={() => handleToggle(it)}
                      trackColor={{ true: theme.colors.accentSoft, false: theme.colors.border }}
                      thumbColor={it.disponible ? theme.colors.accent : '#f4f3f4'}
                    />
                    <Text style={[styles.dispLabel, { color: it.disponible ? theme.colors.accent : theme.colors.textMuted }]}>
                      {it.disponible ? 'Disponible' : 'Agotado'}
                    </Text>
                  </View>
                  <View style={styles.rowBtns}>
                    <PressableScale onPress={() => openEdit(it)} style={styles.editBtn}>
                      <Text style={styles.editBtnText}>Editar</Text>
                    </PressableScale>
                    {confirmDelete === it.id ? (
                      <PressableScale onPress={() => handleDelete(it.id)} style={styles.delConfirm}>
                        <Text style={styles.delConfirmText}>Quitar</Text>
                      </PressableScale>
                    ) : (
                      <PressableScale onPress={() => setConfirmDelete(it.id)} style={styles.delBtn}>
                        <Trash2 size={15} color={theme.colors.danger} />
                      </PressableScale>
                    )}
                  </View>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}

      {/* Modal agregar/editar */}
      <Modal visible={addOpen} animationType="slide" transparent onRequestClose={() => setAddOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.modalHead}>
              <Text style={styles.modalTitle}>{selected ? 'Producto' : 'Agregar producto'}</Text>
              <PressableScale onPress={() => setAddOpen(false)} style={styles.iconBtn}>
                <X size={20} color={theme.colors.textSecondary} />
              </PressableScale>
            </View>

            {!selected ? (
              <>
                <View style={styles.searchBar}>
                  <Search size={18} color={theme.colors.textMuted} />
                  <TextInput
                    style={styles.searchInput}
                    value={query}
                    onChangeText={setQuery}
                    placeholder="Buscar en el catálogo…"
                    placeholderTextColor={theme.colors.textMuted}
                    autoFocus
                  />
                </View>
                <ScrollView style={{ maxHeight: 320 }} keyboardShouldPersistTaps="handled">
                  {searching ? (
                    <ActivityIndicator color={theme.colors.accent} style={{ marginTop: 20 }} />
                  ) : results.length === 0 && query.trim().length >= 2 ? (
                    <Text style={styles.muted}>Sin resultados en el catálogo.</Text>
                  ) : (
                    results.map((p) => (
                      <PressableScale key={p.id} style={styles.resultRow} onPress={() => setSelected(p)}>
                        <Pill size={16} color={theme.colors.accent} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.resultName} numberOfLines={1}>{p.nombreComercial}</Text>
                          <Text style={styles.resultMeta} numberOfLines={1}>{prodLabel(p)}</Text>
                        </View>
                      </PressableScale>
                    ))
                  )}
                </ScrollView>
              </>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.selectedBox}>
                  <Text style={styles.selectedName}>{selected.nombreComercial}</Text>
                  <Text style={styles.selectedMeta}>{prodLabel(selected)}</Text>
                </View>

                <Text style={styles.fieldLabel}>Precio (RD$)</Text>
                <TextInput
                  style={styles.input}
                  value={precio}
                  onChangeText={setPrecio}
                  placeholder="0.00"
                  placeholderTextColor={theme.colors.textMuted}
                  keyboardType="decimal-pad"
                />

                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>Disponible</Text>
                  <Switch
                    value={disponible}
                    onValueChange={setDisponible}
                    trackColor={{ true: theme.colors.accentSoft, false: theme.colors.border }}
                    thumbColor={disponible ? theme.colors.accent : '#f4f3f4'}
                  />
                </View>

                {error && <Text style={styles.errorText}>{error}</Text>}

                <PressableScale onPress={handleSave} style={[styles.saveBtn, saving && { opacity: 0.6 }]}>
                  <Text style={styles.saveBtnText}>{saving ? 'Guardando…' : 'Guardar'}</Text>
                </PressableScale>
                <PressableScale onPress={() => setSelected(null)} style={styles.changeBtn}>
                  <Text style={styles.changeBtnText}>Cambiar producto</Text>
                </PressableScale>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
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
  headerTitleBox: { flex: 1, alignItems: 'center' },
  headerTitle: { ...theme.text.h3, color: theme.colors.textPrimary },
  headerSub: { ...theme.text.caption, color: theme.colors.textSecondary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: theme.spacing.sm },
  muted: { ...theme.text.body, color: theme.colors.textSecondary, textAlign: 'center', marginTop: theme.spacing.md },
  empty: { alignItems: 'center', gap: theme.spacing.md, marginTop: theme.spacing.huge },
  emptyBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: theme.colors.accent, paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.sm, borderRadius: theme.radius.pill },
  emptyBtnText: { ...theme.text.button, color: theme.colors.accentText },

  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.surface, borderRadius: theme.radius.md, padding: theme.spacing.md, marginBottom: theme.spacing.sm, ...theme.shadow.sm },
  rowName: { ...theme.text.title, color: theme.colors.textPrimary },
  rowMeta: { ...theme.text.caption, color: theme.colors.textSecondary, marginTop: 1 },
  rowPrice: { ...theme.text.bodyMedium, color: theme.colors.accent, marginTop: 3 },
  rowRight: { alignItems: 'flex-end', gap: 6, marginLeft: theme.spacing.sm },
  dispBox: { alignItems: 'center' },
  dispLabel: { ...theme.text.label, marginTop: 1 },
  rowBtns: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  editBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: theme.radius.pill, backgroundColor: theme.colors.accentSofter },
  editBtnText: { ...theme.text.label, color: theme.colors.accent },
  delBtn: { width: 30, height: 30, borderRadius: theme.radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.dangerSoft },
  delConfirm: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: theme.radius.pill, backgroundColor: theme.colors.danger },
  delConfirmText: { ...theme.text.label, color: theme.colors.white },

  modalBackdrop: { flex: 1, backgroundColor: theme.colors.overlay, justifyContent: 'flex-end', alignItems: 'center' },
  modalCard: { backgroundColor: theme.colors.bg, borderTopLeftRadius: theme.radius.xl, borderTopRightRadius: theme.radius.xl, padding: theme.spacing.lg, maxHeight: '88%', width: '100%', maxWidth: 480 },
  modalHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: theme.spacing.md },
  modalTitle: { ...theme.text.h2, color: theme.colors.textPrimary },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, backgroundColor: theme.colors.surface, borderRadius: theme.radius.md, paddingHorizontal: theme.spacing.md, borderWidth: 1, borderColor: theme.colors.border, marginBottom: theme.spacing.sm },
  searchInput: { flex: 1, ...theme.text.body, color: theme.colors.textPrimary, paddingVertical: theme.spacing.md },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, paddingVertical: theme.spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border },
  resultName: { ...theme.text.title, color: theme.colors.textPrimary },
  resultMeta: { ...theme.text.caption, color: theme.colors.textSecondary },
  selectedBox: { backgroundColor: theme.colors.accentSofter, borderRadius: theme.radius.md, padding: theme.spacing.md, marginBottom: theme.spacing.md },
  selectedName: { ...theme.text.h3, color: theme.colors.textPrimary },
  selectedMeta: { ...theme.text.caption, color: theme.colors.textSecondary, marginTop: 2 },
  fieldLabel: { ...theme.text.label, color: theme.colors.textSecondary, marginBottom: theme.spacing.xs },
  input: { ...theme.text.body, color: theme.colors.textPrimary, backgroundColor: theme.colors.surface, borderRadius: theme.radius.md, paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.md, borderWidth: 1, borderColor: theme.colors.border },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: theme.spacing.md },
  switchLabel: { ...theme.text.bodyMedium, color: theme.colors.textPrimary },
  errorText: { ...theme.text.caption, color: theme.colors.danger, marginBottom: theme.spacing.sm },
  saveBtn: { backgroundColor: theme.colors.accent, borderRadius: theme.radius.pill, paddingVertical: theme.spacing.md, alignItems: 'center', marginTop: theme.spacing.sm, ...theme.shadow.accent },
  saveBtnText: { ...theme.text.button, color: theme.colors.accentText },
  changeBtn: { alignItems: 'center', paddingVertical: theme.spacing.md },
  changeBtnText: { ...theme.text.button, color: theme.colors.textSecondary },
});
