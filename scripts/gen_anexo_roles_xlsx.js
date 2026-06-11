const ExcelJS = require('exceljs');

// ============================================================
// Keriva — Anexo Técnico / Plan de trabajo por roles (con tiempos)
// Estilo basado en el ejemplo del cliente (margen + bandas + días).
// Tareas NUEVAS (re-scope) resaltadas en ROJO.
// ============================================================

const BAND = 'FF106B4F';     // banda de sección (verde Keriva), texto blanco
const SUB = 'FFDCFCE7';      // sub-encabezado claro
const WHITE = 'FFFFFFFF';
const NEW_FILL = 'FFFADBD8'; // rojo claro para tareas nuevas
const NEW_TXT = 'FFB03A2E';  // rojo oscuro
const ST_FILL = { '✅ Está': 'FFD5F5E3', '🟡 Parcial': 'FFFCF3CF', '❌ Falta': 'FFFADBD8', '🆕 Nuevo': 'FFD6EAF8' };
const PR_FILL = { Imprescindible: 'FFF5B7B1', Alta: 'FFF8C9A4', Media: 'FFFAD7A0', Baja: 'FFD5DBDB', Recomendado: 'FFFAD7A0' };
const thin = { style: 'thin', color: { argb: 'FFD7DEDB' } };

const wb = new ExcelJS.Workbook();
wb.creator = 'Keriva';

// Columnas: A margen, B Actividad, C Detalle, D Estado, E Días, F Prioridad, G Tipo
const W = [3.5, 32, 50, 12, 12, 14, 16];

function newSheet(name) {
  const ws = wb.addWorksheet(name, { views: [{ showGridLines: false }] });
  W.forEach((w, i) => (ws.getColumn(i + 1).width = w));
  return ws;
}
function title(ws, t, sub) {
  ws.mergeCells(2, 2, 2, 7);
  const c = ws.getCell(2, 2);
  c.value = t; c.font = { bold: true, size: 16, color: { argb: BAND } };
  ws.getRow(2).height = 22;
  ws.mergeCells(3, 2, 3, 7);
  const s = ws.getCell(3, 2);
  s.value = sub; s.font = { italic: true, size: 10, color: { argb: 'FF555555' } };
  s.alignment = { wrapText: true, vertical: 'middle' };
  ws.getRow(3).height = 28;
}
function band(ws, rowIdx, text) {
  ws.mergeCells(rowIdx, 2, rowIdx, 7);
  const c = ws.getCell(rowIdx, 2);
  c.value = text; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BAND } };
  c.font = { bold: true, color: { argb: WHITE }, size: 11 };
  c.alignment = { vertical: 'middle' };
  ws.getRow(rowIdx).height = 20;
}
function headerRow(ws, rowIdx, headers) {
  const r = ws.getRow(rowIdx);
  headers.forEach((h, i) => {
    const c = r.getCell(i + 2);
    c.value = h; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SUB } };
    c.font = { bold: true, size: 10, color: { argb: 'FF1A3A2C' } };
    c.alignment = { vertical: 'middle', wrapText: true };
    c.border = { bottom: thin };
  });
  r.height = 18;
}
// data row: [actividad, detalle, estado, dias, prioridad, tipo], isNew
function dataRow(ws, rowIdx, d, isNew) {
  const r = ws.getRow(rowIdx);
  const cells = [d[0], d[1], d[2], d[3], d[4], d[5]];
  cells.forEach((v, i) => {
    const c = r.getCell(i + 2);
    c.value = v;
    c.alignment = { vertical: 'top', wrapText: true, horizontal: i >= 2 && i <= 4 ? 'center' : 'left' };
    c.font = { size: 10 };
    c.border = { bottom: { style: 'hair', color: { argb: 'FFEAEFED' } } };
  });
  // estado
  const est = r.getCell(4);
  if (ST_FILL[d[2]]) est.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ST_FILL[d[2]] } };
  est.font = { size: 10, bold: true };
  // prioridad
  const pr = r.getCell(6);
  if (PR_FILL[d[4]]) pr.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PR_FILL[d[4]] } };
  // tipo / nueva
  const tp = r.getCell(7);
  if (isNew) {
    tp.value = '🆕 Tarea nueva';
    tp.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NEW_FILL } };
    tp.font = { bold: true, size: 10, color: { argb: NEW_TXT } };
    r.getCell(2).font = { size: 10, bold: true, color: { argb: NEW_TXT } }; // actividad en rojo
  } else {
    tp.font = { size: 10, color: { argb: 'FF777777' } };
  }
  tp.alignment = { vertical: 'top', wrapText: true, horizontal: 'center' };
  r.height = Math.max(16, Math.ceil(String(d[1]).length / 48) * 13);
}

// Construye una hoja de rol: secciones = [{band, rows:[[d..],isNew]}]
function roleSheet(name, t, sub, sections) {
  const ws = newSheet(name);
  title(ws, t, sub);
  let row = 5;
  sections.forEach((sec) => {
    band(ws, row++, sec.band);
    headerRow(ws, row++, ['Actividad', 'Qué incluye', 'Estado', 'Días est.', 'Prioridad', 'Tipo']);
    sec.rows.forEach((rw) => dataRow(ws, row++, rw[0], rw[1]));
    row++; // espacio
  });
  return ws;
}

// ---------- RESUMEN Y ALCANCE ----------
(() => {
  const ws = newSheet('Resumen y Alcance');
  title(ws, 'Keriva — Anexo Técnico y Plan de Trabajo por Roles',
    'Desglose por actividad, con estimación en días y resaltado de tareas nuevas (re-scope acordado con el cliente). Fecha: 9 de junio de 2026.');
  let row = 5;
  band(ws, row++, 'RESUMEN POR MÓDULOS');
  headerRow(ws, row++, ['Módulo', 'Descripción', '', 'Días est.', 'Prioridad', '']);
  const sum = [
    ['Login y Acceso', 'Ajustes de entrada + crear cuenta como farmacia + bloqueo por estado', '', '4 – 6', 'Imprescindible', ''],
    ['Rol Usuario', 'Orden por cercanía (2 km), casos borde GPS, disponibilidad, “abierta ahora”', '', '12 – 18', 'Imprescindible', ''],
    ['Rol Farmacia (Aliado)', 'Sucursales, stock, descuentos, contribución, métricas, leads, onboarding', '', '30 – 45', 'Imprescindible', ''],
    ['Rol Administrador (web)', 'Plataforma web de administración y aprobación de registros', '', '18 – 28', 'Recomendado', ''],
    ['Decisiones / Catálogo maestro', 'Normalización del catálogo + decisiones de modelo de datos', '', '3 – 5', 'Imprescindible', ''],
    ['TOTAL ESTIMADO', 'Suma de los módulos anteriores (referencial; sujeto a decisiones clave)', '', '67 – 102', '—', ''],
  ];
  sum.forEach((s, i) => {
    const r = ws.getRow(row++);
    [s[0], s[1], '', s[3], s[4], ''].forEach((v, j) => {
      const c = r.getCell(j + 2); c.value = v;
      c.alignment = { vertical: 'top', wrapText: true, horizontal: j === 3 ? 'center' : 'left' };
      c.font = { size: 10, bold: i === sum.length - 1 };
    });
    if (PR_FILL[s[4]]) r.getCell(6).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PR_FILL[s[4]] } };
    if (i === sum.length - 1) r.eachCell((c) => (c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF7F2' } }));
    r.height = 24;
  });
  row++;
  band(ws, row++, 'LEYENDA');
  const leg = [
    ['✅ Está', 'Ya implementado y funcionando'],
    ['🟡 Parcial', 'Existe base; falta completar/ajustar'],
    ['❌ Falta', 'No existe; hay que construirlo'],
    ['🆕 Nuevo / ROJO', 'Tarea nueva del re-scope (resaltada en rojo en cada hoja)'],
  ];
  leg.forEach((l) => {
    const r = ws.getRow(row++);
    const a = r.getCell(2); a.value = l[0]; a.font = { bold: true, size: 10 };
    if (ST_FILL[l[0]]) a.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ST_FILL[l[0]] } };
    if (l[0].includes('Nuevo')) { a.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NEW_FILL } }; a.font = { bold: true, color: { argb: NEW_TXT }, size: 10 }; }
    ws.mergeCells(r.number, 3, r.number, 7);
    const b = r.getCell(3); b.value = l[1]; b.font = { size: 10 }; b.alignment = { vertical: 'middle' };
  });
  row++;
  band(ws, row++, 'DECISIÓN MADRE — SUCURSALES');
  ws.mergeCells(row, 2, row + 1, 7);
  const f = ws.getCell(row, 2);
  f.value = 'Precio, stock, descuento, cuentas internas, leads y métricas dependen de la sucursal. Definir y diseñar este modelo PRIMERO; todo lo demás del rol Farmacia se construye encima.';
  f.font = { size: 10, color: { argb: NEW_TXT } }; f.alignment = { wrapText: true, vertical: 'top' };
  ws.getRow(row).height = 44;
})();

// ---------- LOGIN ----------
roleSheet('Login y Acceso',
  'Login y Acceso',
  'Punto de entrada compartido. El cliente pidió que en el login esté también la opción de “Crear cuenta como Farmacia”.',
  [{
    band: 'ENTRADA Y REGISTRO',
    rows: [
      [['Iniciar sesión (email + contraseña)', 'Autenticación estándar', '✅ Está', '—', 'Imprescindible', 'Existente'], false],
      [['Crear cuenta como Usuario', 'Registro de usuario final', '✅ Está', '—', 'Imprescindible', 'Existente'], false],
      [['Crear cuenta como Farmacia / Aliado', 'Botón/selector visible en el login que abre el flujo de solicitud de farmacia', '🟡 Parcial', '1 – 2', 'Imprescindible', ''], true],
      [['Selector de tipo de cuenta al registrar', 'Elegir Usuario vs Farmacia al inicio del registro', '🟡 Parcial', '1 – 2', 'Alta', ''], true],
      [['Recuperar / restablecer contraseña', 'Olvidé contraseña + verificación', '✅ Está', '—', 'Media', 'Existente'], false],
      [['Verificación de correo', 'Confirmación de email', '✅ Está', '—', 'Media', 'Existente'], false],
      [['Selección de idioma (20 idiomas)', 'Cambio de idioma global', '✅ Está', '—', 'Baja', 'Existente'], false],
      [['Entrar como invitado', 'Probar sin cuenta (solo búsqueda tras el re-scope)', '✅ Está', '—', 'Media', 'Existente'], false],
      [['Cerrar sesión → vuelve a Login', 'Redirección correcta al login', '✅ Está', '—', 'Media', 'Existente'], false],
      [['Bloqueo por estado de cuenta de farmacia', 'Si la farmacia no está aprobada, acceso limitado', '❌ Falta', '1 – 2', 'Alta', ''], true],
    ],
  }]);

// ---------- USUARIO ----------
roleSheet('Rol Usuario',
  'Rol Usuario',
  'Busca medicamentos y ve farmacias cercanas (2 km), ordenadas por proximidad — no por precio. El “cómo llegar” se queda del lado del usuario.',
  [
    {
      band: 'BÚSQUEDA Y RESULTADOS',
      rows: [
        [['Buscar medicamento por nombre comercial', 'Con autocompletado', '✅ Está', '—', 'Imprescindible', 'Existente'], false],
        [['Buscar por principio activo y categoría', 'Requiere catálogo maestro con principio activo', '🟡 Parcial', '2 – 3', 'Alta', ''], true],
        [['Lista de farmacias por CERCANÍA (2 km)', 'Usar RPC de cercanía como orden principal; quitar orden por precio', '🟡 Parcial', '1 – 2', 'Imprescindible', ''], true],
        [['Mostrar solo farmacias con disponibilidad', 'Filtra por stock/disponibilidad (depende de decisión #2)', '❌ Falta', '2 – 3', 'Alta', ''], true],
        [['Mostrar distancia a cada farmacia', 'Distancia calculada', '✅ Está', '—', 'Media', 'Existente'], false],
        [['Indicar “Abierta ahora”', 'Requiere horario estructurado por día', '🟡 Parcial', '2 – 3', 'Media', ''], true],
        [['Mostrar precio y descuento (informativo)', 'Precio referencial + descuento', '✅ Está', '—', 'Media', 'Existente'], false],
      ],
    },
    {
      band: 'UBICACIÓN, CONTACTO Y APORTES',
      rows: [
        [['GPS denegado → ingresar dirección manual', 'Entrada manual de ubicación', '❌ Falta', '1 – 2', 'Alta', ''], true],
        [['Sin farmacias en 2 km → ampliar radio', 'Control visible “buscar más lejos”', '🟡 Parcial', '1', 'Alta', ''], true],
        [['Cómo llegar (Google Maps / Waze)', 'Abrir ruta', '✅ Está', '—', 'Imprescindible', 'Existente'], false],
        [['Contactar por WhatsApp', 'Mensaje a la farmacia', '✅ Está', '—', 'Media', 'Existente'], false],
        [['Llamar a la farmacia', 'Botón de llamada directa', '🟡 Parcial', '0.5', 'Baja', ''], true],
        [['Reservar el medicamento', 'Definir si solo va, contacta o reserva', '❌ Falta', '2 – 3', 'Media', ''], true],
        [['Calificar farmacia y ver reseñas', 'Keriva Reviews', '✅ Está', '—', 'Media', 'Existente'], false],
        [['Reportar precio y ganar puntos', 'Flujo colaborativo', '✅ Está', '—', 'Baja', 'Existente'], false],
        [['Editar perfil / familia', 'Foto, dirección, dependientes', '✅ Está', '—', 'Baja', 'Existente'], false],
        [['Consentimiento de datos de salud', 'Política y aviso (decisión #3)', '❌ Falta', '1 – 2', 'Alta', ''], true],
      ],
    },
  ]);

// ---------- FARMACIA ----------
roleSheet('Rol Farmacia (Aliado)',
  'Rol Farmacia (Aliado)',
  'Se le quita el mapa y “buscar medicamento”. Se enfoca en gestión: sucursales, contribución, descuentos, métricas y leads.',
  [
    {
      band: 'ACCESO Y ONBOARDING',
      rows: [
        [['Quitar mapa y “buscar medicamento”', 'Ocultar esas secciones para el rol farmacia', '🆕 Nuevo', '1', 'Alta', ''], true],
        [['Estados de registro (pendiente → revisión → aprobado/rechazado/observaciones)', 'Máquina de estados del onboarding', '🟡 Parcial', '3 – 4', 'Alta', ''], true],
        [['Subir documentos legales', 'Licencia de funcionamiento, registro de la droguería/farmacia y cédula del representante', '🟡 Parcial', '2 – 3', 'Alta', ''], true],
        [['Ver estado + comentarios del admin y reenviar corregido', 'Ciclo de observaciones', '❌ Falta', '2 – 3', 'Alta', ''], true],
        [['No aparecer ante usuarios hasta estar aprobada', 'Gating por aprobación', '❌ Falta', '1', 'Alta', ''], true],
      ],
    },
    {
      band: 'SUCURSALES, CATÁLOGO, PRECIOS Y STOCK',
      rows: [
        [['Gestión de sucursales / sedes (CRUD)', 'DECISIÓN MADRE: precio, stock, descuento, cuentas y leads cuelgan de la sucursal', '❌ Falta', '4 – 6', 'Imprescindible', ''], true],
        [['Mapear productos al catálogo maestro', 'Enlace obligatorio producto→catálogo (no texto libre)', '🟡 Parcial', '2 – 3', 'Alta', ''], true],
        [['Carga masiva (Excel/CSV) con validación', 'Validación por fila, manejo de errores, global o por sucursal', '🟡 Parcial', '3 – 5', 'Alta', ''], true],
        [['Fijar precio por producto', 'Por farmacia o por sucursal (definir)', '🟡 Parcial', '2 – 3', 'Alta', ''], true],
        [['Disponibilidad por (sucursal, producto)', 'Flag disponible/no disponible (decisión #2)', '❌ Falta', '3 – 4', 'Alta', ''], true],
        [['Descuentos avanzados', 'Vigencia (inicio/fin), tipo (% o monto), alcance (general/sucursal)', '🟡 Parcial', '2 – 3', 'Alta', ''], true],
      ],
    },
    {
      band: 'MÉTRICAS, LEADS Y CUENTAS',
      rows: [
        [['Dashboard de métricas', '“Los más buscados”, visitas, conversión', '❌ Falta', '4 – 6', 'Alta', ''], true],
        [['Captura de leads / visitas', 'Definir y registrar eventos (vista, “cómo llegar”, contacto)', '❌ Falta', '3 – 5', 'Alta', ''], true],
        [['Cuentas internas (varios usuarios)', 'Ej. un encargado por sucursal', '❌ Falta', '3 – 4', 'Media', ''], true],
        [['Ficha “Mi farmacia”', 'Vista informativa', '✅ Está', '—', 'Baja', 'Existente'], false],
        [['Contribuciones ilimitadas (farmacia/admin)', 'Sin límite diario', '✅ Está', '—', 'Baja', 'Existente'], false],
      ],
    },
  ]);

// ---------- ADMIN ----------
roleSheet('Rol Administrador (web)',
  'Rol Administrador (web)',
  'El admin sale de la app y pasa a una plataforma WEB. El cliente lo deja para después; se documenta el alcance.',
  [{
    band: 'PLATAFORMA WEB DE ADMINISTRACIÓN',
    rows: [
      [['Plataforma web base (auth + layout)', 'Nuevo front web de administración', '❌ Falta', '5 – 8', 'Media', ''], true],
      [['Revisar documentos legales de farmacias', 'Visor de documentos', '❌ Falta', '2 – 3', 'Alta', ''], true],
      [['Aprobar / rechazar / comentar registros', 'Acciones + estados + comentarios', '🟡 Parcial', '3 – 4', 'Alta', ''], true],
      [['Activar / desactivar farmacias', 'Existe en la app; migrar a web', '✅ Está', '1', 'Media', 'Migrar'], false],
      [['Importar / exportar CSV', 'Existe en la app; migrar a web', '✅ Está', '1', 'Media', 'Migrar'], false],
      [['Gestión del catálogo maestro (CRUD)', 'UI de administración de productos', '🟡 Parcial', '3 – 4', 'Alta', ''], true],
      [['Gestión de precios base', 'UI sobre tabla existente', '🟡 Parcial', '2 – 3', 'Media', ''], true],
      [['Moderar reseñas y contribuciones', 'Existe en la app; migrar a web', '✅ Está', '1', 'Media', 'Migrar'], false],
      [['Analítica global de la plataforma', 'Apoyo en PostHog (requiere llave)', '❌ Falta', '2 – 3', 'Baja', ''], true],
    ],
  }]);

// ---------- DECISIONES ----------
(() => {
  const ws = newSheet('Decisiones Clave');
  ws.getColumn(2).width = 28; ws.getColumn(3).width = 46; ws.getColumn(4).width = 38; ws.getColumn(5).width = 40;
  title(ws, 'Decisiones Clave (cerrar antes de construir)',
    'Cada decisión condiciona el modelo de datos y el alcance. Confirmar con el cliente.');
  let row = 5;
  band(ws, row++, 'DECISIONES');
  headerRow(ws, row++, ['Decisión', 'Por qué importa', 'Opciones', 'Recomendación']);
  const D = [
    ['1. Catálogo maestro de medicamentos', 'Sostiene el match “usuario busca X → farmacias que lo tienen”. En texto libre se rompe.', 'Texto libre (no) / Catálogo normalizado con enlace obligatorio', 'Usar el catálogo existente (productos) y forzar el enlace; agregar principio activo, concentración y presentación.'],
    ['2. Stock por sucursal: ¿sí o no?', 'Si se maneja, el usuario ve solo farmacias que realmente lo tienen. Cambia el modelo.', 'Sin stock / Flag disponible-no / Stock numérico', 'Flag “disponible / no disponible” por (sucursal, producto). Numérico es excesivo.'],
    ['3. Privacidad de datos de salud', 'Las búsquedas son datos sensibles; si se guardan para leads hay obligaciones legales (Ley 172-13 de RD).', 'Leads anónimos/agregados / Asociados al usuario con consentimiento', 'Empezar anónimo/agregado; consentimiento explícito si se asocia al usuario.'],
    ['Modelo de Sucursales (madre)', 'Precio, stock, descuento, cuentas y leads cuelgan de la sucursal.', 'Farmacia plana / Farmacia con N sucursales', 'Con sucursales. Diseñar este esquema primero.'],
    ['Definición de “lead / visita”', 'Sin definición no se miden “los más buscados”.', 'Vista de producto / Clic en cómo llegar / Contacto / Reserva', 'Definir 2-3 eventos concretos; decidir anónimo vs registrado.'],
  ];
  D.forEach((d) => {
    const r = ws.getRow(row++);
    d.forEach((v, i) => { const c = r.getCell(i + 2); c.value = v; c.alignment = { vertical: 'top', wrapText: true }; c.font = { size: 10, bold: i === 0 }; });
    r.getCell(5).font = { size: 10, color: { argb: 'FF1E7D34' } };
    r.height = 46;
  });
})();

// ---------- ROADMAP ----------
(() => {
  const ws = newSheet('Roadmap y Fases');
  ws.getColumn(2).width = 30; ws.getColumn(3).width = 56; ws.getColumn(4).width = 12; ws.getColumn(5).width = 14; ws.getColumn(6).width = 18;
  title(ws, 'Roadmap y Fases',
    'Ancla el plan anterior (contrato, 8 fases) con el re-scope nuevo. Días estimados referenciales.');
  let row = 5;
  band(ws, row++, 'FASES Y BLOQUES');
  headerRow(ws, row++, ['Fase / Bloque', 'Alcance', 'Estado', 'Días est.', 'Origen']);
  const R = [
    ['Fases 1-5 (base)', 'Búsqueda, mapa, precios, perfiles/familia, registro farmacia, panel admin en app, CSV, 20 idiomas', '✅ Está', '—', 'Contrato', false],
    ['Mejora — Keriva Reviews', 'Calificaciones y reseñas de farmacias', '✅ Está', '—', 'Mejora', false],
    ['Re-scope — Rol Usuario', 'Cercanía 2 km, casos GPS, disponibilidad, “abierta ahora”', '🟡 Parcial', '12 – 18', 'Re-scope', true],
    ['Re-scope — Rol Farmacia', 'Sucursales, stock, descuentos, contribución, métricas, leads', '❌ Falta', '30 – 45', 'Re-scope', true],
    ['Re-scope — Admin web', 'Plataforma web de administración y aprobación', '❌ Falta', '18 – 28', 'Re-scope', true],
    ['Fase 6 (contrato)', 'Agente de IA con Anthropic', '❌ Falta', 'alto', 'Contrato', false],
    ['Fase 7 (contrato)', 'QA, prueba de carga y documentación', '❌ Falta', '—', 'Contrato', false],
    ['Fase 8 (contrato)', 'Despliegue (keriva.app) y beta pública', '❌ Falta', '—', 'Contrato', false],
    ['Integraciones', 'PostHog, OneSignal, Sentry (requieren llaves del cliente)', '🟡 Parcial', '—', 'Contrato', false],
    ['Pendiente UX', 'Tema oscuro/claro persistente', '❌ Falta', '2 – 3', 'Mejora', false],
  ];
  R.forEach((d) => {
    const r = ws.getRow(row++);
    [d[0], d[1], d[2], d[3], d[4]].forEach((v, i) => {
      const c = r.getCell(i + 2); c.value = v;
      c.alignment = { vertical: 'top', wrapText: true, horizontal: i === 2 || i === 3 ? 'center' : 'left' };
      c.font = { size: 10, bold: i === 0 };
    });
    const sc = r.getCell(4);
    if (ST_FILL[d[2]]) sc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ST_FILL[d[2]] } };
    sc.font = { size: 10, bold: true };
    if (d[5]) { r.getCell(6).font = { size: 10, bold: true, color: { argb: NEW_TXT } }; r.getCell(2).font = { size: 10, bold: true, color: { argb: NEW_TXT } }; }
    r.height = 26;
  });
})();

const out = process.argv[2] || 'Keriva_Anexo_Tecnico_Roles.xlsx';
wb.xlsx.writeFile(out).then(() => console.log('WROTE ' + out));
