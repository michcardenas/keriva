import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { X } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/AuthContext';

type LoginNudgeProps = {
  message?: string;
  ctaText?: string;
  delayMs?: number;
};

export default function LoginNudge({
  message = 'Crea tu cuenta para reportar precios y ganar puntos',
  ctaText = 'Registrarme',
  delayMs = 4000,
}: LoginNudgeProps) {
  const { session } = useAuth();
  const router = useRouter();
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
        <Text style={styles.message}>{message}</Text>
        <TouchableOpacity
          style={styles.cta}
          onPress={() => router.push('/auth/register')}
        >
          <Text style={styles.ctaText}>{ctaText}</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity
        style={styles.dismiss}
        onPress={() => setDismissed(true)}
      >
        <X size={14} color="#999" />
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 72,
    left: 12,
    right: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(52, 194, 106, 0.3)',
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  message: {
    flex: 1,
    fontFamily: 'DMSans-Medium',
    fontSize: 13,
    color: '#052419',
    lineHeight: 18,
  },
  cta: {
    backgroundColor: '#106B4F',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  ctaText: {
    fontFamily: 'DMSans-Bold',
    fontSize: 12,
    color: '#FFFFFF',
  },
  dismiss: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4,
  },
});
