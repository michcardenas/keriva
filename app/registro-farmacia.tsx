import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Modal,
  FlatList,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { ArrowLeft, Store, MapPin, Clock, Phone, User, FileText, ChevronDown } from 'lucide-react-native';
import { useAuth } from '@/lib/AuthContext';
import { createSolicitud, getMySolicitud, type SolicitudFarmacia } from '@/lib/api/solicitudes';
import AuthRequiredPlaceholder from '@/components/AuthRequiredPlaceholder';

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

export default function RegistroFarmaciaScreen() {
  const router = useRouter();
  const { session, user, perfil } = useAuth();

  const [nombreComercial, setNombreComercial] = useState('');
  const [rnc, setRnc] = useState('');
  const [direccion, setDireccion] = useState('');
  const [ciudad, setCiudad] = useState('');
  const [telefono, setTelefono] = useState('');
  const [horario, setHorario] = useState('');
  const [nombrePropietario, setNombrePropietario] = useState('');
  const [cedulaPropietario, setCedulaPropietario] = useState('');

  const [showCiudadPicker, setShowCiudadPicker] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [existingSolicitud, setExistingSolicitud] = useState<SolicitudFarmacia | null>(null);
  const [checkingExisting, setCheckingExisting] = useState(true);

  useEffect(() => {
    if (!user) { setCheckingExisting(false); return; }
    getMySolicitud(user.id).then((s) => {
      if (s && (s.estado === 'pendiente' || s.estado === 'aprobada')) {
        setExistingSolicitud(s);
      }
      setCheckingExisting(false);
    });
  }, [user]);

  const validate = useCallback((): string | null => {
    if (!nombreComercial.trim()) return 'Ingresa el nombre de la farmacia';
    if (!DOC_REGEX.test(rnc)) return 'RNC inválido (formato: XXX-XXXXXXX-X)';
    if (!direccion.trim()) return 'Ingresa la dirección';
    if (!ciudad) return 'Selecciona la ciudad';
    if (!telefono.trim()) return 'Ingresa el teléfono';
    if (!horario.trim()) return 'Ingresa el horario';
    if (!nombrePropietario.trim()) return 'Ingresa el nombre del propietario';
    if (!DOC_REGEX.test(cedulaPropietario)) return 'Cédula inválida (formato: XXX-XXXXXXX-X)';
    return null;
  }, [nombreComercial, rnc, direccion, ciudad, telefono, horario, nombrePropietario, cedulaPropietario]);

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
    });
    setSubmitting(false);

    if (!result.ok) { setError(result.error); return; }
    setSuccess(true);
  }

  // Guard: not authenticated
  if (!session) {
    return (
      <AuthRequiredPlaceholder
        icon={<Store size={56} color="#7ED957" />}
        title="Registra tu farmacia"
        description="Inicia sesión para solicitar el registro de tu farmacia en Keriva."
      />
    );
  }

  // Guard: already a farmacia or admin
  if (perfil && perfil.rol !== 'usuario') {
    return (
      <LinearGradient colors={['#0F1F17', '#1A7A4A', '#0F1F17']} style={styles.container}>
        <View style={styles.centerContent}>
          <Store size={56} color="#7ED957" />
          <Text style={styles.centerTitle}>
            {perfil.rol === 'farmacia' ? 'Ya eres farmacia' : 'Eres administrador'}
          </Text>
          <Text style={styles.centerText}>Tu cuenta ya tiene el rol asignado.</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={() => router.back()}>
            <Text style={styles.primaryButtonText}>Volver</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    );
  }

  if (checkingExisting) {
    return (
      <View style={[styles.container, styles.centerContent, { backgroundColor: '#0F1F17' }]}>
        <ActivityIndicator size="large" color="#7ED957" />
      </View>
    );
  }

  // Already has pending request
  if (existingSolicitud) {
    return (
      <LinearGradient colors={['#0F1F17', '#1A7A4A', '#0F1F17']} style={styles.container}>
        <View style={styles.inner}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <ArrowLeft color="#FFFFFF" size={24} />
          </TouchableOpacity>
          <View style={styles.centerContent}>
            <Clock size={56} color="#FFA726" />
            <Text style={styles.centerTitle}>Solicitud en revisión</Text>
            <Text style={styles.centerText}>
              Tu solicitud para "{existingSolicitud.nombreComercial}" está siendo revisada por nuestro equipo.
              Te notificaremos cuando sea aprobada.
            </Text>
            <TouchableOpacity style={styles.primaryButton} onPress={() => router.back()}>
              <Text style={styles.primaryButtonText}>Volver al perfil</Text>
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>
    );
  }

  // Success
  if (success) {
    return (
      <LinearGradient colors={['#0F1F17', '#1A7A4A', '#0F1F17']} style={styles.container}>
        <View style={styles.centerContent}>
          <Text style={{ fontSize: 64 }}>✅</Text>
          <Text style={styles.centerTitle}>¡Solicitud enviada!</Text>
          <Text style={styles.centerText}>
            Revisaremos tu solicitud y te notificaremos cuando sea aprobada.
            Esto usualmente toma 1-2 días hábiles.
          </Text>
          <TouchableOpacity style={styles.primaryButton} onPress={() => router.replace('/(tabs)/profile')}>
            <Text style={styles.primaryButtonText}>Ir a mi perfil</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#0F1F17', '#1A7A4A', '#0F1F17']} style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <ArrowLeft color="#FFFFFF" size={24} />
          </TouchableOpacity>

          <View style={styles.header}>
            <Store size={32} color="#7ED957" />
            <Text style={styles.title}>Registrar farmacia</Text>
            <Text style={styles.subtitle}>
              Completa los datos de tu farmacia. Un administrador revisará tu solicitud.
            </Text>
          </View>

          <Text style={styles.sectionLabel}>Datos de la farmacia</Text>

          <View style={styles.inputWrapper}>
            <Store size={18} color="rgba(255,255,255,0.5)" />
            <TextInput
              style={styles.input}
              placeholder="Nombre comercial"
              placeholderTextColor="rgba(255,255,255,0.4)"
              value={nombreComercial}
              onChangeText={setNombreComercial}
              editable={!submitting}
            />
          </View>

          <View style={styles.inputWrapper}>
            <FileText size={18} color="rgba(255,255,255,0.5)" />
            <TextInput
              style={styles.input}
              placeholder="RNC (XXX-XXXXXXX-X)"
              placeholderTextColor="rgba(255,255,255,0.4)"
              value={rnc}
              onChangeText={(t) => setRnc(formatDocRD(t))}
              keyboardType="number-pad"
              maxLength={13}
              editable={!submitting}
            />
          </View>

          <View style={styles.inputWrapper}>
            <MapPin size={18} color="rgba(255,255,255,0.5)" />
            <TextInput
              style={styles.input}
              placeholder="Dirección completa"
              placeholderTextColor="rgba(255,255,255,0.4)"
              value={direccion}
              onChangeText={setDireccion}
              editable={!submitting}
            />
          </View>

          <TouchableOpacity
            style={styles.inputWrapper}
            onPress={() => setShowCiudadPicker(true)}
            disabled={submitting}
          >
            <MapPin size={18} color="rgba(255,255,255,0.5)" />
            <Text style={[styles.input, !ciudad && { color: 'rgba(255,255,255,0.4)' }]}>
              {ciudad || 'Ciudad'}
            </Text>
            <ChevronDown size={18} color="rgba(255,255,255,0.5)" />
          </TouchableOpacity>

          <View style={styles.inputWrapper}>
            <Phone size={18} color="rgba(255,255,255,0.5)" />
            <TextInput
              style={styles.input}
              placeholder="Teléfono (809-000-0000)"
              placeholderTextColor="rgba(255,255,255,0.4)"
              value={telefono}
              onChangeText={setTelefono}
              keyboardType="phone-pad"
              editable={!submitting}
            />
          </View>

          <View style={styles.inputWrapper}>
            <Clock size={18} color="rgba(255,255,255,0.5)" />
            <TextInput
              style={styles.input}
              placeholder="Horario (ej: Lun-Sab 8am-10pm)"
              placeholderTextColor="rgba(255,255,255,0.4)"
              value={horario}
              onChangeText={setHorario}
              editable={!submitting}
            />
          </View>

          <Text style={[styles.sectionLabel, { marginTop: 20 }]}>Datos del propietario</Text>

          <View style={styles.inputWrapper}>
            <User size={18} color="rgba(255,255,255,0.5)" />
            <TextInput
              style={styles.input}
              placeholder="Nombre del propietario"
              placeholderTextColor="rgba(255,255,255,0.4)"
              value={nombrePropietario}
              onChangeText={setNombrePropietario}
              editable={!submitting}
            />
          </View>

          <View style={styles.inputWrapper}>
            <FileText size={18} color="rgba(255,255,255,0.5)" />
            <TextInput
              style={styles.input}
              placeholder="Cédula (XXX-XXXXXXX-X)"
              placeholderTextColor="rgba(255,255,255,0.4)"
              value={cedulaPropietario}
              onChangeText={(t) => setCedulaPropietario(formatDocRD(t))}
              keyboardType="number-pad"
              maxLength={13}
              editable={!submitting}
            />
          </View>

          {error && <Text style={styles.errorText}>{error}</Text>}

          <TouchableOpacity
            style={[styles.primaryButton, submitting && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#1A7A4A" />
            ) : (
              <Text style={styles.primaryButtonText}>Enviar solicitud</Text>
            )}
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Ciudad picker modal */}
      <Modal visible={showCiudadPicker} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Selecciona la ciudad</Text>
            <FlatList
              data={CIUDADES_RD}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.modalItem}
                  onPress={() => { setCiudad(item); setShowCiudadPicker(false); }}
                >
                  <Text style={[styles.modalItemText, ciudad === item && styles.modalItemActive]}>
                    {item}
                  </Text>
                </TouchableOpacity>
              )}
              showsVerticalScrollIndicator={false}
            />
            <TouchableOpacity style={styles.modalClose} onPress={() => setShowCiudadPicker(false)}>
              <Text style={styles.modalCloseText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  inner: { flex: 1, padding: 24, paddingTop: 60 },
  scroll: { padding: 24, paddingTop: 50 },
  backButton: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 16,
  },
  header: { alignItems: 'center', marginBottom: 24, gap: 8 },
  title: { fontFamily: 'Poppins-Bold', fontSize: 26, color: '#FFFFFF', textAlign: 'center' },
  subtitle: { fontFamily: 'DMSans-Regular', fontSize: 14, color: 'rgba(255,255,255,0.7)', textAlign: 'center', lineHeight: 20 },
  sectionLabel: { fontFamily: 'DMSans-Bold', fontSize: 13, color: '#7ED957', marginBottom: 10, marginTop: 4, textTransform: 'uppercase', letterSpacing: 1 },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12,
    paddingHorizontal: 14, height: 50, marginBottom: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
  },
  input: { flex: 1, fontFamily: 'DMSans-Regular', fontSize: 15, color: '#FFFFFF' },
  errorText: { fontFamily: 'DMSans-Medium', fontSize: 13, color: '#FF6B6B', textAlign: 'center', marginVertical: 8 },
  primaryButton: { backgroundColor: '#FFFFFF', borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 12 },
  primaryButtonText: { fontFamily: 'Poppins-Bold', fontSize: 16, color: '#1A7A4A' },
  buttonDisabled: { opacity: 0.7 },
  centerContent: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16, paddingHorizontal: 32 },
  centerTitle: { fontFamily: 'Poppins-Bold', fontSize: 22, color: '#FFFFFF', textAlign: 'center' },
  centerText: { fontFamily: 'DMSans-Regular', fontSize: 15, color: 'rgba(255,255,255,0.8)', textAlign: 'center', lineHeight: 22 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '60%' },
  modalTitle: { fontFamily: 'Poppins-SemiBold', fontSize: 18, color: '#0F1F17', marginBottom: 16 },
  modalItem: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  modalItemText: { fontFamily: 'DMSans-Regular', fontSize: 16, color: '#333' },
  modalItemActive: { color: '#1A7A4A', fontFamily: 'DMSans-Bold' },
  modalClose: { paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  modalCloseText: { fontFamily: 'DMSans-Medium', fontSize: 15, color: '#666' },
});
