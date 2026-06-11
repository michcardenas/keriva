import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Store, Upload, Tag, ShoppingBag, TrendingUp, ChevronRight, Settings } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/AuthContext';
import { theme } from '@/lib/theme';
import PressableScale from '@/components/ui/PressableScale';
import PillBackground from '@/components/ui/PillBackground';
import AuthRequiredPlaceholder from '@/components/AuthRequiredPlaceholder';
import { getSucursales } from '@/lib/api/sucursales';
import { getReservasFarmacia } from '@/lib/api/reservas';

type Card = {
  key: string;
  title: string;
  desc: string;
  Icon: typeof Store;
  route: '/farmacia/sucursales' | '/farmacia/carga-masiva' | '/farmacia/descuentos' | '/farmacia/reservas' | '/farmacia/metricas' | '/farmacia/cuenta';
};

const CARDS: Card[] = [
  { key: 'suc', title: 'Sucursales', desc: 'Sedes e inventario', Icon: Store, route: '/farmacia/sucursales' },
  { key: 'res', title: 'Reservas y ventas', desc: 'Confirma y vende', Icon: ShoppingBag, route: '/farmacia/reservas' },
  { key: 'met', title: 'Estadísticas', desc: 'Ventas e ingresos', Icon: TrendingUp, route: '/farmacia/metricas' },
  { key: 'car', title: 'Carga masiva', desc: 'Sube tu inventario', Icon: Upload, route: '/farmacia/carga-masiva' },
  { key: 'des', title: 'Descuentos', desc: 'Promos y vigencia', Icon: Tag, route: '/farmacia/descuentos' },
  { key: 'cta', title: 'Perfil de cuenta', desc: 'Nombre y logo', Icon: Settings, route: '/farmacia/cuenta' },
];

export default function FarmaciaHubScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { perfil, session } = useAuth();
  const rol = perfil?.rol;
  const farmaciaId = perfil?.farmaciaId ?? null;

  const [numSucursales, setNumSucursales] = useState<number | null>(null);
  const [numPendientes, setNumPendientes] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!farmaciaId) return;
    const [suc, pend] = await Promise.all([
      getSucursales(farmaciaId),
      getReservasFarmacia('pendiente'),
    ]);
    setNumSucursales(suc.length);
    setNumPendientes(pend.length);
  }, [farmaciaId]);

  useEffect(() => {
    load();
  }, [load]);

  if (!session) {
    return (
      <AuthRequiredPlaceholder
        icon={<Store size={56} color={theme.colors.accent} />}
        title="Inicia sesión"
        description="Entra con tu cuenta de farmacia para gestionar tu negocio."
      />
    );
  }
  if (rol !== 'farmacia') {
    return (
      <View style={[styles.container, styles.center, { paddingTop: insets.top }]}>
        <PillBackground opacity={0.55} />
        <Store size={40} color={theme.colors.textMuted} />
        <Text style={styles.muted}>Esta sección es para cuentas de farmacia.</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <PillBackground opacity={0.55} />
      <ScrollView contentContainerStyle={{ padding: theme.spacing.xl, paddingBottom: insets.bottom + 24 }} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Mi Farmacia</Text>
        <Text style={styles.subtitle}>Gestiona sucursales, inventario, ventas y más</Text>

        {/* Quick stats */}
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{numSucursales ?? '—'}</Text>
            <Text style={styles.statLabel}>Sucursales</Text>
          </View>
          <View style={styles.stat}>
            <Text style={[styles.statValue, (numPendientes ?? 0) > 0 && { color: theme.colors.warning }]}>{numPendientes ?? '—'}</Text>
            <Text style={styles.statLabel}>Reservas pendientes</Text>
          </View>
        </View>

        {/* Management cards */}
        <View style={styles.grid}>
          {CARDS.map((c) => (
            <PressableScale key={c.key} style={styles.card} onPress={() => router.push(c.route)} scaleTo={0.96}>
              <View style={styles.cardIcon}>
                <c.Icon size={22} color={theme.colors.accent} />
              </View>
              <Text style={styles.cardTitle}>{c.title}</Text>
              <Text style={styles.cardDesc}>{c.desc}</Text>
              <ChevronRight size={16} color={theme.colors.textMuted} style={styles.cardArrow} />
            </PressableScale>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  center: { alignItems: 'center', justifyContent: 'center', gap: theme.spacing.md },
  muted: { ...theme.text.body, color: theme.colors.textSecondary, textAlign: 'center', paddingHorizontal: theme.spacing.xl },
  title: { ...theme.text.h1, color: theme.colors.textPrimary, marginTop: theme.spacing.sm },
  subtitle: { ...theme.text.body, color: theme.colors.textSecondary, marginTop: 2 },

  statsRow: { flexDirection: 'row', gap: theme.spacing.md, marginTop: theme.spacing.xl },
  stat: { flex: 1, backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, padding: theme.spacing.lg, ...theme.shadow.card },
  statValue: { fontFamily: theme.font.bold, fontSize: 26, color: theme.colors.textPrimary },
  statLabel: { ...theme.text.caption, color: theme.colors.textSecondary, marginTop: 2 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.md, marginTop: theme.spacing.xl },
  card: { flexGrow: 1, flexBasis: '45%', minWidth: 150, backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, padding: theme.spacing.lg, ...theme.shadow.card },
  cardIcon: { width: 44, height: 44, borderRadius: theme.radius.pill, backgroundColor: theme.colors.accentSoft, alignItems: 'center', justifyContent: 'center', marginBottom: theme.spacing.md },
  cardTitle: { ...theme.text.h3, color: theme.colors.textPrimary },
  cardDesc: { ...theme.text.caption, color: theme.colors.textSecondary, marginTop: 2 },
  cardArrow: { position: 'absolute', top: theme.spacing.lg, right: theme.spacing.lg },
});
