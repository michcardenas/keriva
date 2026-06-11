import { type ReactNode } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useLanguage } from '@/lib/LanguageContext';
import { theme } from '@/lib/theme';
import PressableScale from '@/components/ui/PressableScale';
import Reveal from '@/components/ui/Reveal';

type AuthRequiredPlaceholderProps = {
  icon: ReactNode;
  title: string;
  description: string;
  registerLabel?: string;
  loginLabel?: string;
};

export default function AuthRequiredPlaceholder({
  icon,
  title,
  description,
  registerLabel,
  loginLabel,
}: AuthRequiredPlaceholderProps) {
  const router = useRouter();
  const { t } = useLanguage();
  const resolvedRegister = registerLabel ?? t.comp.registerLabel;
  const resolvedLogin = loginLabel ?? t.comp.loginLabel;

  return (
    <View style={styles.container}>
      <Reveal variant="up" delay={60}>
        <View style={styles.iconBox}>{icon}</View>
      </Reveal>
      <Reveal variant="up" delay={120}>
        <Text style={styles.title}>{title}</Text>
      </Reveal>
      <Reveal variant="up" delay={160}>
        <Text style={styles.description}>{description}</Text>
      </Reveal>

      <View style={styles.buttons}>
        <Reveal index={1} delay={200} style={styles.buttonWrap}>
          <PressableScale
            style={styles.primaryButton}
            onPress={() => router.push('/auth/register')}
          >
            <Text style={styles.primaryButtonText}>{resolvedRegister}</Text>
          </PressableScale>
        </Reveal>

        <Reveal index={2} delay={240} style={styles.buttonWrap}>
          <PressableScale
            style={styles.secondaryButton}
            onPress={() => router.push('/auth/login')}
          >
            <Text style={styles.secondaryButtonText}>{resolvedLogin}</Text>
          </PressableScale>
        </Reveal>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.xxxl,
    backgroundColor: theme.colors.bg,
  },
  iconBox: {
    width: 120,
    height: 120,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.accentSoft,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.xxl,
    alignSelf: 'center',
  },
  title: {
    ...theme.text.h1,
    fontSize: 26,
    lineHeight: 32,
    color: theme.colors.textPrimary,
    textAlign: 'center',
    marginBottom: theme.spacing.md,
  },
  description: {
    ...theme.text.body,
    fontSize: 15,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: theme.spacing.xxxl,
    paddingHorizontal: theme.spacing.lg,
  },
  buttons: {
    alignSelf: 'stretch',
    gap: theme.spacing.md,
  },
  buttonWrap: {
    alignSelf: 'stretch',
  },
  primaryButton: {
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius.pill,
    paddingVertical: theme.spacing.lg,
    alignItems: 'center',
    ...theme.shadow.accent,
  },
  primaryButtonText: {
    fontFamily: theme.font.bold,
    fontSize: 16,
    color: theme.colors.accentText,
  },
  secondaryButton: {
    borderWidth: 2,
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.accentSofter,
    borderRadius: theme.radius.pill,
    paddingVertical: theme.spacing.lg,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontFamily: theme.font.bold,
    fontSize: 16,
    color: theme.colors.accent,
  },
});
