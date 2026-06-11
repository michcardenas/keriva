import { type ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  StyleSheet,
  type ViewStyle,
  type StyleProp,
} from 'react-native';

type KeyboardAwareScreenProps = {
  children: ReactNode;
  /** Estilo del contenedor del contenido (padding, etc.). */
  contentContainerStyle?: StyleProp<ViewStyle>;
  style?: StyleProp<ViewStyle>;
  /** Offset extra entre el teclado y el input (default 0). */
  keyboardOffset?: number;
};

/**
 * Envoltorio para pantallas con formularios: evita que el teclado tape los
 * inputs. Combina KeyboardAvoidingView + ScrollView y permite tocar botones
 * con el teclado abierto (keyboardShouldPersistTaps="handled").
 *
 * Úsalo como contenedor raíz de cualquier pantalla con TextInput:
 *   <KeyboardAwareScreen contentContainerStyle={{ padding: 24 }}>
 *     ...inputs...
 *   </KeyboardAwareScreen>
 */
export default function KeyboardAwareScreen({
  children,
  contentContainerStyle,
  style,
  keyboardOffset = 0,
}: KeyboardAwareScreenProps) {
  return (
    <KeyboardAvoidingView
      style={[styles.flex, style]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={keyboardOffset}
    >
      <ScrollView
        contentContainerStyle={[styles.content, contentContainerStyle]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { flexGrow: 1 },
});
