import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { X } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/AuthContext';
import { useLanguage } from '@/lib/LanguageContext';
import { theme } from '@/lib/theme';
import PressableScale from '@/components/ui/PressableScale';

type LoginNudgeProps = {
  message?: string;
  ctaText?: string;
  delayMs?: number;
};

export default function LoginNudge({
  message,
  ctaText,
  delayMs = 4000,
}: LoginNudgeProps) {
  const { session } = useAuth();
  const { t } = useLanguage();
  const router = useRouter();
  const resolvedMessage = message ?? t.comp.nudgeMessage;
  const resolvedCta = ctaText ?? t.comp.nudgeCta;
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    if (session || dismissed) return;
    const timer = setTimeout(() => {
      setVisible(true);
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
      ]).start();
    }, delayMs);
    return () => clearTimeout(timer);
  }, [session, dismissed, delayMs, fadeAnim, slideAnim]);

  if (session || !visible || dismissed) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <View style={styles.content}>
        <Text style={styles.message}>{resolvedMessage}</Text>
        <PressableScale
          style={styles.cta}
          onPress={() => router.push('/auth/register')}
        >
          <Text style={styles.ctaText}>{resolvedCta}</Text>
        </PressableScale>
      </View>
      <PressableScale
        style={styles.dismiss}
        onPress={() => setDismissed(true)}
        scaleTo={0.85}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <X size={14} color={theme.colors.textMuted} />
      </PressableScale>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 72,
    left: theme.spacing.md,
    right: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadow.lg,
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  message: {
    flex: 1,
    ...theme.text.bodyMedium,
    fontSize: 13,
    color: theme.colors.textPrimary,
    lineHeight: 18,
  },
  cta: {
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius.pill,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    ...theme.shadow.accent,
  },
  ctaText: {
    fontFamily: theme.font.bodyBold,
    fontSize: 12,
    color: theme.colors.accentText,
  },
  dismiss: {
    width: 28,
    height: 28,
    borderRadius: theme.radius.pill,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: theme.spacing.xs,
  },
});
