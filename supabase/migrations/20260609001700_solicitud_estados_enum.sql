-- =====================================================================
-- Onboarding farmacia — nuevos estados (Etapa 1) — Tarea #33 (1/2)
-- =====================================================================
-- ⚠️ CORRER ESTE ARCHIVO SOLO, ANTES del 20260609001800.
-- Postgres no permite usar un valor de enum recién agregado dentro de la
-- misma transacción, por eso va separado.
-- =====================================================================

alter type public.estado_solicitud add value if not exists 'en_revision';
alter type public.estado_solicitud add value if not exists 'con_observaciones';
