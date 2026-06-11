const ExcelJS = require('exceljs');

// ============================================================
// Keriva — Plan de trabajo por roles (Login, Usuario, Farmacia, Admin)
// Estado: ✅ Está · 🟡 Parcial · ❌ Falta · 🆕 Nuevo (re-scope)
// ============================================================

const BRAND = 'FF106B4F';
const HEADER_TXT = 'FFFFFFFF';
const FILLS = {
  '✅ Está': 'FFD5F5E3',
  '🟡 Parcial': 'FFFCF3CF',
  '❌ Falta': 'FFFADBD8',
  '🆕 Nuevo': 'FFD6EAF8',
};
const PRIO = { Alta: 'FFF5B7B1', Media: 'FFFAD7A0', Baja: 'FFD5DBDB' };

const wb = new ExcelJS.Workbook();
wb.creator = 'Keriva';
wb.created = new Date(2026, 5, 9);

const COLS = [
  { header: 'Módulo / Pantalla', key: 'mod', width: 26 },
  { header: 'Funcionalidad', key: 'fn', width: 46 },
  { header: 'Estado', key: 'st', width: 12 },
  { header: 'Detalle / Qué falta o decidir', key: 'dt', width: 58 },
  { header: 'Prioridad', key: 'pr', width: 11 },
  { header: 'Origen', key: 'or', width: 16 },
];

function styleHeader(ws) {
  const row = ws.getRow(1);
  row.height = 22;
  row.eachCell((c) => {
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND } };
    c.font = { bold: true, color: { argb: HEADER_TXT }, size: 11 };
    c.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
    c.border = { bottom: { style: 'thin', color: { argb: 'FF0B4A36' } } };
  });
}

function buildSheet(name, intro, rows) {
  const ws = wb.addWorksheet(name, { views: [{ state: 'frozen', ySplit: intro ? 3 : 1 }] });
  // Solo anchos + keys (sin 'header' para que ExcelJS NO escriba la fila 1).
  ws.columns = COLS.map((c) => ({ key: c.key, width: c.width }));

  let headerRowIdx = 1;
  if (intro) {
    ws.mergeCells(1, 1, 1, COLS.length);
    const c = ws.getCell(1, 1);
    c.value = intro;
    c.font = { italic: true, color: { argb: 'FF555555' }, size: 10 };
    c.alignment = { wrapText: true, vertical: 'middle' };
    ws.getRow(1).height = 30;
    ws.getRow(2).height = 4; // separador
    headerRowIdx = 3;
  }

  // Encabezado manual en la fila correcta.
  const hrow = ws.getRow(headerRowIdx);
  COLS.forEach((col, i) => (hrow.getCell(i + 1).value = col.header));
  hrow.height = 22;
  hrow.eachCell((c) => {
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND } };
    c.font = { bold: true, color: { argb: HEADER_TXT }, size: 11 };
    c.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
  });

  rows.forEach((r) => {
    const row = ws.addRow({ mod: r[0], fn: r[1], st: r[2], dt: r[3], pr: r[4], or: r[5] });
    row.alignment = { vertical: 'top', wrapText: true };
    const stCell = row.getCell('st');
    if (FILLS[r[2]]) stCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: FILLS[r[2]] } };
    stCell.font = { bold: true, size: 10 };
    stCell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    const prCell = row.getCell('pr');
    if (PRIO[r[4]]) prCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PRIO[r[4]] } };
    prCell.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  ws.autoFilter = {
    from: { row: headerRowIdx, column: 1 },
    to: { row: headerRowIdx, column: COLS.length },
  };
  return ws;
}

// ---------- 0. LEYENDA ----------
const wsL = wb.addWorksheet('Leyenda y Resumen');
wsL.columns = [{ width: 22 }, { width: 90 }];
const addL = (a, b, opts = {}) => {
  const r = wsL.addRow([a, b]);
  r.getCell(1).font = { bold: true, color: { argb: opts.c || 'FF111827' } };
  r.getCell(2).alignment = { wrapText: true, vertical: 'top' };
  if (opts.fill) r.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: opts.fill } };
  r.height = opts.h || 18;
  return r;
};
wsL.addRow(['KERIVA — Plan de trabajo por roles']).getCell(1).font = { bold: true, size: 16, color: { argb: BRAND } };
wsL.addRow(['Fecha: 9 de junio de 2026 · Hojas: Login, Usuario, Farmacia, Administrador, Decisiones, Roadmap']);
wsL.addRow([]);
addL('LEYENDA DE ESTADO', '');
addL('✅ Está', 'Ya implementado y funcionando en la app.', { fill: FILLS['✅ Está'], h: 22 });
addL('🟡 Parcial', 'Existe una base, pero falta completarlo o ajustarlo.', { fill: FILLS['🟡 Parcial'], h: 22 });
addL('❌ Falta', 'No existe; hay que construirlo.', { fill: FILLS['❌ Falta'], h: 22 });
addL('🆕 Nuevo', 'Módulo nuevo del re-scope acordado en la reunión con el cliente.', { fill: FILLS['🆕 Nuevo'], h: 22 });
wsL.addRow([]);
addL('ORIGEN', 'Contrato = alcance original firmado · Re-scope = pedido nuevo del cliente · Mejora = valor agregado.');
wsL.addRow([]);
addL('🚩 BANDERA CRÍTICA', 'Los documentos y leyes que mencionó el cliente son COLOMBIANOS (RUT, INVIMA, Cámara de Comercio, Ley 1581 Habeas Data), pero la app está construida para REPÚBLICA DOMINICANA (Santiago, DIGEMAPS, cédula). Hay que CONFIRMAR el mercado objetivo: cambia el catálogo maestro, los documentos de registro y la ley de privacidad.', { c: 'FFB03A2E', h: 70 });
wsL.addRow([]);
addL('RE-SCOPE POR ROL', '');
addL('Usuario', 'Sigue buscando medicamentos, pero la lista de farmacias se ordena por CERCANÍA (radio 2 km), no por precio. El “cómo llegar” se queda del lado del usuario.', { h: 34 });
addL('Farmacia / Aliado', 'Se le quita el mapa y “buscar medicamento”. Se le agregan: métricas, contribución (carga masiva), descuentos, leads y SUCURSALES.', { h: 34 });
addL('Administrador', 'Sale de la app y pasa a WEB: revisar documentos legales, aprobar/rechazar/comentar registros de farmacias. Se deja para después.', { h: 34 });
wsL.addRow([]);
addL('DECISIÓN MADRE', 'SUCURSALES: precio, stock, descuento, cuentas internas, leads y métricas dependen de la sucursal. Definir y diseñar este modelo PRIMERO.', { c: 'FFB03A2E', h: 34 });

// ---------- 1. LOGIN ----------
buildSheet(
  'Login y Acceso',
  'Punto de entrada compartido. El cliente pidió que en el login esté también la opción de “Crear cuenta como Farmacia”.',
  [
    ['Login', 'Iniciar sesión con email y contraseña', '✅ Está', 'Funciona.', 'Alta', 'Contrato'],
    ['Login', 'Opción “Crear cuenta como Usuario”', '✅ Está', 'Registro de usuario existe.', 'Alta', 'Contrato'],
    ['Login', 'Opción “Crear cuenta como Farmacia / Aliado”', '🟡 Parcial', 'Existe el flujo de solicitud de farmacia (registro-farmacia), pero hay que exponerlo claramente como botón/selector desde el login.', 'Alta', 'Re-scope'],
    ['Login', 'Selección de tipo de cuenta al registrarse (Usuario vs Farmacia)', '🟡 Parcial', 'Definir UX: un selector al inicio del registro.', 'Alta', 'Re-scope'],
    ['Login', 'Recuperar / restablecer contraseña', '✅ Está', 'forgot-password + reset-password + verify.', 'Media', 'Contrato'],
    ['Login', 'Verificación de correo', '✅ Está', 'Pantalla verify.', 'Media', 'Contrato'],
    ['Login', 'Selección de idioma (20 idiomas)', '✅ Está', '', 'Baja', 'Contrato'],
    ['Login', 'Entrar como invitado (“probar sin cuenta”)', '✅ Está', 'Revisar qué ve el invitado tras el re-scope (solo búsqueda).', 'Media', 'Contrato'],
    ['Login', 'Cerrar sesión → vuelve a Login', '✅ Está', 'Corregido recientemente.', 'Media', 'Mejora'],
    ['Login', 'Bloqueo por estado de cuenta de farmacia (no aprobada → acceso limitado)', '❌ Falta', 'Depende de los estados de onboarding de farmacia (ver hoja Farmacia).', 'Alta', 'Re-scope'],
  ],
);

// ---------- 2. USUARIO ----------
buildSheet(
  'Rol Usuario',
  'El usuario busca medicamentos y ve farmacias cercanas (2 km), ordenadas por proximidad — no por precio.',
  [
    ['Búsqueda', 'Buscar medicamento por nombre comercial', '✅ Está', 'Con autocompletado.', 'Alta', 'Contrato'],
    ['Búsqueda', 'Buscar por principio activo y por categoría', '🟡 Parcial', 'Depende del catálogo maestro (debe guardar principio activo). Decisión clave #1.', 'Alta', 'Re-scope'],
    ['Resultados', 'Lista de farmacias ordenada por CERCANÍA (radio 2 km)', '🟡 Parcial', 'El RPC farmacias_cercanas (2 km) YA existe. Falta usarlo como orden principal y quitar el orden por precio.', 'Alta', 'Re-scope'],
    ['Resultados', 'Mostrar solo farmacias que SÍ tienen el medicamento (disponibilidad)', '❌ Falta', 'Depende de la decisión de stock por sucursal (decisión #2).', 'Alta', 'Re-scope'],
    ['Resultados', 'Mostrar distancia a cada farmacia', '✅ Está', '', 'Media', 'Contrato'],
    ['Resultados', 'Indicar “Abierta ahora”', '🟡 Parcial', 'El horario hoy es texto libre; para “abierta ahora” se necesita horario estructurado por día.', 'Media', 'Re-scope'],
    ['Resultados', 'Mostrar precio y descuento (informativo)', '✅ Está', 'Para afiliadas. Cada farmacia igual debe fijar precio (ver hoja Farmacia).', 'Media', 'Contrato'],
    ['Casos borde GPS', 'Permiso de ubicación denegado → ingresar dirección manual', '❌ Falta', 'Hoy cae a ubicación aproximada (Santiago). Falta entrada manual.', 'Alta', 'Re-scope'],
    ['Casos borde GPS', 'Sin farmacias en 2 km → ampliar radio / “buscar más lejos”', '🟡 Parcial', 'Existe fallback a 5 km en código; falta el control visible para el usuario y un radio fijo de 2 km dará pantallas vacías.', 'Alta', 'Re-scope'],
    ['Cómo llegar', 'Abrir ruta en Google Maps / Waze', '✅ Está', 'El cliente confirmó que el “cómo llegar” se queda del lado del usuario.', 'Alta', 'Contrato'],
    ['Contacto', 'Contactar farmacia por WhatsApp', '✅ Está', 'Para afiliadas.', 'Media', 'Contrato'],
    ['Contacto', 'Llamar a la farmacia', '🟡 Parcial', 'Hay teléfono; falta botón de llamada directo.', 'Baja', 'Re-scope'],
    ['Contacto', 'Reservar el medicamento', '❌ Falta', 'Decidir si el usuario solo va, contacta o reserva.', 'Media', 'Re-scope'],
    ['Reseñas', 'Calificar farmacia (estrellas) y ver reseñas', '✅ Está', 'Keriva Reviews — implementado.', 'Media', 'Mejora'],
    ['Aportes', 'Reportar precio y ganar puntos', '✅ Está', 'Flujo colaborativo + puntos.', 'Baja', 'Contrato'],
    ['Perfil', 'Editar perfil (foto, dirección, ubicación)', '✅ Está', 'Corregido recientemente (subida de foto).', 'Baja', 'Contrato'],
    ['Perfil', 'Multi-perfil / familia (dependientes, niños)', '✅ Está', '', 'Baja', 'Contrato'],
    ['Privacidad', 'Consentimiento de datos de salud (búsquedas)', '❌ Falta', 'Las búsquedas son datos sensibles. Política de tratamiento desde ya (decisión #3).', 'Alta', 'Re-scope'],
  ],
);

// ---------- 3. FARMACIA ----------
buildSheet(
  'Rol Farmacia (Aliado)',
  'Se le quita el mapa y “buscar medicamento”. Se enfoca en gestión: contribución, descuentos, métricas, leads y sucursales.',
  [
    ['Acceso', 'Quitar mapa y “buscar medicamento” de la vista de farmacia', '🆕 Nuevo', 'Ocultar/eliminar esas secciones para el rol farmacia.', 'Alta', 'Re-scope'],
    ['Onboarding', 'Estados de registro (pendiente → en revisión → aprobado / rechazado / con observaciones)', '🟡 Parcial', 'Existe solicitud de farmacia; faltan los estados explícitos y el flujo.', 'Alta', 'Re-scope'],
    ['Onboarding', 'Subir documentos legales (según mercado: Cámara/RUT/INVIMA/licencia/cédula rep.)', '🟡 Parcial', 'Sube un documento; falta el set específico. ⚠️ El set depende de Colombia vs RD.', 'Alta', 'Re-scope'],
    ['Onboarding', 'Ver estado + comentarios del admin y reenviar corregido', '❌ Falta', 'Ciclo de observaciones con el administrador.', 'Alta', 'Re-scope'],
    ['Onboarding', 'No aparecer ante usuarios hasta estar aprobada', '❌ Falta', 'Gating por estado de aprobación.', 'Alta', 'Re-scope'],
    ['Sucursales', 'Gestión de sucursales/sedes (CRUD)', '❌ Falta', 'DECISIÓN MADRE: precio, stock, descuento, cuentas y leads cuelgan de la sucursal. Diseñar primero.', 'Alta', 'Re-scope'],
    ['Catálogo', 'Mapear productos de la farmacia al catálogo maestro', '🟡 Parcial', 'El catálogo (productos) existe; falta forzar el enlace producto→catálogo en la carga (no texto libre). Decisión #1.', 'Alta', 'Re-scope'],
    ['Contribución', 'Carga masiva de productos (Excel/CSV)', '🟡 Parcial', 'Existe import CSV; falta: mapeo a catálogo, validación por fila, manejo de errores, y definir si es global o por sucursal.', 'Alta', 'Re-scope'],
    ['Precios', 'Fijar precio por producto', '🟡 Parcial', 'precios_base existe; decidir si el precio es por farmacia o por sucursal.', 'Alta', 'Re-scope'],
    ['Stock', 'Disponibilidad por (sucursal, producto)', '❌ Falta', 'Recomendado: flag “disponible / no disponible” (no stock numérico). Decisión #2.', 'Alta', 'Re-scope'],
    ['Descuentos', 'Descuento con vigencia (inicio/fin), tipo (% o monto fijo) y alcance (general/sucursal)', '🟡 Parcial', 'Hoy solo % estándar, sin vigencia ni tipo. Ampliar el modelo.', 'Alta', 'Re-scope'],
    ['Métricas', 'Dashboard: “los más buscados”, visitas, conversión', '❌ Falta', 'Requiere registrar eventos del lado del usuario.', 'Alta', 'Re-scope'],
    ['Leads', 'Definición y captura de “lead/visita” (vista de producto, clic en “cómo llegar”, contacto)', '❌ Falta', 'Definir qué cuenta como lead y si el usuario es anónimo o registrado. Implica privacidad (decisión #3).', 'Alta', 'Re-scope'],
    ['Cuentas', 'Múltiples usuarios por farmacia (ej. un encargado por sucursal)', '❌ Falta', 'Decidir: una cuenta o varias por farmacia/sucursal.', 'Media', 'Re-scope'],
    ['Perfil', 'Ficha de farmacia / “Mi farmacia”', '✅ Está', 'Vista informativa existe.', 'Baja', 'Contrato'],
    ['Aportes', 'Contribuciones ilimitadas (farmacia/admin)', '✅ Está', '', 'Baja', 'Mejora'],
  ],
);

// ---------- 4. ADMIN ----------
buildSheet(
  'Rol Administrador (web)',
  'El admin sale de la app y pasa a una plataforma WEB. El cliente lo deja para después, pero se documenta el alcance.',
  [
    ['Plataforma', 'Panel de administración WEB (fuera de la app móvil)', '❌ Falta', 'Nuevo front web. Diferido por el cliente.', 'Media', 'Re-scope'],
    ['Registros', 'Revisar documentos legales de farmacias', '❌ Falta', 'Visor de documentos subidos.', 'Alta', 'Re-scope'],
    ['Registros', 'Aprobar / rechazar / comentar registros de farmacia', '🟡 Parcial', 'Existe base de solicitudes; faltan acciones, estados y comentarios.', 'Alta', 'Re-scope'],
    ['Farmacias', 'Activar / desactivar farmacias', '✅ Está', 'Existe en la app; mover a web.', 'Media', 'Contrato'],
    ['Datos', 'Importar / exportar CSV de farmacias y medicamentos', '✅ Está', 'Existe en la app.', 'Media', 'Contrato'],
    ['Catálogo', 'Gestión del catálogo maestro (CRUD de productos)', '🟡 Parcial', 'La tabla productos existe; falta UI de administración.', 'Alta', 'Re-scope'],
    ['Precios', 'Gestión de precios base de referencia', '🟡 Parcial', 'Tabla precios_base existe; falta UI.', 'Media', 'Contrato'],
    ['Moderación', 'Moderar reseñas y contribuciones', '✅ Está', 'Existe en la app; mover a web.', 'Media', 'Mejora'],
    ['Métricas', 'Analítica global de la plataforma', '❌ Falta', 'Puede apoyarse en PostHog (requiere llave del cliente).', 'Baja', 'Contrato'],
  ],
);

// ---------- 5. DECISIONES ----------
const wsD = wb.addWorksheet('Decisiones Clave', { views: [{ state: 'frozen', ySplit: 1 }] });
wsD.columns = [
  { header: '#', key: 'n', width: 5 },
  { header: 'Decisión', key: 'd', width: 30 },
  { header: 'Por qué importa', key: 'w', width: 50 },
  { header: 'Opciones', key: 'o', width: 40 },
  { header: 'Recomendación', key: 'r', width: 40 },
];
styleHeader(wsD);
[
  ['1', 'Catálogo maestro de medicamentos', 'Sostiene toda la app: si cada farmacia escribe en texto libre, el match “usuario busca X → farmacias que lo tienen” se rompe.', 'a) Texto libre (no) · b) Catálogo normalizado con enlace obligatorio', 'Usar el catálogo existente (productos) y forzar el enlace en la carga. Agregar principio activo, concentración y presentación.'],
  ['2', 'Stock por sucursal: ¿sí o no?', 'Si se maneja, el usuario ve solo farmacias que realmente lo tienen (mucho mejor). Cambia el modelo de datos.', 'a) Sin stock (solo “trabaja el producto”) · b) Flag disponible/no · c) Stock numérico', 'Opción b: flag “disponible / no disponible” por (sucursal, producto). Numérico es excesivo (no lo mantienen).'],
  ['3', 'Privacidad de datos de salud', 'Las búsquedas son datos sensibles. Si se guardan para leads, hay obligaciones legales.', 'a) Leads anónimos/agregados · b) Leads asociados al usuario con consentimiento', 'Empezar con leads anónimos/agregados; consentimiento explícito si se asocian al usuario. Definir política desde ya.'],
  ['🚩', 'Mercado: Colombia vs República Dominicana', 'Define el catálogo (INVIMA vs DIGEMAPS), los documentos de registro y la ley de privacidad (1581 vs 172-13).', 'a) Colombia · b) República Dominicana · c) Ambos', 'CONFIRMAR con el cliente antes de construir catálogo y onboarding. Hoy el código es RD; los términos de la reunión son CO.'],
  ['M', 'Modelo de Sucursales (decisión madre)', 'Precio, stock, descuento, cuentas internas, leads y métricas cuelgan de la sucursal.', 'a) Farmacia plana (sin sedes) · b) Farmacia con N sucursales', 'Opción b. Diseñar el esquema de sucursales PRIMERO; todo lo demás se modela encima.'],
  ['L', 'Definición de “lead / visita”', 'Sin una definición clara no se pueden medir “los más buscados”.', 'Vista de producto · Clic en “cómo llegar” · Contacto (WhatsApp/llamar) · Reserva', 'Definir 2-3 eventos concretos y registrarlos; decidir anónimo vs registrado (liga con decisión #3).'],
].forEach((r) => {
  const row = wsD.addRow({ n: r[0], d: r[1], w: r[2], o: r[3], r: r[4] });
  row.alignment = { vertical: 'top', wrapText: true };
  row.getCell('d').font = { bold: true };
  row.getCell('r').font = { color: { argb: 'FF1E7D34' } };
});
wsD.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: 5 } };

// ---------- 6. ROADMAP ----------
const wsR = wb.addWorksheet('Roadmap por Fases', { views: [{ state: 'frozen', ySplit: 1 }] });
wsR.columns = [
  { header: 'Fase / Bloque', key: 'f', width: 30 },
  { header: 'Alcance', key: 'a', width: 60 },
  { header: 'Estado', key: 's', width: 12 },
  { header: 'Notas', key: 'n', width: 40 },
];
styleHeader(wsR);
[
  ['Fases 1-5 (base)', 'Búsqueda, mapa, precios, perfiles/familia, registro de farmacia, panel admin en app, CSV, traducciones.', '✅ Está', 'Implementado.'],
  ['Mejora — Keriva Reviews', 'Calificaciones y reseñas de farmacias.', '✅ Está', 'Requiere correr la migración en Supabase (hecho).'],
  ['Re-scope — Rol Usuario', 'Orden por cercanía (2 km), casos borde GPS, disponibilidad, “abierta ahora”.', '🟡 Parcial', 'Base existe; ajustes y nuevos casos.'],
  ['Re-scope — Rol Farmacia', 'Sucursales, stock, descuentos avanzados, contribución por catálogo, métricas, leads, cuentas internas.', '❌ Falta', 'Módulo grande; depende de decisiones clave.'],
  ['Re-scope — Admin web', 'Plataforma web de administración y aprobación de registros.', '❌ Falta', 'Diferido por el cliente.'],
  ['Fase 6 (contrato)', 'Agente de IA con Anthropic.', '❌ Falta', 'Contractual, esfuerzo alto.'],
  ['Fase 7 (contrato)', 'QA, prueba de carga y documentación de rendimiento.', '❌ Falta', ''],
  ['Fase 8 (contrato)', 'Despliegue (keriva.app) y beta pública.', '❌ Falta', 'Requiere dominio del cliente.'],
  ['Integraciones', 'PostHog (analítica), OneSignal (push), Sentry (errores).', '🟡 Parcial', 'Requieren llaves/DSN del cliente.'],
  ['Pendiente UX', 'Tema oscuro/claro persistente.', '❌ Falta', 'Tokens de tema ya existen.'],
].forEach((r) => {
  const row = wsR.addRow({ f: r[0], a: r[1], s: r[2], n: r[3] });
  row.alignment = { vertical: 'top', wrapText: true };
  row.getCell('f').font = { bold: true };
  const sc = row.getCell('s');
  if (FILLS[r[2]]) sc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: FILLS[r[2]] } };
  sc.alignment = { vertical: 'middle', horizontal: 'center' };
  sc.font = { bold: true, size: 10 };
});
wsR.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: 4 } };

const out = process.argv[2] || 'Keriva_Plan_Trabajo_Roles.xlsx';
wb.xlsx.writeFile(out).then(() => console.log('WROTE ' + out));
