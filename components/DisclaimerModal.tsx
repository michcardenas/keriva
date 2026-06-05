import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  BackHandler,
  Platform,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native';
import { AlertTriangle, Check } from 'lucide-react-native';
import {
  aceptarDisclaimer,
  DISCLAIMER_CARE_TEXT,
  DISCLAIMER_KIDS_TEXT,
  DISCLAIMER_VERSIONS,
  type TipoDisclaimer,
} from '@/lib/api/disclaimer';

// =====================================================================
// DisclaimerModal — Brief §5.1 (Keriva Kids / Care)
// =====================================================================
// Requisitos legales (no UX opcional):
//   1. Cubre 100% del viewport con fondo oscuro
//   2. NO hay X de cerrar
//   3. NO cierra con toque fuera del modal
//   4. NO cierra con botón físico de retroceso (Android)
//   5. Botón 'Acepto' DESHABILITADO hasta scroll completo al final del texto
//   6. Al aceptar: registra perfil_id, user_id, versión, texto exacto,
//      timestamp, IP, device fingerprint (vía RPC registrar_disclaimer)
//   7. Al cancelar: vuelve atrás sin registrar nada
// =====================================================================

type Props = {
  visible: boolean;
  tipo: TipoDisclaimer;
  perfilId: string;
  perfilNombre?: string;
  onAccept: () => void;
  onCancel: () => void;
};

const SCROLL_THRESHOLD_PX = 24; // tolerancia para detectar "fin del scroll"

export default function DisclaimerModal({
  visible,
  tipo,
  perfilId,
  perfilNombre,
  onAccept,
  onCancel,
}: Props) {
  const [reachedBottom, setReachedBottom] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView | null>(null);

  const text = tipo === 'pediatrico' ? DISCLAIMER_KIDS_TEXT : DISCLAIMER_CARE_TEXT;
  const version = DISCLAIMER_VERSIONS[tipo];

  // Reset state cada vez que se abre el modal
  useEffect(() => {
    if (visible) {
      setReachedBottom(false);
      setSubmitting(false);
      setError(null);
    }
  }, [visible]);

  // Bloquear botón físico de retroceso de Android (req §5.1 paso 2)
  useEffect(() => {
    if (!visible || Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, [visible]);

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
      const distanceFromBottom =
        contentSize.height - layoutMeasurement.height - contentOffset.y;
      if (distanceFromBottom <= SCROLL_THRESHOLD_PX && !reachedBottom) {
        setReachedBottom(true);
      }
    },
    [reachedBottom],
  );

  // Si el contenido es más corto que el viewport, marcamos directamente reachedBottom
  const onContentSizeChange = useCallback(
    (_w: number, contentHeight: number) => {
      // Comparar con la altura del ScrollView contenedor:
      // si layout no se ha medido aún, esperamos al primer onScroll.
      // En web onScroll puede no dispararse si no hay overflow — usamos un
      // pequeño truco midiendo el container.
      if (scrollRef.current) {
        // En RN web, la ref tiene `.measure` no siempre disponible. Como fallback,
        // si contentHeight es chico, asumimos que cabe entero (caso raro porque el
        // texto es largo, pero por robustez).
        if (contentHeight < 300) setReachedBottom(true);
      }
    },
    [],
  );

  const onPressAccept = useCallback(async () => {
    if (!reachedBottom || submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await aceptarDisclaimer(perfilId, tipo);
      if (!res.ok) {
        setError(res.error ?? 'No se pudo registrar la aceptación');
        return;
      }
      onAccept();
    } finally {
      setSubmitting(false);
    }
  }, [reachedBottom, submitting, perfilId, tipo, onAccept]);

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="fade"
      // En iOS, evitar swipe-down para cerrar
      presentationStyle="fullScreen"
      // El usuario NO puede cerrar el modal — no hay onRequestClose útil
      onRequestClose={() => {
        /* bloquea Android back */
      }}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerIcon}>
              <AlertTriangle size={24} color="#FFB74D" />
            </View>
            <Text style={styles.headerTitle}>AVISO MÉDICO IMPORTANTE</Text>
            <Text style={styles.headerSub}>
              {tipo === 'pediatrico' ? 'Keriva Kids' : 'Keriva Care'}
              {perfilNombre ? ` · ${perfilNombre}` : ''}
            </Text>
          </View>

          {/* Cuerpo scrollable */}
          <View style={styles.scrollWrap}>
            <ScrollView
              ref={(r) => {
                scrollRef.current = r;
              }}
              onScroll={onScroll}
              onContentSizeChange={onContentSizeChange}
              scrollEventThrottle={32}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator
            >
              <Text style={styles.bodyText}>{text}</Text>
              <View style={styles.endMarker}>
                <Text style={styles.endMarkerText}>— Fin del aviso —</Text>
              </View>
            </ScrollView>

            {!reachedBottom ? (
              <View style={styles.scrollHint}>
                <Text style={styles.scrollHintText}>
                  ↓ Desliza para leer el aviso completo
                </Text>
              </View>
            ) : null}
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <View style={styles.footerButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={onCancel}
                disabled={submitting}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.acceptButton,
                  (!reachedBottom || submitting) && styles.acceptButtonDisabled,
                ]}
                onPress={onPressAccept}
                disabled={!reachedBottom || submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Check size={16} color="#FFFFFF" />
                    <Text style={styles.acceptButtonText}>
                      Acepto y entiendo
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            <Text style={styles.versionText}>
              Versión {version} · Su aceptación queda registrada conforme a la
              Ley 172-13
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(5, 36, 25, 0.98)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  card: {
    width: '100%',
    maxWidth: 560,
    maxHeight: '95%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    flex: 1,
  },
  header: {
    backgroundColor: '#FFF3E0',
    padding: 20,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#FFE0B2',
  },
  headerIcon: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: '#FFE0B2',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 8,
  },
  headerTitle: {
    fontFamily: 'Poppins-Bold', fontSize: 16,
    color: '#E65100', textAlign: 'center',
    letterSpacing: 0.5,
  },
  headerSub: {
    fontFamily: 'DMSans-Medium', fontSize: 13,
    color: '#A14E00', marginTop: 4,
  },
  scrollWrap: { flex: 1, position: 'relative' },
  scrollContent: { padding: 20, paddingBottom: 32 },
  bodyText: {
    fontFamily: 'DMSans-Regular',
    fontSize: 14,
    color: '#1F2937',
    lineHeight: 22,
  },
  endMarker: {
    marginTop: 18,
    paddingVertical: 10,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  endMarkerText: {
    fontFamily: 'DMSans-Bold',
    fontSize: 12,
    color: '#6B7280',
    letterSpacing: 0.5,
  },
  scrollHint: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  scrollHintText: {
    fontFamily: 'DMSans-Bold',
    fontSize: 12,
    color: '#E65100',
    textAlign: 'center',
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#FAFAFA',
  },
  errorText: {
    fontFamily: 'DMSans-Medium',
    fontSize: 13,
    color: '#D32F2F',
    textAlign: 'center',
    marginBottom: 8,
  },
  footerButtons: { flexDirection: 'row', gap: 10 },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontFamily: 'DMSans-Bold',
    fontSize: 14,
    color: '#374151',
  },
  acceptButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#34C26A',
  },
  acceptButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  acceptButtonText: {
    fontFamily: 'Poppins-Bold',
    fontSize: 14,
    color: '#FFFFFF',
  },
  versionText: {
    fontFamily: 'DMSans-Regular',
    fontSize: 11,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 10,
  },
});
