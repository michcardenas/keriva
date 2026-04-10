import { type ReactNode } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';

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
  registerLabel = 'Crear cuenta gratis',
  loginLabel = 'Ya tengo cuenta',
}: AuthRequiredPlaceholderProps) {
  const router = useRouter();

  return (
    <LinearGradient
      colors={['#0F1F17', '#1A7A4A', '#0F1F17']}
      style={styles.container}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
    >
      <View style={styles.iconBox}>{icon}</View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>

      <View style={styles.buttons}>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => router.push('/auth/register')}
        >
          <Text style={styles.primaryButtonText}>{registerLabel}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => router.push('/auth/login')}
        >
          <Text style={styles.secondaryButtonText}>{loginLabel}</Text>
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  iconBox: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(126, 217, 87, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 28,
  },
  title: {
    fontFamily: 'Poppins-Bold',
    fontSize: 26,
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 12,
  },
  description: {
    fontFamily: 'DMSans-Regular',
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 36,
    paddingHorizontal: 16,
  },
  buttons: {
    alignSelf: 'stretch',
    gap: 12,
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
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontFamily: 'Poppins-Bold',
    fontSize: 16,
    color: '#FFFFFF',
  },
});
