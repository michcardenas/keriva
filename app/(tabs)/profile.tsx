import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Award, Trophy, TrendingUp, Gift, Settings, ArrowLeft } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import LanguageSelector from '@/components/LanguageSelector';

const ACHIEVEMENTS = [
  { icon: '🎯', title: 'Primer reporte', description: 'Reportaste tu primer precio', unlocked: true },
  { icon: '🌟', title: '10 reportes', description: 'Alcanza 10 reportes', unlocked: false },
  { icon: '🏆', title: 'Contribuidor top', description: 'Sé uno de los mejores', unlocked: false },
];

const RECENT_ACTIVITY = [
  { action: 'Reporte de precio', medication: 'Metformina 500mg', points: 50, date: 'Hace 2 horas' },
  { action: 'Reporte de precio', medication: 'Losartán 50mg', points: 50, date: 'Ayer' },
  { action: 'Reporte de precio', medication: 'Amoxicilina 500mg', points: 50, date: 'Hace 3 días' },
];

export default function ProfileScreen() {
  const router = useRouter();
  const [points, setPoints] = useState(150);
  const [reportsCount, setReportsCount] = useState(3);

  useEffect(() => {
    loadUserPoints();
  }, []);

  const loadUserPoints = async () => {
    const { data, error } = await supabase
      .from('user_points')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) {
      setPoints(data.points);
      setReportsCount(data.reports_count);
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => router.push('/(tabs)')}
      >
        <ArrowLeft size={24} color="#FFFFFF" />
      </TouchableOpacity>

      <LinearGradient
        colors={['#1A7A4A', '#0F1F17']}
        style={styles.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      >
        <View style={styles.headerTop}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>👤</Text>
          </View>
          <View style={styles.headerActions}>
            <LanguageSelector />
            <TouchableOpacity style={styles.settingsButton}>
              <Settings size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.userName}>Usuario Keriva</Text>
        <Text style={styles.userEmail}>usuario@keriva.com</Text>

        <View style={styles.pointsCard}>
          <View style={styles.pointsLeft}>
            <Award size={32} color="#7ED957" />
          </View>
          <View style={styles.pointsRight}>
            <Text style={styles.pointsLabel}>Puntos totales</Text>
            <Text style={styles.pointsValue}>{points.toLocaleString()}</Text>
          </View>
        </View>
      </LinearGradient>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Trophy size={24} color="#1A7A4A" />
            <Text style={styles.statValue}>{reportsCount}</Text>
            <Text style={styles.statLabel}>Reportes</Text>
          </View>
          <View style={styles.statCard}>
            <TrendingUp size={24} color="#1A7A4A" />
            <Text style={styles.statValue}>#{reportsCount <= 10 ? '100+' : '50+'}</Text>
            <Text style={styles.statLabel}>Ranking</Text>
          </View>
          <View style={styles.statCard}>
            <Gift size={24} color="#1A7A4A" />
            <Text style={styles.statValue}>0</Text>
            <Text style={styles.statLabel}>Recompensas</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Logros</Text>
          <View style={styles.achievementsList}>
            {ACHIEVEMENTS.map((achievement, index) => (
              <View
                key={index}
                style={[
                  styles.achievementCard,
                  !achievement.unlocked && styles.achievementCardLocked,
                ]}
              >
                <Text style={styles.achievementIcon}>{achievement.icon}</Text>
                <View style={styles.achievementInfo}>
                  <Text
                    style={[
                      styles.achievementTitle,
                      !achievement.unlocked && styles.achievementTitleLocked,
                    ]}
                  >
                    {achievement.title}
                  </Text>
                  <Text style={styles.achievementDescription}>
                    {achievement.description}
                  </Text>
                </View>
                {achievement.unlocked && (
                  <View style={styles.achievementBadge}>
                    <Text style={styles.achievementBadgeText}>✓</Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Actividad reciente</Text>
          {RECENT_ACTIVITY.map((activity, index) => (
            <View key={index} style={styles.activityCard}>
              <View style={styles.activityLeft}>
                <View style={styles.activityIcon}>
                  <Text style={styles.activityIconText}>📊</Text>
                </View>
                <View>
                  <Text style={styles.activityAction}>{activity.action}</Text>
                  <Text style={styles.activityMedication}>{activity.medication}</Text>
                  <Text style={styles.activityDate}>{activity.date}</Text>
                </View>
              </View>
              <View style={styles.activityPoints}>
                <Text style={styles.activityPointsValue}>+{activity.points}</Text>
                <Text style={styles.activityPointsLabel}>pts</Text>
              </View>
            </View>
          ))}
        </View>

        <TouchableOpacity style={styles.redeemButton}>
          <Gift size={20} color="#FFFFFF" />
          <Text style={styles.redeemButtonText}>Canjear puntos</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  backButton: {
    position: 'absolute',
    top: 60,
    left: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1001,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  header: {
    paddingTop: 60,
    paddingBottom: 24,
    paddingHorizontal: 20,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 32,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  settingsButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userName: {
    fontFamily: 'Poppins-Bold',
    fontSize: 24,
    color: '#FFFFFF',
    marginBottom: 4,
  },
  userEmail: {
    fontFamily: 'DMSans-Regular',
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 20,
  },
  pointsCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  pointsLeft: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(126, 217, 87, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pointsRight: {
    flex: 1,
  },
  pointsLabel: {
    fontFamily: 'DMSans-Regular',
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 4,
  },
  pointsValue: {
    fontFamily: 'Poppins-Bold',
    fontSize: 32,
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  statValue: {
    fontFamily: 'Poppins-Bold',
    fontSize: 24,
    color: '#0F1F17',
    marginTop: 8,
  },
  statLabel: {
    fontFamily: 'DMSans-Regular',
    fontSize: 12,
    color: '#666666',
    marginTop: 4,
  },
  section: {
    padding: 20,
  },
  sectionTitle: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 18,
    color: '#0F1F17',
    marginBottom: 16,
  },
  achievementsList: {
    gap: 12,
  },
  achievementCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  achievementCardLocked: {
    opacity: 0.5,
  },
  achievementIcon: {
    fontSize: 32,
  },
  achievementInfo: {
    flex: 1,
  },
  achievementTitle: {
    fontFamily: 'DMSans-Medium',
    fontSize: 15,
    color: '#0F1F17',
    marginBottom: 2,
  },
  achievementTitleLocked: {
    color: '#999999',
  },
  achievementDescription: {
    fontFamily: 'DMSans-Regular',
    fontSize: 13,
    color: '#666666',
  },
  achievementBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#7ED957',
    justifyContent: 'center',
    alignItems: 'center',
  },
  achievementBadgeText: {
    color: '#0F1F17',
    fontSize: 14,
    fontFamily: 'DMSans-Bold',
  },
  activityCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  activityLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  activityIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F0F9F4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  activityIconText: {
    fontSize: 20,
  },
  activityAction: {
    fontFamily: 'DMSans-Medium',
    fontSize: 14,
    color: '#0F1F17',
  },
  activityMedication: {
    fontFamily: 'DMSans-Regular',
    fontSize: 13,
    color: '#666666',
    marginTop: 2,
  },
  activityDate: {
    fontFamily: 'DMSans-Regular',
    fontSize: 12,
    color: '#999999',
    marginTop: 2,
  },
  activityPoints: {
    alignItems: 'flex-end',
  },
  activityPointsValue: {
    fontFamily: 'Poppins-Bold',
    fontSize: 18,
    color: '#1A7A4A',
  },
  activityPointsLabel: {
    fontFamily: 'DMSans-Regular',
    fontSize: 11,
    color: '#666666',
  },
  redeemButton: {
    backgroundColor: '#1A7A4A',
    borderRadius: 12,
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 20,
    marginBottom: 20,
  },
  redeemButtonText: {
    fontFamily: 'Poppins-Bold',
    fontSize: 16,
    color: '#FFFFFF',
  },
});
