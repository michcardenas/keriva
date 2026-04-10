-- Enable public read access on catalog tables.
-- These tables contain reference data that the app needs to read anonymously:
--   - Farmacias: pharmacy directory
--   - Medicamentos: curated medication catalog
--   - Precios: reported prices (public feed)
--   - digemaps_catalogo: official regulatory catalog
--   - "principios activos": active ingredients
--   - keriva_fabricantes: manufacturers
--
-- Write access on Precios and Puntos is intentionally NOT enabled here.
-- It will be added in the auth sprint once users can be authenticated.

-- Farmacias
drop policy if exists "Farmacias readable by anyone" on "Farmacias";
create policy "Farmacias readable by anyone"
  on "Farmacias"
  for select
  to anon, authenticated
  using (true);

-- Medicamentos
drop policy if exists "Medicamentos readable by anyone" on "Medicamentos";
create policy "Medicamentos readable by anyone"
  on "Medicamentos"
  for select
  to anon, authenticated
  using (true);

-- Precios (read-only for now, insert will be restricted to authenticated users later)
drop policy if exists "Precios readable by anyone" on "Precios";
create policy "Precios readable by anyone"
  on "Precios"
  for select
  to anon, authenticated
  using (true);

-- digemaps_catalogo
drop policy if exists "digemaps_catalogo readable by anyone" on digemaps_catalogo;
create policy "digemaps_catalogo readable by anyone"
  on digemaps_catalogo
  for select
  to anon, authenticated
  using (true);

-- principios activos (note: table name has a space, must be quoted)
drop policy if exists "principios activos readable by anyone" on "principios activos";
create policy "principios activos readable by anyone"
  on "principios activos"
  for select
  to anon, authenticated
  using (true);

-- keriva_fabricantes
drop policy if exists "keriva_fabricantes readable by anyone" on keriva_fabricantes;
create policy "keriva_fabricantes readable by anyone"
  on keriva_fabricantes
  for select
  to anon, authenticated
  using (true);
