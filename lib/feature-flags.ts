/**
 * Feature flags — control de funcionalidades en runtime.
 *
 * Cambiar aquí + rebuild es suficiente para activar/desactivar features.
 * Para producción se podrían leer desde env vars o desde una tabla de
 * `feature_flags` en Supabase, pero por ahora estática.
 */

export const featureFlags = {
  /**
   * Tab "Reportar precio" — flujo legado de Fase 2.
   * Deshabilitado en Fase 1 según adendum v2.1 §3.3:
   * los usuarios ahora auditan con votos ✅/❌ en `<PriceRangeCard>`.
   * El admin sigue pudiendo ver/moderar reportes existentes desde el panel.
   */
  reportTabEnabled: false,

  /**
   * Pin Patrocinado — UI en resultados de búsqueda.
   * Activar cuando Bloque 4 esté implementado y haya pins reales en `sponsored_pins`.
   */
  sponsoredPinUI: false,

  /**
   * Tracking PostHog — Bloque 5.
   * Requiere EXPO_PUBLIC_POSTHOG_KEY configurado.
   */
  posthogEnabled: false,

  /**
   * Modo desarrollo: muestra hints y warnings adicionales en UI.
   */
  devMode: __DEV__,
} as const;
