import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { ArrowLeft, TrendingUp, DollarSign, ShoppingBag, Clock, Package } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/AuthContext';
import { theme } from '@/lib/theme';
import PressableScale from '@/components/ui/PressableScale';
import PillBackground from '@/components/ui/PillBackground';
import { getReservasFarmacia, type Reserva } from '@/lib/api/reservas';

type TopProducto = { nombre: string; cantidad: number; ingreso: number };

function ingresoDe(r: Reserva): number {
  return (r.precio ?? 0) * (r.cantidad ?? 1);
}

export default function MetricasScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { perfil } = useAuth();
  const farmaciaId = perfil?.farmaciaId ?? null;

  const [loading, setLoading] = useState(true);
  const [ventas, setVentas] = useState<Reserva[]>([]);
  const [pendientes, setPendientes] = useState(0);

  const load = useCallback(async () => {
    if (!farmaciaId) {
      setLoading(false);
      return;
    }
    const [conf, pend] = await Promise.all([
      getReservasFarmacia('confirmada'),
      getReservasFarmacia('pendiente'),
    ]);
    setVentas(conf);
    setPendientes(pend.length);
    setLoading(false);
  }, [farmaciaId]);

  useEffect(() => {
    load();
  }, [load]);

  const totalVentas = ventas.length;
  const ingresos = ventas.reduce((s, r) => s + ingresoDe(r), 0);
  const ticket = totalVentas > 0 ? ingresos / totalVentas : 0;

  // Más vendidos (por producto)
  const topMap = new Map<string, TopProducto>();
  for (const r of ventas) {
    const nombre = r.productoNombre ?? 'Producto';
    const prev = topMap.get(nombre) ?? { nombre, cantidad: 0, ingreso: 0 };
    prev.cantidad += r.cantidad ?? 1;
    prev.ingreso += ingresoDe(r);
    topMap.set(nombre, prev);
  }
  const top = Array.from(topMap.values()).sort((a, b) => b.cantidad - a.cantidad).slice(0, 6);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <PillBackground opacity={0.55} />
      <View style={styles.header}>
        <PressableScale onPress={() => router.back()} style={styles.iconBtn}>
          <ArrowLeft size={22} color={theme.colors.textPrimary} />
        </PressableScale>
        <Text style={styles.headerTitle}>Estadísticas</Text>
        <View style={styles.iconBtn} />
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={theme.colors.accent} /></View>
      ) : !farmaciaId ? (
        <View style={styles.center}><Text style={styles.muted}>Esta cuenta no es una farmacia.</Text></View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: insets.bottom + 40 }}>
          {/* KPIs */}
          <View style={styles.kpiGrid}>
            <View style={[styles.kpi, { backgroundColor: theme.colors.accentSofter }]}>
              <ShoppingBag size={22} color={theme.colors.accent} />
              <Text style={styles.kpiValue}>{totalVentas}</Text>
              <Text style={styles.kpiLabel}>Ventas</Text>
            </View>
            <View style={[styles.kpi, { backgroundColor: theme.colors.successSoft }]}>
              <DollarSign size={22} color={theme.colors.success} />
              <Text style={styles.kpiValue}>RD${Math.round(ingresos).toLocaleString()}</Text>
              <Text style={styles.kpiLabel}>Ingresos</Text>
            </View>
            <View style={[styles.kpi, { backgroundColor: theme.colors.infoSoft }]}>
              <TrendingUp size={22} color={theme.colors.info} />
              <Text style={styles.kpiValue}>RD${Math.round(ticket).toLocaleString()}</Text>
              <Text style={styles.kpiLabel}>Ticket prom.</Text>
            </View>
            <View style={[styles.kpi, { backgroundColor: theme.colors.warningSoft }]}>
              <Clock size={22} color={theme.colors.warning} />
              <Text style={styles.kpiValue}>{pendientes}</Text>
              <Text style={styles.kpiLabel}>Pendientes</Text>
            </View>
          </View>

          {/* Más vendidos */}
          <Text style={styles.sectionTitle}>Más vendidos</Text>
          {top.length === 0 ? (
            <View style={styles.emptyBox}>
              <Package size={28} color={theme.colors.textMuted} />
              <Text style={styles.muted}>Aún no hay ventas registradas.</Text>
              <Text style={styles.mutedSm}>Las ventas se cuentan al confirmar reservas.</Text>
            </View>
          ) : (
            top.map((p, i) => (
              <View key={p.nombre} style={styles.topRow}>
                <Text style={styles.rank}>{i + 1}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.topName} numberOfLines={1}>{p.nombre}</Text>
                  <Text style={styles.topMeta}>{p.cantidad} uds · RD${Math.round(p.ingreso).toLocaleString()}</Text>
                </View>
              </View>
            ))
          )}

          {/* Nota sobre leads/demanda (se activan con la captura de eventos) */}
          <View style={styles.note}>
            <Text style={styles.noteText}>
              Las métricas de “más buscados” y demanda insatisfecha se activan cuando se conecte la captura de eventos del lado del usuario.
            </Text>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border, backgroundColor: theme.colors.surface },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { ...theme.text.h3, color: theme.colors.textPrimary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: theme.spacing.sm },
  muted: { ...theme.text.body, color: theme.colors.textSecondary, textAlign: 'center' },
  mutedSm: { ...theme.text.caption, color: theme.colors.textMuted, textAlign: 'center' },

  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.md },
  kpi: { flexGrow: 1, flexBasis: '45%', minWidth: 140, borderRadius: theme.radius.lg, padding: theme.spacing.lg, gap: 4 },
  kpiValue: { fontFamily: theme.font.bold, fontSize: 22, color: theme.colors.textPrimary, marginTop: theme.spacing.xs },
  kpiLabel: { ...theme.text.caption, color: theme.colors.textSecondary },

  sectionTitle: { ...theme.text.h3, color: theme.colors.textPrimary, marginTop: theme.spacing.xl, marginBottom: theme.spacing.md },
  emptyBox: { alignItems: 'center', gap: theme.spacing.xs, padding: theme.spacing.xl, backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, ...theme.shadow.sm },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md, backgroundColor: theme.colors.surface, borderRadius: theme.radius.md, padding: theme.spacing.md, marginBottom: theme.spacing.sm, ...theme.shadow.sm },
  rank: { fontFamily: theme.font.bold, fontSize: 16, color: theme.colors.accent, width: 22, textAlign: 'center' },
  topName: { ...theme.text.title, color: theme.colors.textPrimary },
  topMeta: { ...theme.text.caption, color: theme.colors.textSecondary, marginTop: 1 },

  note: { marginTop: theme.spacing.xl, padding: theme.spacing.md, backgroundColor: theme.colors.accentSofter, borderRadius: theme.radius.md },
  noteText: { ...theme.text.caption, color: theme.colors.textSecondary },
});
