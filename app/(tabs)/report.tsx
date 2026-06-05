import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Image,
  Modal,
  FlatList,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import {
  ArrowLeft,
  Check,
  Camera as CameraIcon,
  X,
  Pill,
  Store,
  DollarSign,
  Search as SearchIcon,
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '@/lib/AuthContext';
import { createPriceReport } from '@/lib/api/precios';
import { getAllMedicationOptions, type MedicationOption } from '@/lib/api/medicamentos';
import { getAllPharmacyOptions, type PharmacyOption } from '@/lib/api/farmacias';
import AuthRequiredPlaceholder from '@/components/AuthRequiredPlaceholder';

export default function ReportScreen() {
  const router = useRouter();
  const { user, session } = useAuth();

  const [medications, setMedications] = useState<MedicationOption[]>([]);
  const [pharmacies, setPharmacies] = useState<PharmacyOption[]>([]);

  const [selectedMed, setSelectedMed] = useState<MedicationOption | null>(null);
  const [selectedPharm, setSelectedPharm] = useState<PharmacyOption | null>(null);
  const [price, setPrice] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);

  const [medModalOpen, setMedModalOpen] = useState(false);
  const [pharmModalOpen, setPharmModalOpen] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!session) return;
    (async () => {
      const [m, p] = await Promise.all([getAllMedicationOptions(), getAllPharmacyOptions()]);
      setMedications(m);
      setPharmacies(p);
    })();
  }, [session]);

  const canSubmit = useMemo(() => {
    const n = parseFloat(price);
    return Boolean(selectedMed && selectedPharm && Number.isFinite(n) && n > 0);
  }, [selectedMed, selectedPharm, price]);

  const pointsPreview = photoUri ? 25 : 10;

  async function handlePickImage() {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted && perm.canAskAgain === false) {
        setError('Necesitas permitir acceso a tus fotos para adjuntar una imagen');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.8,
      });
      if (!result.canceled && result.assets?.[0]) {
        setPhotoUri(result.assets[0].uri);
      }
    } catch {
      setError('No se pudo acceder a la galería');
    }
  }

  async function handleTakePhoto() {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        setError('Necesitas permitir acceso a la cámara');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
      });
      if (!result.canceled && result.assets?.[0]) {
        setPhotoUri(result.assets[0].uri);
      }
    } catch {
      setError('No se pudo acceder a la cámara');
    }
  }

  async function handleSubmit() {
    if (!user || !selectedMed || !selectedPharm) return;
    setSubmitting(true);
    setError(null);
    const result = await createPriceReport({
      userId: user.id,
      medicamentoId: selectedMed.id,
      farmaciaId: selectedPharm.id,
      price: parseFloat(price),
      photoUri: photoUri ?? undefined,
    });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSuccess(true);
  }

  const resetForm = useCallback(() => {
    setSelectedMed(null);
    setSelectedPharm(null);
    setPrice('');
    setPhotoUri(null);
    setError(null);
    setSuccess(false);
  }, []);

  if (!session) {
    return (
      <AuthRequiredPlaceholder
        icon={<CameraIcon size={56} color="#34C26A" />}
        title="Reporta precios y gana puntos"
        description="Crea tu cuenta gratuita para reportar precios de medicamentos y ayudar a la comunidad dominicana a ahorrar."
      />
    );
  }

  if (success) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={['#106B4F', '#052419']} style={styles.successContainer}>
          <View style={styles.successIconCircle}>
            <Check size={56} color="#FFFFFF" strokeWidth={3} />
          </View>
          <Text style={styles.successTitle}>¡Reporte enviado!</Text>
          <Text style={styles.successText}>
            Gracias por contribuir. Ganaste{' '}
            <Text style={styles.successPoints}>+{pointsPreview} puntos</Text>.
          </Text>
          <Text style={styles.successHint}>
            Tu reporte queda pendiente de verificación. Cuando sea verificado ganarás{' '}
            <Text style={styles.bold}>+20 puntos extra</Text>.
          </Text>

          <TouchableOpacity style={styles.successPrimary} onPress={resetForm}>
            <Text style={styles.successPrimaryText}>Reportar otro precio</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.successSecondary}
            onPress={() => router.push('/(tabs)/profile')}
          >
            <Text style={styles.successSecondaryText}>Ver mi perfil</Text>
          </TouchableOpacity>
        </LinearGradient>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#106B4F', '#052419']} style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.push('/(tabs)')}>
          <ArrowLeft size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Reportar precio</Text>
        <Text style={styles.headerSubtitle}>Ayuda a otros a encontrar mejores precios</Text>
      </LinearGradient>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
        <Text style={styles.label}>Medicamento</Text>
        <TouchableOpacity
          style={styles.selector}
          onPress={() => setMedModalOpen(true)}
          disabled={submitting}
        >
          <Pill size={20} color="#106B4F" />
          <View style={styles.selectorTextBox}>
            {selectedMed ? (
              <>
                <Text style={styles.selectorValue}>{selectedMed.name}</Text>
                <Text style={styles.selectorMeta}>
                  {selectedMed.dosage} · {selectedMed.category}
                </Text>
              </>
            ) : (
              <Text style={styles.selectorPlaceholder}>Seleccionar medicamento</Text>
            )}
          </View>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>

        <Text style={styles.label}>Farmacia</Text>
        <TouchableOpacity
          style={styles.selector}
          onPress={() => setPharmModalOpen(true)}
          disabled={submitting}
        >
          <Store size={20} color="#106B4F" />
          <View style={styles.selectorTextBox}>
            {selectedPharm ? (
              <>
                <Text style={styles.selectorValue}>{selectedPharm.name}</Text>
                <Text style={styles.selectorMeta}>{selectedPharm.city}</Text>
              </>
            ) : (
              <Text style={styles.selectorPlaceholder}>Seleccionar farmacia</Text>
            )}
          </View>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>

        <Text style={styles.label}>Precio en RD$</Text>
        <View style={styles.priceInput}>
          <DollarSign size={20} color="#106B4F" />
          <TextInput
            style={styles.priceField}
            keyboardType="decimal-pad"
            placeholder="0.00"
            placeholderTextColor="#999"
            value={price}
            onChangeText={setPrice}
            editable={!submitting}
          />
        </View>

        <Text style={styles.label}>Foto del precio (opcional · +15 puntos)</Text>
        {photoUri ? (
          <View style={styles.photoPreviewBox}>
            <Image source={{ uri: photoUri }} style={styles.photoPreview} />
            <TouchableOpacity style={styles.photoRemove} onPress={() => setPhotoUri(null)}>
              <X size={16} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.photoActions}>
            <TouchableOpacity style={styles.photoBtn} onPress={handleTakePhoto}>
              <CameraIcon size={20} color="#106B4F" />
              <Text style={styles.photoBtnText}>Tomar foto</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.photoBtn} onPress={handlePickImage}>
              <SearchIcon size={20} color="#106B4F" />
              <Text style={styles.photoBtnText}>Elegir archivo</Text>
            </TouchableOpacity>
          </View>
        )}

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <View style={styles.pointsPreview}>
          <Text style={styles.pointsPreviewLabel}>Ganarás</Text>
          <Text style={styles.pointsPreviewValue}>+{pointsPreview} puntos</Text>
          <Text style={styles.pointsPreviewHint}>
            {photoUri ? '10 base + 15 por foto' : '+15 extra si agregas foto'}
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.submit, (!canSubmit || submitting) && styles.submitDisabled]}
          onPress={handleSubmit}
          disabled={!canSubmit || submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.submitText}>Enviar reporte</Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      <PickerModal
        visible={medModalOpen}
        title="Seleccionar medicamento"
        items={medications}
        keyExtractor={(m) => String(m.id)}
        onSelect={(m) => {
          setSelectedMed(m);
          setMedModalOpen(false);
        }}
        onClose={() => setMedModalOpen(false)}
        renderPrimary={(m) => m.name}
        renderSecondary={(m) => `${m.dosage} · ${m.category}`}
        searchPlaceholder="Buscar medicamento..."
      />

      <PickerModal
        visible={pharmModalOpen}
        title="Seleccionar farmacia"
        items={pharmacies}
        keyExtractor={(p) => String(p.id)}
        onSelect={(p) => {
          setSelectedPharm(p);
          setPharmModalOpen(false);
        }}
        onClose={() => setPharmModalOpen(false)}
        renderPrimary={(p) => p.name}
        renderSecondary={(p) => `${p.city} · ${p.address}`}
        searchPlaceholder="Buscar farmacia..."
      />
    </View>
  );
}

type PickerModalProps<T> = {
  visible: boolean;
  title: string;
  items: T[];
  keyExtractor: (item: T) => string;
  onSelect: (item: T) => void;
  onClose: () => void;
  renderPrimary: (item: T) => string;
  renderSecondary: (item: T) => string;
  searchPlaceholder: string;
};

function PickerModal<T>(props: PickerModalProps<T>) {
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return props.items;
    return props.items.filter((item) =>
      `${props.renderPrimary(item)} ${props.renderSecondary(item)}`
        .toLowerCase()
        .includes(q),
    );
  }, [query, props]);

  return (
    <Modal
      visible={props.visible}
      animationType="slide"
      transparent
      onRequestClose={props.onClose}
    >
      <View style={modalStyles.backdrop}>
        <View style={modalStyles.sheet}>
          <View style={modalStyles.header}>
            <Text style={modalStyles.title}>{props.title}</Text>
            <TouchableOpacity onPress={props.onClose}>
              <X size={22} color="#052419" />
            </TouchableOpacity>
          </View>
          <View style={modalStyles.searchBox}>
            <SearchIcon size={18} color="#666" />
            <TextInput
              style={modalStyles.searchInput}
              placeholder={props.searchPlaceholder}
              placeholderTextColor="#999"
              value={query}
              onChangeText={setQuery}
            />
          </View>
          <FlatList
            data={filtered}
            keyExtractor={props.keyExtractor}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <TouchableOpacity style={modalStyles.item} onPress={() => props.onSelect(item)}>
                <Text style={modalStyles.itemPrimary}>{props.renderPrimary(item)}</Text>
                <Text style={modalStyles.itemSecondary}>{props.renderSecondary(item)}</Text>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <Text style={modalStyles.empty}>No se encontraron resultados</Text>
            }
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: { paddingTop: 60, paddingBottom: 24, paddingHorizontal: 20 },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerTitle: { fontFamily: 'Poppins-Bold', fontSize: 24, color: '#FFFFFF' },
  headerSubtitle: {
    fontFamily: 'DMSans-Regular',
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  content: { flex: 1 },
  contentInner: { padding: 20, paddingBottom: 40 },
  label: {
    fontFamily: 'DMSans-Bold',
    fontSize: 13,
    color: '#052419',
    marginBottom: 8,
    marginTop: 16,
  },
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  selectorTextBox: { flex: 1 },
  selectorPlaceholder: {
    fontFamily: 'DMSans-Regular',
    fontSize: 15,
    color: '#999999',
  },
  selectorValue: {
    fontFamily: 'DMSans-Medium',
    fontSize: 15,
    color: '#052419',
  },
  selectorMeta: {
    fontFamily: 'DMSans-Regular',
    fontSize: 12,
    color: '#666666',
    marginTop: 2,
  },
  chevron: { fontSize: 28, color: '#999', fontWeight: '300' },
  priceInput: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  priceField: {
    flex: 1,
    fontFamily: 'Poppins-Bold',
    fontSize: 22,
    color: '#052419',
    paddingVertical: 0,
  },
  photoActions: { flexDirection: 'row', gap: 10 },
  photoBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#106B4F',
  },
  photoBtnText: { fontFamily: 'DMSans-Bold', fontSize: 13, color: '#106B4F' },
  photoPreviewBox: { borderRadius: 12, overflow: 'hidden', position: 'relative' },
  photoPreview: { width: '100%', height: 200, resizeMode: 'cover' },
  photoRemove: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorBox: {
    backgroundColor: '#FFEBEE',
    padding: 12,
    borderRadius: 10,
    marginTop: 12,
  },
  errorText: { fontFamily: 'DMSans-Medium', fontSize: 13, color: '#D32F2F' },
  pointsPreview: {
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    padding: 16,
    borderRadius: 12,
    marginTop: 20,
  },
  pointsPreviewLabel: { fontFamily: 'DMSans-Regular', fontSize: 13, color: '#106B4F' },
  pointsPreviewValue: {
    fontFamily: 'Poppins-Bold',
    fontSize: 26,
    color: '#106B4F',
    marginTop: 2,
  },
  pointsPreviewHint: {
    fontFamily: 'DMSans-Regular',
    fontSize: 11,
    color: '#106B4F',
    marginTop: 2,
  },
  submit: {
    backgroundColor: '#106B4F',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  submitDisabled: { backgroundColor: '#999' },
  submitText: { fontFamily: 'Poppins-Bold', fontSize: 16, color: '#FFFFFF' },
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  successIconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#34C26A',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  successTitle: {
    fontFamily: 'Poppins-Bold',
    fontSize: 28,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  successText: {
    fontFamily: 'DMSans-Regular',
    fontSize: 16,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    marginTop: 12,
  },
  successPoints: { fontFamily: 'DMSans-Bold', color: '#34C26A' },
  bold: { fontFamily: 'DMSans-Bold', color: '#34C26A' },
  successHint: {
    fontFamily: 'DMSans-Regular',
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 20,
  },
  successPrimary: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
    marginTop: 32,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  successPrimaryText: {
    fontFamily: 'Poppins-Bold',
    fontSize: 15,
    color: '#106B4F',
  },
  successSecondary: {
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
    marginTop: 12,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  successSecondaryText: {
    fontFamily: 'Poppins-Bold',
    fontSize: 15,
    color: '#FFFFFF',
  },
});

const modalStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
  },
  title: { fontFamily: 'Poppins-Bold', fontSize: 18, color: '#052419' },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F0F0F0',
    marginHorizontal: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontFamily: 'DMSans-Regular',
    fontSize: 14,
    color: '#052419',
  },
  item: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  itemPrimary: { fontFamily: 'DMSans-Medium', fontSize: 15, color: '#052419' },
  itemSecondary: {
    fontFamily: 'DMSans-Regular',
    fontSize: 12,
    color: '#666666',
    marginTop: 2,
  },
  empty: {
    fontFamily: 'DMSans-Regular',
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    padding: 40,
  },
});
