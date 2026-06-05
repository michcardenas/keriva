import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Award,
  Trophy,
  TrendingUp,
  Gift,
  LogOut,
  ArrowLeft,
  ShieldCheck,
  Clock,
  Camera as CameraIcon,
  Store,
  UserCog,
  Users,
} from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/AuthContext';
import { signOut } from '@/lib/api/auth';
import {
  getMyReports,
  getMyStats,
  getMyPoints,
  getMyPointsHistory,
  type MyReport,
  type PointTransaction,
} from '@/lib/api/precios';
import AuthRequiredPlaceholder from '@/components/AuthRequiredPlaceholder';
import type { Rol } from '@/lib/api/perfiles';
import { getMySolicitud, type SolicitudFarmacia } from '@/lib/api/solicitudes';
import LanguageSelector from '@/components/LanguageSelector';

const ROL_LABELS: Record<Rol, string> = {
  usuario: 'Usuario',
  farmacia: 'Farmacia',
  admin: 'Administrador',
};

const ROL_COLORS: Record<Rol, { bg: string; text: string }> = {
  usuario: { bg: '#E8F5E9', text: '#106B4F' },
  farmacia: { bg: '#FFF3E0', text: '#E65100' },
  admin: { bg: '#E3F2FD', text: '#0D47A1' },
};

function RolIcon({ rol }: { rol: Rol }) {
  if (rol === 'admin') return <UserCog size={14} color={ROL_COLORS.admin.text} />;
  if (rol === 'farmacia') return <Store size={14} color={ROL_COLORS.farmacia.text} />;
  return <Award size={14} color={ROL_COLORS.usuario.text} />;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('es-DO', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function ProfileScreen() {
  const router = useRouter();
  const { user, perfil, session, refreshPerfil } = useAuth();
  const [reports, setReports] = useState<MyReport[]>([]);
  const [stats, setStats] = useState({ totalReports: 0, verifiedReports: 0, pendingReports: 0 });
  const [points, setPoints] = useState(0);
  const [pointsHistory, setPointsHistory] = useState<PointTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);
  const [solicitud, setSolicitud] = useState<SolicitudFarmacia | null>(null);

  const loadData = useCallback(async () => {
    if (!user) return;
    try {
      setDataError(null);
      const [r, s, p, ph, sol] = await Promise.all([
        getMyReports(user.id, 20),
        getMyStats(user.id),
        getMyPoints(user.id),
        getMyPointsHistory(user.id),
        getMySolicitud(user.id),
      ]);
      setReports(r);
      setStats(s);
      setPoints(p);
      setPointsHistory(ph);
      setSolicitud(sol);
    } catch {
      setDataError('No se pudieron cargar tus datos. Verifica tu conexión.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    // Keep perfil fresh in case admin promoted this user in another tab.
    refreshPerfil();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleLogout() {
    await signOut();
  }

  if (!session) {
    return (
      <AuthRequiredPlaceholder
        icon={<Award size={56} color="#34C26A" />}
        title="Tu perfil de contribuidor"
        description="Inicia sesión para ver tus reportes, puntos acumulados y logros. Cada reporte que hagas ayuda a la comunidad."
      />
    );
  }

  const displayName =
    perfil?.nombre ??
    (user?.user_metadata?.nombre as string | undefined) ??
    user?.email?.split('@')[0] ??
    'Usuario Keriva';
  const displayEmail = perfil?.email ?? user?.email ?? '';
  const rol: Rol = perfil?.rol ?? 'usuario';
  const rolColors = ROL_COLORS[rol];

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.backButton} onPress={() => router.push('/(tabs)')}>
        <ArrowLeft size={24} color="#FFFFFF" />
      </TouchableOpacity>

      <LinearGradient
        colors={['#106B4F', '#052419']}
        style={styles.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      >
        <View style={styles.headerTop}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>👤</Text>
          </View>
          <View style={styles.headerActions}>
            <LanguageSelector />
            <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
              <LogOut size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.userName}>{displayName}</Text>
        <Text style={styles.userEmail}>{displayEmail}</Text>

        <View style={[styles.rolBadge, { backgroundColor: rolColors.bg }]}>
          <RolIcon rol={rol} />
          <Text style={[styles.rolBadgeText, { color: rolColors.text }]}>
            {ROL_LABELS[rol]}
          </Text>
        </View>

        <View style={styles.pointsCard}>
          <View style={styles.pointsLeft}>
            <Award size={32} color="#34C26A" />
          </View>
          <View style={styles.pointsRight}>
            <Text style={styles.pointsLabel}>Puntos totales</Text>
            <Text style={styles.pointsValue}>{points.toLocaleString('es-DO')}</Text>
          </View>
        </View>
      </LinearGradient>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {dataError && (
          <TouchableOpacity style={styles.errorBanner} onPress={loadData}>
            <Text style={styles.errorBannerText}>{dataError}</Text>
            <Text style={styles.errorBannerRetry}>Reintentar</Text>
          </TouchableOpacity>
        )}

        {/* Pharmacy registration CTA / status — only for regular users */}
        {rol === 'usuario' && !loading && (
          !solicitud ? (
            <TouchableOpacity
              style={styles.farmaciaCta}
              onPress={() => router.push('/registro-farmacia')}
            >
              <Store size={22} color="#106B4F" />
              <View style={{ flex: 1 }}>
                <Text style={styles.farmaciaCtaTitle}>¿Tienes una farmacia?</Text>
                <Text style={styles.farmaciaCtaText}>Regístrala en Keriva y gestiona tus precios</Text>
              </View>
              <Text style={styles.farmaciaCtaArrow}>→</Text>
            </TouchableOpacity>
          ) : solicitud.estado === 'pendiente' ? (
            <View style={styles.farmaciaStatusPending}>
              <Clock size={20} color="#E65100" />
              <View style={{ flex: 1 }}>
                <Text style={styles.farmaciaStatusTitle}>Solicitud en revisión</Text>
                <Text style={styles.farmaciaStatusText}>
                  Tu solicitud para "{solicitud.nombreComercial}" está siendo revisada
                </Text>
              </View>
            </View>
          ) : solicitud.estado === 'rechazada' ? (
            <TouchableOpacity
              style={styles.farmaciaStatusRejected}
              onPress={() => router.push('/registro-farmacia')}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.farmaciaStatusTitle}>Solicitud rechazada</Text>
                <Text style={styles.farmaciaStatusText}>
                  {solicitud.motivoRechazo || 'Tu solicitud no fue aprobada'}
                </Text>
                <Text style={[styles.farmaciaCtaText, { color: '#D32F2F', marginTop: 4 }]}>
                  Toca para volver a solicitar →
                </Text>
              </View>
            </TouchableOpacity>
          ) : null
        )}

        {/* Mi familia (Multi-Perfil) */}
        <TouchableOpacity
          style={styles.familiaCta}
          onPress={() => router.push('/familia' as any)}
        >
          <View style={styles.familiaCtaIcon}>
            <Users size={22} color="#106B4F" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.familiaCtaTitle}>Mi familia</Text>
            <Text style={styles.familiaCtaText}>
              Titular + hasta 4 dependientes (hijos, adultos mayores)
            </Text>
          </View>
          <Text style={styles.familiaCtaArrow}>→</Text>
        </TouchableOpacity>

        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Trophy size={24} color="#106B4F" />
            <Text style={styles.statValue}>{stats.totalReports}</Text>
            <Text style={styles.statLabel}>Reportes</Text>
          </View>
          <View style={styles.statCard}>
            <ShieldCheck size={24} color="#106B4F" />
            <Text style={styles.statValue}>{stats.verifiedReports}</Text>
            <Text style={styles.statLabel}>Verificados</Text>
          </View>
          <View style={styles.statCard}>
            <Clock size={24} color="#106B4F" />
            <Text style={styles.statValue}>{stats.pendingReports}</Text>
            <Text style={styles.statLabel}>Pendientes</Text>
          </View>
        </View>

        {/* Points history */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Historial de puntos</Text>
          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator color="#106B4F" />
            </View>
          ) : pointsHistory.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyEmoji}>⭐</Text>
              <Text style={styles.emptyTitle}>Sin puntos aún</Text>
              <Text style={styles.emptyText}>
                Reporta precios para empezar a ganar puntos.
              </Text>
            </View>
          ) : (
            pointsHistory.map((tx, idx) => (
              <View key={tx.id ?? idx} style={styles.pointTxCard}>
                <View style={styles.pointTxLeft}>
                  <View
                    style={[
                      styles.pointTxIconBox,
                      tx.accion === 'reporte_verificado' && styles.pointTxIconBoxVerified,
                    ]}
                  >
                    {tx.accion === 'reporte_verificado' ? (
                      <ShieldCheck size={18} color="#106B4F" />
                    ) : (
                      <CameraIcon size={18} color="#34C26A" />
                    )}
                  </View>
                  <View style={styles.pointTxInfo}>
                    <Text style={styles.pointTxDesc}>{tx.descripcion}</Text>
                    <Text style={styles.pointTxDate}>{formatDate(tx.created_at)}</Text>
                  </View>
                </View>
                <Text style={styles.pointTxAmount}>+{tx.puntos}</Text>
              </View>
            ))
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Historial de contribuciones</Text>
          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator color="#106B4F" />
            </View>
          ) : reports.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyEmoji}>📋</Text>
              <Text style={styles.emptyTitle}>Aún no has reportado precios</Text>
              <Text style={styles.emptyText}>
                Reporta el precio de un medicamento en una farmacia y empieza a ganar puntos.
              </Text>
              <TouchableOpacity
                style={styles.emptyCta}
                onPress={() => router.push('/(tabs)/report')}
              >
                <Text style={styles.emptyCtaText}>Hacer mi primer reporte</Text>
              </TouchableOpacity>
            </View>
          ) : (
            reports.map((r) => (
              <View key={r.id} style={styles.reportCard}>
                <View style={styles.reportLeft}>
                  <View style={styles.reportIconBox}>
                    <Text style={styles.reportIcon}>💊</Text>
                  </View>
                  <View style={styles.reportInfo}>
                    <Text style={styles.reportName}>
                      {r.medicationName} {r.medicationDosage}
                    </Text>
                    <Text style={styles.reportPharmacy}>
                      {r.pharmacyName} · {r.pharmacyCity}
                    </Text>
                    <View style={styles.reportMeta}>
                      <Text style={styles.reportDate}>{formatDate(r.createdAt)}</Text>
                      {r.hasPhoto && (
                        <View style={styles.reportPhotoBadge}>
                          <CameraIcon size={10} color="#666" />
                          <Text style={styles.reportPhotoText}>foto</Text>
                        </View>
                      )}
                    </View>
                  </View>
                </View>
                <View style={styles.reportRight}>
                  <Text style={styles.reportPrice}>RD${r.price.toFixed(2)}</Text>
                  <View
                    style={[
                      styles.statusBadge,
                      r.status === 'verificado'
                        ? styles.statusVerified
                        : styles.statusPending,
                    ]}
                  >
                    {r.status === 'verificado' ? (
                      <ShieldCheck size={12} color="#106B4F" />
                    ) : (
                      <Clock size={12} color="#E65100" />
                    )}
                    <Text
                      style={[
                        styles.statusText,
                        r.status === 'verificado'
                          ? styles.statusTextVerified
                          : styles.statusTextPending,
                      ]}
                    >
                      {r.status === 'verificado' ? 'Verificado' : 'Pendiente'}
                    </Text>
                  </View>
                </View>
              </View>
            ))
          )}
        </View>

        {rol === 'admin' && (
          <View style={styles.roleBanner}>
            <UserCog size={20} color="#0D47A1" />
            <Text style={styles.roleBannerText}>
              Tienes permisos de administrador. Puedes moderar precios y gestionar farmacias.
            </Text>
          </View>
        )}

        {rol === 'farmacia' && (
          <View style={styles.roleBannerOrange}>
            <Store size={20} color="#E65100" />
            <Text style={styles.roleBannerTextOrange}>
              Gestionas los precios de tu farmacia. Puedes verificar reportes de tus clientes.
            </Text>
          </View>
        )}

        <View style={styles.footerSpace} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  backButton: {
    position: 'absolute',
    top: 60,
    left: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  header: { paddingTop: 60, paddingBottom: 24, paddingHorizontal: 20 },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingLeft: 60,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(52, 194, 106,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#34C26A',
  },
  avatarText: { fontSize: 28 },
  headerActions: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  logoutButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userName: {
    fontFamily: 'Poppins-Bold',
    fontSize: 24,
    color: '#FFFFFF',
  },
  userEmail: {
    fontFamily: 'DMSans-Regular',
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  rolBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 10,
  },
  rolBadgeText: {
    fontFamily: 'DMSans-Bold',
    fontSize: 12,
  },
  pointsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(52, 194, 106,0.15)',
    borderRadius: 16,
    padding: 16,
    gap: 16,
    marginTop: 20,
    borderWidth: 1,
    borderColor: 'rgba(52, 194, 106,0.3)',
  },
  pointsLeft: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(52, 194, 106,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pointsRight: { flex: 1 },
  pointsLabel: {
    fontFamily: 'DMSans-Medium',
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
  },
  pointsValue: {
    fontFamily: 'Poppins-Bold',
    fontSize: 28,
    color: '#FFFFFF',
  },
  errorBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFEBEE',
    marginHorizontal: 20,
    marginTop: 12,
    padding: 12,
    borderRadius: 10,
  },
  errorBannerText: { fontFamily: 'DMSans-Medium', fontSize: 13, color: '#D32F2F', flex: 1 },
  errorBannerRetry: { fontFamily: 'DMSans-Bold', fontSize: 13, color: '#D32F2F', marginLeft: 12 },
  farmaciaCta: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#E8F5E9', marginHorizontal: 20, marginTop: 12,
    padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#C8E6C9',
  },
  farmaciaCtaTitle: { fontFamily: 'DMSans-Bold', fontSize: 14, color: '#106B4F' },
  farmaciaCtaText: { fontFamily: 'DMSans-Regular', fontSize: 12, color: '#666', marginTop: 2 },
  farmaciaCtaArrow: { fontFamily: 'Poppins-Bold', fontSize: 20, color: '#106B4F' },
  familiaCta: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#FFFFFF', marginHorizontal: 20, marginTop: 12,
    padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#E0E0E0',
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  familiaCtaIcon: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center', alignItems: 'center',
  },
  familiaCtaTitle: { fontFamily: 'DMSans-Bold', fontSize: 14, color: '#106B4F' },
  familiaCtaText: { fontFamily: 'DMSans-Regular', fontSize: 12, color: '#666', marginTop: 2 },
  familiaCtaArrow: { fontFamily: 'Poppins-Bold', fontSize: 20, color: '#106B4F' },
  farmaciaStatusPending: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#FFF3E0', marginHorizontal: 20, marginTop: 12,
    padding: 14, borderRadius: 12,
  },
  farmaciaStatusRejected: {
    backgroundColor: '#FFEBEE', marginHorizontal: 20, marginTop: 12,
    padding: 14, borderRadius: 12,
  },
  farmaciaStatusTitle: { fontFamily: 'DMSans-Bold', fontSize: 14, color: '#052419' },
  farmaciaStatusText: { fontFamily: 'DMSans-Regular', fontSize: 12, color: '#666', marginTop: 2 },
  content: { flex: 1 },
  statsGrid: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  statValue: {
    fontFamily: 'Poppins-Bold',
    fontSize: 22,
    color: '#052419',
  },
  statLabel: {
    fontFamily: 'DMSans-Regular',
    fontSize: 11,
    color: '#666666',
  },
  section: { paddingHorizontal: 20, marginBottom: 16 },
  sectionTitle: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 16,
    color: '#052419',
    marginBottom: 12,
  },
  loadingBox: { padding: 40, alignItems: 'center' },
  emptyBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    gap: 8,
  },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 16,
    color: '#052419',
  },
  emptyText: {
    fontFamily: 'DMSans-Regular',
    fontSize: 13,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 8,
  },
  emptyCta: {
    backgroundColor: '#106B4F',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  emptyCtaText: {
    fontFamily: 'DMSans-Bold',
    fontSize: 13,
    color: '#FFFFFF',
  },
  reportCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  reportLeft: { flexDirection: 'row', gap: 12, flex: 1 },
  reportIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F0F9F4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reportIcon: { fontSize: 20 },
  reportInfo: { flex: 1 },
  reportName: {
    fontFamily: 'DMSans-Medium',
    fontSize: 14,
    color: '#052419',
  },
  reportPharmacy: {
    fontFamily: 'DMSans-Regular',
    fontSize: 12,
    color: '#666666',
    marginTop: 2,
  },
  reportMeta: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
    alignItems: 'center',
  },
  reportDate: {
    fontFamily: 'DMSans-Regular',
    fontSize: 11,
    color: '#999999',
  },
  reportPhotoBadge: {
    flexDirection: 'row',
    gap: 3,
    alignItems: 'center',
    backgroundColor: '#F0F0F0',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
  },
  reportPhotoText: {
    fontFamily: 'DMSans-Regular',
    fontSize: 10,
    color: '#666',
  },
  reportRight: {
    alignItems: 'flex-end',
    gap: 6,
    marginLeft: 12,
  },
  reportPrice: {
    fontFamily: 'Poppins-Bold',
    fontSize: 15,
    color: '#106B4F',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusVerified: { backgroundColor: '#E8F5E9' },
  statusPending: { backgroundColor: '#FFF3E0' },
  statusText: {
    fontFamily: 'DMSans-Bold',
    fontSize: 10,
  },
  statusTextVerified: { color: '#106B4F' },
  statusTextPending: { color: '#E65100' },
  roleBanner: {
    flexDirection: 'row',
    backgroundColor: '#E3F2FD',
    padding: 14,
    marginHorizontal: 20,
    borderRadius: 12,
    gap: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  roleBannerText: {
    flex: 1,
    fontFamily: 'DMSans-Medium',
    fontSize: 13,
    color: '#0D47A1',
    lineHeight: 18,
  },
  roleBannerOrange: {
    flexDirection: 'row',
    backgroundColor: '#FFF3E0',
    padding: 14,
    marginHorizontal: 20,
    borderRadius: 12,
    gap: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  roleBannerTextOrange: {
    flex: 1,
    fontFamily: 'DMSans-Medium',
    fontSize: 13,
    color: '#E65100',
    lineHeight: 18,
  },
  pointTxCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  pointTxLeft: { flexDirection: 'row', gap: 12, flex: 1, alignItems: 'center' },
  pointTxIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(52, 194, 106,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pointTxIconBoxVerified: {
    backgroundColor: '#E8F5E9',
  },
  pointTxInfo: { flex: 1 },
  pointTxDesc: {
    fontFamily: 'DMSans-Medium',
    fontSize: 14,
    color: '#052419',
  },
  pointTxDate: {
    fontFamily: 'DMSans-Regular',
    fontSize: 11,
    color: '#999999',
    marginTop: 3,
  },
  pointTxAmount: {
    fontFamily: 'Poppins-Bold',
    fontSize: 18,
    color: '#106B4F',
    marginLeft: 12,
  },
  footerSpace: { height: 40 },
});
