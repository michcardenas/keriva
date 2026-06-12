import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Platform,
  ActivityIndicator,
  Modal,
  FlatList,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, Store, MapPin, Clock, Phone, User, FileText, ChevronDown, Paperclip, X, CircleCheck as CheckCircle2, TriangleAlert as AlertTriangle, Eye } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '@/lib/AuthContext';
import { createSolicitud, getMySolicitud, reenviarSolicitud, type SolicitudFarmacia } from '@/lib/api/solicitudes';
import AuthRequiredPlaceholder from '@/components/AuthRequiredPlaceholder';
import { useLanguage } from '@/lib/LanguageContext';
import { theme } from '@/lib/theme';
import PressableScale from '@/components/ui/PressableScale';
import Reveal from '@/components/ui/Reveal';
import KeyboardAwareScreen from '@/components/ui/KeyboardAwareScreen';
import PillBackground from '@/components/ui/PillBackground';

const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? '';
const SANTIAGO_CENTER: [number, number] = [-70.6970, 19.4517];

function getMapboxGL(): any {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && (window as any).mapboxgl) {
    return (window as any).mapboxgl;
  }
  return null;
}

const CIUDADES_RD = [
  'Santiago de los Caballeros',
  'Santo Domingo',
  'Santo Domingo Este',
  'Santo Domingo Norte',
  'Santo Domingo Oeste',
  'La Vega',
  'San Cristóbal',
  'Puerto Plata',
  'La Romana',
  'San Pedro de Macorís',
  'Higüey',
  'San Francisco de Macorís',
  'Moca',
  'Bonao',
  'Baní',
  'Azua',
  'Nagua',
  'Cotuí',
  'Monte Plata',
  'Barahona',
  'Mao',
  'Esperanza',
  'Hato Mayor',
  'El Seibo',
  'Samaná',
  'Constanza',
  'Jarabacoa',
  'Salcedo',
  'Tenares',
  'Villa Altagracia',
];

// Auto-format Dominican RNC/Cedula: XXX-XXXXXXX-X
function formatDocRD(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 10) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 10)}-${digits.slice(10)}`;
}

const DOC_REGEX = /^\d{3}-\d{7}-\d{1}$/;

type Field =
  | 'nombre'
  | 'rnc'
  | 'direccion'
  | 'ciudad'
  | 'telefono'
  | 'horario'
  | 'propietario'
  | 'cedula';

export default function RegistroFarmaciaScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const { session, user, perfil } = useAuth();

  const [nombreComercial, setNombreComercial] = useState('');
  const [rnc, setRnc] = useState('');
  const [direccion, setDireccion] = useState('');
  const [ciudad, setCiudad] = useState('');
  const [telefono, setTelefono] = useState('');
  const [horario, setHorario] = useState('');
  const [nombrePropietario, setNombrePropietario] = useState('');
  const [cedulaPropietario, setCedulaPropietario] = useState('');
  const [focused, setFocused] = useState<Field | null>(null);

  const [latitud, setLatitud] = useState<number | null>(null);
  const [longitud, setLongitud] = useState<number | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);

  const [docs, setDocs] = useState<{
    licencia: { uri: string; name: string } | null;
    registro: { uri: string; name: string } | null;
    cedula: { uri: string; name: string } | null;
  }>({ licencia: null, registro: null, cedula: null });
  const [showCiudadPicker, setShowCiudadPicker] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [existingSolicitud, setExistingSolicitud] = useState<SolicitudFarmacia | null>(null);
  const [checkingExisting, setCheckingExisting] = useState(true);

  useEffect(() => {
    if (!user) { setCheckingExisting(false); return; }
    getMySolicitud(user.id).then((s) => {
      // Cualquier solicitud "viva" muestra su estado; solo 'rechazada' deja
      // volver al formulario para postular de nuevo desde cero.
      if (s && s.estado !== 'rechazada') {
        setExistingSolicitud(s);
      }
      setCheckingExisting(false);
    });
  }, [user]);

  const [reenviando, setReenviando] = useState(false);
  const handleReenviar = useCallback(async () => {
    if (!user || !existingSolicitud) return;
    setReenviando(true);
    const res = await reenviarSolicitud(user.id, existingSolicitud.id, {});
    setReenviando(false);
    if (res.ok) {
      setExistingSolicitud({ ...existingSolicitud, estado: 'pendiente', observaciones: null });
    } else {
      setError(res.error ?? 'No se pudo reenviar.');
    }
  }, [user, existingSolicitud]);

  // Init mini-map for location picking
  useEffect(() => {
    if (Platform.OS !== 'web' || !MAPBOX_TOKEN || mapInstanceRef.current) return;

    const tryInit = () => {
      const container = mapContainerRef.current;
      if (!container || mapInstanceRef.current) return;

      const mapboxgl = getMapboxGL();
      if (!mapboxgl) return;

      mapboxgl.accessToken = MAPBOX_TOKEN;

      const map = new mapboxgl.Map({
        container,
        style: 'mapbox://styles/mapbox/dark-v11',
        center: SANTIAGO_CENTER,
        zoom: 13,
        attributionControl: false,
      });

      map.addControl(new mapboxgl.NavigationControl(), 'top-right');

      map.on('click', (e: any) => {
        const { lng, lat } = e.lngLat;
        setLatitud(lat);
        setLongitud(lng);

        if (markerRef.current) markerRef.current.remove();

        const el = document.createElement('div');
        el.style.cssText = `width:32px;height:32px;border-radius:50%;background:${theme.colors.accent};border:3px solid ${theme.colors.white};box-shadow:0 2px 6px rgba(0,0,0,0.35);`;

        markerRef.current = new mapboxgl.Marker({ element: el })
          .setLngLat([lng, lat])
          .addTo(map);
      });

      mapInstanceRef.current = map;
    };

    const interval = setInterval(() => {
      tryInit();
      if (mapInstanceRef.current) clearInterval(interval);
    }, 200);
    const timeout = setTimeout(() => clearInterval(interval), 10000);

    return () => { clearInterval(interval); clearTimeout(timeout); };
  }, [checkingExisting, existingSolicitud, success]);

  const validate = useCallback((): string | null => {
    if (!nombreComercial.trim()) return t.registro.errNombre;
    if (!DOC_REGEX.test(rnc)) return t.registro.errRnc;
    if (!direccion.trim()) return t.registro.errDireccion;
    if (!ciudad) return t.registro.errCiudad;
    if (!telefono.trim()) return t.registro.errTelefono;
    if (!horario.trim()) return t.registro.errHorario;
    if (!nombrePropietario.trim()) return t.registro.errPropietario;
    if (!DOC_REGEX.test(cedulaPropietario)) return t.registro.errCedula;
    return null;
  }, [nombreComercial, rnc, direccion, ciudad, telefono, horario, nombrePropietario, cedulaPropietario, t]);

  async function pickDoc(kind: 'licencia' | 'registro' | 'cedula') {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      const a = result.assets[0];
      setDocs((d) => ({ ...d, [kind]: { uri: a.uri, name: a.fileName ?? 'documento.jpg' } }));
    }
  }

  async function handleSubmit() {
    const validationError = validate();
    if (validationError) { setError(validationError); return; }
    if (!user) return;

    setError(null);
    setSubmitting(true);
    const result = await createSolicitud({
      usuarioId: user.id,
      nombreComercial: nombreComercial.trim(),
      rnc,
      direccion: direccion.trim(),
      ciudad,
      telefonoFarmacia: telefono.trim(),
      horario: horario.trim(),
      nombrePropietario: nombrePropietario.trim(),
      cedulaPropietario,
      docLicenciaUri: docs.licencia?.uri,
      docRegistroUri: docs.registro?.uri,
      docCedulaUri: docs.cedula?.uri,
      latitud: latitud ?? undefined,
      longitud: longitud ?? undefined,
    });
    setSubmitting(false);

    if (!result.ok) { setError(result.error); return; }
    setSuccess(true);
  }

  const iconColor = (field: Field) =>
    focused === field ? theme.colors.accent : theme.colors.textMuted;

  // Guard: not authenticated
  if (!session) {
    return (
      <AuthRequiredPlaceholder
        icon={<Store size={56} color={theme.colors.accent} />}
        title={t.registro.authTitle}
        description={t.registro.authDesc}
      />
    );
  }

  // Guard: already a farmacia or admin
  if (perfil && perfil.rol !== 'usuario') {
    return (
      <View style={styles.container}>
        <PillBackground />
        <View style={styles.centerContent}>
          <Reveal variant="up" delay={60}>
            <View style={styles.centerIconCircle}>
              <Store size={48} color={theme.colors.white} />
            </View>
          </Reveal>
          <Reveal index={1} delay={120}>
            <Text style={styles.centerTitle}>
              {perfil.rol === 'farmacia' ? t.registro.alreadyPharmacy : t.registro.youAreAdmin}
            </Text>
          </Reveal>
          <Reveal index={2} delay={160}>
            <Text style={styles.centerText}>{t.registro.roleAssigned}</Text>
          </Reveal>
          <Reveal index={3} delay={200} style={styles.centerButtonWrap}>
            <PressableScale style={styles.primaryButton} onPress={() => router.back()}>
              <Text style={styles.primaryButtonText}>{t.registro.back}</Text>
            </PressableScale>
          </Reveal>
        </View>
      </View>
    );
  }

  if (checkingExisting) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <PillBackground />
        <ActivityIndicator size="large" color={theme.colors.accent} />
      </View>
    );
  }

  // Already has pending request
  if (existingSolicitud) {
    const est = existingSolicitud.estado;
    const meta =
      est === 'aprobada'
        ? { Icon: CheckCircle2, color: theme.colors.success, title: '¡Solicitud aprobada!', text: `"${existingSolicitud.nombreComercial}" ya está activa. Puedes gestionar tu farmacia desde tu perfil.` }
        : est === 'en_revision'
        ? { Icon: Eye, color: theme.colors.info, title: 'En revisión', text: `Estamos revisando los datos de "${existingSolicitud.nombreComercial}". Te avisaremos cuando haya una respuesta.` }
        : est === 'con_observaciones'
        ? { Icon: AlertTriangle, color: theme.colors.warning, title: 'Necesita correcciones', text: `Revisa las observaciones del administrador y reenvía tu solicitud.` }
        : { Icon: Clock, color: theme.colors.warning, title: 'Solicitud enviada', text: `Tu solicitud para "${existingSolicitud.nombreComercial}" está pendiente de revisión.` };

    return (
      <View style={styles.container}>
        <PillBackground />
        <View style={styles.centerContent}>
          <Reveal variant="up" delay={60}>
            <View style={[styles.centerIconCircle, { backgroundColor: meta.color }]}>
              <meta.Icon size={48} color={theme.colors.white} />
            </View>
          </Reveal>
          <Reveal index={1} delay={120}>
            <Text style={styles.centerTitle}>{meta.title}</Text>
          </Reveal>
          <Reveal index={2} delay={160}>
            <Text style={styles.centerText}>{meta.text}</Text>
          </Reveal>

          {est === 'con_observaciones' && !!existingSolicitud.observaciones && (
            <Reveal index={3} delay={190}>
              <View style={styles.obsBox}>
                <Text style={styles.obsLabel}>Observaciones del administrador</Text>
                <Text style={styles.obsText}>{existingSolicitud.observaciones}</Text>
              </View>
            </Reveal>
          )}

          {error && (
            <Text style={[styles.centerText, { color: theme.colors.danger }]}>{error}</Text>
          )}

          <Reveal index={4} delay={220} style={styles.centerButtonWrap}>
            {est === 'con_observaciones' ? (
              <PressableScale
                style={[styles.primaryButton, reenviando && { opacity: 0.6 }]}
                onPress={handleReenviar}
              >
                <Text style={styles.primaryButtonText}>{reenviando ? 'Reenviando…' : 'Reenviar solicitud'}</Text>
              </PressableScale>
            ) : (
              <PressableScale style={styles.primaryButton} onPress={() => router.back()}>
                <Text style={styles.primaryButtonText}>{t.registro.backToProfile}</Text>
              </PressableScale>
            )}
          </Reveal>
        </View>
      </View>
    );
  }

  // Success
  if (success) {
    return (
      <View style={styles.container}>
        <PillBackground />
        <View style={styles.centerContent}>
          <Reveal variant="up" delay={60}>
            <Text style={styles.successEmoji}>✅</Text>
          </Reveal>
          <Reveal index={1} delay={120}>
            <Text style={styles.centerTitle}>{t.registro.requestSent}</Text>
          </Reveal>
          <Reveal index={2} delay={160}>
            <Text style={styles.centerText}>{t.registro.requestSentDesc}</Text>
          </Reveal>
          <Reveal index={3} delay={200} style={styles.centerButtonWrap}>
            <PressableScale style={styles.primaryButton} onPress={() => router.replace('/(tabs)/profile')}>
              <Text style={styles.primaryButtonText}>{t.registro.goToProfile}</Text>
            </PressableScale>
          </Reveal>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <PillBackground />
      <KeyboardAwareScreen contentContainerStyle={styles.scroll}>
        <Reveal variant="up" delay={60}>
          <PressableScale style={styles.backButton} onPress={() => router.back()} scaleTo={0.9}>
            <ArrowLeft color={theme.colors.textPrimary} size={22} />
          </PressableScale>
          <Text style={styles.headerTitle}>{t.registro.title}</Text>
          <Text style={styles.headerSubtitle}>{t.registro.subtitle}</Text>
        </Reveal>

        <View style={styles.form}>
          <Reveal index={1} delay={120}>
            <Text style={styles.sectionLabel}>{t.registro.pharmacyData}</Text>
          </Reveal>

          <Reveal index={2} delay={160}>
            <View style={[styles.inputWrapper, focused === 'nombre' && styles.inputFocused]}>
              <Store size={20} color={iconColor('nombre')} />
              <TextInput
                style={styles.input}
                placeholder={t.registro.commercialName}
                placeholderTextColor={theme.colors.textMuted}
                value={nombreComercial}
                onChangeText={setNombreComercial}
                editable={!submitting}
                onFocus={() => setFocused('nombre')}
                onBlur={() => setFocused(null)}
              />
            </View>
          </Reveal>

          <Reveal index={3} delay={200}>
            <View style={[styles.inputWrapper, focused === 'rnc' && styles.inputFocused]}>
              <FileText size={20} color={iconColor('rnc')} />
              <TextInput
                style={styles.input}
                placeholder={t.registro.rncPlaceholder}
                placeholderTextColor={theme.colors.textMuted}
                value={rnc}
                onChangeText={(v) => setRnc(formatDocRD(v))}
                keyboardType="number-pad"
                maxLength={13}
                editable={!submitting}
                onFocus={() => setFocused('rnc')}
                onBlur={() => setFocused(null)}
              />
            </View>
          </Reveal>

          <Reveal index={4} delay={240}>
            <View style={[styles.inputWrapper, focused === 'direccion' && styles.inputFocused]}>
              <MapPin size={20} color={iconColor('direccion')} />
              <TextInput
                style={styles.input}
                placeholder={t.registro.fullAddress}
                placeholderTextColor={theme.colors.textMuted}
                value={direccion}
                onChangeText={setDireccion}
                editable={!submitting}
                onFocus={() => setFocused('direccion')}
                onBlur={() => setFocused(null)}
              />
            </View>
          </Reveal>

          <Reveal index={5} delay={280}>
            <PressableScale
              style={[styles.inputWrapper, !!ciudad && styles.inputFilled]}
              onPress={() => setShowCiudadPicker(true)}
              disabled={submitting}
            >
              <MapPin size={20} color={ciudad ? theme.colors.accent : theme.colors.textMuted} />
              <Text style={[styles.input, styles.inputText, !ciudad && styles.inputPlaceholder]}>
                {ciudad || t.registro.city}
              </Text>
              <ChevronDown size={20} color={theme.colors.textMuted} />
            </PressableScale>
          </Reveal>

          {/* Location picker map */}
          {Platform.OS === 'web' && MAPBOX_TOKEN && (
            <Reveal index={6} delay={320}>
              <View style={styles.mapSection}>
                <Text style={styles.mapLabel}>{t.registro.mapLabel}</Text>
                <View style={styles.mapContainer}>
                  <div
                    ref={mapContainerRef}
                    style={{ width: '100%', height: '100%', borderRadius: theme.radius.md }}
                  />
                </View>
                {latitud && longitud ? (
                  <Text style={styles.mapCoords}>
                    {t.registro.locationSelected}: {latitud.toFixed(5)}, {longitud.toFixed(5)}
                  </Text>
                ) : (
                  <Text style={styles.mapHint}>{t.registro.mapHint}</Text>
                )}
              </View>
            </Reveal>
          )}

          <Reveal index={7} delay={360}>
            <View style={[styles.inputWrapper, focused === 'telefono' && styles.inputFocused]}>
              <Phone size={20} color={iconColor('telefono')} />
              <TextInput
                style={styles.input}
                placeholder={t.registro.phonePlaceholder}
                placeholderTextColor={theme.colors.textMuted}
                value={telefono}
                onChangeText={setTelefono}
                keyboardType="phone-pad"
                editable={!submitting}
                onFocus={() => setFocused('telefono')}
                onBlur={() => setFocused(null)}
              />
            </View>
          </Reveal>

          <Reveal index={8} delay={400}>
            <View style={[styles.inputWrapper, focused === 'horario' && styles.inputFocused]}>
              <Clock size={20} color={iconColor('horario')} />
              <TextInput
                style={styles.input}
                placeholder={t.registro.schedulePlaceholder}
                placeholderTextColor={theme.colors.textMuted}
                value={horario}
                onChangeText={setHorario}
                editable={!submitting}
                onFocus={() => setFocused('horario')}
                onBlur={() => setFocused(null)}
              />
            </View>
          </Reveal>

          <Reveal index={9} delay={440}>
            <Text style={[styles.sectionLabel, styles.sectionLabelSpaced]}>{t.registro.ownerData}</Text>
          </Reveal>

          <Reveal index={10} delay={480}>
            <View style={[styles.inputWrapper, focused === 'propietario' && styles.inputFocused]}>
              <User size={20} color={iconColor('propietario')} />
              <TextInput
                style={styles.input}
                placeholder={t.registro.ownerName}
                placeholderTextColor={theme.colors.textMuted}
                value={nombrePropietario}
                onChangeText={setNombrePropietario}
                editable={!submitting}
                onFocus={() => setFocused('propietario')}
                onBlur={() => setFocused(null)}
              />
            </View>
          </Reveal>

          <Reveal index={11} delay={520}>
            <View style={[styles.inputWrapper, focused === 'cedula' && styles.inputFocused]}>
              <FileText size={20} color={iconColor('cedula')} />
              <TextInput
                style={styles.input}
                placeholder={t.registro.cedulaPlaceholder}
                placeholderTextColor={theme.colors.textMuted}
                value={cedulaPropietario}
                onChangeText={(v) => setCedulaPropietario(formatDocRD(v))}
                keyboardType="number-pad"
                maxLength={13}
                editable={!submitting}
                onFocus={() => setFocused('cedula')}
                onBlur={() => setFocused(null)}
              />
            </View>
          </Reveal>

          <Reveal index={12} delay={560}>
            <Text style={[styles.sectionLabel, styles.sectionLabelSpaced]}>{t.registro.supportDoc}</Text>
            <Text style={styles.docHint}>{t.registro.supportDocHint}</Text>
          </Reveal>

          <Reveal index={13} delay={600}>
            <View style={{ gap: 12 }}>
              {([
                ['licencia', 'Licencia de funcionamiento'],
                ['registro', 'Registro de la droguería / farmacia'],
                ['cedula', 'Cédula del representante'],
              ] as const).map(([kind, label]) => {
                const doc = docs[kind];
                return (
                  <View key={kind}>
                    <Text style={styles.docHint}>{label}</Text>
                    {doc ? (
                      <View style={styles.docAttached}>
                        <Paperclip size={16} color={theme.colors.accent} />
                        <Text style={styles.docAttachedName} numberOfLines={1}>{doc.name}</Text>
                        <PressableScale
                          onPress={() => setDocs((d) => ({ ...d, [kind]: null }))}
                          scaleTo={0.85}
                          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                          <X size={18} color={theme.colors.textSecondary} />
                        </PressableScale>
                      </View>
                    ) : (
                      <PressableScale style={styles.docButton} onPress={() => pickDoc(kind)} disabled={submitting} scaleTo={0.97}>
                        <Paperclip size={18} color={theme.colors.accent} />
                        <Text style={styles.docButtonText}>{t.registro.attachDoc}</Text>
                      </PressableScale>
                    )}
                  </View>
                );
              })}
            </View>
          </Reveal>

          {error && (
            <Reveal variant="fade">
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            </Reveal>
          )}

          <Reveal index={14} delay={640}>
            <PressableScale
              style={[styles.primaryButton, submitting && styles.buttonDisabled]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color={theme.colors.white} />
              ) : (
                <Text style={styles.primaryButtonText}>{t.registro.submit}</Text>
              )}
            </PressableScale>
          </Reveal>
        </View>
      </KeyboardAwareScreen>

      {/* Ciudad picker modal */}
      <Modal visible={showCiudadPicker} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <PillBackground opacity={0.45} />
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>{t.registro.selectCity}</Text>
            <FlatList
              data={CIUDADES_RD}
              keyExtractor={(item) => item}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <PressableScale
                  style={styles.modalItem}
                  onPress={() => { setCiudad(item); setShowCiudadPicker(false); }}
                  scaleTo={0.98}
                >
                  <Text style={[styles.modalItemText, ciudad === item && styles.modalItemActive]}>
                    {item}
                  </Text>
                </PressableScale>
              )}
              showsVerticalScrollIndicator={false}
            />
            <PressableScale style={styles.modalClose} onPress={() => setShowCiudadPicker(false)}>
              <Text style={styles.modalCloseText}>{t.registro.cancel}</Text>
            </PressableScale>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  scroll: {
    flexGrow: 1,
    padding: theme.spacing.xxl,
    paddingTop: 50,
    paddingBottom: theme.spacing.huge,
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
    marginBottom: theme.spacing.lg,
    ...theme.shadow.sm,
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
  form: { marginTop: theme.spacing.xl, gap: theme.spacing.md },
  sectionLabel: {
    ...theme.text.label,
    color: theme.colors.accent,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  sectionLabelSpaced: { marginTop: theme.spacing.md },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.lg,
    height: 56,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
  },
  inputFocused: {
    borderColor: theme.colors.accent,
    ...theme.shadow.sm,
  },
  inputFilled: {
    borderColor: theme.colors.accent,
  },
  input: {
    flex: 1,
    fontFamily: theme.font.body,
    fontSize: 15,
    color: theme.colors.textPrimary,
    height: '100%',
  },
  inputText: {
    textAlignVertical: 'center',
    paddingTop: 18,
  },
  inputPlaceholder: {
    color: theme.colors.textMuted,
  },
  mapSection: { gap: theme.spacing.sm },
  mapLabel: {
    ...theme.text.label,
    color: theme.colors.accent,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  mapContainer: {
    height: 200,
    borderRadius: theme.radius.md,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    ...theme.shadow.card,
  },
  mapCoords: {
    ...theme.text.caption,
    fontFamily: theme.font.bodyMedium,
    color: theme.colors.accent,
  },
  mapHint: {
    ...theme.text.caption,
    color: theme.colors.textSecondary,
  },
  docHint: {
    ...theme.text.caption,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
    marginBottom: theme.spacing.sm,
  },
  docButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.accentSofter,
    borderWidth: 1.5,
    borderColor: theme.colors.accent,
    borderStyle: 'dashed',
    borderRadius: theme.radius.md,
    paddingVertical: theme.spacing.lg,
    paddingHorizontal: theme.spacing.lg,
  },
  docButtonText: {
    ...theme.text.bodyMedium,
    fontFamily: theme.font.bodyBold,
    fontSize: 14,
    color: theme.colors.accent,
  },
  docAttached: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    backgroundColor: theme.colors.accentSoft,
    borderRadius: theme.radius.md,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderWidth: 1.5,
    borderColor: theme.colors.accent,
  },
  docAttachedName: {
    flex: 1,
    ...theme.text.bodyMedium,
    fontSize: 13,
    color: theme.colors.accent,
  },
  errorBox: {
    backgroundColor: theme.colors.dangerSoft,
    padding: theme.spacing.md,
    borderRadius: theme.radius.sm,
  },
  errorText: {
    ...theme.text.bodyMedium,
    fontSize: 13,
    color: theme.colors.danger,
    textAlign: 'center',
  },
  primaryButton: {
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius.pill,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: theme.spacing.sm,
    ...theme.shadow.accent,
  },
  buttonDisabled: {
    backgroundColor: theme.colors.bgSecondary,
    ...theme.shadow.none,
  },
  primaryButtonText: {
    fontFamily: theme.font.bold,
    fontSize: 16,
    color: theme.colors.white,
    letterSpacing: 0.3,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: theme.spacing.lg,
    paddingHorizontal: theme.spacing.xxxl,
  },
  centerIconCircle: {
    width: 96,
    height: 96,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    ...theme.shadow.accent,
  },
  centerIconWarning: {
    backgroundColor: theme.colors.warning,
  },
  successEmoji: { fontSize: 64, textAlign: 'center' },
  centerTitle: {
    ...theme.text.h1,
    fontSize: 24,
    color: theme.colors.textPrimary,
    textAlign: 'center',
  },
  centerText: {
    ...theme.text.body,
    fontSize: 15,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  centerButtonWrap: {
    alignSelf: 'stretch',
    marginTop: theme.spacing.md,
  },
  obsBox: {
    backgroundColor: theme.colors.warningSoft,
    borderRadius: theme.radius.md,
    padding: theme.spacing.lg,
    marginTop: theme.spacing.md,
    alignSelf: 'stretch',
  },
  obsLabel: {
    ...theme.text.label,
    color: theme.colors.warning,
    marginBottom: theme.spacing.xs,
  },
  obsText: {
    ...theme.text.body,
    color: theme.colors.textPrimary,
    lineHeight: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: theme.colors.overlay,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: theme.radius.xl,
    borderTopRightRadius: theme.radius.xl,
    padding: theme.spacing.xl,
    maxHeight: '60%',
    overflow: 'hidden',
    width: '100%',
    maxWidth: 480,
  },
  modalHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.border,
    marginBottom: theme.spacing.md,
  },
  modalTitle: {
    ...theme.text.h2,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.lg,
  },
  modalItem: {
    paddingVertical: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
  },
  modalItemText: {
    ...theme.text.body,
    fontSize: 16,
    color: theme.colors.textPrimary,
  },
  modalItemActive: {
    color: theme.colors.accent,
    fontFamily: theme.font.bodyBold,
  },
  modalClose: {
    paddingVertical: theme.spacing.lg,
    alignItems: 'center',
    marginTop: theme.spacing.sm,
  },
  modalCloseText: {
    ...theme.text.bodyMedium,
    fontSize: 15,
    color: theme.colors.textSecondary,
  },
});
