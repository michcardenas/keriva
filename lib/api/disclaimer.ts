import { Platform } from 'react-native';
import { restGet, restRpc } from '@/lib/api/_rest';

// =====================================================================
// Versiones de los disclaimers — bump aquí cuando cambie el texto.
// Cualquier cambio de versión obliga al usuario a re-aceptar.
// =====================================================================
export const DISCLAIMER_VERSIONS = {
  pediatrico: 'kids_v1.0',
  adulto_care: 'care_v1.0',
} as const;

export type TipoDisclaimer = keyof typeof DISCLAIMER_VERSIONS;

// =====================================================================
// Texto del disclaimer pediátrico — Brief §5 (texto EXACTO)
// =====================================================================
export const DISCLAIMER_KIDS_TEXT = `AVISO MÉDICO IMPORTANTE

Keriva es una herramienta informativa y de apoyo, NO sustituye la consulta médica profesional. Los cálculos son estimaciones basadas en literatura estándar. Siempre valide con su médico antes de administrar medicamentos. En caso de emergencia, llame al 9-1-1.

Al continuar, usted reconoce que:

1. Los cálculos de dosis se basan en el peso y la edad ingresados por usted, y en literatura pediátrica estándar (Vademécum, PROMESE/CAL). Pueden no aplicar a todos los casos clínicos.

2. Las alertas de contraindicación son orientativas. No reemplazan el criterio del pediatra, ni cubren todas las interacciones medicamentosas, alergias o condiciones médicas posibles.

3. Keriva, KRV Dominicana SRL y sus empleados no se responsabilizan por el uso indebido o por la administración de medicamentos sin supervisión médica.

4. En caso de duda, suspenda la administración y consulte al pediatra de inmediato. En caso de emergencia (dificultad respiratoria, reacción alérgica, alteración del estado de conciencia, fiebre persistente), llame al 9-1-1 o acuda al centro asistencial más cercano.

5. Su aceptación queda registrada con fecha, dispositivo e IP para cumplimiento de la Ley 172-13 de Protección de Datos Personales de la República Dominicana.

Versión kids_v1.0 · Keriva / KRV Dominicana SRL · Abril 2026`;

export const DISCLAIMER_CARE_TEXT = `AVISO DE USO — KERIVA CARE

Keriva Care le ayuda a recordar la toma de sus medicamentos crónicos. NO sustituye la consulta médica ni la orientación de su farmacéutico.

Al activar Keriva Care, usted acepta que:

1. Los recordatorios son una ayuda informativa. La responsabilidad de la toma del medicamento es siempre del paciente o su cuidador.

2. Los rangos de precio que muestra Keriva son estimaciones (±5%). Para conocer el precio exacto, cotice por WhatsApp con la farmacia.

3. Sus datos personales se procesan conforme a la Ley 172-13. Puede revocar el consentimiento en cualquier momento desde "Mi Privacidad".

Versión care_v1.0 · Keriva / KRV Dominicana SRL · Abril 2026`;

// =====================================================================
// API
// =====================================================================

/**
 * Verifica si el perfil tiene un disclaimer activo de la versión actual.
 * Si ya aceptó la versión vigente, no se muestra el modal.
 */
export async function hasActiveDisclaimer(
  perfilId: string,
  tipo: TipoDisclaimer,
): Promise<boolean> {
  const version = DISCLAIMER_VERSIONS[tipo];
  try {
    const data = await restGet<any[]>(
      `perfil_disclaimer_log?select=id` +
        `&perfil_id=eq.${perfilId}` +
        `&tipo_disclaimer=eq.${tipo}` +
        `&version_disclaimer=eq.${encodeURIComponent(version)}` +
        `&activo=eq.true&limit=1`,
    );
    return Array.isArray(data) && data.length > 0;
  } catch (e) {
    console.warn('hasActiveDisclaimer error', e);
    return false;
  }
}

/**
 * Registra la aceptación del disclaimer vía RPC `registrar_disclaimer`
 * (SECURITY DEFINER). Devuelve el id del log creado o un error legible.
 */
export async function aceptarDisclaimer(
  perfilId: string,
  tipo: TipoDisclaimer,
): Promise<{ ok: boolean; logId?: string; error?: string }> {
  const version = DISCLAIMER_VERSIONS[tipo];
  const texto =
    tipo === 'pediatrico' ? DISCLAIMER_KIDS_TEXT : DISCLAIMER_CARE_TEXT;

  // Device fingerprint mínimo (Platform.OS + Platform.Version)
  const fingerprint = `${Platform.OS}-${Platform.Version ?? 'n/a'}`;

  try {
    const data = await restRpc('registrar_disclaimer', {
      p_perfil_id: perfilId,
      p_tipo_disclaimer: tipo,
      p_version: version,
      p_texto: texto,
      p_ip: null,
      p_device_fingerprint: fingerprint,
    });
    return { ok: true, logId: data as unknown as string };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? 'No se pudo registrar' };
  }
}
