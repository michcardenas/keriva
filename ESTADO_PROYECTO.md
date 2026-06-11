# Estado del proyecto Keriva — Handoff de sesión

> Última actualización: 2026-06-10. Documento para retomar el trabajo sin perder el hilo.

---

## 🔑 RETOMAR — palabra clave: **"KERIVA RESCOPE"**
Al decir **"KERIVA RESCOPE"** (o "retomemos Keriva") en una nueva sesión, leer este bloque + las memorias.

### Estado del re-scope (sesión 2026-06-09/10)
El cliente redefinió la app en 3 roles. **Rol Farmacia = COMPLETO y verificado** con cuentas reales. **Puente Usuario↔Farmacia (reservar) = funcionando end-to-end.**

**Decisiones cerradas (con el usuario):**
- Mercado = **República Dominicana** (NO Colombia — descartado).
- **Sucursales**: N por farmacia, cada una con datos propios. Cuenta única por farmacia.
- **Precio + stock por sucursal**; stock = flag disponible/no.
- **Carga masiva**: destino todas/una sucursal + modo actualizar/reemplazar.
- **Catálogo maestro** = tabla `productos` (enlace obligatorio).
- **Ventas** = vía reserva + confirmación de la farmacia.
- **Búsqueda del usuario** corre sobre **inventario por sucursal** (gating inherente: solo aprobadas).
- **Notificaciones** = 2da etapa (se cobra aparte).

**Migraciones de esta sesión (en `supabase/migrations/`) — el usuario las corre en el SQL Editor:**
- `20260609001000_sucursales.sql` … `20260609001600_eventos.sql` (7 archivos: sucursales, seed principal, productos+concentracion, inventario_sucursal, descuentos, reservas, eventos) — ✅ CORRIDAS.
- `20260609001700_solicitud_estados_enum.sql` + `20260609001800_solicitud_onboarding.sql` (onboarding) — ✅ CORRIDAS.
- `20260609001900_farmacia_cuenta.sql` (perfil de cuenta) — ⬜ **PENDIENTE de correr**.
- `_SEED_productos_prueba.sql` — seed opcional de catálogo de prueba.

**Construido y verificado (Rol Farmacia):** Sucursales (CRUD) · Inventario por sucursal · Carga masiva CSV · Descuentos · Reservas+confirmar venta · Dashboard de ventas · Perfil de cuenta (nombre/logo) · Onboarding (5 estados + observaciones + reenviar + 3 docs RD) · **Tab dedicado "Mi Farmacia"** (Buscar/Mapa ocultos para farmacia, aterriza en su hub).
APIs: `lib/api/{sucursales,inventario,descuentos,reservas,farmacias(getMiFarmacia/actualizarCuenta),solicitudes(reenviar/marcarEnRevision/solicitarObservaciones)}.ts`.
Pantallas: `app/farmacia/{sucursales,inventario,carga-masiva,descuentos,reservas,metricas,cuenta}.tsx` + `app/(tabs)/farmacia.tsx` (hub).

**Construido y verificado (puente Usuario):** en `app/detail.tsx` la sección **"Disponible cerca de ti"** usa `getSucursalesConProducto()` → sucursales con el producto disponible, ordenadas por cercanía, con **Reservar** + Cómo llegar. Loop completo probado: usuario reserva → farmacia confirma → métricas.

**PENDIENTE (pulido Usuario + farmacia):**
- [F] Adaptar el tab Perfil para farmacia (ocultar Mi familia/puntos/stats; mostrar datos de cuenta). ← se estaba haciendo, a medias.
- [U] Buscar por principio activo / categoría + autocompletado.
- [U] "Abierta ahora" (necesita horario estructurado por sucursal).
- [U] Consentimiento de datos de salud (Ley 172-13).
- [U] Captura de leads/eventos (tabla `eventos` ya existe) + demanda insatisfecha.
- [U] #16 orden por cercanía 2km en el MAPA (ya codeado en map.tsx, sin verificar).
- [U] GPS denegado → dirección manual; sin farmacias en 2km → ampliar radio; botón llamar.
- [Login] exponer "Crear cuenta como Farmacia" + selector de tipo.
- 2da etapa: Notificaciones (#45-48) + push OneSignal (requiere llave del cliente).

**Cuentas de prueba:** admin@keriva.do/KerivaAdmin2026! · farmacia@keriva.do/KerivaFarmacia2026! · usuario@keriva.do/KerivaUsuario2026!
**Datos de prueba ya en DB:** sucursal principal de la farmacia con Metformina (RD$99.50) en inventario; reservas de prueba.

**Cliente (reunión):** activar Google Maps key (Maps SDK Android + billing + SHA-1 `B5:D6:16:73:F3:C5:0F:FD:88:E2:03:12:F3:69:18:55:59:95:D9:E5` + paquete `app.keriva.farmacias`). APK preview: perfil EAS `preview`, build con `npm run build:preview` (token EXPO en sesión).

**⚠️ Commit local en rama (sin push — el cliente aún no dio acceso de colaborador al repo).**

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
