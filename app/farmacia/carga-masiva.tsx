import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { ArrowLeft, Download, Upload, CheckCircle2, AlertTriangle, FileSpreadsheet } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/AuthContext';
import { theme } from '@/lib/theme';
import PressableScale from '@/components/ui/PressableScale';
import PillBackground from '@/components/ui/PillBackground';
import { generateCSV, downloadCSV, pickAndParseCSV } from '@/lib/csv';
import { getSucursales, type Sucursal } from '@/lib/api/sucursales';
import { procesarCargaMasiva, type CargaModo, type CargaResultado } from '@/lib/api/inventario';

const TEMPLATE_HEADERS = ['nombre', 'concentracion', 'disponible', 'precio'];
const TEMPLATE_SAMPLE = [
  { nombre: 'Acetaminofén', concentracion: '500 mg', disponible: 'si', precio: '85.00' },
  { nombre: 'Ibuprofeno', concentracion: '400 mg', disponible: 'no', precio: '' },
  { nombre: 'Amoxicilina', concentracion: '500 mg', disponible: 'si', precio: '120.00' },
];

export default function CargaMasivaScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { perfil } = useAuth();
  const farmaciaId = perfil?.farmaciaId ?? null;

  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  const [loading, setLoading] = useState(true);

  const [rows, setRows] = useState<Array<Record<string, string>> | null>(null);
  const [destino, setDestino] = useState<'todas' | string>('todas'); // 'todas' o sucursalId
  const [modo, setModo] = useState<CargaModo>('actualizar');
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<CargaResultado | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!farmaciaId) {
      setLoading(false);
      return;
    }
    const data = await getSucursales(farmaciaId);
    setSucursales(data.filter((s) => s.activa));
    setLoading(false);
  }, [farmaciaId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleTemplate = async () => {
    const csv = generateCSV(TEMPLATE_HEADERS, TEMPLATE_SAMPLE);
    await downloadCSV(csv, 'plantilla_inventario_keriva.csv');
  };

  const handlePick = async () => {
    setError(null);
    setResult(null);
    const parsed = await pickAndParseCSV();
    if (!parsed) return;
    setRows(parsed);
  };

  const handleProcess = async () => {
    setError(null);
    setResult(null);
    if (!rows || rows.length === 0) return setError('Primero selecciona un archivo.');
    const sucursalIds =
      destino === 'todas' ? sucursales.map((s) => s.id) : [destino];
    if (sucursalIds.length === 0) return setError('No hay sucursales destino.');
    setProcessing(true);
    const res = await procesarCargaMasiva(sucursalIds, rows, modo);
    setProcessing(false);
    setResult(res);
  };

  const handleDownloadErrors = async () => {
    if (!result || result.errores.length === 0) return;
    const csv = generateCSV(['fila', 'nombre', 'motivo'], result.errores as any);
    await downloadCSV(csv, 'errores_carga_keriva.csv');
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <PillBackground opacity={0.55} />
      <View style={styles.header}>
        <PressableScale onPress={() => router.back()} style={styles.iconBtn}>
          <ArrowLeft size={22} color={theme.colors.textPrimary} />
        </PressableScale>
        <Text style={styles.headerTitle}>Carga masiva</Text>
        <View style={styles.iconBtn} />
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={theme.colors.accent} /></View>
      ) : !farmaciaId ? (
        <View style={styles.center}><Text style={styles.muted}>Esta cuenta no es una farmacia.</Text></View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: insets.bottom + 40 }}>
          {/* Paso 1: plantilla */}
          <View style={styles.card}>
            <Text style={styles.step}>1. Descarga la plantilla</Text>
            <Text style={styles.stepDesc}>
              Llénala en Excel con tus productos. Columnas: nombre, concentración, disponible (sí/no) y precio.
            </Text>
            <PressableScale onPress={handleTemplate} style={styles.outlineBtn}>
              <Download size={18} color={theme.colors.accent} />
              <Text style={styles.outlineBtnText}>Descargar plantilla CSV</Text>
            </PressableScale>
          </View>

          {/* Paso 2: archivo */}
          <View style={styles.card}>
            <Text style={styles.step}>2. Sube tu archivo</Text>
            <PressableScale onPress={handlePick} style={styles.outlineBtn}>
              <Upload size={18} color={theme.colors.accent} />
              <Text style={styles.outlineBtnText}>{rows ? 'Cambiar archivo' : 'Seleccionar CSV'}</Text>
            </PressableScale>
            {rows && (
              <View style={styles.fileInfo}>
                <FileSpreadsheet size={16} color={theme.colors.accent} />
                <Text style={styles.fileInfoText}>{rows.length} filas detectadas</Text>
              </View>
            )}
          </View>

          {/* Paso 3: destino */}
          <View style={styles.card}>
            <Text style={styles.step}>3. ¿A qué sucursales?</Text>
            <PressableScale onPress={() => setDestino('todas')} style={[styles.radioRow, destino === 'todas' && styles.radioRowActive]}>
              <View style={[styles.radio, destino === 'todas' && styles.radioOn]} />
              <Text style={styles.radioText}>Todas las sucursales ({sucursales.length})</Text>
            </PressableScale>
            {sucursales.map((s) => (
              <PressableScale key={s.id} onPress={() => setDestino(s.id)} style={[styles.radioRow, destino === s.id && styles.radioRowActive]}>
                <View style={[styles.radio, destino === s.id && styles.radioOn]} />
                <Text style={styles.radioText} numberOfLines={1}>{s.nombre}</Text>
              </PressableScale>
            ))}
          </View>

          {/* Paso 4: modo */}
          <View style={styles.card}>
            <Text style={styles.step}>4. Modo de carga</Text>
            <View style={styles.segment}>
              <PressableScale onPress={() => setModo('actualizar')} style={[styles.segBtn, modo === 'actualizar' && styles.segBtnOn]}>
                <Text style={[styles.segText, modo === 'actualizar' && styles.segTextOn]}>Actualizar</Text>
              </PressableScale>
              <PressableScale onPress={() => setModo('reemplazar')} style={[styles.segBtn, modo === 'reemplazar' && styles.segBtnOn]}>
                <Text style={[styles.segText, modo === 'reemplazar' && styles.segTextOn]}>Reemplazar</Text>
              </PressableScale>
            </View>
            <Text style={styles.stepDesc}>
              {modo === 'actualizar'
                ? 'Solo toca los productos del archivo; el resto queda igual.'
                : 'Lo que no esté en el archivo se elimina del inventario de esas sucursales.'}
            </Text>
          </View>

          {error && <Text style={styles.errorText}>{error}</Text>}

          <PressableScale
            onPress={handleProcess}
            style={[styles.processBtn, (processing || !rows) && { opacity: 0.6 }]}
          >
            <Text style={styles.processBtnText}>{processing ? 'Procesando…' : 'Procesar carga'}</Text>
          </PressableScale>

          {/* Resultado */}
          {result && (
            <View style={styles.resultCard}>
              <View style={styles.resultRow}>
                <CheckCircle2 size={20} color={theme.colors.success} />
                <Text style={styles.resultOk}>{result.aplicadas} productos aplicados</Text>
              </View>
              {result.errores.length > 0 ? (
                <>
                  <View style={styles.resultRow}>
                    <AlertTriangle size={20} color={theme.colors.warning} />
                    <Text style={styles.resultWarn}>{result.errores.length} con error</Text>
                  </View>
                  {result.errores.slice(0, 8).map((e, i) => (
                    <Text key={i} style={styles.errLine}>
                      • {e.fila > 0 ? `Fila ${e.fila}: ` : ''}{e.nombre ? `${e.nombre} — ` : ''}{e.motivo}
                    </Text>
                  ))}
                  {result.errores.length > 8 && (
                    <Text style={styles.errLine}>…y {result.errores.length - 8} más</Text>
                  )}
                  <PressableScale onPress={handleDownloadErrors} style={styles.outlineBtn}>
                    <Download size={16} color={theme.colors.accent} />
                    <Text style={styles.outlineBtnText}>Descargar errores</Text>
                  </PressableScale>
                </>
              ) : (
                <Text style={styles.muted}>Sin errores. ¡Todo cargado!</Text>
              )}
            </View>
          )}
        </ScrollView>
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
  headerTitle: { ...theme.text.h3, color: theme.colors.textPrimary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  muted: { ...theme.text.body, color: theme.colors.textSecondary, textAlign: 'center' },

  card: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, padding: theme.spacing.lg, marginBottom: theme.spacing.md, ...theme.shadow.card },
  step: { ...theme.text.h3, color: theme.colors.textPrimary, marginBottom: theme.spacing.xs },
  stepDesc: { ...theme.text.caption, color: theme.colors.textSecondary, marginTop: theme.spacing.xs },
  outlineBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1.5, borderColor: theme.colors.accent, borderRadius: theme.radius.pill, paddingVertical: theme.spacing.md, marginTop: theme.spacing.sm },
  outlineBtnText: { ...theme.text.button, color: theme.colors.accent },
  fileInfo: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: theme.spacing.md, backgroundColor: theme.colors.accentSofter, padding: theme.spacing.md, borderRadius: theme.radius.md },
  fileInfoText: { ...theme.text.bodyMedium, color: theme.colors.accentDark },

  radioRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, paddingVertical: theme.spacing.md, paddingHorizontal: theme.spacing.sm, borderRadius: theme.radius.md, marginTop: 4 },
  radioRowActive: { backgroundColor: theme.colors.accentSofter },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: theme.colors.border },
  radioOn: { borderColor: theme.colors.accent, backgroundColor: theme.colors.accent },
  radioText: { ...theme.text.body, color: theme.colors.textPrimary, flex: 1 },

  segment: { flexDirection: 'row', backgroundColor: theme.colors.bgSecondary, borderRadius: theme.radius.pill, padding: 4, marginTop: theme.spacing.sm },
  segBtn: { flex: 1, alignItems: 'center', paddingVertical: theme.spacing.sm, borderRadius: theme.radius.pill },
  segBtnOn: { backgroundColor: theme.colors.accent },
  segText: { ...theme.text.button, color: theme.colors.textSecondary },
  segTextOn: { color: theme.colors.accentText },

  errorText: { ...theme.text.caption, color: theme.colors.danger, marginBottom: theme.spacing.sm, textAlign: 'center' },
  processBtn: { backgroundColor: theme.colors.accent, borderRadius: theme.radius.pill, paddingVertical: theme.spacing.md, alignItems: 'center', ...theme.shadow.accent },
  processBtnText: { ...theme.text.button, color: theme.colors.accentText },

  resultCard: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, padding: theme.spacing.lg, marginTop: theme.spacing.lg, gap: theme.spacing.sm, ...theme.shadow.card },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  resultOk: { ...theme.text.title, color: theme.colors.success },
  resultWarn: { ...theme.text.title, color: theme.colors.warning },
  errLine: { ...theme.text.caption, color: theme.colors.textSecondary, marginLeft: theme.spacing.sm },
});
