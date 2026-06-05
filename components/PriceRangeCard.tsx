import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Linking,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Check, X, MessageCircle, Clock } from 'lucide-react-native';
import {
  getPriceRange,
  formatPriceRange,
  createAuditVote,
  getUserAuditCountToday,
  getFarmaciaWhatsapp,
  isFarmaciaOpenNow,
  buildWhatsAppLink,
  type PrecioRango,
} from '@/lib/api/precios';

// Verde oficial de WhatsApp (adendum §3.2)
const WHATSAPP_GREEN = '#25D366';
const WHATSAPP_GREEN_DARK = '#1EBD5B';

type Props = {
  /** UUID del producto (productos.id) */
  skuId: string;
  /** ID bigint de la farmacia ("Farmacias".id legacy) */
  farmaciaId: number;
  /** Nombre visible del medicamento para el mensaje WhatsApp */
  medicamentoNombre: string;
  /** Nombre visible de la farmacia (opcional, solo para UI) */
  farmaciaNombre?: string;
  /** Si cambia, fuerza re-fetch */
  version?: number;
};

export default function PriceRangeCard({
  skuId,
  farmaciaId,
  medicamentoNombre,
  farmaciaNombre,
  version = 0,
}: Props) {
  const [rango, setRango] = useState<PrecioRango | null>(null);
  const [loading, setLoading] = useState(true);
  const [voting, setVoting] = useState<null | 'correcto' | 'incorrecto'>(null);
  const [votosHoy, setVotosHoy] = useState(0);
  const [hasVoted, setHasVoted] = useState(false);
  const [whatsappData, setWhatsappData] = useState<{
    numeroWhatsapp: string;
    horarioApertura: string | null;
    horarioCierre: string | null;
  } | null>(null);

  // Fetch inicial
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [rangoData, wsData, count] = await Promise.all([
        getPriceRange(skuId, farmaciaId),
        getFarmaciaWhatsapp(farmaciaId),
        getUserAuditCountToday(farmaciaId),
      ]);
      if (cancelled) return;
      setRango(rangoData);
      setWhatsappData(wsData);
      setVotosHoy(count);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [skuId, farmaciaId, version]);

  // Voto
  const handleVote = useCallback(
    async (voto: 'correcto' | 'incorrecto') => {
      if (voting || hasVoted || votosHoy >= 3 || !rango) return;
      setVoting(voto);
      const precioVisto = (rango.precioMin + rango.precioMax) / 2;
      const res = await createAuditVote({ skuId, farmaciaId, voto, precioVisto });
      setVoting(null);

      if (res.ok) {
        setHasVoted(true);
        setVotosHoy((n) => n + 1);
      } else {
        Alert.alert('No se pudo registrar', res.error);
        if (res.limitReached) setVotosHoy(3);
      }
    },
    [voting, hasVoted, votosHoy, rango, skuId, farmaciaId],
  );

  // WhatsApp
  const handleWhatsApp = useCallback(async () => {
    if (!whatsappData || !rango) return;

    const abierta = await isFarmaciaOpenNow(farmaciaId);
    const rangoStr = formatPriceRange(rango);
    const link = buildWhatsAppLink(whatsappData.numeroWhatsapp, medicamentoNombre, rangoStr);

    const open = () => {
      if (Platform.OS === 'web') window.open(link, '_blank');
      else Linking.openURL(link);
    };

    if (!abierta && whatsappData.horarioApertura && whatsappData.horarioCierre) {
      const horario = `${whatsappData.horarioApertura.slice(0, 5)} – ${whatsappData.horarioCierre.slice(0, 5)}`;
      Alert.alert(
        'Fuera de horario',
        `Esta farmacia atiende de ${horario}. ¿Quieres enviar el mensaje de todas formas?`,
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Enviar', onPress: open },
        ],
      );
    } else {
      open();
    }
  }, [whatsappData, rango, farmaciaId, medicamentoNombre]);

  // Estados UI
  if (loading) {
    return (
      <View style={[styles.card, styles.cardLoading]}>
        <ActivityIndicator color="#106B4F" />
      </View>
    );
  }

  if (!rango) {
    return (
      <View style={[styles.card, styles.cardEmpty]}>
        <Text style={styles.emptyText}>Precio no disponible</Text>
        <Text style={styles.emptySubtext}>Consulta directamente con la farmacia</Text>
      </View>
    );
  }

  const rangoStr = formatPriceRange(rango);
  const votosRestantes = 3 - votosHoy;
  const botonesDisabled = hasVoted || votosHoy >= 3;

  return (
    <View style={styles.card}>
      {/* Rango estimado */}
      <View style={styles.header}>
        <Text style={styles.label}>Rango estimado</Text>
        <Text style={styles.range}>{rangoStr}</Text>
        <Text style={styles.legend}>
          Cotiza el precio exacto por WhatsApp con la farmacia.
        </Text>
      </View>

      {/* Botón WhatsApp (si afiliada) */}
      {whatsappData && (
        <TouchableOpacity
          style={styles.whatsappBtn}
          onPress={handleWhatsApp}
          activeOpacity={0.85}
        >
          <MessageCircle size={20} color="#FFFFFF" />
          <Text style={styles.whatsappBtnText}>Reservar por WhatsApp</Text>
        </TouchableOpacity>
      )}

      {!whatsappData && (
        <View style={styles.nonAffiliateBox}>
          <Clock size={14} color="#666" />
          <Text style={styles.nonAffiliateText}>
            Farmacia no afiliada · consulta presencialmente
          </Text>
        </View>
      )}

      {/* Botones auditoría ✅/❌ */}
      <View style={styles.auditRow}>
        <Text style={styles.auditLabel}>¿Este precio es correcto?</Text>
        <View style={styles.auditButtons}>
          <TouchableOpacity
            style={[
              styles.auditBtn,
              styles.auditBtnOk,
              botonesDisabled && styles.auditBtnDisabled,
              voting === 'correcto' && styles.auditBtnActive,
            ]}
            onPress={() => handleVote('correcto')}
            disabled={botonesDisabled || voting !== null}
            activeOpacity={0.7}
          >
            <Check size={16} color={botonesDisabled ? '#999' : '#106B4F'} />
            <Text style={[styles.auditBtnText, botonesDisabled && styles.auditBtnTextDisabled]}>
              Compré a este precio
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.auditBtn,
              styles.auditBtnBad,
              botonesDisabled && styles.auditBtnDisabled,
              voting === 'incorrecto' && styles.auditBtnActive,
            ]}
            onPress={() => handleVote('incorrecto')}
            disabled={botonesDisabled || voting !== null}
            activeOpacity={0.7}
          >
            <X size={16} color={botonesDisabled ? '#999' : '#D32F2F'} />
            <Text style={[styles.auditBtnText, botonesDisabled && styles.auditBtnTextDisabled]}>
              Precio incorrecto
            </Text>
          </TouchableOpacity>
        </View>

        {hasVoted && (
          <Text style={styles.thankyou}>
            ¡Gracias por colaborar! Tu voto ayuda a mantener precios confiables.
          </Text>
        )}

        {!hasVoted && votosHoy > 0 && votosHoy < 3 && (
          <Text style={styles.votosRestantes}>
            Te quedan {votosRestantes} {votosRestantes === 1 ? 'voto' : 'votos'} hoy en esta farmacia
          </Text>
        )}

        {votosHoy >= 3 && !hasVoted && (
          <Text style={styles.limitReached}>
            Llegaste al límite diario en esta farmacia. Vuelve mañana.
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  cardLoading: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 32,
  },
  cardEmpty: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  emptyText: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 14,
    color: '#666',
  },
  emptySubtext: {
    fontFamily: 'DMSans-Regular',
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  header: {
    marginBottom: 14,
  },
  label: {
    fontFamily: 'DMSans-Medium',
    fontSize: 12,
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  range: {
    fontFamily: 'Poppins-Bold',
    fontSize: 22,
    color: '#052419',
    marginTop: 4,
  },
  legend: {
    fontFamily: 'DMSans-Regular',
    fontSize: 12,
    color: '#6B7280',
    fontStyle: 'italic',
    marginTop: 6,
  },
  whatsappBtn: {
    backgroundColor: WHATSAPP_GREEN,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 44,
    borderBottomWidth: 2,
    borderBottomColor: WHATSAPP_GREEN_DARK,
  },
  whatsappBtnText: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 15,
    color: '#FFFFFF',
  },
  nonAffiliateBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
  },
  nonAffiliateText: {
    fontFamily: 'DMSans-Regular',
    fontSize: 12,
    color: '#666',
  },
  auditRow: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  auditLabel: {
    fontFamily: 'DMSans-Medium',
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 8,
  },
  auditButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  auditBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  auditBtnOk: {
    backgroundColor: '#F0F9F4',
    borderColor: '#34C26A',
  },
  auditBtnBad: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  auditBtnDisabled: {
    backgroundColor: '#F3F4F6',
    borderColor: '#E5E7EB',
  },
  auditBtnActive: {
    opacity: 0.6,
  },
  auditBtnText: {
    fontFamily: 'DMSans-Medium',
    fontSize: 12,
    color: '#052419',
  },
  auditBtnTextDisabled: {
    color: '#999',
  },
  thankyou: {
    fontFamily: 'DMSans-Medium',
    fontSize: 11,
    color: '#106B4F',
    marginTop: 8,
    textAlign: 'center',
  },
  votosRestantes: {
    fontFamily: 'DMSans-Regular',
    fontSize: 11,
    color: '#6B7280',
    marginTop: 6,
    textAlign: 'center',
  },
  limitReached: {
    fontFamily: 'DMSans-Medium',
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 6,
    textAlign: 'center',
  },
});
