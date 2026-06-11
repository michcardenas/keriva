# Estado del proyecto Keriva — Handoff de sesión

> Última actualización: 2026-06-11. Documento para retomar el trabajo sin perder el hilo.

---

## 🔑 RETOMAR — palabra clave: **"KERIVA RESCOPE"**
Al decir **"KERIVA RESCOPE"** (o "retomemos Keriva") en una nueva sesión, leer este bloque + las memorias.

### Estado a 2026-06-11 — Plan completo de la app móvil CERRADO

El cliente envió la documentación completa (`Keriva_Brief_Tecnico_Fase1_v1`, `Anexo_Tecnico_Roles_ACTUALIZADO`, `Plan_Trabajo_Farmacia`, `Fases_Alcance_Requerimientos`, `Mejoras_20.05`, `Llaves_Configuracion_Michael`). Esta sesión cerró TODO lo que figuraba como pendiente para la app móvil. Sólo quedan tareas que necesitan al cliente (llaves OneSignal, acceso DNS/Play Store) o son fuera de scope (Fase 6 IA, Admin web, deploy beta).

**Sprints completados esta jornada:**
- **Sprint 0 — Plataforma** ✅ Sentry (Ley 172-13: PII redactada en message/extra/stacktrace, user.id solo con consentimiento) · PostHog cliente ligero (5 eventos: search_med, pharmacy_view, reserve_created, reserve_confirmed, signup_completed) · Google Maps verificado en config estática.
- **Sprint 1 — Cerrar Rol Farmacia** ✅ Perfil farmacia con stats (sucursales/pendientes/ventas) · CTA "Crear cuenta como Farmacia" en login · E2E verificado con `farmacia@keriva.do`.
- **Sprint 2 — Rol Usuario crítico** ✅ Consentimiento Ley 172-13 (modal + RPC `aceptar_consentimiento_172_13`) · Buscar por principio activo (RPC `buscar_medicamentos`) · Cercanía 2km en mapa (RPC PostGIS `farmacias_cercanas`) · GPS denegado → dirección manual (Google Geocoding) · Ampliar radio 5/10km · Botón llamar `tel:`.
- **Sprint 3 — Rol Usuario complementario** ✅ "Abierta ahora" (jsonb horarios por sucursal + editor + helper isOpenNow America/Santo_Domingo + filtro+badge en detail.tsx) · Captura demanda insatisfecha (logBusquedaSinResultado en index.tsx + logSinDisponibilidad en detail.tsx + vista `v_demanda_insatisfecha` para admin web).
- **Cleanup Admin** ✅ Borrado de UI admin de la app móvil (moderation.tsx eliminado, branches `rol === 'admin'` en profile/PriceRangeCard removidos, tab Moderation fuera del layout). El rol 'admin' SIGUE existiendo en BD (RLS) y se gestionará desde panel web aparte.
- **Bloque 0 — Bugs críticos** ✅ B02 DateTimePicker (DateField + DateField.web ya estaban, MIN_BIRTH_DATE=1900) · B03 Cambio idioma efectivo (LanguageContext con useMemo + state + AsyncStorage).
- **Bloque 1 — Login al 100%** ✅ Selector tipo cuenta dentro de register (Usuario→form actual, Farmacia→`/registro-farmacia`) · Bloqueo acceso si `Farmacias.activa=false` con pantalla "Cuenta en revisión" + logout.
- **Bloque 2 — UX Usuario en mapa** ✅ Toggle "Con inventario" en header del bottom sheet, filtra pins+lista a las farmacias_osm vinculadas a una cuenta con producto disponible (`getFarmaciaIdsConInventario` join `inventario_sucursal` → sucursales).
- **Bloque 3 — Cuentas internas farmacia** ✅ Tabla `cuentas_sucursal` + RPC `invitar_encargado_sucursal` + UI `app/farmacia/encargados.tsx`. La RPC NO toca rol/farmacia_id (existe trigger DB que solo deja a admin cambiar roles). El gating "encargado solo ve su sucursal" queda como deuda separada (~1-2 días).
- **Bloque 4 — Tema oscuro/claro** ✅ `lib/ThemeContext.tsx` con persistencia AsyncStorage + toggle en perfil + StatusBar dinámico. El refactor visual completo de cada componente queda como deuda separada (~2-3 días).

**Migraciones que el cliente CORRIÓ esta sesión:**
- `20260609001900_farmacia_cuenta.sql` (mi_farmacia + actualizar_cuenta_farmacia)
- `20260609000300_resenas_farmacias.sql` (Keriva Reviews)
- `20260611000000_consentimiento_172_13.sql` (Ley 172-13)
- RPC PostGIS `farmacias_cercanas` (radio 2km)
- `sucursales.horarios jsonb` + función `sucursal_abierta_a`
- `eventos`: enum extendido (`busqueda_sin_resultado`, `sin_disponibilidad`) + columna `metadata jsonb` + vista `v_demanda_insatisfecha`
- `cuentas_sucursal` + RPC `invitar_encargado_sucursal`

⚠️ **Pendiente del cliente** que las migraciones ad-hoc (`_RUN_*.sql`) las consolidemos como migraciones versionadas formales antes del próximo despliegue (deuda técnica).

### Pendientes que SÍ requieren al cliente (no se pueden hacer sin)

**🟥 Llaves para activar features:**
- OneSignal App ID + REST API Key + FCM Server Key → activa notificaciones push (Bloque 5 del plan, ~4h)
- Catálogo de productos real o autorización DIGEMAPS → para beta con datos creíbles
- Lista final de farmacias afiliadas con tels/horarios/lat-lng

**🟧 Accesos para deploy:**
- Panel DNS de `keriva.app` → para Vercel/Netlify
- Google Play Console (editor) → APK preview
- Apple Developer (si va iOS)

**🟨 Decisiones de scope (sesiones separadas):**
- Fase 6 Agente IA Anthropic → necesita 1 reunión scoping (alcance, disclaimers Ley 172-13 RD, modelo de cobro)
- Admin web (proyecto aparte) → stack + alcance + auth
- ¿Tema oscuro completo entra ahora o en otra fase?

### Lo que sigue para mí (sin tocar al cliente)
- **Bloque 6 — QA + Documentación** (~4-5h): plan de pruebas E2E con 3 cuentas, README actualizado, diagrama tablas/RLS, guía de despliegue (env vars, EAS, rollback).
- Consolidar migraciones `_RUN_*.sql` en archivos versionados.
- Resolver deudas: gating encargado, refactor visual dark mode.

**Cuentas de prueba:** admin@keriva.do/KerivaAdmin2026! · farmacia@keriva.do/KerivaFarmacia2026! · usuario@keriva.do/KerivaUsuario2026!

**Datos de prueba:** sucursal principal de la farmacia con Metformina (RD$99.50) en inventario; sucursal `5550370d` vinculada a Farmacia Santa Lucía OSM (vínculo creado para smoke del toggle "Con inventario"); horarios 24/7 seteados en la sucursal de inventario; reservas de prueba; eventos de demanda insatisfecha sembrados (rivaroxaban x4, ozempic x3, Metformina sin disp x2, dapagliflozina x1).

---

## 1. Qué es Keriva
App de farmacias para República Dominicana (Santiago). Expo / React Native 0.81 + Expo Router + Supabase.
3 roles: **usuario**, **farmacia**, **admin**. Multi-idioma (20 idiomas vía `lib/translations.ts`).
- App: `C:\Users\DELL\keriva` (carpetas `app/`, `lib/`, `components/`, `supabase/`).
- Contrato firmado: 8 fases, $1,335, hitos 30/30/40. Fase 6 = Agente IA con Anthropic (contractual).

## 2. Cómo correr el preview (flujo verificado)
NO usamos Expo Go ni EAS de pago. Probamos por **web export servido en LAN**:
```bash
cd /c/Users/DELL/keriva
rm -f app.config.js              # ⚠️ si existe, rompe el export (PluginError @rnmapbox)
npx expo export --platform web   # genera dist/
node scripts/static-preview.js   # server node puerto 8082, headers no-cache
```
- URL en el celular (misma red): **http://192.168.1.14:8082/** (usar `?v=N` o incógnito para evitar caché).
- Typecheck: `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json`
- Verificación visual: MCP preview "keriva-static" (preview_eval / preview_screenshot).

## 3. Cuentas de prueba
- **admin**: dado por el cliente.
- **cliente** y **farmacia**: creados (patrón de password `Keriva<Rol>2026!`).

## 4. Lo COMPLETADO recientemente (esta tanda)
### Mapa (#1, #2, #3) — `app/(tabs)/map.tsx`
- **Búsqueda de medicamento DENTRO del mapa**: buscador flotante arriba con autocompletar → pines de precio sobre las farmacias que lo venden + lista ordenada barato→caro + badge MEJOR.
- **Botones de ruta con marca**: "Cómo llegar" → "¿Cómo prefieres llegar?" → Google Maps (azul) / Waze (cian) con animación.
- **Ruta directa desde el detalle**: al entrar a un medicamento y tocar "Ver en el mapa", abre la tarjeta de esa farmacia con el selector de ruta YA desplegado (sin pasos extra). Params: `focusNav=1`, `focusName/Addr/Med/Price`.

### Comercio (#20, #7)
- **Seed aplicado** (el usuario corrió `supabase/migrations/20260609000200_seed_comercio_fase3.sql` en el SQL Editor): 12 productos, 12 precios_base, 8 farmacias afiliadas (WhatsApp + descuento), 2 sponsored_pins.
- **Detalle de medicamento** ahora muestra farmacias afiliadas con rango de precio, descuento, distancia, botón "Reservar por WhatsApp" y auditoría ✅/❌.
- **Pin Patrocinado** (#7): nueva API `lib/api/sponsored.ts` + tarjeta "PATROCINADO" como resultado #1 al filtrar por categoría en el Home (Diabetes→Glucophage, Colesterol→Lipitor).

### Keriva Reviews (#4) — calificación de farmacias ⭐
- **Tabla `resenas`** (FK a `farmacias_osm.id` uuid — la fuente del mapa, NO la legacy `Farmacias`). 1 reseña/usuario/farmacia (unique → editar = upsert). Nombre/avatar del autor denormalizados (la RLS de `perfiles` solo deja leer el perfil propio). Vista `v_farmacia_ratings` (promedio+total+distribución). Migración: `supabase/migrations/20260609000300_resenas_farmacias.sql`.
- **`lib/api/reviews.ts`**: getRatingsForPharmacies (batch para el mapa), getFarmaciaRating, getReviews, getMyReview, getMyReviews, upsertReview, deleteReview. Degradan a vacío si la migración aún no se aplicó (no crashean).
- **`components/StarRating.tsx`**: estrellas reutilizables, modo display (medias estrellas + conteo) e input interactivo (color `theme.gold`).
- **Pantalla `app/resenas/[farmaciaId].tsx`**: resumen (promedio grande + distribución), formulario escribir/editar/borrar la reseña propia (confirmación inline + toast), lista de reseñas de otros. Registrada en el Stack de `app/_layout.tsx`.
- **Mapa** (`app/(tabs)/map.tsx`): estrellas bajo la dirección en cada `pharmCard`, y fila "Ver reseñas" + promedio en la card de farmacia seleccionada → navega a `/resenas/[id]`.
- ⚠️ **PENDIENTE: el usuario debe correr la migración** `20260609000300_resenas_farmacias.sql` en el SQL Editor de Supabase. Hasta entonces las estrellas no aparecen (datos vacíos) pero la app no rompe. Verificado en preview: la pantalla y el input de estrellas renderizan/funcionan, sin errores de consola, typecheck limpio.

### Profile
- Botón **"+ Nueva contribución"** siempre visible en el historial (lleva a reportar).

### Antes de esto (sesiones previas, ya cerrado)
Bugs de Jenn: rectángulos negros inputs, teclado tapa inputs (header colapsable), buscador responsive, logout→login, rol farmacia "Mi farmacia" informativo, distancia en detalle, mapa interno único, contribuciones ilimitadas farmacia/admin, editar perfil con avatar+dirección+ubicación, traducciones 20 idiomas, imágenes Storage (buckets), moderación.

## 5. PENDIENTE (próximos frentes)
| # | Tarea | Notas |
|---|---|---|
| 4 | ~~Keriva Reviews~~ ✅ HECHO (falta correr la migración en Supabase) | v2: respuestas de farmacia a reseñas, "Mis reseñas" en perfil, reseñas en detail.tsx (afiliadas legacy) |
| 5 | Keriva Wallet | Feature Fase 1 brief |
| 6 | Medallas + Referidos + Points (rehacer según brief) | |
| 8 | PostHog (analítica) | Necesita key de cuenta del cliente |
| 9 | OneSignal push + Edge Function recordatorios | Necesita key |
| 10 | Sentry (DSN + extender captura) | Necesita DSN |
| 15 | Teclado tapa inputs (resto de forms) | Mayormente hecho |
| 16 | Tema oscuro/claro (toggle persistido) | |
| 19 | **FASE 6 contrato: Agente IA Anthropic** | Contractual, esfuerzo alto |
| 21 | QA + prueba de carga + doc rendimiento (Fase 7) | |
| 22 | Deploy keriva.app + beta pública (Fase 8) | |
| 23 | Entregables: README técnico + guía despliegue + entrega IP | |
| 28 | Moderación: foto subida en registro farmacia | Probablemente resuelto con buckets; falta verificar |

## 6. Notas técnicas importantes
- **app.config.js**: si reaparece, BORRARLO antes de exportar (rompe el build de mapbox).
- **Fuentes cargadas** (`app/_layout.tsx`): Poppins-SemiBold/Bold, DMSans-Regular/Medium/Bold. NO existe `DMSans-SemiBold` → usar DMSans-Medium.
- **Gap de geolocalización**: solo 31 Farmacias (todas con coords). La búsqueda de medicamento en el mapa solo pinta farmacias con coordenadas; los `Precios` legados de Paracetamol etc. apuntan a farmacias sin coords → salen 0. Demostrar con **Metformina** (Farmacia GBC, RD$100).
- **Sin service-role key ni Supabase CLI**: los SQL los corre el usuario en el dashboard (SQL Editor). Conexión: proyecto `zclgqjvsvimqaaikabnl`.
- Migración SQL del límite de auditoría exento para farmacia/admin: `20260609000000_audit_limit_exempt_farmacia.sql` (verificar si se aplicó).

## 7. Recomendación para retomar
1. **Correr la migración de reseñas** `20260609000300_resenas_farmacias.sql` en el SQL Editor de Supabase (proyecto `zclgqjvsvimqaaikabnl`) para activar Keriva Reviews end-to-end.
2. Luego seguir con **#16 Tema oscuro/claro** (toggle persistido — ya hay tokens `night*` en theme.ts) o **#19 Agente IA (Fase 6, contractual)**.
