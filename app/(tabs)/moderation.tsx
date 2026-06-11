import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Image,
  RefreshControl,
  Linking,
  Platform,
  TextInput,
} from 'react-native';
import {
  ShieldCheck,
  Clock,
  Check,
  X,
  Store,
  UserCog,
  Camera as CameraIcon,
  Download,
  Search,
  MapPin,
  Phone,
  Pill,
} from 'lucide-react-native';
import { useAuth } from '@/lib/AuthContext';
import {
  getPendingReports,
  verifyReport,
  rejectReport,
  type MyReport,
} from '@/lib/api/precios';
import {
  getPendingSolicitudes,
  aprobarSolicitud,
  rechazarSolicitud,
  type SolicitudFarmacia,
} from '@/lib/api/solicitudes';
import {
  getAllFarmaciasAdmin,
  toggleFarmaciaActiva,
  exportFarmaciasCSV,
  importFarmaciasCSV,
  type FarmaciaAdmin,
} from '@/lib/api/farmacias';
import {
  exportMedicamentosCSV,
  importMedicamentosCSV,
} from '@/lib/api/medicamentos';
import { pickAndParseCSV } from '@/lib/csv';
import LanguageSelector from '@/components/LanguageSelector';
import { useLanguage } from '@/lib/LanguageContext';
import { theme } from '@/lib/theme';
import PressableScale from '@/components/ui/PressableScale';
import Reveal from '@/components/ui/Reveal';
import PillBackground from '@/components/ui/PillBackground';

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

type TabKey = 'reportes' | 'solicitudes' | 'gestion' | 'datos';

export default function ModerationScreen() {
  const { t } = useLanguage();
  const { perfil } = useAuth();
  const rol = perfil?.rol ?? 'usuario';

  const [reports, setReports] = useState<MyReport[]>([]);
  const [solicitudes, setSolicitudes] = useState<SolicitudFarmacia[]>([]);
  const [farmacias, setFarmacias] = useState<FarmaciaAdmin[]>([]);
  const [farmaciaFilter, setFarmaciaFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actioning, setActioning] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('reportes');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (rol === 'usuario') {
      setReports([]);
      setSolicitudes([]);
      setLoading(false);
      return;
    }
    const reportsData = await getPendingReports({
      kind: rol,
      farmaciaId: perfil?.farmaciaId ?? undefined,
    });
    setReports(reportsData);

    if (rol === 'admin') {
      const [solData, farmData] = await Promise.all([
        getPendingSolicitudes(),
        getAllFarmaciasAdmin(),
      ]);
      setSolicitudes(solData);
      setFarmacias(farmData);
    }
    setLoading(false);
  }, [rol, perfil?.farmaciaId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function onRefresh() {
    setRefreshing(true);
    await loadData();
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

  async function handleAprobarSolicitud(id: number) {
    setActioning(id);
    const res = await aprobarSolicitud(id);
    setActioning(null);
    if (res.ok) {
      setSolicitudes((prev) => prev.filter((s) => s.id !== id));
    }
  }

  async function handleToggleFarmacia(id: number, activa: boolean) {
    setActioning(id);
    const res = await toggleFarmaciaActiva(id, activa);
    setActioning(null);
    if (res.ok) {
      setFarmacias((prev) => prev.map((f) => f.id === id ? { ...f, activa } : f));
    }
  }

  async function handleImportCSV(type: 'farmacias' | 'medicamentos') {
    setImporting(true);
    setImportResult(null);
    try {
      const rows = await pickAndParseCSV();
      if (!rows) {
        setImporting(false);
        return; // user cancelled
      }
      if (rows.length === 0) {
        setImportResult(t.moderation.csvEmpty);
        setImporting(false);
        return;
      }
      const result = type === 'farmacias'
        ? await importFarmaciasCSV(rows)
        : await importMedicamentosCSV(rows);
      setImportResult(`${result.inserted} ${t.moderation.recordsImported}${result.errors > 0 ? `, ${result.errors} ${t.moderation.withError}` : ''}`);
      if (type === 'farmacias') {
        const farmData = await getAllFarmaciasAdmin();
        setFarmacias(farmData);
      }
    } catch {
      setImportResult(t.moderation.fileError);
    }
    setImporting(false);
  }

  async function handleRechazarSolicitud(id: number) {
    setActioning(id);
    const res = await rechazarSolicitud(id, t.moderation.autoRejectReason);
    setActioning(null);
    if (res.ok) {
      setSolicitudes((prev) => prev.filter((s) => s.id !== id));
    }
  }

  // Non-privileged users see an info screen
  if (rol === 'usuario') {
    return (
      <View style={styles.container}>
        <PillBackground />
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.headerTopRow}>
            <Text style={styles.headerTitle}>{t.moderation.title}</Text>
          </View>
          <Reveal variant="up" delay={60}>
            <View style={styles.emptyInfo}>
              <View style={styles.emptyIconBubble}>
                <ShieldCheck size={36} color={theme.colors.accent} />
              </View>
              <Text style={styles.emptyInfoTitle}>{t.moderation.onlyForStaff}</Text>
              <Text style={styles.emptyInfoText}>{t.moderation.onlyForStaffDesc}</Text>
            </View>
          </Reveal>
        </ScrollView>
      </View>
    );
  }

  const isAdmin = rol === 'admin';
  const title = isAdmin ? t.moderation.globalTitle : t.moderation.myPharmacyTitle;
  const subtitle = isAdmin
    ? t.moderation.adminSubtitle
    : t.moderation.pharmacySubtitle;

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'reportes', label: `${t.moderation.tabReports} (${reports.length})` },
    { key: 'solicitudes', label: `${t.moderation.tabRequests} (${solicitudes.length})` },
    { key: 'gestion', label: t.moderation.tabManagement },
    { key: 'datos', label: t.moderation.tabData },
  ];

  return (
    <View style={styles.container}>
      <PillBackground />

      {/* Header (claro) */}
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <View style={styles.headerBadge}>
            {isAdmin ? (
              <UserCog size={14} color={theme.colors.accent} />
            ) : (
              <Store size={14} color={theme.colors.accent} />
            )}
            <Text style={styles.headerBadgeText}>
              {isAdmin ? t.moderation.roleAdmin : t.moderation.rolePharmacy}
            </Text>
          </View>
          <LanguageSelector />
        </View>
        <Text style={styles.headerTitle}>{title}</Text>
        <Text style={styles.headerSubtitle}>{subtitle}</Text>

        {/* Farmacia: simple pending count */}
        {!isAdmin && (
          <View style={styles.statsBar}>
            <View style={styles.statBox}>
              <View style={styles.statIconBubble}>
                <Clock size={16} color={theme.colors.accent} />
              </View>
              <Text style={styles.statValue}>{reports.length}</Text>
              <Text style={styles.statLabel}>{t.moderation.pending}</Text>
            </View>
          </View>
        )}

        {/* Admin tabs */}
        {isAdmin && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabBar}
          >
            {tabs.map((tab) => {
              const active = activeTab === tab.key;
              return (
                <PressableScale
                  key={tab.key}
                  style={[styles.tab, active && styles.tabActive]}
                  onPress={() => setActiveTab(tab.key)}
                  scaleTo={0.95}
                >
                  <Text style={[styles.tabText, active && styles.tabTextActive]}>
                    {tab.label}
                  </Text>
                </PressableScale>
              );
            })}
          </ScrollView>
        )}
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentInner}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.accent}
            colors={[theme.colors.accent]}
          />
        }
      >
        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={theme.colors.accent} size="large" />
          </View>
        ) : activeTab === 'datos' && isAdmin ? (
          <View style={{ gap: theme.spacing.lg }}>
            {importResult && (
              <Reveal variant="fade">
                <View style={styles.resultCard}>
                  <Text style={styles.resultText}>{importResult}</Text>
                </View>
              </Reveal>
            )}

            {/* Instructions */}
            <Reveal index={0}>
              <View style={styles.instructionCard}>
                <Text style={styles.cardMedName}>{t.moderation.howToImport}</Text>
                <Text style={styles.instructionText}>{t.moderation.importStep1}</Text>
                <Text style={styles.instructionText}>{t.moderation.importStep2}</Text>
                <Text style={styles.instructionText}>{t.moderation.importStep3}</Text>
                <Text style={styles.instructionText}>{t.moderation.importStep4}</Text>
                <Text style={styles.instructionText}>{t.moderation.importStep5}</Text>
                <Text style={styles.instructionNote}>{t.moderation.importNote}</Text>
              </View>
            </Reveal>

            <Reveal index={1}>
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.cardIconBox}>
                    <Store size={20} color={theme.colors.accent} />
                  </View>
                  <View style={styles.cardHeaderText}>
                    <Text style={styles.cardMedName}>{t.moderation.pharmaciesTitle}</Text>
                    <Text style={styles.cardPharm}>{farmacias.length} {t.moderation.pharmaciesRegistered}</Text>
                  </View>
                </View>
                <View style={styles.actions}>
                  <PressableScale
                    style={[styles.actionBtn, styles.verifyBtn]}
                    onPress={exportFarmaciasCSV}
                  >
                    <Download size={16} color={theme.colors.accentText} />
                    <Text style={styles.verifyText}>{t.moderation.exportCSV}</Text>
                  </PressableScale>
                  <PressableScale
                    style={[styles.actionBtn, styles.importBtn]}
                    onPress={() => handleImportCSV('farmacias')}
                    disabled={importing}
                  >
                    {importing ? (
                      <ActivityIndicator color={theme.colors.info} size="small" />
                    ) : (
                      <Text style={styles.importText}>{t.moderation.importCSV}</Text>
                    )}
                  </PressableScale>
                </View>
                <Text style={styles.instructionColumns}>
                  Columnas: nombre; direccion; ciudad; telefono; horario; activa; latitud; longitud
                </Text>
              </View>
            </Reveal>

            <Reveal index={2}>
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.cardIconBox}>
                    <Pill size={20} color={theme.colors.accent} />
                  </View>
                  <View style={styles.cardHeaderText}>
                    <Text style={styles.cardMedName}>{t.moderation.medicationsTitle}</Text>
                    <Text style={styles.cardPharm}>{t.moderation.medicationsCatalog}</Text>
                  </View>
                </View>
                <View style={styles.actions}>
                  <PressableScale
                    style={[styles.actionBtn, styles.verifyBtn]}
                    onPress={exportMedicamentosCSV}
                  >
                    <Download size={16} color={theme.colors.accentText} />
                    <Text style={styles.verifyText}>{t.moderation.exportCSV}</Text>
                  </PressableScale>
                  <PressableScale
                    style={[styles.actionBtn, styles.importBtn]}
                    onPress={() => handleImportCSV('medicamentos')}
                    disabled={importing}
                  >
                    {importing ? (
                      <ActivityIndicator color={theme.colors.info} size="small" />
                    ) : (
                      <Text style={styles.importText}>{t.moderation.importCSV}</Text>
                    )}
                  </PressableScale>
                </View>
                <Text style={styles.instructionColumns}>
                  Columnas: nombre; nombre_generico; concentracion; presentacion; laboratorio; categoria; precio_referencia_rd
                </Text>
              </View>
            </Reveal>
          </View>
        ) : activeTab === 'gestion' && isAdmin ? (
          <>
            <View style={styles.filterRow}>
              <Search size={16} color={theme.colors.textMuted} />
              <TextInput
                style={styles.filterInput}
                placeholder={t.moderation.filterPlaceholder}
                placeholderTextColor={theme.colors.textMuted}
                value={farmaciaFilter}
                onChangeText={setFarmaciaFilter}
              />
              {farmaciaFilter ? (
                <PressableScale onPress={() => setFarmaciaFilter('')} scaleTo={0.85}>
                  <X size={16} color={theme.colors.textMuted} />
                </PressableScale>
              ) : null}
            </View>

            {(() => {
              const filtered = farmacias.filter((f) => {
                if (!farmaciaFilter.trim()) return true;
                const q = farmaciaFilter.toLowerCase();
                return f.nombre.toLowerCase().includes(q) || f.ciudad.toLowerCase().includes(q);
              });

              if (filtered.length === 0) {
                return (
                  <View style={styles.emptyBox}>
                    <View style={styles.emptyIconBubble}>
                      <Store size={32} color={theme.colors.accent} />
                    </View>
                    <Text style={styles.emptyTitle}>{t.moderation.noPharmaciesFound}</Text>
                  </View>
                );
              }

              return filtered.map((f, idx) => (
                <Reveal key={f.id} index={idx}>
                  <View style={styles.card}>
                    <View style={styles.cardHeader}>
                      <View style={[styles.cardIconBox, !f.activa && styles.cardIconBoxInactive]}>
                        <Store size={20} color={f.activa ? theme.colors.accent : theme.colors.danger} />
                      </View>
                      <View style={styles.cardHeaderText}>
                        <Text style={styles.cardMedName}>{f.nombre}</Text>
                        <View style={styles.metaRow}>
                          <MapPin size={12} color={theme.colors.textSecondary} />
                          <Text style={styles.cardPharm}>{f.ciudad} · {f.direccion}</Text>
                        </View>
                        {f.telefono && (
                          <View style={styles.metaRow}>
                            <Phone size={12} color={theme.colors.textSecondary} />
                            <Text style={styles.cardPharm}>{f.telefono}</Text>
                          </View>
                        )}
                        {f.horario && (
                          <View style={styles.metaRow}>
                            <Clock size={12} color={theme.colors.textSecondary} />
                            <Text style={styles.cardPharm}>{f.horario}</Text>
                          </View>
                        )}
                        <Text style={styles.cardDate}>
                          {t.moderation.registered}: {formatDate(f.createdAt)}
                        </Text>
                        <Text style={styles.cardDate}>
                          {t.moderation.coordinates}: {f.latitud.toFixed(4)}, {f.longitud.toFixed(4)}
                        </Text>
                      </View>
                      <View style={[styles.farmBadge, f.activa ? styles.farmBadgeActive : styles.farmBadgeInactive]}>
                        <Text style={[styles.farmBadgeText, f.activa ? styles.farmBadgeTextActive : styles.farmBadgeTextInactive]}>
                          {f.activa ? t.moderation.active : t.moderation.inactive}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.actions}>
                      <PressableScale
                        style={[styles.actionBtn, f.activa ? styles.rejectBtn : styles.verifyBtn]}
                        onPress={() => handleToggleFarmacia(f.id, !f.activa)}
                        disabled={actioning === f.id}
                      >
                        {actioning === f.id ? (
                          <ActivityIndicator color={f.activa ? theme.colors.danger : theme.colors.accentText} size="small" />
                        ) : (
                          <Text style={f.activa ? styles.rejectText : styles.verifyText}>
                            {f.activa ? t.moderation.deactivate : t.moderation.activate}
                          </Text>
                        )}
                      </PressableScale>
                    </View>
                  </View>
                </Reveal>
              ));
            })()}
          </>
        ) : activeTab === 'solicitudes' && isAdmin ? (
          solicitudes.length === 0 ? (
            <View style={styles.emptyBox}>
              <View style={styles.emptyIconBubble}>
                <Check size={32} color={theme.colors.accent} />
              </View>
              <Text style={styles.emptyTitle}>{t.moderation.noRequests}</Text>
              <Text style={styles.emptyText}>{t.moderation.noRequestsDesc}</Text>
            </View>
          ) : (
            solicitudes.map((s, idx) => (
              <Reveal key={s.id} index={idx}>
                <View style={styles.card}>
                  <View style={styles.cardHeader}>
                    <View style={[styles.cardIconBox, styles.cardIconBoxWarning]}>
                      <Store size={20} color={theme.colors.warning} />
                    </View>
                    <View style={styles.cardHeaderText}>
                      <Text style={styles.cardMedName}>{s.nombreComercial}</Text>
                      <Text style={styles.cardPharm}>RNC: {s.rnc}</Text>
                      <Text style={styles.cardPharm}>{s.ciudad} · {s.direccion}</Text>
                      <Text style={styles.cardPharm}>Tel: {s.telefonoFarmacia} · {s.horario}</Text>
                      <Text style={styles.cardDate}>{t.moderation.owner}: {s.nombrePropietario} · {t.moderation.cedula}: {s.cedulaPropietario}</Text>
                      <Text style={styles.cardDate}>{formatDate(s.createdAt)}</Text>
                      {s.documentoUrl && (
                        <PressableScale
                          style={styles.docLink}
                          onPress={() => {
                            if (Platform.OS === 'web') window.open(s.documentoUrl!, '_blank');
                            else Linking.openURL(s.documentoUrl!);
                          }}
                        >
                          <Download size={14} color={theme.colors.accent} />
                          <Text style={styles.docLinkText}>{t.moderation.viewDocument}</Text>
                        </PressableScale>
                      )}
                    </View>
                  </View>
                  <View style={styles.actions}>
                    <PressableScale
                      style={[styles.actionBtn, styles.rejectBtn]}
                      onPress={() => handleRechazarSolicitud(s.id)}
                      disabled={actioning === s.id}
                    >
                      {actioning === s.id ? (
                        <ActivityIndicator color={theme.colors.danger} size="small" />
                      ) : (
                        <>
                          <X size={18} color={theme.colors.danger} />
                          <Text style={styles.rejectText}>{t.moderation.reject}</Text>
                        </>
                      )}
                    </PressableScale>
                    <PressableScale
                      style={[styles.actionBtn, styles.verifyBtn]}
                      onPress={() => handleAprobarSolicitud(s.id)}
                      disabled={actioning === s.id}
                    >
                      {actioning === s.id ? (
                        <ActivityIndicator color={theme.colors.accentText} size="small" />
                      ) : (
                        <>
                          <Check size={18} color={theme.colors.accentText} />
                          <Text style={styles.verifyText}>{t.moderation.approve}</Text>
                        </>
                      )}
                    </PressableScale>
                  </View>
                </View>
              </Reveal>
            ))
          )
        ) : reports.length === 0 ? (
          <View style={styles.emptyBox}>
            <View style={styles.emptyIconBubble}>
              <Check size={32} color={theme.colors.accent} />
            </View>
            <Text style={styles.emptyTitle}>{t.moderation.noReports}</Text>
            <Text style={styles.emptyText}>
              {isAdmin ? t.moderation.noReportsAdmin : t.moderation.noReportsPharmacy}
            </Text>
          </View>
        ) : (
          reports.map((r, idx) => (
            <Reveal key={r.id} index={idx}>
              <View style={styles.card}>
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
                    <CameraIcon size={18} color={theme.colors.textMuted} />
                    <Text style={styles.noPhotoText}>{t.moderation.reportNoPhoto}</Text>
                  </View>
                )}

                <View style={styles.actions}>
                  <PressableScale
                    style={[styles.actionBtn, styles.rejectBtn]}
                    onPress={() => handleReject(r.id)}
                    disabled={actioning === r.id}
                  >
                    {actioning === r.id ? (
                      <ActivityIndicator color={theme.colors.danger} size="small" />
                    ) : (
                      <>
                        <X size={18} color={theme.colors.danger} />
                        <Text style={styles.rejectText}>{t.moderation.reject}</Text>
                      </>
                    )}
                  </PressableScale>
                  <PressableScale
                    style={[styles.actionBtn, styles.verifyBtn]}
                    onPress={() => handleVerify(r.id)}
                    disabled={actioning === r.id}
                  >
                    {actioning === r.id ? (
                      <ActivityIndicator color={theme.colors.accentText} size="small" />
                    ) : (
                      <>
                        <Check size={18} color={theme.colors.accentText} />
                        <Text style={styles.verifyText}>{t.moderation.verify}</Text>
                      </>
                    )}
                  </PressableScale>
                </View>
              </View>
            </Reveal>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  header: {
    paddingTop: 54,
    paddingBottom: theme.spacing.lg,
    paddingHorizontal: theme.spacing.xl,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  headerBadge: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    backgroundColor: theme.colors.accentSoft,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 6,
    borderRadius: theme.radius.pill,
  },
  headerBadgeText: {
    ...theme.text.label,
    fontFamily: theme.font.bodyBold,
    fontSize: 12,
    letterSpacing: 0.2,
    color: theme.colors.accent,
  },
  headerTitle: {
    ...theme.text.h1,
    color: theme.colors.textPrimary,
  },
  headerSubtitle: {
    ...theme.text.body,
    color: theme.colors.textSecondary,
    marginTop: 4,
  },
  statsBar: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginTop: theme.spacing.lg,
  },
  statBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.lg,
    ...theme.shadow.card,
  },
  statIconBubble: {
    width: 36,
    height: 36,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.accentSofter,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statValue: {
    fontFamily: theme.font.bold,
    fontSize: 20,
    color: theme.colors.textPrimary,
  },
  statLabel: {
    ...theme.text.caption,
    color: theme.colors.textSecondary,
  },
  tabBar: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.lg,
    paddingRight: theme.spacing.xs,
  },
  tab: {
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.radius.pill,
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadow.sm,
  },
  tabActive: {
    backgroundColor: theme.colors.accent,
    borderColor: theme.colors.accent,
  },
  tabText: {
    ...theme.text.bodyMedium,
    fontFamily: theme.font.bodyBold,
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  tabTextActive: { color: theme.colors.accentText },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.lg,
    height: 48,
    marginBottom: theme.spacing.lg,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
  },
  filterInput: {
    flex: 1,
    fontFamily: theme.font.body,
    fontSize: 14,
    color: theme.colors.textPrimary,
    height: '100%',
  },
  farmBadge: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: theme.radius.sm,
    alignSelf: 'flex-start',
  },
  farmBadgeActive: { backgroundColor: theme.colors.accentSoft },
  farmBadgeInactive: { backgroundColor: theme.colors.dangerSoft },
  farmBadgeText: { ...theme.text.label, fontSize: 10 },
  farmBadgeTextActive: { color: theme.colors.accent },
  farmBadgeTextInactive: { color: theme.colors.danger },
  resultCard: {
    backgroundColor: theme.colors.accentSoft,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    ...theme.shadow.card,
  },
  resultText: {
    ...theme.text.bodyMedium,
    fontFamily: theme.font.bodyBold,
    color: theme.colors.accent,
  },
  instructionCard: {
    backgroundColor: theme.colors.accentSofter,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.accentSoft,
  },
  instructionText: {
    ...theme.text.body,
    fontSize: 13,
    color: theme.colors.textSecondary,
    lineHeight: 22,
  },
  instructionNote: {
    ...theme.text.bodyMedium,
    fontSize: 13,
    color: theme.colors.accent,
    marginTop: 6,
  },
  instructionColumns: {
    ...theme.text.caption,
    fontSize: 11,
    color: theme.colors.textMuted,
    marginTop: theme.spacing.sm,
    backgroundColor: theme.colors.bgSecondary,
    padding: theme.spacing.sm,
    borderRadius: theme.radius.xs,
  },
  docLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.colors.accentSofter,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 5,
    borderRadius: theme.radius.sm,
    alignSelf: 'flex-start',
    marginTop: theme.spacing.sm,
  },
  docLinkText: {
    ...theme.text.caption,
    fontFamily: theme.font.bodyBold,
    color: theme.colors.accent,
  },
  content: { flex: 1 },
  contentInner: { paddingHorizontal: theme.spacing.xl, paddingBottom: theme.spacing.huge },
  scrollContent: {
    paddingHorizontal: theme.spacing.xl,
    paddingTop: 54,
    flexGrow: 1,
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
  emptyIconBubble: {
    width: 64,
    height: 64,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.accentSoft,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
  },
  emptyTitle: {
    ...theme.text.h3,
    color: theme.colors.textPrimary,
    textAlign: 'center',
  },
  emptyText: {
    ...theme.text.body,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  emptyInfo: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.xxl,
    alignItems: 'center',
    gap: theme.spacing.md,
    marginTop: theme.spacing.lg,
    ...theme.shadow.card,
  },
  emptyInfoTitle: {
    ...theme.text.h2,
    color: theme.colors.textPrimary,
    textAlign: 'center',
  },
  emptyInfoText: {
    ...theme.text.body,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    ...theme.shadow.card,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing.md },
  cardIconBox: {
    width: 44,
    height: 44,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.accentSofter,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardIconBoxInactive: { backgroundColor: theme.colors.dangerSoft },
  cardIconBoxWarning: { backgroundColor: theme.colors.warningSoft },
  cardIcon: { fontSize: 20 },
  cardHeaderText: { flex: 1 },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  cardMedName: {
    ...theme.text.title,
    color: theme.colors.textPrimary,
  },
  cardPharm: {
    ...theme.text.caption,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  cardDate: {
    ...theme.text.caption,
    fontSize: 11,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  cardPrice: {
    fontFamily: theme.font.bold,
    fontSize: 18,
    color: theme.colors.accent,
  },
  photo: {
    width: '100%',
    height: 180,
    borderRadius: theme.radius.md,
    marginTop: theme.spacing.md,
    backgroundColor: theme.colors.bgSecondary,
  },
  noPhoto: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.bgSecondary,
    padding: theme.spacing.lg,
    borderRadius: theme.radius.md,
    marginTop: theme.spacing.md,
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  noPhotoText: {
    ...theme.text.caption,
    color: theme.colors.textMuted,
  },
  actions: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginTop: theme.spacing.md,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.pill,
  },
  rejectBtn: {
    backgroundColor: theme.colors.dangerSoft,
    borderWidth: 1,
    borderColor: theme.colors.danger,
  },
  rejectText: {
    fontFamily: theme.font.bodyBold,
    fontSize: 14,
    color: theme.colors.danger,
  },
  verifyBtn: {
    backgroundColor: theme.colors.accent,
    ...theme.shadow.accent,
  },
  verifyText: {
    fontFamily: theme.font.bodyBold,
    fontSize: 14,
    color: theme.colors.accentText,
  },
  importBtn: {
    backgroundColor: theme.colors.infoSoft,
    borderWidth: 1,
    borderColor: theme.colors.info,
  },
  importText: {
    fontFamily: theme.font.bodyBold,
    fontSize: 14,
    color: theme.colors.info,
  },
});
