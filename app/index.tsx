import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Search } from 'lucide-react-native';
import { useLanguage } from '@/lib/LanguageContext';
import { LANGUAGES } from '@/lib/translations';

export default function SplashScreen() {
  const router = useRouter();
  const { language, setLanguage, t } = useLanguage();

  return (
    <LinearGradient
      colors={['#0F1F17', '#1A7A4A', '#0F1F17']}
      style={styles.container}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.logoContainer}>
          <View style={styles.logoIcon}>
            <Search color="#7ED957" size={36} strokeWidth={3} />
            <View style={styles.pillIconContainer}>
              <View style={styles.pillHalf} />
              <View style={[styles.pillHalf, styles.pillHalfWhite]} />
            </View>
          </View>
          <Text style={styles.logoText}>keriva</Text>
          <Text style={styles.tagline}>
            {t.splash.tagline}
          </Text>
        </View>

        <View style={styles.languageContainer}>
          <Text style={styles.languageLabel}>{t.splash.language}</Text>
          <View style={styles.languageGrid}>
            {LANGUAGES.map((lang) => (
              <TouchableOpacity
                key={lang.code}
                style={[
                  styles.languageButton,
                  language === lang.code && styles.languageButtonActive,
                ]}
                onPress={() => setLanguage(lang.code as any)}
              >
                <Text style={styles.languageFlag}>{lang.flag}</Text>
                <Text
                  style={[
                    styles.languageCode,
                    language === lang.code && styles.languageCodeActive,
                  ]}
                >
                  {lang.code}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.featuresContainer}>
          {t.splash.features.map((feature, index) => (
            <View key={index} style={styles.featureChip}>
              <View style={styles.featureCheckmark}>
                <Text style={styles.featureCheckmarkText}>✓</Text>
              </View>
              <Text style={styles.featureText}>{feature}</Text>
            </View>
          ))}
        </View>

        <View style={styles.ctaContainer}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => router.push('/(tabs)')}
          >
            <Text style={styles.primaryButtonText}>{t.splash.startButton}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => router.push('/(tabs)')}
          >
            <Text style={styles.secondaryButtonText}>{t.splash.signInButton}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 80,
    paddingBottom: 40,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoIcon: {
    position: 'relative',
    width: 80,
    height: 80,
    backgroundColor: 'rgba(126, 217, 87, 0.1)',
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  pillIconContainer: {
    position: 'absolute',
    width: 16,
    height: 8,
    flexDirection: 'row',
    borderRadius: 4,
    overflow: 'hidden',
  },
  pillHalf: {
    width: 8,
    height: 8,
    backgroundColor: '#7ED957',
  },
  pillHalfWhite: {
    backgroundColor: '#FFFFFF',
  },
  logoText: {
    fontFamily: 'Poppins-Black',
    fontSize: 48,
    color: '#FFFFFF',
    letterSpacing: -1,
  },
  tagline: {
    fontFamily: 'DMSans-Regular',
    fontSize: 16,
    color: '#7ED957',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 24,
    paddingHorizontal: 20,
  },
  languageContainer: {
    marginBottom: 32,
  },
  languageLabel: {
    fontFamily: 'DMSans-Medium',
    fontSize: 14,
    color: '#FFFFFF',
    marginBottom: 12,
    opacity: 0.7,
  },
  languageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  languageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  languageButtonActive: {
    backgroundColor: '#7ED957',
    borderColor: '#7ED957',
  },
  languageFlag: {
    fontSize: 18,
  },
  languageCode: {
    fontFamily: 'DMSans-Medium',
    fontSize: 12,
    color: '#FFFFFF',
  },
  languageCodeActive: {
    color: '#0F1F17',
  },
  featuresContainer: {
    gap: 12,
    marginBottom: 40,
  },
  featureChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(126, 217, 87, 0.1)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(126, 217, 87, 0.3)',
  },
  featureCheckmark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#7ED957',
    justifyContent: 'center',
    alignItems: 'center',
  },
  featureCheckmarkText: {
    color: '#0F1F17',
    fontSize: 14,
    fontFamily: 'DMSans-Bold',
  },
  featureText: {
    flex: 1,
    fontFamily: 'DMSans-Regular',
    fontSize: 14,
    color: '#FFFFFF',
    lineHeight: 20,
  },
  ctaContainer: {
    gap: 12,
    marginTop: 'auto',
  },
  primaryButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryButtonText: {
    fontFamily: 'Poppins-Bold',
    fontSize: 16,
    color: '#1A7A4A',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  secondaryButtonText: {
    fontFamily: 'Poppins-Bold',
    fontSize: 16,
    color: '#FFFFFF',
  },
});
