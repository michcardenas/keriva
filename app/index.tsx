import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useLanguage } from '@/lib/LanguageContext';
import LanguageSelector from '@/components/LanguageSelector';

export default function SplashScreen() {
  const router = useRouter();
  const { t } = useLanguage();

  return (
    <LinearGradient
      colors={['#052419', '#106B4F', '#052419']}
      style={styles.container}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
    >
      <View style={styles.topBar}>
        <LanguageSelector />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.logoContainer}>
          <Image
            source={require('@/assets/images/logo.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
          <Text style={styles.tagline}>
            {t.splash.tagline}
          </Text>
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
            onPress={() => router.push('/auth/register')}
          >
            <Text style={styles.primaryButtonText}>{t.splash.startButton}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => router.push('/auth/login')}
          >
            <Text style={styles.secondaryButtonText}>{t.splash.signInButton}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.exploreButton}
            onPress={() => router.replace('/(tabs)')}
          >
            <Text style={styles.exploreButtonText}>Explorar sin cuenta</Text>
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
  topBar: {
    position: 'absolute',
    top: 60,
    right: 20,
    zIndex: 10,
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
  logoImage: {
    width: 200,
    height: 200,
    marginBottom: 16,
  },
  tagline: {
    fontFamily: 'DMSans-Medium',
    fontSize: 22,
    color: '#34C26A',
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 32,
    paddingHorizontal: 20,
  },
  featuresContainer: {
    gap: 12,
    marginBottom: 40,
  },
  featureChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(52, 194, 106, 0.1)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(52, 194, 106, 0.3)',
  },
  featureCheckmark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#34C26A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  featureCheckmarkText: {
    color: '#052419',
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
    color: '#106B4F',
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
  exploreButton: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  exploreButtonText: {
    fontFamily: 'DMSans-Medium',
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.65)',
    textDecorationLine: 'underline',
  },
});
