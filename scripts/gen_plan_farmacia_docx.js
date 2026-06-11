const fs = require('fs');
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Footer, AlignmentType, LevelFormat, HeadingLevel,
  BorderStyle, WidthType, ShadingType, PageNumber, PageBreak, VerticalAlign,
} = require('docx');

const GREEN = '106B4F';
const ACCENT = '16A34A';
const GREY = '6B7280';
const HEAD = 'DCFCE7';
const SUBT = 'EFF7F2';
const STAGE2 = 'FDECEC';
const CONTENT_W = 9360;

const P = (t, o = {}) => new Paragraph({ spacing: { after: o.after ?? 120, before: o.before ?? 0 }, alignment: o.align, children: [new TextRun({ text: t, bold: o.bold, italics: o.italics, color: o.color, size: o.size })] });
const H1 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(t)] });
const H2 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(t)] });
const bullet = (t) => new Paragraph({ numbering: { reference: 'b', level: 0 }, spacing: { after: 70 }, children: Array.isArray(t) ? t : [new TextRun(t)] });
const numbered = (t) => new Paragraph({ numbering: { reference: 's', level: 0 }, spacing: { after: 70 }, children: [new TextRun(t)] });
const spacer = (h = 100) => new Paragraph({ spacing: { after: h }, children: [] });

const bd = { style: BorderStyle.SINGLE, size: 1, color: 'D7DEDB' };
const borders = { top: bd, bottom: bd, left: bd, right: bd };
function cell(text, width, o = {}) {
  const runs = Array.isArray(text) ? text : [new TextRun({ text: String(text), bold: o.bold, color: o.color, size: o.size ?? 20 })];
  return new TableCell({ borders, width: { size: width, type: WidthType.DXA }, shading: o.fill ? { fill: o.fill, type: ShadingType.CLEAR } : undefined, margins: { top: 60, bottom: 60, left: 100, right: 100 }, verticalAlign: VerticalAlign.CENTER, children: runs.map((r) => (r instanceof Paragraph ? r : new Paragraph({ alignment: o.align, children: [r] }))) });
}
// rows: [ [#, tarea, depende, dias] ... ]; last optional subtotal
function taskTable(rows, subtotal) {
  const widths = [700, 5360, 1450, 1850];
  const header = new TableRow({ tableHeader: true, children: [
    cell('#', widths[0], { bold: true, fill: HEAD, align: AlignmentType.CENTER }),
    cell('Tarea', widths[1], { bold: true, fill: HEAD }),
    cell('Depende', widths[2], { bold: true, fill: HEAD, align: AlignmentType.CENTER }),
    cell('Días est.', widths[3], { bold: true, fill: HEAD, align: AlignmentType.CENTER }),
  ] });
  const body = rows.map((r) => new TableRow({ children: [
    cell(r[0], widths[0], { align: AlignmentType.CENTER, bold: true }),
    cell(r[1], widths[1]),
    cell(r[2], widths[2], { align: AlignmentType.CENTER, color: GREY }),
    cell(r[3], widths[3], { align: AlignmentType.CENTER }),
  ] }));
  const rowsAll = [header, ...body];
  if (subtotal) rowsAll.push(new TableRow({ children: [
    cell('', widths[0], { fill: SUBT }),
    cell([new TextRun({ text: 'Subtotal del bloque', bold: true })], widths[1], { fill: SUBT }),
    cell('', widths[2], { fill: SUBT }),
    cell([new TextRun({ text: subtotal, bold: true })], widths[3], { fill: SUBT, align: AlignmentType.CENTER }),
  ] }));
  return new Table({ width: { size: CONTENT_W, type: WidthType.DXA }, columnWidths: widths, rows: rowsAll });
}

const doc = new Document({
  styles: {
    default: { document: { run: { font: 'Arial', size: 22 } } },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 28, bold: true, font: 'Arial', color: GREEN }, paragraph: { spacing: { before: 280, after: 140 }, outlineLevel: 0 } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 23, bold: true, font: 'Arial', color: ACCENT }, paragraph: { spacing: { before: 160, after: 90 }, outlineLevel: 1 } },
    ],
  },
  numbering: { config: [
    { reference: 'b', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 520, hanging: 260 } } } }] },
    { reference: 's', levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 520, hanging: 260 } } } }] },
  ] },
  sections: [{
    properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
    footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Keriva · Plan de trabajo Rol Farmacia (Etapa 1) · Página ', size: 16, color: GREY }), new TextRun({ children: [PageNumber.CURRENT], size: 16, color: GREY })] })] }) },
    children: [
      spacer(1600),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 100 }, children: [new TextRun({ text: 'KERIVA', bold: true, size: 64, color: GREEN })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 }, children: [new TextRun({ text: 'Plan de trabajo — Rol Farmacia (Etapa 1)', size: 28, color: GREY })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 560 }, children: [new TextRun({ text: 'App de farmacias — República Dominicana', size: 22, italics: true, color: GREY })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Preparado para el cliente · 9 de junio de 2026', size: 22 })] }),
      new Paragraph({ children: [new PageBreak()] }),

      // 1. ALCANCE
      H1('1. Alcance de la Etapa 1'),
      P('Esta etapa transforma el rol Farmacia / Aliado en una herramienta de gestión completa. Incluye: sucursales con datos propios, catálogo de productos, inventario con precio y disponibilidad por sucursal, carga masiva, descuentos, reservas con confirmación de venta, métricas (incluyendo ventas) y el flujo de registro y aprobación.'),
      P('Las notificaciones y alertas se entregan como una segunda etapa (ver sección 6), cotizada por separado.'),

      // 2. DECISIONES
      H1('2. Decisiones de diseño acordadas'),
      bullet('Sucursales: cada farmacia puede tener varias sucursales, cada una con sus propios datos (dirección, teléfono, horario, ubicación).'),
      bullet('Cuenta: una sola cuenta por farmacia, que gestiona todas sus sucursales.'),
      bullet('Precio y disponibilidad (stock): se manejan por sucursal. El stock es un indicador “disponible / no disponible”.'),
      bullet('Carga masiva: la farmacia elige aplicar a todas las sucursales o a una sola, y el modo actualizar (solo lo del archivo) o reemplazar (lo ausente queda no disponible).'),
      bullet('Catálogo maestro: productos normalizados; cada producto de la farmacia se enlaza al catálogo (no texto libre).'),
      bullet('Ventas: se obtienen de reservas confirmadas — el usuario reserva y la farmacia marca la venta como concretada.'),
      bullet('Privacidad: la captura de eventos para métricas es anónima/agregada por defecto (Ley 172-13 de RD).'),

      new Paragraph({ children: [new PageBreak()] }),

      // 3. PLAN
      H1('3. Plan de trabajo'),
      P('Días estimados de desarrollo (referenciales, sujetos a validación). El orden respeta las dependencias entre tareas.'),

      H2('Bloque A — Fundación'),
      taskTable([
        ['21', 'Diseñar el esquema de datos completo del rol Farmacia', '—', '2 – 3'],
        ['22', 'Migración: tabla de sucursales (datos propios por sede)', '21', '2 – 3'],
        ['23', 'CRUD de sucursales (API + interfaz)', '22', '3 – 4'],
        ['24', 'Asociar farmacias existentes a una sucursal por defecto', '22', '1'],
        ['25', 'Extender el catálogo maestro (principio activo, concentración, presentación)', '21', '2 – 3'],
      ], '10 – 14'),

      H2('Bloque B — Inventario, carga y precios'),
      taskTable([
        ['26', 'Migración: inventario por sucursal (disponible + precio)', '22, 25', '2 – 3'],
        ['27', 'Interfaz para gestionar el inventario por sucursal (manual)', '26', '3 – 4'],
        ['28', 'Plantilla descargable para la carga masiva', '25', '1'],
        ['29', 'Carga masiva (todas/una sucursal + actualizar/reemplazar, validación por fila)', '26, 28', '3 – 5'],
        ['30', 'Descuentos avanzados (vigencia, tipo % o monto, alcance)', '22', '2 – 3'],
      ], '11 – 16'),

      H2('Bloque C — Reservas y ventas'),
      taskTable([
        ['40', 'Migración: modelo de reservas', '22, 26', '1 – 2'],
        ['41', 'Usuario: reservar un medicamento en una sucursal', '40', '2 – 3'],
        ['42', 'Farmacia: gestión de reservas + confirmar venta', '40', '2 – 3'],
        ['43', 'Métricas de ventas e ingresos (más vendidos, ticket promedio, conversión)', '42', '3 – 4'],
        ['44', 'Demanda insatisfecha (buscado sin disponibilidad)', '26, 37', '2 – 3'],
      ], '10 – 15'),

      H2('Bloque D — Registro y aprobación (onboarding)'),
      taskTable([
        ['33', 'Estados de registro (pendiente → revisión → aprobado / rechazado / observaciones)', '—', '2 – 3'],
        ['34', 'Subir documentos legales de la farmacia (RD)', '33', '2 – 3'],
        ['35', 'Ver estado + comentarios del admin y reenviar corregido', '33, 34', '2 – 3'],
        ['36', 'Gating: la farmacia no aparece a usuarios hasta estar aprobada', '33', '1'],
      ], '7 – 10'),

      H2('Bloque E — Métricas, perfil y vista'),
      taskTable([
        ['37', 'Captura de eventos / leads (4 tipos definidos)', '22, 25', '3 – 4'],
        ['38', 'Dashboard de métricas (leads + ventas + demanda)', '37, 43, 44', '4 – 6'],
        ['39', 'Perfil de la cuenta de farmacia', '—', '1 – 2'],
        ['31', 'Quitar mapa y “buscar medicamento” del rol farmacia', '—', '1'],
        ['32', 'Ficha de farmacia con sus sucursales', '22, 23', '2 – 3'],
      ], '11 – 16'),

      // 4. RESUMEN
      H1('4. Resumen de esfuerzo (Etapa 1)'),
      taskTable([
        ['A', 'Fundación', '', '10 – 14'],
        ['B', 'Inventario, carga y precios', '', '11 – 16'],
        ['C', 'Reservas y ventas', '', '10 – 15'],
        ['D', 'Registro y aprobación', '', '7 – 10'],
        ['E', 'Métricas, perfil y vista', '', '11 – 16'],
      ], '49 – 71'),
      spacer(60),
      P('Camino crítico: diseño (21) → sucursales (22) → inventario (26) → carga masiva (29) y reservas (40 → 42 → 43).', { italics: true, color: GREY }),

      // 5. REQUERIMIENTOS
      H1('5. Lo que necesitamos del cliente para esta etapa'),
      bullet('Confirmar el set exacto de documentos legales exigidos en RD para el registro de farmacias.'),
      bullet('Catálogo de productos real (o autorización para cargarlo) para poblar el catálogo maestro.'),
      bullet('Datos de farmacias y sucursales reales (dirección, teléfono, horario, ubicación) para la demo.'),
      bullet('(Pendiente general) Habilitar la llave de Google Maps para que el mapa del usuario funcione.'),

      // 6. SEGUNDA ETAPA
      H1('6. Segunda etapa — Notificaciones y alertas (cotización aparte)'),
      P('Las reservas funcionan sin notificaciones (la farmacia las ve en su panel). Las notificaciones agregan el aviso automático y se cotizan por separado:'),
      taskTable([
        ['45', 'Sistema de notificaciones in-app (centro / campana)', '—', '3 – 4'],
        ['46', 'Notificaciones de reservas (nueva reserva / confirmada / rechazada)', '45', '2 – 3'],
        ['47', 'Notificaciones de onboarding y alertas (demanda, estados)', '45', '2 – 3'],
        ['48', 'Push notifications (OneSignal — requiere llave del cliente)', '45', '2 – 3'],
      ], '9 – 13'),
      spacer(140),
      P('Quedamos atentos para validar el plan y comenzar por el diseño del esquema de datos.', { italics: true, color: GREY }),
    ],
  }],
});

Packer.toBuffer(doc).then((buf) => {
  const out = process.argv[2] || 'Keriva_Plan_Trabajo_Farmacia.docx';
  fs.writeFileSync(out, buf);
  console.log('WROTE ' + out + ' (' + buf.length + ' bytes)');
});
