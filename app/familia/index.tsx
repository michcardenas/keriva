import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useFocusEffect } from 'expo-router';
import {
  ArrowLeft,
  UserPlus,
  Pencil,
  Trash2,
  Users,
  Pill,
  ShieldCheck,
  ShieldAlert,
  Lock,
  Baby,
} from 'lucide-react-native';
import { useAuth } from '@/lib/AuthContext';
import AuthRequiredPlaceholder from '@/components/AuthRequiredPlaceholder';
import {
  listFamilia,
  softDeleteDependiente,
  labelTipoPerfil,
  FAMILIA_LIMIT,
  type FamiliaDashboardRow,
} from '@/lib/api/familia';

function webConfirm(message: string): boolean {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return window.confirm(message);
  }
  return true;
}

export default function FamiliaScreen() {
  const router = useRouter();
  const { session, loading: authLoading } = useAuth();
  const [familia, setFamilia] = useState<FamiliaDashboardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const rows = await listFamilia();
      setFamilia(rows);
    } catch (e: any) {
      setError(e?.message ?? 'No se pudo cargar la familia');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (session) load();
    else setLoading(false);
  }, [authLoading, session, load]);

  useFocusEffect(
    useCallback(() => {
      if (session) load();
    }, [session, load]),
  );

  const handleDelete = useCallback(
    (perfil: FamiliaDashboardRow) => {
      const msg = `¿Eliminar el perfil de ${perfil.nombre}? Esta acción puede deshacerse desde soporte.`;
      const proceed = async () => {
        const res = await softDeleteDependiente(perfil.id);
        if (!res.ok) {
          Alert.alert('Error', res.error ?? 'No se pudo eliminar');
          return;
        }
        await load();
      };
      if (Platform.OS === 'web') {
        if (webConfirm(msg)) proceed();
      } else {
        Alert.alert('Eliminar perfil', msg, [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Eliminar', style: 'destructive', onPress: proceed },
        ]);
      }
    },
    [load],
  );

  if (authLoading) {
    return (
      <LinearGradient colors={['#052419', '#106B4F', '#052419']} style={styles.container}>
        <View style={styles.centerContent}>
          <ActivityIndicator color="#34C26A" />
        </View>
      </LinearGradient>
    );
  }

  if (!session) {
    return (
      <AuthRequiredPlaceholder
        icon={<Lock size={48} color="#34C26A" />}
        title="Tu familia, en un solo lugar"
        description="Inicia sesión para gestionar perfiles de tu familia (titular + hasta 4 dependientes)."
      />
    );
  }

  return (
    <LinearGradient colors={['#052419', '#106B4F', '#052419']} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={20} color="#FFFFFF" />
        </TouchableOpacity>

        <View style={styles.header}>
          <View style={styles.heroIcon}>
            <Users size={28} color="#34C26A" />
          </View>
          <Text style={styles.title}>Mi familia</Text>
          <Text style={styles.subtitle}>
            Gestiona tu perfil titular y hasta 4 dependientes (hijos, adultos mayores).
            Cada perfil tiene sus propios medicamentos y recordatorios.
          </Text>
        </View>

        {loading ? (
          <View style={styles.centerContent}>
            <ActivityIndicator color="#34C26A" />
          </View>
        ) : error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : (
          <>
            <View style={styles.countRow}>
              <Text style={styles.countText}>
                {familia.length} / {FAMILIA_LIMIT} perfiles activos
              </Text>
            </View>

            {familia.map((p) => (
              <View key={p.id} style={styles.card}>
                <View style={styles.cardLeft}>
                  <Text style={styles.avatar}>{p.avatarEmoji ?? '👤'}</Text>
                </View>
                <View style={styles.cardMain}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardName} numberOfLines={1}>
                      {p.nombre}
                      {p.apellido ? ` ${p.apellido}` : ''}
                    </Text>
                    <View
                      style={[
                        styles.badge,
                        p.tipoPerfil === 'titular' && styles.badgeTitular,
                        p.tipoPerfil === 'dependiente_pediatrico' &&
                          styles.badgePediatrico,
                      ]}
                    >
                      <Text style={styles.badgeText}>{labelTipoPerfil(p.tipoPerfil)}</Text>
                    </View>
                  </View>

                  <View style={styles.metaRow}>
                    {p.edadAnios !== null ? (
                      <Text style={styles.metaText}>{p.edadAnios} años</Text>
                    ) : null}
                    {p.pesoLb !== null ? (
                      <Text style={styles.metaText}>{p.pesoLb} lb</Text>
                    ) : null}
                    <View style={styles.metaInline}>
                      <Pill size={12} color="rgba(255,255,255,0.6)" />
                      <Text style={styles.metaText}>{p.medicamentosActivos} med.</Text>
                    </View>
                    {p.disclaimerAceptado ? (
                      <View style={styles.metaInline}>
                        <ShieldCheck size={12} color="#34C26A" />
                        <Text style={[styles.metaText, { color: '#34C26A' }]}>
                          Disclaimer ✓
                        </Text>
                      </View>
                    ) : p.tipoPerfil === 'dependiente_pediatrico' ? (
                      <View style={styles.metaInline}>
                        <ShieldAlert size={12} color="#FFB74D" />
                        <Text style={[styles.metaText, { color: '#FFB74D' }]}>
                          Disclaimer pendiente
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  <View style={styles.actionsRow}>
                    <TouchableOpacity
                      style={styles.actionBtn}
                      onPress={() => router.push(`/familia/edit?id=${p.id}` as any)}
                    >
                      <Pencil size={14} color="#34C26A" />
                      <Text style={styles.actionText}>Editar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.actionBtn}
                      onPress={() =>
                        router.push(`/familia/medicamentos?perfilId=${p.id}` as any)
                      }
                    >
                      <Pill size={14} color="#34C26A" />
                      <Text style={styles.actionText}>Medicamentos</Text>
                    </TouchableOpacity>
                    {p.tipoPerfil === 'dependiente_pediatrico' ? (
                      <TouchableOpacity
                        style={[styles.actionBtn, styles.actionKids]}
                        onPress={() =>
                          router.push(`/familia/kids?perfilId=${p.id}` as any)
                        }
                      >
                        <Baby size={14} color="#E65100" />
                        <Text style={[styles.actionText, { color: '#E65100' }]}>
                          Kids
                        </Text>
                      </TouchableOpacity>
                    ) : null}
                    {p.tipoPerfil !== 'titular' ? (
                      <TouchableOpacity
                        style={[styles.actionBtn, styles.actionDelete]}
                        onPress={() => handleDelete(p)}
                      >
                        <Trash2 size={14} color="#FF6B6B" />
                        <Text style={[styles.actionText, { color: '#FF6B6B' }]}>
                          Eliminar
                        </Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </View>
              </View>
            ))}

            {familia.length < FAMILIA_LIMIT ? (
              <TouchableOpacity
                style={styles.addButton}
                onPress={() => router.push('/familia/edit' as any)}
              >
                <UserPlus size={18} color="#106B4F" />
                <Text style={styles.addButtonText}>Agregar dependiente</Text>
              </TouchableOpacity>
            ) : (
              <Text style={styles.limitText}>
                Has alcanzado el límite de {FAMILIA_LIMIT} perfiles activos.
              </Text>
            )}
          </>
        )}
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 24, paddingTop: 50, paddingBottom: 60 },
  backButton: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 16,
  },
  header: { alignItems: 'center', marginBottom: 20, gap: 8 },
  heroIcon: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: 'rgba(52, 194, 106, 0.15)',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 6,
  },
  title: { fontFamily: 'Poppins-Bold', fontSize: 26, color: '#FFFFFF', textAlign: 'center' },
  subtitle: { fontFamily: 'DMSans-Regular', fontSize: 14, color: 'rgba(255,255,255,0.7)', textAlign: 'center', lineHeight: 20, paddingHorizontal: 8 },
  countRow: { marginBottom: 12, alignItems: 'flex-end' },
  countText: { fontFamily: 'DMSans-Medium', fontSize: 12, color: 'rgba(255,255,255,0.6)' },
  card: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(52, 194, 106, 0.15)',
    gap: 12,
  },
  cardLeft: {
    width: 50, height: 50, borderRadius: 25,
    backgroundColor: 'rgba(52, 194, 106, 0.15)',
    justifyContent: 'center', alignItems: 'center',
  },
  avatar: { fontSize: 26 },
  cardMain: { flex: 1, gap: 6 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  cardName: { flex: 1, fontFamily: 'Poppins-SemiBold', fontSize: 16, color: '#FFFFFF' },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.12)' },
  badgeTitular: { backgroundColor: 'rgba(52, 194, 106, 0.2)' },
  badgePediatrico: { backgroundColor: 'rgba(255, 183, 77, 0.2)' },
  badgeText: { fontFamily: 'DMSans-Bold', fontSize: 10, color: '#FFFFFF', textTransform: 'uppercase', letterSpacing: 0.5 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'center' },
  metaInline: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontFamily: 'DMSans-Regular', fontSize: 12, color: 'rgba(255,255,255,0.6)' },
  actionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
    backgroundColor: 'rgba(52, 194, 106, 0.12)',
    borderWidth: 1, borderColor: 'rgba(52, 194, 106, 0.25)',
  },
  actionDelete: { backgroundColor: 'rgba(255, 107, 107, 0.1)', borderColor: 'rgba(255, 107, 107, 0.3)' },
  actionKids: { backgroundColor: 'rgba(255, 183, 77, 0.15)', borderColor: 'rgba(255, 183, 77, 0.4)' },
  actionText: { fontFamily: 'DMSans-Bold', fontSize: 12, color: '#34C26A' },
  addButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#FFFFFF', borderRadius: 12,
    paddingVertical: 14, marginTop: 4,
  },
  addButtonText: { fontFamily: 'Poppins-Bold', fontSize: 15, color: '#106B4F' },
  limitText: { fontFamily: 'DMSans-Regular', fontSize: 13, color: 'rgba(255,255,255,0.6)', textAlign: 'center', marginTop: 12 },
  centerContent: { paddingVertical: 40, alignItems: 'center' },
  errorText: { fontFamily: 'DMSans-Medium', fontSize: 13, color: '#FF6B6B', textAlign: 'center', marginVertical: 12 },
});
