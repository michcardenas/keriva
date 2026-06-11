-- =====================================================================
-- SEED de prueba — enriquece el catálogo `productos` (NO es migración formal)
-- Corre esto en el SQL Editor para tener productos que buscar en el
-- inventario y la carga masiva. Idempotente (no duplica por nombre+conc).
-- =====================================================================

insert into public.productos (nombre_comercial, principio_activo, concentracion, presentacion, categoria_id, activo)
select v.nombre, v.pa, v.conc, v.pres, c.id, true
from (values
  ('Acetaminofén',   'Acetaminofén',   '500 mg',  'Tabletas x 30',      'analgesico'),
  ('Ibuprofeno',     'Ibuprofeno',     '400 mg',  'Tabletas x 20',      'antiinflamatorio'),
  ('Amoxicilina',    'Amoxicilina',    '500 mg',  'Cápsulas x 21',      'antibiotico'),
  ('Metformina',     'Metformina',     '850 mg',  'Tabletas x 30',      'diabetes'),
  ('Losartán',       'Losartán',       '50 mg',   'Tabletas x 30',      'presion-arterial'),
  ('Atorvastatina',  'Atorvastatina',  '20 mg',   'Tabletas x 30',      'colesterol'),
  ('Omeprazol',      'Omeprazol',      '20 mg',   'Cápsulas x 14',      'gastro'),
  ('Loratadina',     'Loratadina',     '10 mg',   'Tabletas x 10',      'alergico'),
  ('Aspirina',       'Ácido acetilsalicílico', '100 mg', 'Tabletas x 30', 'anticoagulante'),
  ('Enalapril',      'Enalapril',      '10 mg',   'Tabletas x 30',      'presion-arterial'),
  ('Azitromicina',   'Azitromicina',   '500 mg',  'Tabletas x 3',       'antibiotico'),
  ('Diclofenaco',    'Diclofenaco',    '50 mg',   'Tabletas x 20',      'antiinflamatorio'),
  ('Ciprofloxacino', 'Ciprofloxacino', '500 mg',  'Tabletas x 10',      'antibiotico'),
  ('Salbutamol',     'Salbutamol',     '100 mcg', 'Inhalador 200 dosis','respiratorio'),
  ('Levotiroxina',   'Levotiroxina',   '50 mcg',  'Tabletas x 50',      'tiroides'),
  ('Glibenclamida',  'Glibenclamida',  '5 mg',    'Tabletas x 30',      'diabetes'),
  ('Naproxeno',      'Naproxeno',      '550 mg',  'Tabletas x 20',      'antiinflamatorio'),
  ('Ranitidina',     'Ranitidina',     '150 mg',  'Tabletas x 20',      'gastro'),
  ('Furosemida',     'Furosemida',     '40 mg',   'Tabletas x 30',      'diuretico'),
  ('Vitamina C',     'Ácido ascórbico','500 mg',  'Tabletas x 30',      'vitaminas')
) as v(nombre, pa, conc, pres, cat)
left join public.categorias_terapeuticas c on c.slug = v.cat
where not exists (
  select 1 from public.productos p
  where lower(p.nombre_comercial) = lower(v.nombre)
    and coalesce(p.concentracion, '') = v.conc
);
