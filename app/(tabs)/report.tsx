import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Camera, Award } from 'lucide-react-native';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';

const STEPS = [
  { number: 1, title: 'Foto', description: 'Toma una foto del precio' },
  { number: 2, title: 'Detalles', description: 'Confirma los datos' },
  { number: 3, title: 'Confirmar', description: 'Envía el reporte' },
];

export default function ReportScreen() {
  const [currentStep, setCurrentStep] = useState(1);
  const [photoTaken, setPhotoTaken] = useState(false);
  const [medication, setMedication] = useState('Metformina 500mg');
  const [pharmacy, setPharmacy] = useState('Farmacia Carol');
  const [price, setPrice] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!price) {
      Alert.alert('Error', 'Por favor ingresa el precio');
      return;
    }

    setSubmitting(true);

    try {
      const userId = 'user-' + Math.random().toString(36).substr(2, 9);

      const { data: existingUser } = await supabase
        .from('user_points')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (!existingUser) {
        await supabase.from('user_points').insert({
          user_id: userId,
          points: 50,
          reports_count: 1,
        });
      } else {
        await supabase
          .from('user_points')
          .update({
            points: existingUser.points + 50,
            reports_count: existingUser.reports_count + 1,
          })
          .eq('user_id', userId);
      }

      Alert.alert(
        '¡Éxito!',
        'Tu reporte ha sido enviado. Has ganado 50 puntos Keriva.',
        [
          {
            text: 'OK',
            onPress: () => {
              setCurrentStep(1);
              setPhotoTaken(false);
              setPrice('');
            },
          },
        ]
      );
    } catch (error) {
      Alert.alert('Error', 'No se pudo enviar el reporte. Intenta de nuevo.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#1A7A4A', '#0F1F17']}
        style={styles.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      >
        <Text style={styles.headerTitle}>Reportar Precio</Text>
        <Text style={styles.headerSubtitle}>Ayuda a la comunidad y gana puntos</Text>

        <View style={styles.stepsContainer}>
          {STEPS.map((step, index) => (
            <View key={step.number} style={styles.stepWrapper}>
              <View
                style={[
                  styles.stepIndicator,
                  currentStep >= step.number && styles.stepIndicatorActive,
                ]}
              >
                <Text
                  style={[
                    styles.stepNumber,
                    currentStep >= step.number && styles.stepNumberActive,
                  ]}
                >
                  {step.number}
                </Text>
              </View>
              {index < STEPS.length - 1 && (
                <View
                  style={[
                    styles.stepConnector,
                    currentStep > step.number && styles.stepConnectorActive,
                  ]}
                />
              )}
            </View>
          ))}
        </View>
      </LinearGradient>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.rewardBanner}>
          <Award size={24} color="#1A7A4A" />
          <Text style={styles.rewardBannerText}>+50 puntos Keriva</Text>
        </View>

        {currentStep === 1 && (
          <View style={styles.stepContent}>
            <TouchableOpacity
              style={styles.photoUpload}
              onPress={() => {
                setPhotoTaken(true);
                setCurrentStep(2);
              }}
            >
              {!photoTaken ? (
                <>
                  <Camera size={48} color="#1A7A4A" />
                  <Text style={styles.photoUploadTitle}>Tomar foto del precio</Text>
                  <Text style={styles.photoUploadSubtitle}>
                    Asegúrate que el precio sea visible
                  </Text>
                </>
              ) : (
                <>
                  <View style={styles.photoPreview}>
                    <Text style={styles.photoPreviewText}>📸</Text>
                  </View>
                  <Text style={styles.photoUploadTitle}>Foto capturada</Text>
                </>
              )}
            </TouchableOpacity>

            {photoTaken && (
              <TouchableOpacity
                style={styles.continueButton}
                onPress={() => setCurrentStep(2)}
              >
                <Text style={styles.continueButtonText}>Continuar</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {currentStep === 2 && (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Confirma los detalles</Text>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Medicamento</Text>
              <TextInput
                style={styles.input}
                value={medication}
                onChangeText={setMedication}
                placeholder="Nombre del medicamento"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Farmacia</Text>
              <TextInput
                style={styles.input}
                value={pharmacy}
                onChangeText={setPharmacy}
                placeholder="Nombre de la farmacia"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Precio (RD$)</Text>
              <TextInput
                style={styles.input}
                value={price}
                onChangeText={setPrice}
                placeholder="0.00"
                keyboardType="decimal-pad"
              />
            </View>

            <TouchableOpacity
              style={styles.continueButton}
              onPress={() => setCurrentStep(3)}
            >
              <Text style={styles.continueButtonText}>Continuar</Text>
            </TouchableOpacity>
          </View>
        )}

        {currentStep === 3 && (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Confirmar reporte</Text>

            <View style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Medicamento</Text>
                <Text style={styles.summaryValue}>{medication}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Farmacia</Text>
                <Text style={styles.summaryValue}>{pharmacy}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Precio</Text>
                <Text style={styles.summaryPrice}>RD${price}</Text>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              <Text style={styles.submitButtonText}>
                {submitting ? 'Enviando...' : 'Enviar reporte'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    paddingTop: 60,
    paddingBottom: 24,
    paddingHorizontal: 20,
  },
  headerTitle: {
    fontFamily: 'Poppins-Bold',
    fontSize: 28,
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontFamily: 'DMSans-Regular',
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 4,
    marginBottom: 24,
  },
  stepsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepIndicator: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepIndicatorActive: {
    backgroundColor: '#7ED957',
  },
  stepNumber: {
    fontFamily: 'Poppins-Bold',
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.5)',
  },
  stepNumberActive: {
    color: '#0F1F17',
  },
  stepConnector: {
    width: 40,
    height: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  stepConnectorActive: {
    backgroundColor: '#7ED957',
  },
  content: {
    flex: 1,
  },
  rewardBanner: {
    backgroundColor: '#E8F5E9',
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    borderWidth: 2,
    borderColor: '#7ED957',
  },
  rewardBannerText: {
    fontFamily: 'Poppins-Bold',
    fontSize: 18,
    color: '#1A7A4A',
  },
  stepContent: {
    padding: 20,
  },
  stepTitle: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 20,
    color: '#0F1F17',
    marginBottom: 20,
  },
  photoUpload: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 40,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E0E0E0',
    borderStyle: 'dashed',
  },
  photoUploadTitle: {
    fontFamily: 'DMSans-Medium',
    fontSize: 16,
    color: '#0F1F17',
    marginTop: 16,
  },
  photoUploadSubtitle: {
    fontFamily: 'DMSans-Regular',
    fontSize: 14,
    color: '#666666',
    marginTop: 4,
  },
  photoPreview: {
    width: 120,
    height: 120,
    backgroundColor: '#F0F9F4',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoPreviewText: {
    fontSize: 48,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontFamily: 'DMSans-Medium',
    fontSize: 14,
    color: '#0F1F17',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    fontFamily: 'DMSans-Regular',
    fontSize: 16,
    color: '#0F1F17',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  continueButton: {
    backgroundColor: '#1A7A4A',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  continueButtonText: {
    fontFamily: 'Poppins-Bold',
    fontSize: 16,
    color: '#FFFFFF',
  },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  summaryLabel: {
    fontFamily: 'DMSans-Regular',
    fontSize: 14,
    color: '#666666',
  },
  summaryValue: {
    fontFamily: 'DMSans-Medium',
    fontSize: 14,
    color: '#0F1F17',
  },
  summaryPrice: {
    fontFamily: 'Poppins-Bold',
    fontSize: 20,
    color: '#1A7A4A',
  },
  submitButton: {
    backgroundColor: '#7ED957',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    fontFamily: 'Poppins-Bold',
    fontSize: 16,
    color: '#0F1F17',
  },
});
