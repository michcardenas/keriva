-- =====================================================================
-- SEED DE PRUEBA — Keriva Kids (Semana 2)
-- =====================================================================
-- Datos mínimos para poder probar la calculadora pediátrica end-to-end.
-- Las dosis citan literatura estándar (uso interno de Keriva — no es
-- prescripción). El equipo de Keriva debe REEMPLAZAR este seed con los
-- datos oficiales (PROMESE/CAL + Vademécum) antes de producción.
--
-- Pasos:
--   1. Inserta o reusa una categoría 'pediatrico'
--   2. Inserta 3 productos de muestra (acetaminofén, ibuprofeno, amoxicilina)
--   3. Inserta dosis y restricciones por edad
--
-- Idempotente: usa on conflict / where not exists.
-- =====================================================================

-- 1) Categoría
insert into public.categorias_terapeuticas (slug, nombre, icono, color, orden, restricted, activo)
  values ('pediatrico', 'Pediátrico', 'Baby', '#FFB74D', 50, false, true)
  on conflict (slug) do nothing;

-- 2) Productos de muestra
do $$
declare
  v_cat_id uuid;
  v_p1 uuid; v_p2 uuid; v_p3 uuid;
begin
  select id into v_cat_id from public.categorias_terapeuticas where slug = 'pediatrico';

  -- Acetaminofén jarabe 160 mg/5 ml
  insert into public.productos (nombre_comercial, principio_activo, presentacion, categoria_id, activo)
  values ('Tylenol Pediátrico Jarabe', 'Acetaminofén',
          'Jarabe 160 mg/5 ml — frasco 120 ml', v_cat_id, true)
  returning id into v_p1;

  -- Ibuprofeno suspensión 100 mg/5 ml
  insert into public.productos (nombre_comercial, principio_activo, presentacion, categoria_id, activo)
  values ('Advil Niños Suspensión', 'Ibuprofeno',
          'Suspensión 100 mg/5 ml — frasco 120 ml', v_cat_id, true)
  returning id into v_p2;

  -- Amoxicilina 250 mg/5 ml
  insert into public.productos (nombre_comercial, principio_activo, presentacion, categoria_id, activo)
  values ('Amoxicilina Genérica Suspensión', 'Amoxicilina',
          'Suspensión 250 mg/5 ml — frasco 60 ml', v_cat_id, true)
  returning id into v_p3;

  -- 3) Dosis pediátricas (idempotente vía unique sku)
  insert into public.dosis_pediatricas
    (sku_id, dosis_mg_por_kg, dosis_max_mg, frecuencia_horas, via_administracion, notas, fuente)
  values
    (v_p1, 12.5, 750, 6, 'oral',
     'No exceder 5 dosis en 24 horas. No usar más de 5 días sin consultar al pediatra.',
     'Vademécum Pediátrico'),
    (v_p2, 7.5, 400, 8, 'oral',
     'Administrar con alimentos. No usar en menores de 6 meses.',
     'Vademécum Pediátrico'),
    (v_p3, 30, 1000, 8, 'oral',
     'Antibiótico — completar la pauta indicada por el médico aunque mejoren los síntomas.',
     'PROMESE/CAL')
  on conflict (sku_id) do nothing;

  -- 4) Restricciones por edad
  insert into public.restricciones_pediatricas
    (sku_id, edad_minima_meses, edad_maxima_meses, contraindicado, advertencia, fuente)
  values
    (v_p1, 3, null, false,
     'En menores de 3 meses, consulte siempre al pediatra antes de administrar.',
     'Vademécum Pediátrico'),
    (v_p2, 6, null, false,
     'CONTRAINDICADO en menores de 6 meses. Riesgo renal en deshidratación.',
     'Vademécum Pediátrico'),
    (v_p3, 1, null, false,
     'Verifique alergias a penicilinas antes de administrar.',
     'PROMESE/CAL');
exception when unique_violation then
  -- Si ya existen los productos (re-ejecución), salta silenciosamente.
  null;
end;
$$;
