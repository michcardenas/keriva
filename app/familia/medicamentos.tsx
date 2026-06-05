import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
  Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import {
  ArrowLeft,
  Plus,
  Pill,
  Trash2,
  Clock,
  Search,
  X,
  ShieldCheck,
  Lock,
} from 'lucide-react-native';
import { useAuth } from '@/lib/AuthContext';
import AuthRequiredPlaceholder from '@/components/AuthRequiredPlaceholder';
import DisclaimerModal from '@/components/DisclaimerModal';
import { getPerfilFamilia, type KerivaPerfil } from '@/lib/api/familia';
import {
  addMedicamento,
  labelFrecuencia,
  listMedicamentosByPerfil,
  softDeleteMedicamento,
  FRECUENCIA_OPTIONS,
  type CareMedicamentoWithProducto,
  type FrecuenciaTipo,
} from '@/lib/api/care';
import {
  listProductosPediatricos,
  type ProductoPediatrico,
} from '@/lib/api/dosis';
import { hasActiveDisclaimer } from '@/lib/api/disclaimer';

function webConfirm(message: string): boolean {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return window.confirm(message);
  }
  return true;
}

export default function MedicamentosScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const params = useLocalSearchParams<{ perfilId?: string }>();
  const perfilId = typeof params.perfilId === 'string' ? params.perfilId : undefined;

  const [perfil, setPerfil] = useState<KerivaPerfil | null>(null);
  const [meds, setMeds] = useState<CareMedicamentoWithProducto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add medication modal
  const [addOpen, setAddOpen] = useState(false);
  const [productos, setProductos] = useState<ProductoPediatrico[]>([]);
  const [searchText, setSearchText] = useState('');
  const [selectedProd, setSelectedProd] = useState<ProductoPediatrico | null>(null);
  const [frecuenciaTipo, setFrecuenciaTipo] = useState<FrecuenciaTipo>('diaria');
  const [frecuenciaValor, setFrecuenciaValor] = useState('1');
  const [submitting, setSubmitting] = useState(false);

  // Disclaimer modal (solo perfiles pediátricos)
  const [needsDisclaimer, setNeedsDisclaimer] = useState(false);
  const [disclaimerOpen, setDisclaimerOpen] = useState(false);

  const load = useCallback(async () => {
    if (!perfilId) return;
    setError(null);
    try {
      const [p, m] = await Promise.all([
        getPerfilFamilia(perfilId),
        listMedicamentosByPerfil(perfilId),
      ]);
      setPerfil(p);
      setMeds(m);

      // Si es pediátrico, verificar disclaimer (no es bloqueante para ver/listar,
      // sí lo es antes de agregar un medicamento)
      if (p && p.tipoPerfil === 'dependiente_pediatrico') {
        const has = await hasActiveDisclaimer(perfilId, 'pediatrico');
        setNeedsDisclaimer(!has);
      } else {
        setNeedsDisclaimer(false);
      }
    } catch (e: any) {
      setError(e?.message ?? 'No se pudo cargar');
    } finally {
      setLoading(false);
    }
  }, [perfilId]);

  useEffect(() => {
    if (session && perfilId) load();
    else setLoading(false);
  }, [session, perfilId, load]);

  useFocusEffect(
    useCallback(() => {
      if (session && perfilId) load();
    }, [session, perfilId, load]),
  );

  // Cargar productos cuando se abre el modal de "agregar"
  useEffect(() => {
    if (!addOpen) return;
    let cancelled = false;
    (async () => {
      const list = await listProductosPediatricos(searchText);
      if (!cancelled) setProductos(list);
    })();
    return () => {
      cancelled = true;
    };
  }, [addOpen, searchText]);

  const openAddFlow = useCallback(() => {
    if (!perfil) return;
    // Si pediátrico y no aceptó disclaimer, mostrarlo primero (bloqueante)
    if (perfil.tipoPerfil === 'dependiente_pediatrico' && needsDisclaimer) {
      setDisclaimerOpen(true);
      return;
    }
    setSearchText('');
    setSelectedProd(null);
    setFrecuenciaTipo('diaria');
    setFrecuenciaValor('1');
    setAddOpen(true);
  }, [perfil, needsDisclaimer]);

  const onDisclaimerAccept = useCallback(() => {
    setDisclaimerOpen(false);
    setNeedsDisclaimer(false);
    // Continúa al flujo de agregar
    setSearchText('');
    setSelectedProd(null);
    setFrecuenciaTipo('diaria');
    setFrecuenciaValor('1');
    setAddOpen(true);
  }, []);

  const onSubmitAdd = useCallback(async () => {
    if (!perfil || !selectedProd) return;
    setSubmitting(true);
    try {
      const valor = Number(frecuenciaValor);
      const res = await addMedicamento({
        perfilId: perfil.id,
        perfilTipo: perfil.tipoPerfil,
        skuId: selectedProd.skuId,
        nombreDisplay: selectedProd.nombreComercial,
        frecuenciaTipo,
        frecuenciaValor: Number.isFinite(valor) && valor > 0 ? valor : 1,
        horasToma: [],
      });
      if (!res.ok) {
        Alert.alert('Error', res.error ?? 'No se pudo agregar');
        return;
      }
      setAddOpen(false);
      await load();
    } finally {
      setSubmitting(false);
    }
  }, [perfil, selectedProd, frecuenciaTipo, frecuenciaValor, load]);

  const handleDelete = useCallback(
    (med: CareMedicamentoWithProducto) => {
      const msg = `¿Eliminar ${med.nombreDisplay}? Dejarás de recibir recordatorios.`;
      const proceed = async () => {
        const res = await softDeleteMedicamento(med.id);
        if (!res.ok) {
          Alert.alert('Error', res.error ?? 'No se pudo eliminar');
          return;
        }
        await load();
      };
      if (Platform.OS === 'web') {
        if (webConfirm(msg)) proceed();
      } else {
        Alert.alert('Eliminar medicamento', msg, [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Eliminar', style: 'destructive', onPress: proceed },
        ]);
      }
    },
    [load],
  );

  const tituloHeader = useMemo(() => {
    if (!perfil) return 'Medicamentos';
    return `Medicamentos · ${perfil.nombre}`;
  }, [perfil]);

  if (!session) {
    return (
      <AuthRequiredPlaceholder
        icon={<Lock size={48} color="#34C26A" />}
        title="Inicia sesión"
        description="Necesitas iniciar sesión para gestionar medicamentos."
      />
    );
  }

  return (
    <LinearGradient colors={['#052419', '#106B4F', '#052419']} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={20} color="#FFFFFF" />
        </TouchableOpacity>

        <View style={styles.header}>
          <View style={styles.heroIcon}>
            <Pill size={28} color="#34C26A" />
          </View>
          <Text style={styles.title}>{tituloHeader}</Text>
          <Text style={styles.subtitle}>
            Medicamentos crónicos para que Keriva te recuerde la toma a la hora indicada.
          </Text>
        </View>

        {loading ? (
          <ActivityIndicator color="#34C26A" style={{ marginTop: 40 }} />
        ) : error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : !perfil ? (
          <Text style={styles.errorText}>Perfil no encontrado</Text>
        ) : (
          <>
            {perfil.tipoPerfil === 'dependiente_pediatrico' && (
              <View
                style={[
                  styles.legalBanner,
                  needsDisclaimer ? styles.legalBannerPending : styles.legalBannerOk,
                ]}
              >
                <ShieldCheck
                  size={16}
                  color={needsDisclaimer ? '#E65100' : '#106B4F'}
                />
                <Text
                  style={[
                    styles.legalBannerText,
                    { color: needsDisclaimer ? '#E65100' : '#106B4F' },
                  ]}
                >
                  {needsDisclaimer
                    ? 'Antes de agregar medicamentos para un perfil pediátrico debes aceptar el aviso médico.'
                    : 'Aviso médico aceptado (kids_v1.0)'}
                </Text>
              </View>
            )}

            {meds.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyEmoji}>💊</Text>
                <Text style={styles.emptyTitle}>Sin medicamentos aún</Text>
                <Text style={styles.emptyText}>
                  Agrega el primer medicamento para empezar a recibir recordatorios.
                </Text>
              </View>
            ) : (
              meds.map((m) => (
                <View key={m.id} style={styles.medCard}>
                  <View style={styles.medCardLeft}>
                    <Pill size={20} color="#34C26A" />
                  </View>
                  <View style={styles.medCardMain}>
                    <Text style={styles.medName}>{m.nombreDisplay}</Text>
                    {m.productoPresentacion ? (
                      <Text style={styles.medPresentacion}>
                        {m.productoPresentacion}
                      </Text>
                    ) : null}
                    <View style={styles.medMetaRow}>
                      <Clock size={12} color="rgba(255,255,255,0.6)" />
                      <Text style={styles.medMetaText}>
                        {labelFrecuencia(m.frecuenciaTipo, m.frecuenciaValor)}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.deleteBtn}
                    onPress={() => handleDelete(m)}
                  >
                    <Trash2 size={16} color="#FF6B6B" />
                  </TouchableOpacity>
                </View>
              ))
            )}

            <TouchableOpacity style={styles.addButton} onPress={openAddFlow}>
              <Plus size={18} color="#106B4F" />
              <Text style={styles.addButtonText}>Agregar medicamento</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>

      {/* Modal: Agregar medicamento */}
      <Modal
        visible={addOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setAddOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Agregar medicamento</Text>
              <TouchableOpacity onPress={() => setAddOpen(false)}>
                <X size={22} color="#052419" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 480 }} contentContainerStyle={{ padding: 16 }}>
              <Text style={styles.modalLabel}>Medicamento</Text>
              <View style={styles.modalInputWrap}>
                <Search size={16} color="#6B7280" />
                <TextInput
                  style={styles.modalInput}
                  placeholder="Buscar por nombre o principio activo"
                  placeholderTextColor="#9CA3AF"
                  value={searchText}
                  onChangeText={setSearchText}
                />
              </View>

              <View style={styles.productsList}>
                {productos.length === 0 ? (
                  <Text style={styles.modalHint}>
                    No hay productos con dosis registrada. Pide al equipo de Keriva que
                    pueble la tabla `dosis_pediatricas`.
                  </Text>
                ) : (
                  productos.map((p) => (
                    <TouchableOpacity
                      key={p.skuId}
                      style={[
                        styles.productItem,
                        selectedProd?.skuId === p.skuId && styles.productItemActive,
                      ]}
                      onPress={() => setSelectedProd(p)}
                    >
                      <Text
                        style={[
                          styles.productName,
                          selectedProd?.skuId === p.skuId && styles.productNameActive,
                        ]}
                      >
                        {p.nombreComercial}
                      </Text>
                      {p.principioActivo ? (
                        <Text style={styles.productMeta}>{p.principioActivo}</Text>
                      ) : null}
                      {p.presentacion ? (
                        <Text style={styles.productMeta}>{p.presentacion}</Text>
                      ) : null}
                    </TouchableOpacity>
                  ))
                )}
              </View>

              <Text style={styles.modalLabel}>Frecuencia</Text>
              <View style={styles.frecRow}>
                {FRECUENCIA_OPTIONS.map(({ key, label }) => (
                  <TouchableOpacity
                    key={key}
                    style={[
                      styles.frecChip,
                      frecuenciaTipo === key && styles.frecChipActive,
                    ]}
                    onPress={() => setFrecuenciaTipo(key)}
                  >
                    <Text
                      style={[
                        styles.frecChipText,
                        frecuenciaTipo === key && styles.frecChipTextActive,
                      ]}
                    >
                      {label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.modalLabel}>
                {frecuenciaTipo === 'horas'
                  ? 'Cada cuántas horas'
                  : frecuenciaTipo === 'semanal'
                  ? 'Veces por semana'
                  : 'Veces al día'}
              </Text>
              <View style={styles.modalInputWrap}>
                <TextInput
                  style={styles.modalInput}
                  keyboardType="number-pad"
                  value={frecuenciaValor}
                  onChangeText={setFrecuenciaValor}
                  maxLength={3}
                />
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setAddOpen(false)}
                disabled={submitting}
              >
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalSubmit,
                  (!selectedProd || submitting) && { opacity: 0.5 },
                ]}
                disabled={!selectedProd || submitting}
                onPress={onSubmitAdd}
              >
                {submitting ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalSubmitText}>Agregar</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Disclaimer médico bloqueante */}
      {perfil ? (
        <DisclaimerModal
          visible={disclaimerOpen}
          tipo="pediatrico"
          perfilId={perfil.id}
          perfilNombre={perfil.nombre}
          onAccept={onDisclaimerAccept}
          onCancel={() => setDisclaimerOpen(false)}
        />
      ) : null}
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
  heroIcon: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: 'rgba(52, 194, 106, 0.15)',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 6,
  },
  title: { fontFamily: 'Poppins-Bold', fontSize: 22, color: '#FFFFFF', textAlign: 'center' },
  subtitle: { fontFamily: 'DMSans-Regular', fontSize: 13, color: 'rgba(255,255,255,0.7)', textAlign: 'center', lineHeight: 19, paddingHorizontal: 8 },
  legalBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    padding: 12, borderRadius: 10, marginBottom: 12,
  },
  legalBannerOk: { backgroundColor: '#E8F5E9', borderWidth: 1, borderColor: '#C8E6C9' },
  legalBannerPending: { backgroundColor: '#FFF3E0', borderWidth: 1, borderColor: '#FFE0B2' },
  legalBannerText: { flex: 1, fontFamily: 'DMSans-Medium', fontSize: 12, lineHeight: 17 },
  emptyBox: { alignItems: 'center', paddingVertical: 30, gap: 6 },
  emptyEmoji: { fontSize: 40 },
  emptyTitle: { fontFamily: 'Poppins-SemiBold', fontSize: 16, color: '#FFFFFF' },
  emptyText: { fontFamily: 'DMSans-Regular', fontSize: 13, color: 'rgba(255,255,255,0.6)', textAlign: 'center' },
  medCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 14,
    padding: 12, marginBottom: 10,
    borderWidth: 1, borderColor: 'rgba(52, 194, 106, 0.15)',
  },
  medCardLeft: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(52, 194, 106, 0.15)',
    justifyContent: 'center', alignItems: 'center',
  },
  medCardMain: { flex: 1, gap: 3 },
  medName: { fontFamily: 'Poppins-SemiBold', fontSize: 15, color: '#FFFFFF' },
  medPresentacion: { fontFamily: 'DMSans-Regular', fontSize: 12, color: 'rgba(255,255,255,0.6)' },
  medMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  medMetaText: { fontFamily: 'DMSans-Medium', fontSize: 12, color: 'rgba(255,255,255,0.6)' },
  deleteBtn: {
    width: 36, height: 36, borderRadius: 18,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(255,107,107,0.1)',
    borderWidth: 1, borderColor: 'rgba(255,107,107,0.3)',
  },
  addButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#FFFFFF', borderRadius: 12,
    paddingVertical: 14, marginTop: 8,
  },
  addButtonText: { fontFamily: 'Poppins-Bold', fontSize: 15, color: '#106B4F' },
  errorText: { fontFamily: 'DMSans-Medium', fontSize: 13, color: '#FF6B6B', textAlign: 'center', marginTop: 12 },

  // Modal
  modalBackdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingBottom: 16,
  },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
  },
  modalTitle: { fontFamily: 'Poppins-Bold', fontSize: 18, color: '#052419' },
  modalLabel: {
    fontFamily: 'DMSans-Bold', fontSize: 12, color: '#106B4F',
    marginTop: 12, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1,
  },
  modalInputWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10,
    paddingHorizontal: 12, height: 44, backgroundColor: '#F9FAFB',
  },
  modalInput: { flex: 1, fontFamily: 'DMSans-Regular', fontSize: 14, color: '#052419' },
  modalHint: { fontFamily: 'DMSans-Regular', fontSize: 12, color: '#6B7280', padding: 8 },
  productsList: { marginTop: 8, gap: 6 },
  productItem: {
    padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  productItemActive: { backgroundColor: '#E8F5E9', borderColor: '#34C26A' },
  productName: { fontFamily: 'Poppins-SemiBold', fontSize: 14, color: '#052419' },
  productNameActive: { color: '#106B4F' },
  productMeta: { fontFamily: 'DMSans-Regular', fontSize: 12, color: '#6B7280', marginTop: 2 },
  frecRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  frecChip: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8,
    backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB',
  },
  frecChipActive: { backgroundColor: '#106B4F', borderColor: '#106B4F' },
  frecChipText: { fontFamily: 'DMSans-Bold', fontSize: 13, color: '#374151' },
  frecChipTextActive: { color: '#FFFFFF' },
  modalFooter: {
    flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: '#F0F0F0',
  },
  modalCancel: {
    flex: 1, paddingVertical: 14, borderRadius: 10,
    borderWidth: 1, borderColor: '#D1D5DB', alignItems: 'center',
  },
  modalCancelText: { fontFamily: 'DMSans-Bold', fontSize: 14, color: '#374151' },
  modalSubmit: {
    flex: 2, paddingVertical: 14, borderRadius: 10,
    backgroundColor: '#106B4F', alignItems: 'center',
  },
  modalSubmitText: { fontFamily: 'Poppins-Bold', fontSize: 14, color: '#FFFFFF' },
});
