import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
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
import { useLanguage } from '@/lib/LanguageContext';
import { useAuth } from '@/lib/AuthContext';
import { theme } from '@/lib/theme';
import PressableScale from '@/components/ui/PressableScale';

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
  const { t } = useLanguage();
  const { perfil } = useAuth();
  // Farmacia y admin contribuyen/auditan sin límite diario.
  const isUnlimited = perfil?.rol === 'farmacia' || perfil?.rol === 'admin';
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
      if (voting || hasVoted || (!isUnlimited && votosHoy >= 3) || !rango) return;
      setVoting(voto);
      const precioVisto = (rango.precioMin + rango.precioMax) / 2;
      const res = await createAuditVote({ skuId, farmaciaId, voto, precioVisto });
      setVoting(null);

      if (res.ok) {
        setHasVoted(true);
        setVotosHoy((n) => n + 1);
      } else {
        Alert.alert(t.priceCard.couldNotRegister, res.error);
        if (res.limitReached) setVotosHoy(3);
      }
    },
    [voting, hasVoted, votosHoy, rango, skuId, farmaciaId, isUnlimited],
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
        t.priceCard.outOfHours,
        `${t.priceCard.pharmacyHours} ${horario}. ${t.priceCard.sendAnyway}`,
        [
          { text: t.priceCard.cancel, style: 'cancel' },
          { text: t.priceCard.send, onPress: open },
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
        <ActivityIndicator color={theme.colors.accent} />
      </View>
    );
  }

  if (!rango) {
    return (
      <View style={[styles.card, styles.cardEmpty]}>
        <Text style={styles.emptyText}>{t.priceCard.priceUnavailable}</Text>
        <Text style={styles.emptySubtext}>{t.priceCard.askPharmacy}</Text>
      </View>
    );
  }

  const rangoStr = formatPriceRange(rango);
  const votosRestantes = 3 - votosHoy;
  const botonesDisabled = hasVoted || (!isUnlimited && votosHoy >= 3);

  return (
    <View style={styles.card}>
      {/* Rango estimado */}
      <View style={styles.header}>
        <Text style={styles.label}>{t.priceCard.estimatedRange}</Text>
        <Text style={styles.range}>{rangoStr}</Text>
        <Text style={styles.legend}>{t.priceCard.legend}</Text>
      </View>

      {/* Botón WhatsApp (si afiliada) */}
      {whatsappData && (
        <PressableScale
          style={styles.whatsappBtn}
          onPress={handleWhatsApp}
        >
          <MessageCircle size={20} color={theme.colors.white} />
          <Text style={styles.whatsappBtnText}>{t.priceCard.reserveWhatsApp}</Text>
        </PressableScale>
      )}

      {!whatsappData && (
        <View style={styles.nonAffiliateBox}>
          <Clock size={14} color={theme.colors.textSecondary} />
          <Text style={styles.nonAffiliateText}>{t.priceCard.notAffiliated}</Text>
        </View>
      )}

      {/* Botones auditoría ✅/❌ */}
      <View style={styles.auditRow}>
        <Text style={styles.auditLabel}>{t.priceCard.isPriceCorrect}</Text>
        <View style={styles.auditButtons}>
          <PressableScale
            style={[
              styles.auditBtn,
              styles.auditBtnOk,
              botonesDisabled && styles.auditBtnDisabled,
              voting === 'correcto' && styles.auditBtnActive,
            ]}
            scaleTo={0.94}
            onPress={() => handleVote('correcto')}
            disabled={botonesDisabled || voting !== null}
          >
            <Check size={16} color={botonesDisabled ? theme.colors.textMuted : theme.colors.accent} />
            <Text style={[styles.auditBtnText, botonesDisabled && styles.auditBtnTextDisabled]}>
              {t.priceCard.boughtAtPrice}
            </Text>
          </PressableScale>

          <PressableScale
            style={[
              styles.auditBtn,
              styles.auditBtnBad,
              botonesDisabled && styles.auditBtnDisabled,
              voting === 'incorrecto' && styles.auditBtnActive,
            ]}
            scaleTo={0.94}
            onPress={() => handleVote('incorrecto')}
            disabled={botonesDisabled || voting !== null}
          >
            <X size={16} color={botonesDisabled ? theme.colors.textMuted : theme.colors.danger} />
            <Text style={[styles.auditBtnText, botonesDisabled && styles.auditBtnTextDisabled]}>
              {t.priceCard.priceIncorrect}
            </Text>
          </PressableScale>
        </View>

        {hasVoted && (
          <Text style={styles.thankyou}>{t.priceCard.thankYou}</Text>
        )}

        {!isUnlimited && !hasVoted && votosHoy > 0 && votosHoy < 3 && (
          <Text style={styles.votosRestantes}>
            {t.priceCard.votesLeftPrefix} {votosRestantes}{' '}
            {votosRestantes === 1 ? t.priceCard.voteSingular : t.priceCard.votePlural}{' '}
            {t.priceCard.votesLeftSuffix}
          </Text>
        )}

        {votosHoy >= 3 && !hasVoted && (
          <Text style={styles.limitReached}>{t.priceCard.dailyLimit}</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadow.card,
  },
  cardLoading: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: theme.spacing.xxxl,
  },
  cardEmpty: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xl,
  },
  emptyText: {
    ...theme.text.h3,
    color: theme.colors.textSecondary,
  },
  emptySubtext: {
    ...theme.text.caption,
    color: theme.colors.textMuted,
    marginTop: theme.spacing.xs,
  },
  header: {
    marginBottom: theme.spacing.md,
  },
  label: {
    ...theme.text.bodyMedium,
    fontSize: 12,
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  range: {
    fontFamily: theme.font.bold,
    fontSize: 22,
    color: theme.colors.textPrimary,
    marginTop: theme.spacing.xs,
  },
  legend: {
    ...theme.text.caption,
    color: theme.colors.textSecondary,
    fontStyle: 'italic',
    marginTop: 6,
  },
  whatsappBtn: {
    backgroundColor: theme.colors.whatsapp,
    borderRadius: theme.radius.md,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    minHeight: 48,
    ...theme.shadow.card,
  },
  whatsappBtnText: {
    fontFamily: theme.font.semibold,
    fontSize: 15,
    color: theme.colors.white,
  },
  nonAffiliateBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: theme.spacing.md,
    backgroundColor: theme.colors.bgSecondary,
    borderRadius: theme.radius.sm,
  },
  nonAffiliateText: {
    ...theme.text.caption,
    color: theme.colors.textSecondary,
  },
  auditRow: {
    marginTop: theme.spacing.md,
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderLight,
  },
  auditLabel: {
    ...theme.text.bodyMedium,
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.sm,
  },
  auditButtons: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  auditBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
  },
  auditBtnOk: {
    backgroundColor: theme.colors.accentSofter,
    borderColor: theme.colors.accent,
  },
  auditBtnBad: {
    backgroundColor: theme.colors.dangerSoft,
    borderColor: theme.colors.danger,
  },
  auditBtnDisabled: {
    backgroundColor: theme.colors.bgSecondary,
    borderColor: theme.colors.border,
  },
  auditBtnActive: {
    opacity: 0.6,
  },
  auditBtnText: {
    ...theme.text.bodyMedium,
    fontSize: 12,
    color: theme.colors.textPrimary,
  },
  auditBtnTextDisabled: {
    color: theme.colors.textMuted,
  },
  thankyou: {
    ...theme.text.bodyMedium,
    fontSize: 11,
    color: theme.colors.accent,
    marginTop: theme.spacing.sm,
    textAlign: 'center',
  },
  votosRestantes: {
    ...theme.text.caption,
    fontSize: 11,
    color: theme.colors.textSecondary,
    marginTop: 6,
    textAlign: 'center',
  },
  limitReached: {
    ...theme.text.bodyMedium,
    fontSize: 11,
    color: theme.colors.textMuted,
    marginTop: 6,
    textAlign: 'center',
  },
});
