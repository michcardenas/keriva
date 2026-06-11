import { useEffect } from 'react';
import { View, Text, StyleSheet, Image, ScrollView, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Banknote, MapPin, TrendingUp, ArrowRight } from 'lucide-react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
  interpolate,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useLanguage } from '@/lib/LanguageContext';
import LanguageSelector from '@/components/LanguageSelector';
import PressableScale from '@/components/ui/PressableScale';
import Reveal from '@/components/ui/Reveal';
import { theme } from '@/lib/theme';

const FEATURE_ICONS = [Banknote, MapPin, TrendingUp];

export default function SplashScreen() {
  const router = useRouter();
  const { t } = useLanguage();

  // Animación 1: el logo flota suavemente (sube y baja).
  const floatY = useSharedValue(0);
  // Animación 2: el brillo del fondo pulsa (como si respirara luz).
  const pulse = useSharedValue(0);

  useEffect(() => {
    floatY.value = withRepeat(
      withTiming(-12, { duration: 1800, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
    pulse.value = withRepeat(
      withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [floatY, pulse]);

  const floatStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: floatY.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pulse.value, [0, 1], [0.12, 0.3]),
    transform: [{ scale: interpolate(pulse.value, [0, 1], [0.95, 1.08]) }],
  }));

  const features = t.splash.features.slice(0, 3);

  return (
    <View style={styles.container}>
      {/* Brillo de fondo animado (pulso de luz, suave) */}
      <Animated.View pointerEvents="none" style={[styles.bgGlow, glowStyle]} />

      <View style={styles.topBar}>
        <LanguageSelector />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Hero: logo flotante */}
        <View style={styles.hero}>
          <Animated.View style={floatStyle}>
            <Image
              source={require('@/assets/images/logo.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </Animated.View>
          <View style={styles.taglineRow}>
            <Text style={styles.tagline}>{t.splash.tagline}</Text>
          </View>
        </View>

        {/* Beneficios — lista apilada (textos originales) */}
        <View style={styles.features}>
          {features.map((feature, i) => {
            const Icon = FEATURE_ICONS[i] ?? Banknote;
            return (
              <Reveal key={i} index={i + 1} delay={120}>
                <View style={styles.featureRow}>
                  <View style={styles.featureIcon}>
                    <Icon size={20} color={theme.colors.nightAccent} strokeWidth={2} />
                  </View>
                  <Text style={styles.featureText}>{feature}</Text>
                </View>
              </Reveal>
            );
          })}
        </View>

        {/* CTAs */}
        <View style={styles.ctaContainer}>
          <Reveal index={4} delay={220}>
            <PressableScale onPress={() => router.push('/auth/register')} style={styles.primaryBtn}>
              <LinearGradient
                colors={[theme.colors.neon, theme.colors.nightAccent]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.primaryGrad}
              >
                <Text style={styles.primaryBtnText}>{t.splash.startButton}</Text>
                <ArrowRight size={18} color={theme.colors.nightBg} strokeWidth={2.5} />
              </LinearGradient>
            </PressableScale>
          </Reveal>

          <Reveal index={5} delay={270}>
            <PressableScale onPress={() => router.push('/auth/login')} style={styles.outlineBtn}>
              <Text style={styles.outlineBtnText}>{t.splash.signInButton}</Text>
            </PressableScale>
          </Reveal>

          <Reveal index={6} delay={310}>
            <PressableScale onPress={() => router.replace('/(tabs)')} style={styles.ghostBtn}>
              <Text style={styles.ghostBtnText}>{t.home.exploreNoAccount}</Text>
            </PressableScale>
          </Reveal>
        </View>
      </ScrollView>
    </View>
  );
}

const GLOW =
  Platform.OS === 'web'
    ? ({ boxShadow: `0px 0px 140px 60px ${theme.colors.nightAccent}` } as any)
    : {
        shadowColor: theme.colors.nightAccent,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 1,
        shadowRadius: 100,
      };

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.nightBg,
    overflow: 'hidden',
  },
  bgGlow: {
    position: 'absolute',
    top: 110,
    alignSelf: 'center',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: theme.colors.nightAccent,
    ...GLOW,
  },
  topBar: {
    position: 'absolute',
    top: 56,
    right: theme.spacing.xl,
    zIndex: 10,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: theme.spacing.xxl,
    paddingTop: 96,
    paddingBottom: theme.spacing.huge,
  },
  hero: {
    alignItems: 'center',
    marginBottom: theme.spacing.xxxl,
  },
  logoImage: {
    width: 150,
    height: 150,
  },
  taglineRow: {
    marginTop: theme.spacing.lg,
    borderTopWidth: 2,
    borderTopColor: theme.colors.nightAccent,
    paddingTop: theme.spacing.md,
  },
  tagline: {
    fontFamily: theme.font.bodyBold,
    fontSize: 13,
    letterSpacing: 3,
    color: theme.colors.nightAccent,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  features: {
    gap: theme.spacing.md,
    marginBottom: theme.spacing.xxxl,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.lg,
    backgroundColor: theme.colors.nightSurface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.nightHairline,
    padding: theme.spacing.lg,
  },
  featureIcon: {
    width: 46,
    height: 46,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.nightAccentSoft,
    borderWidth: 1,
    borderColor: theme.colors.nightAccentBorder,
    justifyContent: 'center',
    alignItems: 'center',
  },
  featureText: {
    flex: 1,
    ...theme.text.bodyMedium,
    fontSize: 14,
    color: theme.colors.nightText,
  },
  ctaContainer: {
    gap: theme.spacing.md,
    marginTop: 'auto',
    marginHorizontal: theme.spacing.md,
  },
  primaryBtn: {
    borderRadius: theme.radius.pill,
    ...(Platform.OS === 'web'
      ? ({ boxShadow: `0px 10px 26px rgba(87,194,147,0.45)` } as any)
      : {
          shadowColor: theme.colors.nightAccent,
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.5,
          shadowRadius: 16,
          elevation: 10,
        }),
  },
  primaryGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    height: 58,
    borderRadius: theme.radius.pill,
    overflow: 'hidden',
  },
  primaryBtnText: {
    fontFamily: theme.font.bold,
    fontSize: 16,
    color: theme.colors.nightBg,
    letterSpacing: 0.3,
  },
  outlineBtn: {
    height: 56,
    borderRadius: theme.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: theme.colors.nightAccentBorder,
    backgroundColor: 'rgba(87,194,147,0.06)',
  },
  outlineBtnText: {
    fontFamily: theme.font.semibold,
    fontSize: 15,
    color: theme.colors.nightAccent,
  },
  ghostBtn: {
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostBtnText: {
    ...theme.text.bodyMedium,
    color: theme.colors.nightTextFaint,
  },
});
