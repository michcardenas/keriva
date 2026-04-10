import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Image,
  RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ShieldCheck,
  Clock,
  Check,
  X,
  Store,
  UserCog,
  Camera as CameraIcon,
} from 'lucide-react-native';
import { useAuth } from '@/lib/AuthContext';
import {
  getPendingReports,
  verifyReport,
  rejectReport,
  type MyReport,
} from '@/lib/api/precios';
import LanguageSelector from '@/components/LanguageSelector';

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('es-DO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function ModerationScreen() {
  const { perfil } = useAuth();
  const rol = perfil?.rol ?? 'usuario';

  const [reports, setReports] = useState<MyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actioning, setActioning] = useState<number | null>(null);

  const loadReports = useCallback(async () => {
    if (rol === 'usuario') {
      setReports([]);
      setLoading(false);
      return;
    }
    const data = await getPendingReports({
      kind: rol,
      farmaciaId: perfil?.farmaciaId ?? undefined,
    });
    setReports(data);
    setLoading(false);
  }, [rol, perfil?.farmaciaId]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  async function onRefresh() {
    setRefreshing(true);
    await loadReports();
    setRefreshing(false);
  }

  async function handleVerify(id: number) {
    setActioning(id);
    const res = await verifyReport(id);
    setActioning(null);
    if (res.ok) {
      setReports((prev) => prev.filter((r) => r.id !== id));
    }
  }

  async function handleReject(id: number) {
    setActioning(id);
    const res = await rejectReport(id);
    setActioning(null);
    if (res.ok) {
      setReports((prev) => prev.filter((r) => r.id !== id));
    }
  }

  // Non-privileged users see an info screen
  if (rol === 'usuario') {
    return (
      <View style={styles.container}>
        <LinearGradient colors={['#1A7A4A', '#0F1F17']} style={styles.header}>
          <Text style={styles.headerTitle}>Moderación</Text>
        </LinearGradient>
        <View style={styles.emptyInfo}>
          <ShieldCheck size={48} color="#999" />
          <Text style={styles.emptyInfoTitle}>Solo para farmacias y administradores</Text>
          <Text style={styles.emptyInfoText}>
            Esta sección permite verificar los precios reportados por la comunidad.
          </Text>
        </View>
      </View>
    );
  }

  const isAdmin = rol === 'admin';
  const title = isAdmin ? 'Moderación global' : 'Mi farmacia';
  const subtitle = isAdmin
    ? 'Verifica precios reportados por la comunidad'
    : 'Verifica los precios reportados en tu sucursal';

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#1A7A4A', '#0F1F17']} style={styles.header}>
        <View style={styles.headerTopRow}>
          <View style={styles.headerBadge}>
            {isAdmin ? (
              <UserCog size={16} color="#7ED957" />
            ) : (
              <Store size={16} color="#7ED957" />
            )}
            <Text style={styles.headerBadgeText}>
              {isAdmin ? 'Administrador' : 'Farmacia'}
            </Text>
          </View>
          <LanguageSelector />
        </View>
        <Text style={styles.headerTitle}>{title}</Text>
        <Text style={styles.headerSubtitle}>{subtitle}</Text>
        <View style={styles.statsBar}>
          <View style={styles.statBox}>
            <Clock size={16} color="#FFF3E0" />
            <Text style={styles.statValue}>{reports.length}</Text>
            <Text style={styles.statLabel}>Pendientes</Text>
          </View>
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentInner}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color="#1A7A4A" size="large" />
          </View>
        ) : reports.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyEmoji}>✅</Text>
            <Text style={styles.emptyTitle}>No hay reportes pendientes</Text>
            <Text style={styles.emptyText}>
              {isAdmin
                ? 'Todos los reportes enviados por la comunidad han sido procesados.'
                : 'No hay reportes de precios pendientes en tu farmacia.'}
            </Text>
          </View>
        ) : (
          reports.map((r) => (
            <View key={r.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardIconBox}>
                  <Text style={styles.cardIcon}>💊</Text>
                </View>
                <View style={styles.cardHeaderText}>
                  <Text style={styles.cardMedName}>
                    {r.medicationName} {r.medicationDosage}
                  </Text>
                  <Text style={styles.cardPharm}>
                    {r.pharmacyName} · {r.pharmacyCity}
                  </Text>
                  <Text style={styles.cardDate}>{formatDate(r.createdAt)}</Text>
                </View>
                <Text style={styles.cardPrice}>RD${r.price.toFixed(2)}</Text>
              </View>

              {r.photoUrl ? (
                <Image
                  source={{ uri: r.photoUrl }}
                  style={styles.photo}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.noPhoto}>
                  <CameraIcon size={18} color="#999" />
                  <Text style={styles.noPhotoText}>Reporte sin foto</Text>
                </View>
              )}

              <View style={styles.actions}>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.rejectBtn]}
                  onPress={() => handleReject(r.id)}
                  disabled={actioning === r.id}
                >
                  {actioning === r.id ? (
                    <ActivityIndicator color="#D32F2F" size="small" />
                  ) : (
                    <>
                      <X size={18} color="#D32F2F" />
                      <Text style={styles.rejectText}>Rechazar</Text>
                    </>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.verifyBtn]}
                  onPress={() => handleVerify(r.id)}
                  disabled={actioning === r.id}
                >
                  {actioning === r.id ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <>
                      <Check size={18} color="#FFFFFF" />
                      <Text style={styles.verifyText}>Verificar</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: { paddingTop: 60, paddingBottom: 24, paddingHorizontal: 20 },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerBadge: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    backgroundColor: 'rgba(126,217,87,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(126,217,87,0.3)',
  },
  headerBadgeText: {
    fontFamily: 'DMSans-Bold',
    fontSize: 12,
    color: '#7ED957',
  },
  headerTitle: { fontFamily: 'Poppins-Bold', fontSize: 26, color: '#FFFFFF' },
  headerSubtitle: {
    fontFamily: 'DMSans-Regular',
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 4,
  },
  statsBar: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  statBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  statValue: {
    fontFamily: 'Poppins-Bold',
    fontSize: 18,
    color: '#FFFFFF',
  },
  statLabel: {
    fontFamily: 'DMSans-Regular',
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
  },
  content: { flex: 1 },
  contentInner: { padding: 20, paddingBottom: 40 },
  loadingBox: { padding: 40, alignItems: 'center' },
  emptyBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
  },
  emptyEmoji: { fontSize: 48, marginBottom: 8 },
  emptyTitle: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 16,
    color: '#0F1F17',
    textAlign: 'center',
  },
  emptyText: {
    fontFamily: 'DMSans-Regular',
    fontSize: 13,
    color: '#666666',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 20,
  },
  emptyInfo: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    gap: 12,
  },
  emptyInfoTitle: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 18,
    color: '#0F1F17',
    textAlign: 'center',
  },
  emptyInfoText: {
    fontFamily: 'DMSans-Regular',
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 20,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  cardIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F0F9F4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardIcon: { fontSize: 20 },
  cardHeaderText: { flex: 1 },
  cardMedName: { fontFamily: 'DMSans-Bold', fontSize: 15, color: '#0F1F17' },
  cardPharm: {
    fontFamily: 'DMSans-Regular',
    fontSize: 12,
    color: '#666666',
    marginTop: 2,
  },
  cardDate: {
    fontFamily: 'DMSans-Regular',
    fontSize: 11,
    color: '#999',
    marginTop: 2,
  },
  cardPrice: {
    fontFamily: 'Poppins-Bold',
    fontSize: 18,
    color: '#1A7A4A',
  },
  photo: {
    width: '100%',
    height: 180,
    borderRadius: 10,
    marginTop: 12,
    backgroundColor: '#F0F0F0',
  },
  noPhoto: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#F8F9FA',
    padding: 16,
    borderRadius: 10,
    marginTop: 12,
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  noPhotoText: {
    fontFamily: 'DMSans-Regular',
    fontSize: 12,
    color: '#999',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
  },
  rejectBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D32F2F',
  },
  rejectText: {
    fontFamily: 'DMSans-Bold',
    fontSize: 14,
    color: '#D32F2F',
  },
  verifyBtn: { backgroundColor: '#1A7A4A' },
  verifyText: { fontFamily: 'DMSans-Bold', fontSize: 14, color: '#FFFFFF' },
});
