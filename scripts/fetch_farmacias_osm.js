#!/usr/bin/env node
/**
 * fetch_farmacias_osm.js
 *
 * Consulta OpenStreetMap (Overpass API) para traer todas las farmacias
 * georreferenciadas de República Dominicana. Genera 3 archivos:
 *
 *   · farmacias_osm.json  → inspección y debugging
 *   · farmacias_osm.csv   → importable en Supabase Table Editor
 *   · farmacias_osm.sql   → ejecutable en Supabase SQL Editor
 *                           (incluye CREATE TABLE, índices espaciales y RLS)
 *
 * Uso:
 *   node scripts/fetch_farmacias_osm.js
 *
 * Requiere: Node 18+ (fetch nativo). Sin dependencias npm.
 *
 * Parte del Bloque 2 del plan de trabajo del Adendum v2.1.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

// ======================================================================
// Config
// ======================================================================
const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

// Overpass QL: farmacias en República Dominicana (ISO 3166-1 alpha-2 = DO)
// Busca nodes, ways y relations con amenity=pharmacy.
const QUERY = `
[out:json][timeout:60];
area["ISO3166-1"="DO"][admin_level=2]->.searchArea;
(
  node["amenity"="pharmacy"](area.searchArea);
  way["amenity"="pharmacy"](area.searchArea);
  relation["amenity"="pharmacy"](area.searchArea);
);
out center tags;
`.trim();

const OUT_DIR = path.join(__dirname, '..', 'supabase', 'osm');

// ======================================================================
// Utilidades
// ======================================================================

/** Escape SQL string (simple doubling of single quotes). */
function sqlEscape(val) {
  if (val === null || val === undefined) return 'NULL';
  const s = String(val);
  return `'${s.replace(/'/g, "''")}'`;
}

/** Escape CSV field (RFC 4180). */
function csvEscape(val) {
  if (val === null || val === undefined) return '';
  const s = String(val);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** Normaliza teléfono a E.164 si empieza con 809/829/849 (RD). */
function normalizePhone(raw) {
  if (!raw) return null;
  const digits = String(raw).replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) return digits;
  if (/^(809|829|849)\d{7}$/.test(digits)) return `+1${digits}`;
  if (/^1(809|829|849)\d{7}$/.test(digits)) return `+${digits}`;
  return digits ? `+${digits}` : null;
}

/** Lee lat/lon de un elemento (node = direct lat/lon; way/relation = center). */
function extractCoords(el) {
  if (typeof el.lat === 'number' && typeof el.lon === 'number') {
    return { lat: el.lat, lon: el.lon };
  }
  if (el.center && typeof el.center.lat === 'number') {
    return { lat: el.center.lat, lon: el.center.lon };
  }
  return null;
}

/** Construye una dirección string concatenando los tags disponibles. */
function buildAddress(tags) {
  const parts = [];
  if (tags['addr:street']) {
    const street = tags['addr:street'];
    const num = tags['addr:housenumber'];
    parts.push(num ? `${street} ${num}` : street);
  }
  if (tags['addr:suburb'] || tags['addr:neighbourhood']) {
    parts.push(tags['addr:suburb'] || tags['addr:neighbourhood']);
  }
  if (tags['addr:city']) parts.push(tags['addr:city']);
  return parts.length ? parts.join(', ') : null;
}

// ======================================================================
// Main
// ======================================================================

(async () => {
  console.log('🌐 Consultando Overpass API (OpenStreetMap)…');
  console.log('    Esto puede tardar 15-60 segundos.');

  const started = Date.now();

  let response;
  try {
    response = await fetch(OVERPASS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Keriva/1.0 (https://keriva.app; farmacias-osm-import)',
        Accept: 'application/json',
      },
      body: `data=${encodeURIComponent(QUERY)}`,
    });
  } catch (err) {
    console.error('❌ Error de red:', err.message);
    process.exit(1);
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    console.error(`❌ Overpass respondió ${response.status}: ${body.slice(0, 300)}`);
    process.exit(1);
  }

  const data = await response.json();
  const elapsed = ((Date.now() - started) / 1000).toFixed(1);
  console.log(`✅ Respuesta recibida en ${elapsed}s (${data.elements?.length ?? 0} elementos)`);

  // --------------------------------------------------------------------
  // Normalizar
  // --------------------------------------------------------------------
  const farmacias = [];
  for (const el of data.elements ?? []) {
    const coords = extractCoords(el);
    if (!coords) continue;

    const tags = el.tags ?? {};
    const nombre = tags.name ?? tags['name:es'] ?? tags.brand ?? 'Farmacia sin nombre';

    farmacias.push({
      osm_id: `${el.type}/${el.id}`,
      osm_type: el.type,
      nombre: nombre.trim(),
      direccion: buildAddress(tags),
      ciudad: tags['addr:city'] ?? tags['addr:suburb'] ?? tags['addr:neighbourhood'] ?? null,
      telefono: normalizePhone(tags.phone ?? tags['contact:phone']),
      whatsapp: normalizePhone(tags['contact:whatsapp']),
      website: tags.website ?? tags['contact:website'] ?? null,
      horario: tags.opening_hours ?? null,
      marca: tags.brand ?? null,
      latitud: coords.lat,
      longitud: coords.lon,
    });
  }

  // --------------------------------------------------------------------
  // Completitud
  // --------------------------------------------------------------------
  const total = farmacias.length;
  const pct = (n) => (total ? ((n / total) * 100).toFixed(1) : '0.0');
  const conNombre    = farmacias.filter((f) => f.nombre && f.nombre !== 'Farmacia sin nombre').length;
  const conDireccion = farmacias.filter((f) => f.direccion).length;
  const conTelefono  = farmacias.filter((f) => f.telefono).length;
  const conHorario   = farmacias.filter((f) => f.horario).length;
  const conMarca     = farmacias.filter((f) => f.marca).length;

  console.log('');
  console.log('═══════════════════════════════════════════════');
  console.log(`📊 Farmacias encontradas: ${total}`);
  console.log('───────────────────────────────────────────────');
  console.log(`   Nombres válidos:   ${conNombre.toString().padStart(5)} (${pct(conNombre)}%)`);
  console.log(`   Con dirección:     ${conDireccion.toString().padStart(5)} (${pct(conDireccion)}%)`);
  console.log(`   Con teléfono:      ${conTelefono.toString().padStart(5)} (${pct(conTelefono)}%)`);
  console.log(`   Con horario:       ${conHorario.toString().padStart(5)} (${pct(conHorario)}%)`);
  console.log(`   Con marca/cadena:  ${conMarca.toString().padStart(5)} (${pct(conMarca)}%)`);
  console.log('═══════════════════════════════════════════════');

  // --------------------------------------------------------------------
  // Preparar output directory
  // --------------------------------------------------------------------
  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  }

  // --------------------------------------------------------------------
  // 1. JSON
  // --------------------------------------------------------------------
  const jsonPath = path.join(OUT_DIR, 'farmacias_osm.json');
  fs.writeFileSync(jsonPath, JSON.stringify(farmacias, null, 2), 'utf-8');
  console.log(`📝 JSON escrito:  ${jsonPath}`);

  // --------------------------------------------------------------------
  // 2. CSV
  // --------------------------------------------------------------------
  const csvHeaders = [
    'osm_id', 'osm_type', 'nombre', 'direccion', 'ciudad',
    'telefono', 'whatsapp', 'website', 'horario', 'marca',
    'latitud', 'longitud',
  ];
  const csvLines = [csvHeaders.join(',')];
  for (const f of farmacias) {
    csvLines.push(csvHeaders.map((h) => csvEscape(f[h])).join(','));
  }
  const csvPath = path.join(OUT_DIR, 'farmacias_osm.csv');
  fs.writeFileSync(csvPath, csvLines.join('\n'), 'utf-8');
  console.log(`📝 CSV  escrito:  ${csvPath}`);

  // --------------------------------------------------------------------
  // 3. SQL
  // --------------------------------------------------------------------
  const sqlChunks = [];
  sqlChunks.push('-- =====================================================================');
  sqlChunks.push(`-- OSM Farmacias RD — ${total} farmacias · ${new Date().toISOString()}`);
  sqlChunks.push('-- =====================================================================');
  sqlChunks.push('-- Generado por scripts/fetch_farmacias_osm.js');
  sqlChunks.push('-- Parte del Bloque 2 (Adendum v2.1).');
  sqlChunks.push('');
  sqlChunks.push('-- Requiere PostGIS para la columna geography(Point).');
  sqlChunks.push('create extension if not exists postgis;');
  sqlChunks.push('');
  sqlChunks.push('-- Tabla farmacias_osm — dataset OSM independiente de la tabla legacy "Farmacias".');
  sqlChunks.push('create table if not exists public.farmacias_osm (');
  sqlChunks.push('  id           uuid primary key default gen_random_uuid(),');
  sqlChunks.push('  osm_id       text not null unique,');
  sqlChunks.push('  osm_type     text not null,');
  sqlChunks.push('  nombre       text not null,');
  sqlChunks.push('  direccion    text,');
  sqlChunks.push('  ciudad       text,');
  sqlChunks.push('  telefono     text,');
  sqlChunks.push('  whatsapp     text,');
  sqlChunks.push('  website      text,');
  sqlChunks.push('  horario      text,');
  sqlChunks.push('  marca        text,');
  sqlChunks.push('  latitud      numeric(10,7) not null,');
  sqlChunks.push('  longitud     numeric(10,7) not null,');
  sqlChunks.push('  geom         geography(Point,4326),');
  sqlChunks.push('  farmacia_id  bigint references public."Farmacias"(id) on delete set null,');
  sqlChunks.push('  activa       boolean not null default true,');
  sqlChunks.push('  created_at   timestamptz not null default now(),');
  sqlChunks.push('  updated_at   timestamptz not null default now(),');
  sqlChunks.push('  constraint farmacias_osm_lat_valida check (latitud  between -90 and 90),');
  sqlChunks.push('  constraint farmacias_osm_lng_valida check (longitud between -180 and 180)');
  sqlChunks.push(');');
  sqlChunks.push('');
  sqlChunks.push('-- Índices');
  sqlChunks.push('create index if not exists idx_farmacias_osm_activa    on public.farmacias_osm (activa) where activa = true;');
  sqlChunks.push('create index if not exists idx_farmacias_osm_ciudad    on public.farmacias_osm (ciudad);');
  sqlChunks.push('create index if not exists idx_farmacias_osm_geom_gist on public.farmacias_osm using gist (geom);');
  sqlChunks.push('');
  sqlChunks.push('-- Trigger updated_at (reutiliza set_updated_at de migración 20260424000000)');
  sqlChunks.push('drop trigger if exists trg_farmacias_osm_updated on public.farmacias_osm;');
  sqlChunks.push('create trigger trg_farmacias_osm_updated');
  sqlChunks.push('  before update on public.farmacias_osm');
  sqlChunks.push('  for each row execute function public.set_updated_at();');
  sqlChunks.push('');
  sqlChunks.push('-- Trigger para poblar geom automáticamente desde lat/lng');
  sqlChunks.push('create or replace function public.farmacias_osm_set_geom()');
  sqlChunks.push('returns trigger language plpgsql as $$');
  sqlChunks.push('begin');
  sqlChunks.push('  new.geom = ST_SetSRID(ST_MakePoint(new.longitud, new.latitud), 4326)::geography;');
  sqlChunks.push('  return new;');
  sqlChunks.push('end; $$;');
  sqlChunks.push('');
  sqlChunks.push('drop trigger if exists trg_farmacias_osm_geom on public.farmacias_osm;');
  sqlChunks.push('create trigger trg_farmacias_osm_geom');
  sqlChunks.push('  before insert or update of latitud, longitud on public.farmacias_osm');
  sqlChunks.push('  for each row execute function public.farmacias_osm_set_geom();');
  sqlChunks.push('');
  sqlChunks.push('-- RLS: lectura pública, escritura solo admin');
  sqlChunks.push('alter table public.farmacias_osm enable row level security;');
  sqlChunks.push('drop policy if exists "farmacias_osm_read_all" on public.farmacias_osm;');
  sqlChunks.push('create policy "farmacias_osm_read_all" on public.farmacias_osm for select');
  sqlChunks.push('  to anon, authenticated using (activa = true or public.current_rol() = \'admin\');');
  sqlChunks.push('drop policy if exists "farmacias_osm_write_admin" on public.farmacias_osm;');
  sqlChunks.push('create policy "farmacias_osm_write_admin" on public.farmacias_osm for all');
  sqlChunks.push('  to authenticated using (public.current_rol() = \'admin\')');
  sqlChunks.push('  with check (public.current_rol() = \'admin\');');
  sqlChunks.push('');
  sqlChunks.push(`-- ${total} INSERT statements`);
  sqlChunks.push('-- (usa ON CONFLICT (osm_id) DO UPDATE para permitir re-ejecutar el script)');
  sqlChunks.push('');

  // Batch inserts of 500 rows each
  const BATCH_SIZE = 500;
  for (let i = 0; i < farmacias.length; i += BATCH_SIZE) {
    const batch = farmacias.slice(i, i + BATCH_SIZE);
    sqlChunks.push('insert into public.farmacias_osm (osm_id, osm_type, nombre, direccion, ciudad, telefono, whatsapp, website, horario, marca, latitud, longitud) values');
    const values = batch.map((f) => (
      `  (${sqlEscape(f.osm_id)}, ${sqlEscape(f.osm_type)}, ${sqlEscape(f.nombre)}, ${sqlEscape(f.direccion)}, ${sqlEscape(f.ciudad)}, ${sqlEscape(f.telefono)}, ${sqlEscape(f.whatsapp)}, ${sqlEscape(f.website)}, ${sqlEscape(f.horario)}, ${sqlEscape(f.marca)}, ${f.latitud}, ${f.longitud})`
    ));
    sqlChunks.push(values.join(',\n'));
    sqlChunks.push('on conflict (osm_id) do update set');
    sqlChunks.push('  nombre    = excluded.nombre,');
    sqlChunks.push('  direccion = excluded.direccion,');
    sqlChunks.push('  ciudad    = excluded.ciudad,');
    sqlChunks.push('  telefono  = excluded.telefono,');
    sqlChunks.push('  whatsapp  = excluded.whatsapp,');
    sqlChunks.push('  website   = excluded.website,');
    sqlChunks.push('  horario   = excluded.horario,');
    sqlChunks.push('  marca     = excluded.marca,');
    sqlChunks.push('  latitud   = excluded.latitud,');
    sqlChunks.push('  longitud  = excluded.longitud,');
    sqlChunks.push('  updated_at = now();');
    sqlChunks.push('');
  }

  sqlChunks.push('-- Fin del dump.');
  const sqlPath = path.join(OUT_DIR, 'farmacias_osm.sql');
  fs.writeFileSync(sqlPath, sqlChunks.join('\n'), 'utf-8');
  console.log(`📝 SQL  escrito:  ${sqlPath}`);

  console.log('');
  console.log('✅ Listo. Siguiente paso:');
  console.log('   1. Revisa farmacias_osm.json para inspección visual');
  console.log('   2. Ejecuta farmacias_osm.sql en Supabase SQL Editor');
  console.log(`   3. Verifica: select count(*) from public.farmacias_osm;  -- esperado: ${total}`);
})();
