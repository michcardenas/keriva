import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Image } from 'react-native';
import {
  Award,
  Trophy,
  Gift,
  LogOut,
  ArrowLeft,
  ShieldCheck,
  Clock,
  Camera as CameraIcon,
  Store,
  Users,
  ChevronRight,
  Pencil,
  Plus,
  Moon,
  Sun,
  BellRing,
} from 'lucide-react-native';
import { useColorMode } from '@/lib/ThemeContext';
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
import { getMiFarmacia, type FarmaciaCuenta } from '@/lib/api/farmacias';
import { getSucursales } from '@/lib/api/sucursales';
import { getReservasFarmacia } from '@/lib/api/reservas';
import LanguageSelector from '@/components/LanguageSelector';
import { useLanguage } from '@/lib/LanguageContext';
import { theme } from '@/lib/theme';
import PressableScale from '@/components/ui/PressableScale';
import Reveal from '@/components/ui/Reveal';
import PillBackground from '@/components/ui/PillBackground';

const ROL_COLORS: Record<Rol, { bg: string; text: string }> = {
  usuario: { bg: theme.colors.accentSoft, text: theme.colors.accent },
  farmacia: { bg: theme.colors.warningSoft, text: theme.colors.warning },
  admin: { bg: theme.colors.infoSoft, text: theme.colors.info },
};

function RolIcon({ rol }: { rol: Rol }) {
  if (rol === 'farmacia') return <Store size={14} color={ROL_COLORS.farmacia.text} />;
  return <Award size={14} color={ROL_COLORS.usuario.text} />;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('es-DO', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function ProfileScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const { user, perfil, session, refreshPerfil } = useAuth();
  const { mode, toggle: toggleColorMode } = useColorMode();
  const rolLabel = (r: Rol) =>
    r === 'farmacia' ? t.profile.rolePharmacy : t.profile.roleUser;
  const [reports, setReports] = useState<MyReport[]>([]);
  const [stats, setStats] = useState({ totalReports: 0, verifiedReports: 0, pendingReports: 0 });
  const [points, setPoints] = useState(0);
  const [pointsHistory, setPointsHistory] = useState<PointTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);
  const [solicitud, setSolicitud] = useState<SolicitudFarmacia | null>(null);
  const [miFarmacia, setMiFarmacia] = useState<FarmaciaCuenta | null>(null);
  const [farmaciaStats, setFarmaciaStats] = useState({ sucursales: 0, pendientes: 0, confirmadas: 0 });

  const loadData = useCallback(async () => {
    if (!user) return;
    try {
      setDataError(null);
      // Para rol=farmacia no traemos puntos/reportes/familia: la vista no los
      // muestra y son llamadas innecesarias.
      if (perfil?.rol === 'farmacia') {
        const farmaciaId = perfil.farmaciaId;
        const [f, sucs, pend, conf] = await Promise.all([
          getMiFarmacia(),
          farmaciaId ? getSucursales(farmaciaId) : Promise.resolve([]),
          getReservasFarmacia('pendiente'),
          getReservasFarmacia('confirmada'),
        ]);
        setMiFarmacia(f);
        setFarmaciaStats({
          sucursales: sucs.length,
          pendientes: pend.length,
          confirmadas: conf.length,
        });
      } else {
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
      }
    } catch {
      setDataError(t.profile.dataError);
    } finally {
      setLoading(false);
    }
  }, [user, perfil?.rol]);

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
    // Tras cerrar sesión enviamos al login (no al registro). Al navegar a una
    // ruta fuera de (tabs), el guard de _layout no redirige a /auth/register.
    router.replace('/auth/login');
  }

  if (!session) {
    return (
      <AuthRequiredPlaceholder
        icon={<Award size={56} color={theme.colors.accent} />}
        title={t.profile.authTitle}
        description={t.profile.authDesc}
      />
    );
  }

  const displayName =
    perfil?.nombre ??
    (user?.user_metadata?.nombre as string | undefined) ??
    user?.email?.split('@')[0] ??
    t.profile.defaultName;
  const displayEmail = perfil?.email ?? user?.email ?? '';
  const rol: Rol = perfil?.rol ?? 'usuario';
  const rolColors = ROL_COLORS[rol];

  // ─────────────────────────────────────────────────────────────────────
  // Vista del rol FARMACIA: oculta Mi familia / puntos / stats / reportes
  // y muestra la cuenta de la marca + atajos a Mi Farmacia y al editor.
  // ─────────────────────────────────────────────────────────────────────
  if (rol === 'farmacia') {
    const farmaciaNombre = miFarmacia?.nombre ?? displayName;
    return (
      <View style={styles.container}>
        <PillBackground />
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.topBar}>
            <PressableScale
              style={styles.backButton}
              onPress={() => router.push('/(tabs)/farmacia')}
              scaleTo={0.9}
            >
              <ArrowLeft size={22} color={theme.colors.textPrimary} />
            </PressableScale>
            <View style={styles.topBarActions}>
              <LanguageSelector />
              <PressableScale style={styles.logoutButton} onPress={handleLogout} scaleTo={0.9}>
                <LogOut size={20} color={theme.colors.danger} />
              </PressableScale>
            </View>
          </View>

          <Reveal variant="up" delay={40}>
            <View style={styles.profileCard}>
              <View style={styles.avatar}>
                {miFarmacia?.logoUrl ? (
                  <Image source={{ uri: miFarmacia.logoUrl }} style={styles.avatarPhoto} />
                ) : (
                  <Text style={styles.avatarInitials}>{getInitials(farmaciaNombre)}</Text>
                )}
                <View style={styles.avatarLogoBadge}>
                  <Store size={16} color={theme.colors.surface} />
                </View>
              </View>
              <Text style={styles.userName} numberOfLines={1}>{farmaciaNombre}</Text>
              <Text style={styles.userEmail} numberOfLines={1}>{displayEmail}</Text>
              <View style={[styles.rolBadge, { backgroundColor: rolColors.bg }]}>
                <RolIcon rol={rol} />
                <Text style={[styles.rolBadgeText, { color: rolColors.text }]}>
                  {rolLabel(rol)}
                </Text>
              </View>
            </View>
          </Reveal>

          {dataError && (
            <Reveal variant="fade">
              <PressableScale style={styles.errorBanner} onPress={loadData}>
                <Text style={styles.errorBannerText}>{dataError}</Text>
                <Text style={styles.errorBannerRetry}>{t.profile.retry}</Text>
              </PressableScale>
            </Reveal>
          )}

          {/* Card destacada: reservas pendientes (acción directa). */}
          <Reveal variant="up" delay={100}>
            <PressableScale
              style={styles.pointsCard}
              onPress={() => router.push('/farmacia/reservas')}
              scaleTo={0.98}
            >
              <View style={styles.pharmacyHeroBubble}>
                <Clock size={28} color={theme.colors.warning} />
              </View>
              <View style={styles.pointsInfo}>
                <Text style={styles.pointsLabel}>Reservas pendientes</Text>
                <Text style={styles.pharmacyHeroValue}>
                  {farmaciaStats.pendientes.toLocaleString('es-DO')}
                </Text>
              </View>
              <View style={styles.pointsGiftBubble}>
                <ChevronRight size={20} color={theme.colors.warning} />
              </View>
            </PressableScale>
          </Reveal>

          {/* Stats grid: Sucursales / Pendientes / Ventas confirmadas. */}
          <View style={styles.statsGrid}>
            <Reveal style={styles.statCardWrap} index={0} delay={160}>
              <View style={styles.statCard}>
                <View style={styles.statIconBubble}>
                  <Store size={20} color={theme.colors.accent} />
                </View>
                <Text style={styles.statValue}>{farmaciaStats.sucursales}</Text>
                <Text style={styles.statLabel}>Sucursales</Text>
              </View>
            </Reveal>
            <Reveal style={styles.statCardWrap} index={1} delay={160}>
              <View style={styles.statCard}>
                <View style={styles.statIconBubbleWarning}>
                  <Clock size={20} color={theme.colors.warning} />
                </View>
                <Text style={styles.statValue}>{farmaciaStats.pendientes}</Text>
                <Text style={styles.statLabel}>Pendientes</Text>
              </View>
            </Reveal>
            <Reveal style={styles.statCardWrap} index={2} delay={160}>
              <View style={styles.statCard}>
                <View style={styles.statIconBubble}>
                  <ShieldCheck size={20} color={theme.colors.accent} />
                </View>
                <Text style={styles.statValue}>{farmaciaStats.confirmadas}</Text>
                <Text style={styles.statLabel}>Ventas</Text>
              </View>
            </Reveal>
          </View>

          <Reveal variant="up" delay={220}>
            <PressableScale
              style={styles.farmaciaCta}
              onPress={() => router.push('/farmacia/cuenta')}
            >
              <View style={styles.ctaIconBubble}>
                <Pencil size={22} color={theme.colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.ctaTitle}>Editar perfil de la cuenta</Text>
                <Text style={styles.ctaText}>Cambia el nombre comercial y el logo de tu marca.</Text>
              </View>
              <ChevronRight size={20} color={theme.colors.accent} />
            </PressableScale>
          </Reveal>

          <Reveal variant="up" delay={260}>
            <PressableScale
              style={styles.familiaCta}
              onPress={() => router.push('/(tabs)/farmacia')}
            >
              <View style={styles.ctaIconBubble}>
                <Store size={22} color={theme.colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.ctaTitle}>Mi Farmacia</Text>
                <Text style={styles.ctaText}>
                  Sucursales, inventario, reservas y métricas.
                </Text>
              </View>
              <ChevronRight size={20} color={theme.colors.accent} />
            </PressableScale>
          </Reveal>

          <View style={styles.roleBannerOrange}>
            <Store size={20} color={theme.colors.warning} />
            <Text style={styles.roleBannerTextOrange}>{t.profile.pharmacyBanner}</Text>
          </View>

          <View style={styles.footerSpace} />
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <PillBackground />

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Top bar */}
        <View style={styles.topBar}>
          <PressableScale
            style={styles.backButton}
            onPress={() => router.push('/(tabs)')}
            scaleTo={0.9}
          >
            <ArrowLeft size={22} color={theme.colors.textPrimary} />
          </PressableScale>
          <View style={styles.topBarActions}>
            <LanguageSelector />
            <PressableScale
              style={styles.editButton}
              onPress={() => router.push('/editar-perfil' as any)}
              scaleTo={0.9}
            >
              <Pencil size={18} color={theme.colors.accent} />
            </PressableScale>
            <PressableScale style={styles.logoutButton} onPress={handleLogout} scaleTo={0.9}>
              <LogOut size={20} color={theme.colors.danger} />
            </PressableScale>
          </View>
        </View>

        {/* Profile header card */}
        <Reveal variant="up" delay={40}>
          <View style={styles.profileCard}>
            <View style={styles.avatar}>
              {perfil?.avatarUrl ? (
                <Image source={{ uri: perfil.avatarUrl }} style={styles.avatarPhoto} />
              ) : (
                <Text style={styles.avatarInitials}>{getInitials(displayName)}</Text>
              )}
              <View style={styles.avatarLogoBadge}>
                <Image
                  source={require('@/assets/images/logo.png')}
                  style={styles.avatarLogoImage}
                  resizeMode="contain"
                />
              </View>
            </View>
            <Text style={styles.userName} numberOfLines={1}>{displayName}</Text>
            <Text style={styles.userEmail} numberOfLines={1}>{displayEmail}</Text>

            <View style={[styles.rolBadge, { backgroundColor: rolColors.bg }]}>
              <RolIcon rol={rol} />
              <Text style={[styles.rolBadgeText, { color: rolColors.text }]}>
                {rolLabel(rol)}
              </Text>
            </View>
          </View>
        </Reveal>

        {/* Points hero card → abre Keriva Wallet */}
        <Reveal variant="up" delay={100}>
          <PressableScale
            style={styles.pointsCard}
            onPress={() => router.push('/wallet' as any)}
            scaleTo={0.98}
          >
            <View style={styles.pointsIconBubble}>
              <Award size={28} color={theme.colors.accent} />
            </View>
            <View style={styles.pointsInfo}>
              <Text style={styles.pointsLabel}>{t.profile.totalPoints}</Text>
              <Text style={styles.pointsValue}>{points.toLocaleString('es-DO')}</Text>
            </View>
            <View style={styles.pointsGiftBubble}>
              <ChevronRight size={20} color={theme.colors.accent} />
            </View>
          </PressableScale>
        </Reveal>

        {dataError && (
          <Reveal variant="fade">
            <PressableScale style={styles.errorBanner} onPress={loadData}>
              <Text style={styles.errorBannerText}>{dataError}</Text>
              <Text style={styles.errorBannerRetry}>{t.profile.retry}</Text>
            </PressableScale>
          </Reveal>
        )}

        {/* Pharmacy registration CTA / status — only for regular users */}
        {rol === 'usuario' && !loading && (
          !solicitud ? (
            <Reveal variant="up" delay={140}>
              <PressableScale
                style={styles.farmaciaCta}
                onPress={() => router.push('/registro-farmacia')}
              >
                <View style={styles.ctaIconBubble}>
                  <Store size={22} color={theme.colors.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.ctaTitle}>{t.profile.havePharmacyTitle}</Text>
                  <Text style={styles.ctaText}>{t.profile.havePharmacyText}</Text>
                </View>
                <ChevronRight size={20} color={theme.colors.accent} />
              </PressableScale>
            </Reveal>
          ) : solicitud.estado === 'pendiente' ? (
            <Reveal variant="up" delay={140}>
              <View style={styles.farmaciaStatusPending}>
                <View style={styles.ctaIconBubbleWarning}>
                  <Clock size={20} color={theme.colors.warning} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.statusTitle}>{t.profile.requestPendingTitle}</Text>
                  <Text style={styles.ctaText}>
                    {t.profile.requestPendingText.replace('{name}', solicitud.nombreComercial)}
                  </Text>
                </View>
              </View>
            </Reveal>
          ) : solicitud.estado === 'rechazada' ? (
            <Reveal variant="up" delay={140}>
              <PressableScale
                style={styles.farmaciaStatusRejected}
                onPress={() => router.push('/registro-farmacia')}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.statusTitle}>{t.profile.requestRejectedTitle}</Text>
                  <Text style={styles.ctaText}>
                    {solicitud.motivoRechazo || t.profile.requestRejectedDefault}
                  </Text>
                  <Text style={styles.rejectedRetry}>
                    {t.profile.requestRejectedRetry}
                  </Text>
                </View>
              </PressableScale>
            </Reveal>
          ) : null
        )}

        {/* R5: Recordatorios de hoy — atajo */}
        <Reveal variant="up" delay={160}>
          <PressableScale
            style={styles.familiaCta}
            onPress={() => router.push('/care/hoy' as any)}
          >
            <View style={styles.ctaIconBubble}>
              <BellRing size={22} color={theme.colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.ctaTitle}>Recordatorios de hoy</Text>
              <Text style={styles.ctaText}>
                Próximas tomas de toda tu familia, ordenadas por hora.
              </Text>
            </View>
            <ChevronRight size={20} color={theme.colors.accent} />
          </PressableScale>
        </Reveal>

        {/* Mi familia (Multi-Perfil) */}
        <Reveal variant="up" delay={180}>
          <PressableScale
            style={styles.familiaCta}
            onPress={() => router.push('/familia' as any)}
          >
            <View style={styles.ctaIconBubble}>
              <Users size={22} color={theme.colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.ctaTitle}>{t.profile.myFamily}</Text>
              <Text style={styles.ctaText}>{t.profile.familyDesc}</Text>
            </View>
            <ChevronRight size={20} color={theme.colors.accent} />
          </PressableScale>
        </Reveal>

        {/* Stats grid */}
        <View style={styles.statsGrid}>
          <Reveal style={styles.statCardWrap} index={0} delay={220}>
            <View style={styles.statCard}>
              <View style={styles.statIconBubble}>
                <Trophy size={20} color={theme.colors.accent} />
              </View>
              <Text style={styles.statValue}>{stats.totalReports}</Text>
              <Text style={styles.statLabel}>{t.profile.reports}</Text>
            </View>
          </Reveal>
          <Reveal style={styles.statCardWrap} index={1} delay={220}>
            <View style={styles.statCard}>
              <View style={styles.statIconBubble}>
                <ShieldCheck size={20} color={theme.colors.accent} />
              </View>
              <Text style={styles.statValue}>{stats.verifiedReports}</Text>
              <Text style={styles.statLabel}>{t.profile.verified}</Text>
            </View>
          </Reveal>
          <Reveal style={styles.statCardWrap} index={2} delay={220}>
            <View style={styles.statCard}>
              <View style={styles.statIconBubble}>
                <Clock size={20} color={theme.colors.accent} />
              </View>
              <Text style={styles.statValue}>{stats.pendingReports}</Text>
              <Text style={styles.statLabel}>{t.profile.pending}</Text>
            </View>
          </Reveal>
        </View>

        {/* Points history */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t.profile.pointsHistory}</Text>
          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator color={theme.colors.accent} />
            </View>
          ) : pointsHistory.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyEmoji}>⭐</Text>
              <Text style={styles.emptyTitle}>{t.profile.noPointsTitle}</Text>
              <Text style={styles.emptyText}>{t.profile.noPointsText}</Text>
            </View>
          ) : (
            pointsHistory.map((tx, idx) => (
              <Reveal key={tx.id ?? idx} index={idx}>
                <View style={styles.pointTxCard}>
                  <View style={styles.pointTxLeft}>
                    <View
                      style={[
                        styles.pointTxIconBox,
                        tx.accion === 'reporte_verificado' && styles.pointTxIconBoxVerified,
                      ]}
                    >
                      {tx.accion === 'reporte_verificado' ? (
                        <ShieldCheck size={18} color={theme.colors.accent} />
                      ) : (
                        <CameraIcon size={18} color={theme.colors.accent} />
                      )}
                    </View>
                    <View style={styles.pointTxInfo}>
                      <Text style={styles.pointTxDesc}>{tx.descripcion}</Text>
                      <Text style={styles.pointTxDate}>{formatDate(tx.created_at)}</Text>
                    </View>
                  </View>
                  <Text style={styles.pointTxAmount}>+{tx.puntos}</Text>
                </View>
              </Reveal>
            ))
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, styles.sectionTitleInRow]} numberOfLines={1}>
              {t.profile.contributionsHistory}
            </Text>
            <PressableScale
              style={styles.newContribBtn}
              onPress={() => router.push('/(tabs)/report')}
              scaleTo={0.94}
            >
              <Plus size={16} color={theme.colors.accentText} />
              <Text style={styles.newContribText} numberOfLines={1}>{t.profile.newContribution}</Text>
            </PressableScale>
          </View>
          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator color={theme.colors.accent} />
            </View>
          ) : reports.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyEmoji}>📋</Text>
              <Text style={styles.emptyTitle}>{t.profile.noReportsTitle}</Text>
              <Text style={styles.emptyText}>{t.profile.noReportsText}</Text>
              <PressableScale
                style={styles.emptyCta}
                onPress={() => router.push('/(tabs)/report')}
              >
                <Text style={styles.emptyCtaText}>{t.profile.firstReport}</Text>
              </PressableScale>
            </View>
          ) : (
            reports.map((r, idx) => (
              <Reveal key={r.id} index={idx}>
                <View style={styles.reportCard}>
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
                            <CameraIcon size={10} color={theme.colors.textSecondary} />
                            <Text style={styles.reportPhotoText}>{t.profile.photo}</Text>
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
                        <ShieldCheck size={12} color={theme.colors.accent} />
                      ) : (
                        <Clock size={12} color={theme.colors.warning} />
                      )}
                      <Text
                        style={[
                          styles.statusText,
                          r.status === 'verificado'
                            ? styles.statusTextVerified
                            : styles.statusTextPending,
                        ]}
                      >
                        {r.status === 'verificado' ? t.profile.statusVerified : t.profile.statusPending}
                      </Text>
                    </View>
                  </View>
                </View>
              </Reveal>
            ))
          )}
        </View>

        {/* T1: toggle tema oscuro/claro persistente */}
        <Reveal variant="up" delay={260}>
          <PressableScale style={styles.themeCta} onPress={toggleColorMode}>
            <View style={styles.ctaIconBubble}>
              {mode === 'dark' ? (
                <Sun size={22} color={theme.colors.accent} />
              ) : (
                <Moon size={22} color={theme.colors.accent} />
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.ctaTitle}>
                {mode === 'dark' ? 'Modo claro' : 'Modo oscuro'}
              </Text>
              <Text style={styles.ctaText}>
                {mode === 'dark'
                  ? 'Volver al tema con fondo blanco.'
                  : 'Cambia a un fondo oscuro con verde neón.'}
              </Text>
            </View>
            <ChevronRight size={20} color={theme.colors.accent} />
          </PressableScale>
        </Reveal>

        {/* La gestión de farmacia vive en el tab "Mi Farmacia" y en su propia
            rama de este componente (early return arriba). El rol admin se
            gestiona desde el panel web aparte, no desde la app móvil. */}

        <View style={styles.footerSpace} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  content: { flex: 1 },
  scrollContent: {
    paddingHorizontal: theme.spacing.xl,
    paddingTop: 54,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  topBarActions: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    alignItems: 'center',
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    ...theme.shadow.sm,
  },
  logoutButton: {
    width: 44,
    height: 44,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.dangerSoft,
    justifyContent: 'center',
    alignItems: 'center',
    ...theme.shadow.sm,
  },
  editButton: {
    width: 44,
    height: 44,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.accentSoft,
    justifyContent: 'center',
    alignItems: 'center',
    ...theme.shadow.sm,
  },
  profileCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    paddingVertical: theme.spacing.xxl,
    paddingHorizontal: theme.spacing.xl,
    alignItems: 'center',
    ...theme.shadow.card,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
    overflow: 'hidden',
    ...theme.shadow.accent,
  },
  avatarPhoto: {
    width: '100%',
    height: '100%',
  },
  avatarInitials: {
    fontFamily: theme.font.bold,
    fontSize: 34,
    color: theme.colors.accentText,
    letterSpacing: 0.5,
  },
  avatarLogoBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 34,
    height: 34,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.accentDark,
    borderWidth: 3,
    borderColor: theme.colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarLogoImage: {
    width: 20,
    height: 20,
  },
  userName: {
    ...theme.text.h1,
    color: theme.colors.textPrimary,
    textAlign: 'center',
  },
  userEmail: {
    ...theme.text.body,
    color: theme.colors.textSecondary,
    marginTop: 2,
    textAlign: 'center',
  },
  rolBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 5,
    borderRadius: theme.radius.pill,
    marginTop: theme.spacing.md,
  },
  rolBadgeText: {
    ...theme.text.label,
    fontFamily: theme.font.bodyBold,
    fontSize: 12,
    letterSpacing: 0.2,
  },
  pointsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    gap: theme.spacing.lg,
    marginTop: theme.spacing.lg,
    ...theme.shadow.card,
  },
  pointsIconBubble: {
    width: 56,
    height: 56,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.accentSofter,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pointsInfo: { flex: 1 },
  pointsLabel: {
    ...theme.text.bodyMedium,
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  pointsValue: {
    fontFamily: theme.font.bold,
    fontSize: 28,
    color: theme.colors.textPrimary,
    marginTop: 2,
  },
  pointsGiftBubble: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.warningSoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: theme.colors.dangerSoft,
    marginTop: theme.spacing.lg,
    padding: theme.spacing.lg,
    borderRadius: theme.radius.md,
  },
  errorBannerText: {
    ...theme.text.bodyMedium,
    fontSize: 13,
    color: theme.colors.danger,
    flex: 1,
  },
  errorBannerRetry: {
    ...theme.text.bodyMedium,
    fontFamily: theme.font.bodyBold,
    fontSize: 13,
    color: theme.colors.danger,
    marginLeft: theme.spacing.md,
  },
  farmaciaCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    marginTop: theme.spacing.lg,
    padding: theme.spacing.lg,
    borderRadius: theme.radius.lg,
    ...theme.shadow.card,
  },
  familiaCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    marginTop: theme.spacing.md,
    padding: theme.spacing.lg,
    borderRadius: theme.radius.lg,
    ...theme.shadow.card,
  },
  themeCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    marginTop: theme.spacing.lg,
    padding: theme.spacing.lg,
    borderRadius: theme.radius.lg,
    ...theme.shadow.card,
  },
  ctaIconBubble: {
    width: 48,
    height: 48,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.accentSofter,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ctaIconBubbleWarning: {
    width: 48,
    height: 48,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.warningSoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ctaTitle: {
    ...theme.text.title,
    color: theme.colors.textPrimary,
  },
  ctaText: {
    ...theme.text.caption,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  statusTitle: {
    ...theme.text.title,
    color: theme.colors.textPrimary,
  },
  rejectedRetry: {
    ...theme.text.caption,
    fontFamily: theme.font.bodyBold,
    color: theme.colors.danger,
    marginTop: 4,
  },
  farmaciaStatusPending: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    marginTop: theme.spacing.md,
    padding: theme.spacing.lg,
    borderRadius: theme.radius.lg,
    ...theme.shadow.card,
  },
  farmaciaStatusRejected: {
    backgroundColor: theme.colors.surface,
    marginTop: theme.spacing.md,
    padding: theme.spacing.lg,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.dangerSoft,
    ...theme.shadow.card,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginTop: theme.spacing.lg,
  },
  statCardWrap: { flex: 1 },
  statCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    paddingVertical: theme.spacing.lg,
    paddingHorizontal: theme.spacing.sm,
    alignItems: 'center',
    gap: 6,
    ...theme.shadow.card,
  },
  statIconBubble: {
    width: 44,
    height: 44,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.accentSofter,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
  },
  statIconBubbleWarning: {
    width: 44,
    height: 44,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.warningSoft,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
  },
  pharmacyHeroBubble: {
    width: 56,
    height: 56,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.warningSoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pharmacyHeroValue: {
    fontFamily: theme.font.bold,
    fontSize: 28,
    color: theme.colors.warning,
    marginTop: 2,
  },
  statValue: {
    fontFamily: theme.font.bold,
    fontSize: 22,
    color: theme.colors.textPrimary,
  },
  statLabel: {
    ...theme.text.caption,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  section: { marginTop: theme.spacing.xxl },
  sectionTitle: {
    ...theme.text.h2,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.lg,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
  },
  // En el header-row el título debe encogerse para no empujar el botón fuera
  // de pantalla (Bug 7). marginBottom:0 porque el row centra verticalmente.
  sectionTitleInRow: {
    flexShrink: 1,
    marginBottom: 0,
  },
  newContribBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
    backgroundColor: theme.colors.accent,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 8,
    borderRadius: theme.radius.pill,
    marginBottom: theme.spacing.lg,
    ...theme.shadow.accent,
  },
  newContribText: {
    fontFamily: theme.font.bold,
    fontSize: 13,
    color: theme.colors.accentText,
  },
  loadingBox: { padding: theme.spacing.huge, alignItems: 'center' },
  emptyBox: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.xxl,
    alignItems: 'center',
    gap: theme.spacing.sm,
    ...theme.shadow.card,
  },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: {
    ...theme.text.h3,
    color: theme.colors.textPrimary,
  },
  emptyText: {
    ...theme.text.body,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: theme.spacing.sm,
  },
  emptyCta: {
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius.pill,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.xxl,
    ...theme.shadow.accent,
  },
  emptyCtaText: {
    fontFamily: theme.font.bold,
    fontSize: 14,
    color: theme.colors.accentText,
  },
  reportCard: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    justifyContent: 'space-between',
    alignItems: 'center',
    ...theme.shadow.card,
  },
  reportLeft: { flexDirection: 'row', gap: theme.spacing.md, flex: 1 },
  reportIconBox: {
    width: 48,
    height: 48,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.accentSofter,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reportIcon: { fontSize: 22 },
  reportInfo: { flex: 1 },
  reportName: {
    ...theme.text.title,
    color: theme.colors.textPrimary,
  },
  reportPharmacy: {
    ...theme.text.caption,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  reportMeta: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginTop: 4,
    alignItems: 'center',
  },
  reportDate: {
    ...theme.text.caption,
    fontSize: 11,
    color: theme.colors.textMuted,
  },
  reportPhotoBadge: {
    flexDirection: 'row',
    gap: 3,
    alignItems: 'center',
    backgroundColor: theme.colors.bgSecondary,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: theme.radius.sm,
  },
  reportPhotoText: {
    ...theme.text.caption,
    fontSize: 10,
    color: theme.colors.textSecondary,
  },
  reportRight: {
    alignItems: 'flex-end',
    gap: 6,
    marginLeft: theme.spacing.md,
  },
  reportPrice: {
    fontFamily: theme.font.bold,
    fontSize: 15,
    color: theme.colors.accent,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: theme.radius.xs,
  },
  statusVerified: { backgroundColor: theme.colors.accentSoft },
  statusPending: { backgroundColor: theme.colors.warningSoft },
  statusText: {
    ...theme.text.label,
    fontSize: 10,
  },
  statusTextVerified: { color: theme.colors.accent },
  statusTextPending: { color: theme.colors.warning },
  roleBanner: {
    flexDirection: 'row',
    backgroundColor: theme.colors.infoSoft,
    padding: theme.spacing.lg,
    marginTop: theme.spacing.lg,
    borderRadius: theme.radius.lg,
    gap: theme.spacing.md,
    alignItems: 'center',
  },
  roleBannerText: {
    flex: 1,
    ...theme.text.bodyMedium,
    fontSize: 13,
    color: theme.colors.info,
  },
  roleBannerOrange: {
    flexDirection: 'row',
    backgroundColor: theme.colors.warningSoft,
    padding: theme.spacing.lg,
    marginTop: theme.spacing.lg,
    borderRadius: theme.radius.lg,
    gap: theme.spacing.md,
    alignItems: 'center',
  },
  roleBannerTextOrange: {
    flex: 1,
    ...theme.text.bodyMedium,
    fontSize: 13,
    color: theme.colors.warning,
  },
  manageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.lg,
    marginTop: theme.spacing.md,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadow.sm,
  },
  manageIcon: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  manageTitle: { ...theme.text.title, color: theme.colors.textPrimary },
  manageDesc: { ...theme.text.caption, color: theme.colors.textSecondary, marginTop: 2 },
  pointTxCard: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    justifyContent: 'space-between',
    alignItems: 'center',
    ...theme.shadow.card,
  },
  pointTxLeft: { flexDirection: 'row', gap: theme.spacing.md, flex: 1, alignItems: 'center' },
  pointTxIconBox: {
    width: 44,
    height: 44,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.accentSofter,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pointTxIconBoxVerified: {
    backgroundColor: theme.colors.accentSoft,
  },
  pointTxInfo: { flex: 1 },
  pointTxDesc: {
    ...theme.text.title,
    color: theme.colors.textPrimary,
  },
  pointTxDate: {
    ...theme.text.caption,
    fontSize: 11,
    color: theme.colors.textMuted,
    marginTop: 3,
  },
  pointTxAmount: {
    fontFamily: theme.font.bold,
    fontSize: 18,
    color: theme.colors.accent,
    marginLeft: theme.spacing.md,
  },
  footerSpace: { height: theme.spacing.huge },
});
