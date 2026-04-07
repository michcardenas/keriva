/*
  # Arreglar esquema - Agregar columnas faltantes
  
  1. Cambios en `pharmacies`
    - Agregar columna `active` (boolean) - Para farmacias activas/inactivas
    - Agregar columna `hours` (text) - Para horario combinado
  
  2. Notas
    - Se mantienen las columnas existentes
    - Se agregan valores por defecto para datos existentes
*/

-- Agregar columna 'active' a pharmacies si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pharmacies' AND column_name = 'active'
  ) THEN
    ALTER TABLE pharmacies ADD COLUMN active boolean DEFAULT true;
  END IF;
END $$;

-- Agregar columna 'hours' a pharmacies si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pharmacies' AND column_name = 'hours'
  ) THEN
    ALTER TABLE pharmacies ADD COLUMN hours text;
  END IF;
END $$;

-- Actualizar columna 'hours' para farmacias existentes basándose en hours_open y hours_close
UPDATE pharmacies
SET hours = COALESCE(hours_open, '08:00') || ' - ' || COALESCE(hours_close, '20:00')
WHERE hours IS NULL;

-- Asegurar que todas las farmacias estén activas por defecto
UPDATE pharmacies
SET active = true
WHERE active IS NULL;
