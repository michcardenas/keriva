import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { ArrowLeft, ShoppingBag, Check, X, Clock } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/AuthContext';
import { theme } from '@/lib/theme';
import PressableScale from '@/components/ui/PressableScale';
import PillBackground from '@/components/ui/PillBackground';
import {
  getReservasFarmacia,
  setEstadoReserva,
  type Reserva,
  type ReservaEstado,
} from '@/lib/api/reservas';

type Filtro = 'pendiente' | 'confirmada' | 'todas';

const ESTADO_META: Record<ReservaEstado, { label: string; color: string; bg: string }> = {
  pendiente: { label: 'Pendiente', color: theme.colors.warning, bg: theme.colors.warningSoft },
  confirmada: { label: 'Vendida', color: theme.colors.success, bg: theme.colors.successSoft },
  rechazada: { label: 'Rechazada', color: theme.colors.danger, bg: theme.colors.dangerSoft },
  cancelada: { label: 'Cancelada', color: theme.colors.textMuted, bg: theme.colors.bgSecondary },
};

function fmt(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export default function ReservasFarmaciaScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { perfil } = useAuth();
  const farmaciaId = perfil?.farmaciaId ?? null;

  const [items, setItems] = useState<Reserva[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<Filtro>('pendiente');
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!farmaciaId) {
      setLoading(false);
      return;
    }
    const estado = filtro === 'todas' ? undefined : filtro;
    const data = await getReservasFarmacia(estado);
    setItems(data);
    setLoading(false);
  }, [farmaciaId, filtro]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const accion = async (id: string, estado: ReservaEstado) => {
    setBusy(id);
    await setEstadoReserva(id, estado);
    setBusy(null);
    await load();
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <PillBackground opacity={0.55} />
      <View style={styles.header}>
        <PressableScale onPress={() => router.back()} style={styles.iconBtn}>
          <ArrowLeft size={22} color={theme.colors.textPrimary} />
        </PressableScale>
        <Text style={styles.headerTitle}>Reservas y ventas</Text>
        <View style={styles.iconBtn} />
      </View>

      <View style={styles.segment}>
        {([['pendiente', 'Pendientes'], ['confirmada', 'Vendidas'], ['todas', 'Todas']] as [Filtro, string][]).map(([key, label]) => (
          <PressableScale key={key} onPress={() => setFiltro(key)} style={[styles.segBtn, filtro === key && styles.segOn]}>
            <Text style={[styles.segText, filtro === key && styles.segTextOn]}>{label}</Text>
          </PressableScale>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={theme.colors.accent} /></View>
      ) : !farmaciaId ? (
        <View style={styles.center}><Text style={styles.muted}>Esta cuenta no es una farmacia.</Text></View>
      ) : items.length === 0 ? (
        <View style={styles.center}>
          <ShoppingBag size={36} color={theme.colors.textMuted} />
          <Text style={styles.muted}>No hay reservas {filtro !== 'todas' ? `(${filtro === 'pendiente' ? 'pendientes' : 'vendidas'})` : ''}.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: insets.bottom + 40 }}>
          {items.map((r) => {
            const meta = ESTADO_META[r.estado];
            return (
              <View key={r.id} style={styles.card}>
                <View style={styles.cardTop}>
                  <Text style={styles.prod} numberOfLines={1}>{r.productoNombre ?? 'Producto'}</Text>
                  <View style={[styles.badge, { backgroundColor: meta.bg }]}>
                    <Text style={[styles.badgeText, { color: meta.color }]}>{meta.label}</Text>
                  </View>
                </View>
                <Text style={styles.meta}>{r.sucursalNombre ?? 'Sucursal'} · Cant. {r.cantidad}{r.precio != null ? ` · RD$${r.precio.toFixed(2)}` : ''}</Text>
                <View style={styles.dateRow}>
                  <Clock size={12} color={theme.colors.textMuted} />
                  <Text style={styles.date}>{fmt(r.createdAt)}</Text>
                </View>
                {!!r.nota && <Text style={styles.nota}>“{r.nota}”</Text>}

                {r.estado === 'pendiente' && (
                  <View style={styles.actions}>
                    <PressableScale
                      onPress={() => busy !== r.id && accion(r.id, 'confirmada')}
                      style={[styles.confirmBtn, busy === r.id && { opacity: 0.6 }]}
                    >
                      <Check size={16} color={theme.colors.white} />
                      <Text style={styles.confirmText}>Confirmar venta</Text>
                    </PressableScale>
                    <PressableScale
                      onPress={() => busy !== r.id && accion(r.id, 'rechazada')}
                      style={styles.rejectBtn}
                    >
                      <X size={16} color={theme.colors.danger} />
                    </PressableScale>
                  </View>
                )}
              </View>
            );
          })}
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
  segment: { flexDirection: 'row', backgroundColor: theme.colors.bgSecondary, borderRadius: theme.radius.pill, padding: 4, margin: theme.spacing.lg },
  segBtn: { flex: 1, alignItems: 'center', paddingVertical: theme.spacing.sm, borderRadius: theme.radius.pill },
  segOn: { backgroundColor: theme.colors.accent },
  segText: { ...theme.text.button, color: theme.colors.textSecondary, fontSize: 13 },
  segTextOn: { color: theme.colors.accentText },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: theme.spacing.sm, padding: theme.spacing.lg },
  muted: { ...theme.text.body, color: theme.colors.textSecondary, textAlign: 'center' },

  card: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, padding: theme.spacing.lg, marginBottom: theme.spacing.md, ...theme.shadow.card },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: theme.spacing.sm },
  prod: { ...theme.text.h3, color: theme.colors.textPrimary, flex: 1 },
  badge: { paddingHorizontal: theme.spacing.md, paddingVertical: 4, borderRadius: theme.radius.pill },
  badgeText: { ...theme.text.label },
  meta: { ...theme.text.bodyMedium, color: theme.colors.textSecondary, marginTop: theme.spacing.sm },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  date: { ...theme.text.caption, color: theme.colors.textMuted },
  nota: { ...theme.text.caption, color: theme.colors.textSecondary, fontStyle: 'italic', marginTop: theme.spacing.sm },
  actions: { flexDirection: 'row', gap: theme.spacing.sm, marginTop: theme.spacing.md },
  confirmBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: theme.colors.accent, borderRadius: theme.radius.pill, paddingVertical: theme.spacing.md, ...theme.shadow.accent },
  confirmText: { ...theme.text.button, color: theme.colors.accentText },
  rejectBtn: { width: 48, borderRadius: theme.radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.dangerSoft },
});
