-- =====================================================================
-- FASE 3 (contrato) — Siembra de datos de comercio
-- =====================================================================
-- Llena las tablas del adendum v2.1 que estaban vacías para que las
-- funciones comerciales se vean en la app:
--   · productos        → SKUs que MATCHEAN por nombre con "Medicamentos"
--                        (Metformina, Losartán, ...) para que detail.tsx
--                        encuentre el producto vía findProductoByMedicamentoName.
--   · precios_base     → precio de referencia DOP por SKU (input del rango ±5%).
--   · farmacia_whatsapp→ 8 farmacias reales (geolocalizadas) afiliadas con
--                        número WhatsApp + horario + descuento estándar.
--   · sponsored_pins   → 2 pines patrocinados (Pfizer/Lipitor, Merck/Glucophage).
--
-- Idempotente: se puede correr varias veces sin duplicar (guards NOT EXISTS).
-- Las categorías y laboratorios ya vienen sembrados por catalog_base.
-- =====================================================================

-- =====================================================================
-- 1. PRODUCTOS (SKU comercial) — nombre_comercial = nombre del Medicamento
-- =====================================================================
insert into public.productos
  (nombre_comercial, sku, principio_activo, presentacion, categoria_id, laboratorio_id, activo)
select
  v.nombre, v.sku, v.pa, v.pres,
  (select id from public.categorias_terapeuticas where slug = v.cat),
  (select id from public.laboratorios            where slug = v.lab),
  true
from (values
  ('Metformina',    'KRV-METFORMINA',    'Metformina clorhidrato', 'Tabletas 500 mg x 30',  'diabetes',         'rowe'),
  ('Losartán',      'KRV-LOSARTAN',      'Losartán potásico',      'Tabletas 50 mg x 30',   'presion-arterial', 'magnachem'),
  ('Atorvastatina', 'KRV-ATORVASTATINA', 'Atorvastatina cálcica',  'Tabletas 20 mg x 30',   'colesterol',       'orbe'),
  ('Amoxicilina',   'KRV-AMOXICILINA',   'Amoxicilina trihidrato', 'Cápsulas 500 mg x 21',  'antibiotico',      'rowe'),
  ('Omeprazol',     'KRV-OMEPRAZOL',     'Omeprazol',              'Cápsulas 20 mg x 28',   'gastro',           'magnachem'),
  ('Amlodipino',    'KRV-AMLODIPINO',    'Amlodipino besilato',    'Tabletas 5 mg x 30',    'presion-arterial', 'orbe'),
  ('Levotiroxina',  'KRV-LEVOTIROXINA',  'Levotiroxina sódica',    'Tabletas 50 mcg x 50',  'tiroides',         'letamar'),
  ('Ibuprofeno',    'KRV-IBUPROFENO',    'Ibuprofeno',             'Tabletas 400 mg x 20',  'antiinflamatorio', 'rowe'),
  ('Paracetamol',   'KRV-PARACETAMOL',   'Acetaminofén',           'Tabletas 500 mg x 20',  'analgesico',       'rowe'),
  ('Enalapril',     'KRV-ENALAPRIL',     'Enalapril maleato',      'Tabletas 10 mg x 30',   'presion-arterial', 'magnachem'),
  -- Marcas premium (para pines patrocinados)
  ('Lipitor',       'KRV-LIPITOR',       'Atorvastatina cálcica',  'Tabletas 20 mg x 30',   'colesterol',       'pfizer'),
  ('Glucophage',    'KRV-GLUCOPHAGE',    'Metformina clorhidrato', 'Tabletas 850 mg x 30',  'diabetes',         'merck')
) as v(nombre, sku, pa, pres, cat, lab)
where not exists (select 1 from public.productos p where p.sku = v.sku);

-- =====================================================================
-- 2. PRECIOS BASE (precio de referencia DOP por SKU)
-- =====================================================================
insert into public.precios_base (sku_id, precio_base, moneda, fuente, notas)
select p.id, v.precio, 'DOP', 'contract', 'Seed Fase 3'
from (values
  ('KRV-METFORMINA',    120.00),
  ('KRV-LOSARTAN',      250.00),
  ('KRV-ATORVASTATINA', 450.00),
  ('KRV-AMOXICILINA',   180.00),
  ('KRV-OMEPRAZOL',     220.00),
  ('KRV-AMLODIPINO',    160.00),
  ('KRV-LEVOTIROXINA',  280.00),
  ('KRV-IBUPROFENO',     90.00),
  ('KRV-PARACETAMOL',    60.00),
  ('KRV-ENALAPRIL',     140.00),
  ('KRV-LIPITOR',       950.00),
  ('KRV-GLUCOPHAGE',    380.00)
) as v(sku, precio)
join public.productos p on p.sku = v.sku
where not exists (
  select 1 from public.precios_base pb
  where pb.sku_id = p.id and pb.vigente_hasta is null
);

-- =====================================================================
-- 3. FARMACIA_WHATSAPP — afiliar 8 farmacias reales (geolocalizadas)
-- =====================================================================
-- horario NULL = abierta 24h (farmacia_abierta_ahora devuelve true).
insert into public.farmacia_whatsapp
  (farmacia_id, numero_whatsapp, horario_apertura, horario_cierre,
   dias_operacion, descuento_estandar, afiliada, fecha_afiliacion, contrato_ref)
select
  v.fid, v.num,
  v.ap::time, v.ci::time,
  '{1,2,3,4,5,6,7}'::smallint[],
  v.descuento, true, current_date, 'Seed Fase 3'
from (values
  (1,  '+18092411001', '08:00', '22:00', 15.0),  -- Farmacia GBC Ens. Libertad
  (2,  '+18092411002', '08:00', '22:00', 15.0),  -- Farmacia GBC Circunvalación
  (4,  '+18092422004', '07:00', '23:00', 12.0),  -- FarmaValue La Zurza
  (5,  '+18092422005', '07:00', '23:00', 12.0),  -- FarmaValue La Argentina
  (8,  '+18092433008', '08:00', '21:00', 10.0),  -- Farmacia San Luis Centro
  (10, '+18092444010',  NULL,    NULL,   18.0),  -- Farma Extra Villa Olga (24h)
  (11, '+18092444011', '08:00', '22:00', 18.0),  -- Farma Extra Ensanche Cibao
  (12, '+18092444012',  NULL,    NULL,   18.0)   -- Farma Extra Autopista Duarte (24h)
) as v(fid, num, ap, ci, descuento)
where exists (select 1 from public."Farmacias" f where f.id = v.fid)
  and not exists (select 1 from public.farmacia_whatsapp fw where fw.farmacia_id = v.fid);

-- =====================================================================
-- 4. SPONSORED PINS — 2 pines patrocinados vigentes 1 año
-- =====================================================================
insert into public.sponsored_pins
  (laboratorio_id, sku_id, categoria_id, fecha_inicio, fecha_fin, prioridad, activo, contrato_ref)
select
  (select id from public.laboratorios            where slug = v.lab),
  (select id from public.productos               where sku  = v.sku),
  (select id from public.categorias_terapeuticas where slug = v.cat),
  now(), now() + interval '365 days', 1, true, 'Seed Fase 3'
from (values
  ('pfizer', 'KRV-LIPITOR',    'colesterol'),
  ('merck',  'KRV-GLUCOPHAGE', 'diabetes')
) as v(lab, sku, cat)
where not exists (
  select 1 from public.sponsored_pins sp
  join public.productos p on p.id = sp.sku_id
  where p.sku = v.sku and sp.activo = true
);

-- =====================================================================
-- 5. Verificación rápida (opcional — devuelve conteos tras la siembra)
-- =====================================================================
-- select 'productos' t, count(*) from public.productos where sku like 'KRV-%'
-- union all select 'precios_base', count(*) from public.precios_base
-- union all select 'farmacia_whatsapp', count(*) from public.farmacia_whatsapp where afiliada
-- union all select 'sponsored_pins', count(*) from public.sponsored_pins where activo;
