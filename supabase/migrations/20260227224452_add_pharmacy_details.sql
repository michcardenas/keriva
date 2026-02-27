/*
  # Add Pharmacy Details Columns

  1. Changes
    - Add `phone` column for pharmacy contact number
    - Add `hours` column for pharmacy operating hours
    - Add `active` column to filter active pharmacies
  
  2. Notes
    - Uses IF NOT EXISTS pattern to safely add columns
    - Sets default values for existing rows
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pharmacies' AND column_name = 'phone'
  ) THEN
    ALTER TABLE pharmacies ADD COLUMN phone text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pharmacies' AND column_name = 'hours'
  ) THEN
    ALTER TABLE pharmacies ADD COLUMN hours text DEFAULT 'Lun-Vie: 8:00 AM - 8:00 PM';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pharmacies' AND column_name = 'active'
  ) THEN
    ALTER TABLE pharmacies ADD COLUMN active boolean DEFAULT true;
  END IF;
END $$;