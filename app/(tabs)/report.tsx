import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Image,
  Modal,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
  ChevronRight,
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '@/lib/AuthContext';
import { createPriceReport } from '@/lib/api/precios';
import { getAllMedicationOptions, type MedicationOption } from '@/lib/api/medicamentos';
import { getAllPharmacyOptions, type PharmacyOption } from '@/lib/api/farmacias';
import AuthRequiredPlaceholder from '@/components/AuthRequiredPlaceholder';
import { useLanguage } from '@/lib/LanguageContext';
import { theme } from '@/lib/theme';
import PressableScale from '@/components/ui/PressableScale';
import Reveal from '@/components/ui/Reveal';
import KeyboardAwareScreen from '@/components/ui/KeyboardAwareScreen';
import PillBackground from '@/components/ui/PillBackground';

export default function ReportScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const { user, session, perfil } = useAuth();
  // Rol farmacia: la farmacia queda fija a la del usuario (campo informativo).
  const isFarmaciaRole = perfil?.rol === 'farmacia' && perfil?.farmaciaId != null;

  const [medications, setMedications] = useState<MedicationOption[]>([]);
  const [pharmacies, setPharmacies] = useState<PharmacyOption[]>([]);

  const [selectedMed, setSelectedMed] = useState<MedicationOption | null>(null);
  const [selectedPharm, setSelectedPharm] = useState<PharmacyOption | null>(null);
  const [price, setPrice] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);

  const [medModalOpen, setMedModalOpen] = useState(false);
  const [pharmModalOpen, setPharmModalOpen] = useState(false);
  const [priceFocused, setPriceFocused] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!session) return;
    (async () => {
      const [m, p] = await Promise.all([getAllMedicationOptions(), getAllPharmacyOptions()]);
      setMedications(m);
      setPharmacies(p);
      // Rol farmacia: fijar automáticamente la farmacia del usuario.
      if (perfil?.rol === 'farmacia' && perfil.farmaciaId != null) {
        const mine = p.find((x) => x.id === perfil.farmaciaId);
        if (mine) setSelectedPharm(mine);
      }
    })();
  }, [session, perfil?.rol, perfil?.farmaciaId]);

  const canSubmit = useMemo(() => {
    const n = parseFloat(price);
    return Boolean(selectedMed && selectedPharm && Number.isFinite(n) && n > 0);
  }, [selectedMed, selectedPharm, price]);

  const pointsPreview = photoUri ? 25 : 10;

  async function handlePickImage() {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted && perm.canAskAgain === false) {
        setError(t.reportScreen.photoPermLibrary);
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
      setError(t.reportScreen.galleryError);
    }
  }

  async function handleTakePhoto() {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        setError(t.reportScreen.cameraPerm);
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
      setError(t.reportScreen.cameraError);
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
        icon={<CameraIcon size={56} color={theme.colors.accent} />}
        title={t.reportScreen.authTitle}
        description={t.reportScreen.authDesc}
      />
    );
  }

  if (success) {
    return (
      <View style={styles.container}>
        <PillBackground />
        <View style={styles.successContainer}>
          <Reveal variant="up" delay={60}>
            <View style={styles.successIconCircle}>
              <Check size={56} color={theme.colors.white} strokeWidth={3} />
            </View>
          </Reveal>
          <Reveal index={1} delay={120}>
            <Text style={styles.successTitle}>{t.reportScreen.sentTitle}</Text>
          </Reveal>
          <Reveal index={2} delay={160}>
            <Text style={styles.successText}>
              {t.reportScreen.thanksEarned}{' '}
              <Text style={styles.successPoints}>+{pointsPreview} {t.reportScreen.points}</Text>.
            </Text>
          </Reveal>
          <Reveal index={3} delay={200}>
            <Text style={styles.successHint}>
              {t.reportScreen.pendingVerification}{' '}
              <Text style={styles.bold}>{t.reportScreen.extraPoints}</Text>.
            </Text>
          </Reveal>

          <Reveal index={4} delay={240} style={styles.successButtons}>
            <PressableScale style={styles.successPrimary} onPress={resetForm}>
              <Text style={styles.successPrimaryText}>{t.reportScreen.reportAnother}</Text>
            </PressableScale>
            <PressableScale
              style={styles.successSecondary}
              onPress={() => router.push('/(tabs)/profile')}
            >
              <Text style={styles.successSecondaryText}>{t.reportScreen.seeProfile}</Text>
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
          <PressableScale
            style={styles.backButton}
            onPress={() => router.push('/(tabs)')}
            scaleTo={0.9}
          >
            <ArrowLeft size={22} color={theme.colors.textPrimary} />
          </PressableScale>
          <Text style={styles.headerTitle}>{t.reportScreen.headerTitle}</Text>
          <Text style={styles.headerSubtitle}>{t.reportScreen.headerSubtitle}</Text>
        </Reveal>

        <View style={styles.form}>
          <Reveal index={1} delay={120}>
            <Text style={styles.label}>{t.reportScreen.medication}</Text>
            <PressableScale
              style={[styles.selector, selectedMed && styles.selectorActive]}
              onPress={() => setMedModalOpen(true)}
              disabled={submitting}
            >
              <Pill size={20} color={selectedMed ? theme.colors.accent : theme.colors.textMuted} />
              <View style={styles.selectorTextBox}>
                {selectedMed ? (
                  <>
                    <Text style={styles.selectorValue}>{selectedMed.name}</Text>
                    <Text style={styles.selectorMeta}>
                      {selectedMed.dosage} · {selectedMed.category}
                    </Text>
                  </>
                ) : (
                  <Text style={styles.selectorPlaceholder}>{t.reportScreen.selectMedication}</Text>
                )}
              </View>
              <ChevronRight size={20} color={theme.colors.textMuted} />
            </PressableScale>
          </Reveal>

          <Reveal index={2} delay={160}>
            <Text style={styles.label}>{t.reportScreen.pharmacy}</Text>
            {isFarmaciaRole ? (
              // Rol farmacia: campo informativo "Mi farmacia" (no seleccionable).
              <View style={[styles.selector, styles.selectorActive]}>
                <Store size={20} color={theme.colors.accent} />
                <View style={styles.selectorTextBox}>
                  <Text style={styles.selectorValue}>{selectedPharm?.name ?? 'Mi farmacia'}</Text>
                  <Text style={styles.selectorMeta}>
                    {selectedPharm?.city ? `${selectedPharm.city} · Mi farmacia` : 'Mi farmacia'}
                  </Text>
                </View>
              </View>
            ) : (
              <PressableScale
                style={[styles.selector, selectedPharm && styles.selectorActive]}
                onPress={() => setPharmModalOpen(true)}
                disabled={submitting}
              >
                <Store size={20} color={selectedPharm ? theme.colors.accent : theme.colors.textMuted} />
                <View style={styles.selectorTextBox}>
                  {selectedPharm ? (
                    <>
                      <Text style={styles.selectorValue}>{selectedPharm.name}</Text>
                      <Text style={styles.selectorMeta}>{selectedPharm.city}</Text>
                    </>
                  ) : (
                    <Text style={styles.selectorPlaceholder}>{t.reportScreen.selectPharmacy}</Text>
                  )}
                </View>
                <ChevronRight size={20} color={theme.colors.textMuted} />
              </PressableScale>
            )}
          </Reveal>

          {/* Bug 5: NO envolver el TextInput del precio en <Reveal>. La animación
              `entering` de Reanimated le roba el foco al input en Android (el
              teclado se abre y se cierra y no deja escribir). Usamos un View plano. */}
          <View>
            <Text style={styles.label}>{t.reportScreen.priceLabel}</Text>
            <View style={[styles.priceInput, priceFocused && styles.selectorActive]}>
              <DollarSign
                size={20}
                color={priceFocused ? theme.colors.accent : theme.colors.textMuted}
              />
              <TextInput
                style={styles.priceField}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={theme.colors.textMuted}
                value={price}
                onChangeText={setPrice}
                editable={!submitting}
                onFocus={() => setPriceFocused(true)}
                onBlur={() => setPriceFocused(false)}
              />
            </View>
          </View>

          <Reveal index={4} delay={240}>
            <Text style={styles.label}>{t.reportScreen.photoLabel}</Text>
            {photoUri ? (
              <View style={styles.photoPreviewBox}>
                <Image source={{ uri: photoUri }} style={styles.photoPreview} />
                <PressableScale
                  style={styles.photoRemove}
                  onPress={() => setPhotoUri(null)}
                  scaleTo={0.85}
                >
                  <X size={16} color={theme.colors.white} />
                </PressableScale>
              </View>
            ) : (
              <View style={styles.photoActions}>
                <PressableScale style={styles.photoBtn} onPress={handleTakePhoto} scaleTo={0.95}>
                  <CameraIcon size={20} color={theme.colors.accent} />
                  <Text style={styles.photoBtnText}>{t.reportScreen.takePhoto}</Text>
                </PressableScale>
                <PressableScale style={styles.photoBtn} onPress={handlePickImage} scaleTo={0.95}>
                  <SearchIcon size={20} color={theme.colors.accent} />
                  <Text style={styles.photoBtnText}>{t.reportScreen.chooseFile}</Text>
                </PressableScale>
              </View>
            )}
          </Reveal>

          {error && (
            <Reveal variant="fade">
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            </Reveal>
          )}

          <Reveal index={5} delay={280}>
            <View style={styles.pointsPreview}>
              <Text style={styles.pointsPreviewLabel}>{t.reportScreen.willEarn}</Text>
              <Text style={styles.pointsPreviewValue}>+{pointsPreview} {t.reportScreen.points}</Text>
              <Text style={styles.pointsPreviewHint}>
                {photoUri ? t.reportScreen.photoBreakdown : t.reportScreen.photoExtra}
              </Text>
            </View>
          </Reveal>

          <Reveal index={6} delay={320}>
            <PressableScale
              style={[styles.submit, (!canSubmit || submitting) && styles.submitDisabled]}
              onPress={handleSubmit}
              disabled={!canSubmit || submitting}
            >
              {submitting ? (
                <ActivityIndicator color={theme.colors.white} />
              ) : (
                <Text
                  style={[
                    styles.submitText,
                    (!canSubmit || submitting) && styles.submitTextDisabled,
                  ]}
                >
                  {t.reportScreen.submit}
                </Text>
              )}
            </PressableScale>
          </Reveal>
        </View>
      </KeyboardAwareScreen>

      <PickerModal
        visible={medModalOpen}
        title={t.reportScreen.selectMedication}
        items={medications}
        keyExtractor={(m) => String(m.id)}
        onSelect={(m) => {
          setSelectedMed(m);
          setMedModalOpen(false);
        }}
        onClose={() => setMedModalOpen(false)}
        renderPrimary={(m) => m.name}
        renderSecondary={(m) => `${m.dosage} · ${m.category}`}
        searchPlaceholder={t.reportScreen.searchMedication}
        emptyText={t.reportScreen.noResults}
      />

      <PickerModal
        visible={pharmModalOpen}
        title={t.reportScreen.selectPharmacy}
        items={pharmacies}
        keyExtractor={(p) => String(p.id)}
        onSelect={(p) => {
          setSelectedPharm(p);
          setPharmModalOpen(false);
        }}
        onClose={() => setPharmModalOpen(false)}
        renderPrimary={(p) => p.name}
        renderSecondary={(p) => `${p.city} · ${p.address}`}
        searchPlaceholder={t.reportScreen.searchPharmacy}
        emptyText={t.reportScreen.noResults}
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
  emptyText: string;
};

function PickerModal<T>(props: PickerModalProps<T>) {
  const [query, setQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const insets = useSafeAreaInsets();
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
      <KeyboardAvoidingView
        style={modalStyles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={[modalStyles.sheet, { paddingBottom: Math.max(insets.bottom, theme.spacing.lg) }]}>
          {/* Fondito de cápsulas detrás de la lista */}
          <PillBackground opacity={0.45} />

          <View style={modalStyles.handle} />
          <View style={modalStyles.header}>
            <Text style={modalStyles.title}>{props.title}</Text>
            <PressableScale onPress={props.onClose} scaleTo={0.85} style={modalStyles.closeBtn}>
              <X size={22} color={theme.colors.textPrimary} />
            </PressableScale>
          </View>
          <View style={[modalStyles.searchBox, searchFocused && modalStyles.searchBoxFocused]}>
            <SearchIcon size={18} color={searchFocused ? theme.colors.accent : theme.colors.textMuted} />
            <TextInput
              style={modalStyles.searchInput}
              placeholder={props.searchPlaceholder}
              placeholderTextColor={theme.colors.textMuted}
              value={query}
              onChangeText={setQuery}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              autoCorrect={false}
            />
          </View>
          <FlatList
            data={filtered}
            keyExtractor={props.keyExtractor}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: theme.spacing.lg }}
            renderItem={({ item }) => (
              <PressableScale
                style={modalStyles.item}
                onPress={() => props.onSelect(item)}
                scaleTo={0.98}
              >
                <Text style={modalStyles.itemPrimary}>{props.renderPrimary(item)}</Text>
                <Text style={modalStyles.itemSecondary}>{props.renderSecondary(item)}</Text>
              </PressableScale>
            )}
            ListEmptyComponent={
              <Text style={modalStyles.empty}>{props.emptyText}</Text>
            }
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  scroll: {
    flexGrow: 1,
    padding: theme.spacing.xl,
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
  label: {
    ...theme.text.label,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.sm,
  },
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: theme.spacing.lg,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
  },
  selectorActive: {
    borderColor: theme.colors.accent,
    ...theme.shadow.sm,
  },
  selectorTextBox: { flex: 1 },
  selectorPlaceholder: {
    ...theme.text.body,
    fontSize: 15,
    color: theme.colors.textMuted,
  },
  selectorValue: {
    ...theme.text.bodyMedium,
    fontSize: 15,
    color: theme.colors.textPrimary,
  },
  selectorMeta: {
    ...theme.text.caption,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  priceInput: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
  },
  priceField: {
    flex: 1,
    fontFamily: theme.font.bold,
    fontSize: 22,
    color: theme.colors.textPrimary,
    paddingVertical: theme.spacing.xs,
  },
  photoActions: { flexDirection: 'row', gap: theme.spacing.md },
  photoBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.accentSofter,
    borderRadius: theme.radius.pill,
    paddingVertical: theme.spacing.lg,
    borderWidth: 1.5,
    borderColor: theme.colors.accent,
  },
  photoBtnText: {
    ...theme.text.bodyMedium,
    fontFamily: theme.font.bodyBold,
    fontSize: 13,
    color: theme.colors.accent,
  },
  photoPreviewBox: {
    borderRadius: theme.radius.md,
    overflow: 'hidden',
    position: 'relative',
    ...theme.shadow.card,
  },
  photoPreview: { width: '100%', height: 200, resizeMode: 'cover' },
  photoRemove: {
    position: 'absolute',
    top: theme.spacing.sm,
    right: theme.spacing.sm,
    width: 32,
    height: 32,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
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
  },
  pointsPreview: {
    alignItems: 'center',
    backgroundColor: theme.colors.accentSoft,
    padding: theme.spacing.xl,
    borderRadius: theme.radius.lg,
    marginTop: theme.spacing.sm,
  },
  pointsPreviewLabel: {
    ...theme.text.bodyMedium,
    color: theme.colors.textSecondary,
  },
  pointsPreviewValue: {
    ...theme.text.h1,
    fontSize: 28,
    color: theme.colors.accent,
    marginTop: theme.spacing.xs,
  },
  pointsPreviewHint: {
    ...theme.text.caption,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
    textAlign: 'center',
  },
  submit: {
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius.pill,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: theme.spacing.sm,
    ...theme.shadow.accent,
  },
  submitDisabled: {
    backgroundColor: theme.colors.bgSecondary,
    ...theme.shadow.none,
  },
  submitText: {
    fontFamily: theme.font.bold,
    fontSize: 16,
    color: theme.colors.white,
    letterSpacing: 0.3,
  },
  submitTextDisabled: {
    color: theme.colors.textMuted,
  },
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.xxxl,
  },
  successIconCircle: {
    width: 96,
    height: 96,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.xxl,
    alignSelf: 'center',
    ...theme.shadow.accent,
  },
  successTitle: {
    ...theme.text.h1,
    fontSize: 28,
    color: theme.colors.textPrimary,
    textAlign: 'center',
  },
  successText: {
    ...theme.text.body,
    fontSize: 16,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: theme.spacing.md,
  },
  successPoints: { fontFamily: theme.font.bodyBold, color: theme.colors.accent },
  bold: { fontFamily: theme.font.bodyBold, color: theme.colors.accent },
  successHint: {
    ...theme.text.caption,
    fontSize: 13,
    color: theme.colors.textMuted,
    textAlign: 'center',
    marginTop: theme.spacing.lg,
    lineHeight: 20,
  },
  successButtons: {
    alignSelf: 'stretch',
    marginTop: theme.spacing.xxxl,
    gap: theme.spacing.md,
  },
  successPrimary: {
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius.pill,
    height: 54,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadow.accent,
  },
  successPrimaryText: {
    fontFamily: theme.font.bold,
    fontSize: 15,
    color: theme.colors.white,
  },
  successSecondary: {
    borderWidth: 2,
    borderColor: theme.colors.accent,
    borderRadius: theme.radius.pill,
    height: 52,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.accentSofter,
  },
  successSecondaryText: {
    fontFamily: theme.font.bold,
    fontSize: 15,
    color: theme.colors.accent,
  },
});

const modalStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: theme.colors.overlay,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: theme.radius.xl,
    borderTopRightRadius: theme.radius.xl,
    maxHeight: '88%',
    minHeight: '55%',
    overflow: 'hidden',
    paddingTop: theme.spacing.sm,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.border,
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.xs,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.md,
  },
  title: { ...theme.text.h2, color: theme.colors.textPrimary },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.bgSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    marginHorizontal: theme.spacing.xl,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.md,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.md,
    ...theme.shadow.sm,
  },
  searchBoxFocused: {
    borderColor: theme.colors.accent,
  },
  searchInput: {
    flex: 1,
    fontFamily: theme.font.body,
    fontSize: 14,
    color: theme.colors.textPrimary,
  },
  item: {
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
  },
  itemPrimary: {
    ...theme.text.bodyMedium,
    fontSize: 15,
    color: theme.colors.textPrimary,
  },
  itemSecondary: {
    ...theme.text.caption,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  empty: {
    ...theme.text.body,
    color: theme.colors.textMuted,
    textAlign: 'center',
    padding: theme.spacing.huge,
  },
});
