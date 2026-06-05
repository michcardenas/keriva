-- =====================================================================
-- Seed de datos demo para el Adendum v2.1 (Bloque 3)
-- =====================================================================
-- Crea datos mínimos para probar el flujo de:
--   · Rango estimado (precios_base + descuento)
--   · Botón WhatsApp (farmacia_whatsapp afiliada)
--   · Auditoría comunitaria (price_audits)
--
-- Uso: pegar en Supabase SQL Editor después de aplicar las 5 migraciones
--      del Bloque 1.
--
-- Idempotente: se puede correr múltiples veces sin duplicar datos.
-- =====================================================================

-- =====================================================================
-- 1. Productos demo (5 SKUs populares en RD)
-- =====================================================================
-- Cada producto tiene nombre_comercial único, así que usamos INSERT…
-- SELECT…WHERE NOT EXISTS para idempotencia.
do $$
declare
  lab_pfizer      uuid := (select id from public.laboratorios where slug = 'pfizer');
  lab_bayer       uuid := (select id from public.laboratorios where slug = 'bayer');
  lab_novartis    uuid := (select id from public.laboratorios where slug = 'novartis');
  lab_merck       uuid := (select id from public.laboratorios where slug = 'merck');
  lab_sanofi      uuid := (select id from public.laboratorios where slug = 'sanofi');

  cat_gastro      uuid := (select id from public.categorias_terapeuticas where slug = 'gastro');
  cat_presion     uuid := (select id from public.categorias_terapeuticas where slug = 'presion-arterial');
  cat_analgesico  uuid := (select id from public.categorias_terapeuticas where slug = 'analgesico');
  cat_antibiotico uuid := (select id from public.categorias_terapeuticas where slug = 'antibiotico');
  cat_diabetes    uuid := (select id from public.categorias_terapeuticas where slug = 'diabetes');

  prod_omep       uuid;
  prod_atoro      uuid;
  prod_acet       uuid;
  prod_amox       uuid;
  prod_metf       uuid;
begin
  -- Omeprazol 20mg (Pfizer) — el más vendido en RD 2021 (51M unidades)
  select id into prod_omep from public.productos where nombre_comercial = 'Omeprazol Pfizer 20mg';
  if prod_omep is null then
    insert into public.productos (nombre_comercial, principio_activo, presentacion, laboratorio_id, categoria_id)
    values ('Omeprazol Pfizer 20mg', 'Omeprazol', 'Cápsulas 20mg x 30', lab_pfizer, cat_gastro)
    returning id into prod_omep;
  end if;

  -- Atorvastatina 20mg (Pfizer Lipitor)
  select id into prod_atoro from public.productos where nombre_comercial = 'Lipitor 20mg';
  if prod_atoro is null then
    insert into public.productos (nombre_comercial, principio_activo, presentacion, laboratorio_id, categoria_id)
    values ('Lipitor 20mg', 'Atorvastatina', 'Tabletas 20mg x 30', lab_pfizer, cat_presion)
    returning id into prod_atoro;
  end if;

  -- Acetaminofén / Paracetamol (Bayer)
  select id into prod_acet from public.productos where nombre_comercial = 'Tylenol 500mg';
  if prod_acet is null then
    insert into public.productos (nombre_comercial, principio_activo, presentacion, laboratorio_id, categoria_id)
    values ('Tylenol 500mg', 'Acetaminofén', 'Tabletas 500mg x 30', lab_bayer, cat_analgesico)
    returning id into prod_acet;
  end if;

  -- Amoxicilina 500mg (Novartis)
  select id into prod_amox from public.productos where nombre_comercial = 'Amoxil 500mg';
  if prod_amox is null then
    insert into public.productos (nombre_comercial, principio_activo, presentacion, laboratorio_id, categoria_id)
    values ('Amoxil 500mg', 'Amoxicilina', 'Cápsulas 500mg x 21', lab_novartis, cat_antibiotico)
    returning id into prod_amox;
  end if;

  -- Metformina 850mg (Merck Glucophage)
  select id into prod_metf from public.productos where nombre_comercial = 'Glucophage 850mg';
  if prod_metf is null then
    insert into public.productos (nombre_comercial, principio_activo, presentacion, laboratorio_id, categoria_id)
    values ('Glucophage 850mg', 'Metformina', 'Tabletas 850mg x 60', lab_merck, cat_diabetes)
    returning id into prod_metf;
  end if;

  -- =====================================================================
  -- 2. Precios base (idempotente: no re-inserta si ya hay vigente)
  -- =====================================================================
  if not exists (select 1 from public.precios_base where sku_id = prod_omep and vigente_hasta is null) then
    insert into public.precios_base (sku_id, precio_base, fuente, notas)
    values (prod_omep, 450.00, 'manual', 'Referencia Farmacias Carol feb 2026');
  end if;

  if not exists (select 1 from public.precios_base where sku_id = prod_atoro and vigente_hasta is null) then
    insert into public.precios_base (sku_id, precio_base, fuente, notas)
    values (prod_atoro, 1850.00, 'manual', 'Referencia Farmacias GBC feb 2026');
  end if;

  if not exists (select 1 from public.precios_base where sku_id = prod_acet and vigente_hasta is null) then
    insert into public.precios_base (sku_id, precio_base, fuente, notas)
    values (prod_acet, 240.00, 'manual', 'Referencia PROMESE/CAL feb 2026');
  end if;

  if not exists (select 1 from public.precios_base where sku_id = prod_amox and vigente_hasta is null) then
    insert into public.precios_base (sku_id, precio_base, fuente, notas)
    values (prod_amox, 620.00, 'manual', 'Referencia Farmacias Carol feb 2026');
  end if;

  if not exists (select 1 from public.precios_base where sku_id = prod_metf and vigente_hasta is null) then
    insert into public.precios_base (sku_id, precio_base, fuente, notas)
    values (prod_metf, 1050.00, 'manual', 'Referencia Farmacia Inmaculada feb 2026');
  end if;
end $$;

-- =====================================================================
-- 3. Afiliaciones WhatsApp (3 farmacias demo)
-- =====================================================================
-- Toma las primeras 3 farmacias legacy de "Farmacias" (si existen) y las
-- afilia con descuento demo para probar el botón WhatsApp.
-- =====================================================================
do $$
declare
  f_rec record;
  counter int := 0;
begin
  for f_rec in
    select id from public."Farmacias" where activa = true order by id asc limit 3
  loop
    counter := counter + 1;

    if not exists (select 1 from public.farmacia_whatsapp where farmacia_id = f_rec.id) then
      insert into public.farmacia_whatsapp (
        farmacia_id, numero_whatsapp, horario_apertura, horario_cierre,
        dias_operacion, descuento_estandar, afiliada, fecha_afiliacion, notas
      ) values (
        f_rec.id,
        '+1809555' || lpad((1000 + counter)::text, 4, '0'),     -- teléfono demo
        '08:00'::time,
        '20:00'::time,
        '{1,2,3,4,5,6}'::smallint[],                             -- lun-sáb
        (5 + counter * 3)::numeric(5,2),                         -- 8%, 11%, 14%
        true,
        current_date,
        'Afiliación demo — Bloque 3 seed'
      );
      raise notice 'Afiliada farmacia_id % con descuento %%', f_rec.id, (5 + counter * 3);
    end if;
  end loop;

  if counter = 0 then
    raise notice 'No hay farmacias legacy activas. Afilia farmacias desde el panel admin primero.';
  end if;
end $$;

-- =====================================================================
-- 4. Verificación
-- =====================================================================
select 'productos demo' as tabla, count(*) from public.productos where principio_activo in ('Omeprazol','Atorvastatina','Acetaminofén','Amoxicilina','Metformina')
union all
select 'precios_base vigentes', count(*) from public.precios_base where vigente_hasta is null
union all
select 'farmacia_whatsapp afiliadas', count(*) from public.farmacia_whatsapp where afiliada = true;
