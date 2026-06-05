import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ArrowLeft,
  Search,
  Baby,
  Scale,
  AlertTriangle,
  Lock,
  Pill,
} from 'lucide-react-native';
import { useAuth } from '@/lib/AuthContext';
import AuthRequiredPlaceholder from '@/components/AuthRequiredPlaceholder';
import DisclaimerModal from '@/components/DisclaimerModal';
import { getPerfilFamilia, type KerivaPerfil } from '@/lib/api/familia';
import {
  calcularDosisPediatrica,
  listProductosPediatricos,
  type CalcularDosisResult,
  type ProductoPediatrico,
} from '@/lib/api/dosis';
import { hasActiveDisclaimer } from '@/lib/api/disclaimer';

function ageMonthsFrom(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  let months = (now.getFullYear() - d.getFullYear()) * 12;
  months += now.getMonth() - d.getMonth();
  if (now.getDate() < d.getDate()) months -= 1;
  return Math.max(0, months);
}

export default function KidsScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const params = useLocalSearchParams<{ perfilId?: string }>();
  const perfilId = typeof params.perfilId === 'string' ? params.perfilId : undefined;

  const [perfil, setPerfil] = useState<KerivaPerfil | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [productos, setProductos] = useState<ProductoPediatrico[]>([]);
  const [searchText, setSearchText] = useState('');
  const [selectedProd, setSelectedProd] = useState<ProductoPediatrico | null>(null);
  const [result, setResult] = useState<CalcularDosisResult | null>(null);

  // Disclaimer state — Brief §5 lo exige bloqueante ANTES de mostrar el cálculo
  const [disclaimerOk, setDisclaimerOk] = useState<boolean | null>(null);
  const [disclaimerOpen, setDisclaimerOpen] = useState(false);

  // Cargar perfil + estado del disclaimer
  useEffect(() => {
    if (!session || !perfilId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setError(null);
      try {
        const p = await getPerfilFamilia(perfilId);
        if (cancelled) return;
        setPerfil(p);

        if (!p) {
          setError('Perfil no encontrado');
          return;
        }
        if (p.tipoPerfil !== 'dependiente_pediatrico') {
          setError('Keriva Kids solo aplica a perfiles pediátricos.');
          return;
        }

        const has = await hasActiveDisclaimer(p.id, 'pediatrico');
        if (cancelled) return;
        setDisclaimerOk(has);
        if (!has) setDisclaimerOpen(true);
      } catch (e: any) {
        setError(e?.message ?? 'No se pudo cargar');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session, perfilId]);

  // Cargar productos (lista) — solo si el disclaimer está OK
  useEffect(() => {
    if (!disclaimerOk) return;
    let cancelled = false;
    (async () => {
      const list = await listProductosPediatricos(searchText);
      if (!cancelled) setProductos(list);
    })();
    return () => {
      cancelled = true;
    };
  }, [disclaimerOk, searchText]);

  // Recalcular cuando cambia el producto seleccionado o el peso
  const pesoLb = perfil?.pesoLb ?? null;
  const edadMeses = useMemo(
    () => (perfil?.fechaNacimiento ? ageMonthsFrom(perfil.fechaNacimiento) : null),
    [perfil?.fechaNacimiento],
  );

  useEffect(() => {
    if (!selectedProd || pesoLb == null) {
      setResult(null);
      return;
    }
    const r = calcularDosisPediatrica({
      pesoLb,
      edadMeses,
      producto: selectedProd,
    });
    setResult(r);
  }, [selectedProd, pesoLb, edadMeses]);

  const onAcceptDisclaimer = useCallback(() => {
    setDisclaimerOpen(false);
    setDisclaimerOk(true);
  }, []);

  const onCancelDisclaimer = useCallback(() => {
    setDisclaimerOpen(false);
    router.back();
  }, [router]);

  if (!session) {
    return (
      <AuthRequiredPlaceholder
        icon={<Lock size={48} color="#34C26A" />}
        title="Inicia sesión"
        description="Necesitas iniciar sesión para usar Keriva Kids."
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
            <Baby size={28} color="#FFB74D" />
          </View>
          <Text style={styles.title}>Keriva Kids</Text>
          <Text style={styles.subtitle}>
            Calculadora de dosis pediátrica basada en peso (libras) y edad.
            {perfil ? ` · ${perfil.nombre}` : ''}
          </Text>
        </View>

        {loading ? (
          <ActivityIndicator color="#34C26A" style={{ marginTop: 40 }} />
        ) : error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : !disclaimerOk ? (
          <View style={styles.lockedBox}>
            <Lock size={28} color="rgba(255,255,255,0.5)" />
            <Text style={styles.lockedText}>
              Acepta el aviso médico para acceder a la calculadora.
            </Text>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => setDisclaimerOpen(true)}
            >
              <Text style={styles.primaryButtonText}>Leer aviso médico</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Resumen del perfil */}
            <View style={styles.perfilCard}>
              <Text style={styles.perfilLabel}>Datos del perfil</Text>
              <View style={styles.perfilRow}>
                <View style={styles.perfilMeta}>
                  <Scale size={14} color="#34C26A" />
                  <Text style={styles.perfilMetaText}>
                    {pesoLb != null ? `${pesoLb} lb` : 'Peso no registrado'}
                  </Text>
                </View>
                <View style={styles.perfilMeta}>
                  <Baby size={14} color="#34C26A" />
                  <Text style={styles.perfilMetaText}>
                    {edadMeses != null
                      ? edadMeses < 24
                        ? `${edadMeses} meses`
                        : `${Math.floor(edadMeses / 12)} años`
                      : 'Edad no registrada'}
                  </Text>
                </View>
              </View>
              {pesoLb == null ? (
                <TouchableOpacity
                  style={styles.editPesoBtn}
                  onPress={() =>
                    router.push(`/familia/edit?id=${perfilId}` as any)
                  }
                >
                  <Text style={styles.editPesoText}>
                    Editar peso del perfil →
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>

            {/* Buscador */}
            <Text style={styles.sectionLabel}>Medicamento</Text>
            <View style={styles.inputWrap}>
              <Search size={16} color="rgba(255,255,255,0.5)" />
              <TextInput
                style={styles.input}
                placeholder="Buscar por nombre o principio activo"
                placeholderTextColor="rgba(255,255,255,0.4)"
                value={searchText}
                onChangeText={setSearchText}
              />
            </View>

            <View style={styles.productsList}>
              {productos.length === 0 ? (
                <Text style={styles.hintText}>
                  No hay productos con dosis registrada todavía.
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
                    <View style={styles.productItemIcon}>
                      <Pill size={16} color="#34C26A" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.productName}>{p.nombreComercial}</Text>
                      {p.principioActivo ? (
                        <Text style={styles.productMeta}>{p.principioActivo}</Text>
                      ) : null}
                      <Text style={styles.productMetaSmall}>
                        {p.dosisMgPorKg} mg/kg · cada {p.frecuenciaHoras}h
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </View>

            {/* Resultado del cálculo */}
            {selectedProd && result ? (
              <View
                style={[
                  styles.resultCard,
                  !result.ok && styles.resultCardError,
                ]}
              >
                {!result.ok ? (
                  <>
                    <View style={styles.resultHeaderRow}>
                      <AlertTriangle size={20} color="#D32F2F" />
                      <Text style={styles.resultErrorTitle}>
                        {result.reason === 'contraindicado'
                          ? 'Contraindicado'
                          : result.reason === 'fuera_rango_edad'
                          ? 'Fuera del rango de edad'
                          : result.reason === 'sin_peso'
                          ? 'Falta peso'
                          : 'No disponible'}
                      </Text>
                    </View>
                    <Text style={styles.resultErrorText}>{result.message}</Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.resultLabel}>Dosis estimada</Text>
                    <Text style={styles.resultDosis}>
                      {result.dosisMg.toFixed(1)} mg
                    </Text>
                    <Text style={styles.resultFrecuencia}>
                      cada {result.frecuenciaHoras} horas
                    </Text>
                    <View style={styles.resultMetaRow}>
                      <Text style={styles.resultMetaText}>
                        Peso: {result.pesoLb} lb
                      </Text>
                      {result.topeAplicado ? (
                        <Text style={[styles.resultMetaText, { color: '#FFB74D' }]}>
                          · Se aplicó tope de seguridad
                        </Text>
                      ) : null}
                    </View>

                    {result.advertencia ? (
                      <View style={styles.warningBox}>
                        <AlertTriangle size={14} color="#E65100" />
                        <Text style={styles.warningText}>{result.advertencia}</Text>
                      </View>
                    ) : null}

                    {result.notas ? (
                      <Text style={styles.notesText}>{result.notas}</Text>
                    ) : null}

                    <Text style={styles.disclaimerFooter}>
                      ⚠ Estimación basada en literatura estándar. Siempre valide con
                      su pediatra antes de administrar.
                    </Text>
                  </>
                )}
              </View>
            ) : null}
          </>
        )}
      </ScrollView>

      {perfil ? (
        <DisclaimerModal
          visible={disclaimerOpen}
          tipo="pediatrico"
          perfilId={perfil.id}
          perfilNombre={perfil.nombre}
          onAccept={onAcceptDisclaimer}
          onCancel={onCancelDisclaimer}
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
    backgroundColor: 'rgba(255, 183, 77, 0.15)',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 6,
  },
  title: { fontFamily: 'Poppins-Bold', fontSize: 24, color: '#FFFFFF', textAlign: 'center' },
  subtitle: { fontFamily: 'DMSans-Regular', fontSize: 13, color: 'rgba(255,255,255,0.7)', textAlign: 'center', lineHeight: 19, paddingHorizontal: 8 },
  perfilCard: {
    backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12,
    padding: 14, marginBottom: 16, gap: 8,
    borderWidth: 1, borderColor: 'rgba(52, 194, 106, 0.15)',
  },
  perfilLabel: { fontFamily: 'DMSans-Bold', fontSize: 11, color: '#34C26A', textTransform: 'uppercase', letterSpacing: 1 },
  perfilRow: { flexDirection: 'row', gap: 16 },
  perfilMeta: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  perfilMetaText: { fontFamily: 'DMSans-Medium', fontSize: 13, color: '#FFFFFF' },
  editPesoBtn: { paddingVertical: 4 },
  editPesoText: { fontFamily: 'DMSans-Bold', fontSize: 12, color: '#FFB74D' },
  sectionLabel: { fontFamily: 'DMSans-Bold', fontSize: 12, color: '#34C26A', marginTop: 6, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12,
    paddingHorizontal: 14, height: 50,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
  },
  input: { flex: 1, fontFamily: 'DMSans-Regular', fontSize: 15, color: '#FFFFFF' },
  productsList: { marginTop: 10, gap: 8 },
  productItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 12, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  productItemActive: {
    backgroundColor: 'rgba(52, 194, 106, 0.18)',
    borderColor: '#34C26A',
  },
  productItemIcon: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(52, 194, 106, 0.15)',
    justifyContent: 'center', alignItems: 'center',
  },
  productName: { fontFamily: 'Poppins-SemiBold', fontSize: 14, color: '#FFFFFF' },
  productMeta: { fontFamily: 'DMSans-Regular', fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  productMetaSmall: { fontFamily: 'DMSans-Regular', fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2 },
  hintText: { fontFamily: 'DMSans-Regular', fontSize: 13, color: 'rgba(255,255,255,0.6)', textAlign: 'center', paddingVertical: 16 },
  resultCard: {
    marginTop: 20, padding: 18, borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 2, borderColor: '#34C26A',
    gap: 6,
  },
  resultCardError: { borderColor: '#D32F2F', backgroundColor: '#FFF5F5' },
  resultHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  resultErrorTitle: { fontFamily: 'Poppins-Bold', fontSize: 15, color: '#D32F2F' },
  resultErrorText: { fontFamily: 'DMSans-Regular', fontSize: 13, color: '#7F1D1D', lineHeight: 19 },
  resultLabel: { fontFamily: 'DMSans-Bold', fontSize: 11, color: '#106B4F', textTransform: 'uppercase', letterSpacing: 1 },
  resultDosis: { fontFamily: 'Poppins-Black', fontSize: 36, color: '#052419', marginVertical: -2 },
  resultFrecuencia: { fontFamily: 'DMSans-Bold', fontSize: 14, color: '#106B4F' },
  resultMetaRow: { flexDirection: 'row', gap: 6, marginTop: 4 },
  resultMetaText: { fontFamily: 'DMSans-Regular', fontSize: 12, color: '#6B7280' },
  warningBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 6,
    marginTop: 10, padding: 10, borderRadius: 8,
    backgroundColor: '#FFF3E0',
  },
  warningText: { flex: 1, fontFamily: 'DMSans-Medium', fontSize: 12, color: '#E65100', lineHeight: 17 },
  notesText: { fontFamily: 'DMSans-Regular', fontSize: 12, color: '#6B7280', marginTop: 8, lineHeight: 17 },
  disclaimerFooter: { fontFamily: 'DMSans-Bold', fontSize: 11, color: '#9CA3AF', marginTop: 10, textAlign: 'center' },
  lockedBox: { alignItems: 'center', gap: 14, padding: 24, marginTop: 20 },
  lockedText: { fontFamily: 'DMSans-Regular', fontSize: 14, color: 'rgba(255,255,255,0.7)', textAlign: 'center' },
  primaryButton: { backgroundColor: '#FFFFFF', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 22 },
  primaryButtonText: { fontFamily: 'Poppins-Bold', fontSize: 14, color: '#106B4F' },
  errorText: { fontFamily: 'DMSans-Medium', fontSize: 14, color: '#FF6B6B', textAlign: 'center', marginTop: 16 },
});
