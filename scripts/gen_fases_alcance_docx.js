const fs = require('fs');
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Footer, AlignmentType, LevelFormat, HeadingLevel,
  BorderStyle, WidthType, ShadingType, PageNumber, PageBreak, VerticalAlign,
} = require('docx');

const GREEN = '106B4F';
const ACCENT = '16A34A';
const GREY = '6B7280';
const HEADROW = 'DCFCE7';
const NEWROW = 'FDECEC';
const REQ = 'FFF4D6';
const CONTENT_W = 9360;

const P = (text, o = {}) => new Paragraph({ spacing: { after: o.after ?? 120, before: o.before ?? 0 }, alignment: o.align, children: [new TextRun({ text, bold: o.bold, italics: o.italics, color: o.color, size: o.size })] });
const H1 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(t)] });
const H2 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(t)] });
const bullet = (text) => new Paragraph({ numbering: { reference: 'b', level: 0 }, spacing: { after: 80 }, children: Array.isArray(text) ? text : [new TextRun(text)] });
const numbered = (t) => new Paragraph({ numbering: { reference: 's', level: 0 }, spacing: { after: 80 }, children: [new TextRun(t)] });
const spacer = (h = 120) => new Paragraph({ spacing: { after: h }, children: [] });

const bd = { style: BorderStyle.SINGLE, size: 1, color: 'D7DEDB' };
const borders = { top: bd, bottom: bd, left: bd, right: bd };
function cell(text, width, o = {}) {
  const runs = Array.isArray(text) ? text : [new TextRun({ text: String(text), bold: o.bold, color: o.color, size: o.size })];
  return new TableCell({ borders, width: { size: width, type: WidthType.DXA }, shading: o.fill ? { fill: o.fill, type: ShadingType.CLEAR } : undefined, margins: { top: 70, bottom: 70, left: 110, right: 110 }, verticalAlign: VerticalAlign.CENTER, children: runs.map((r) => (r instanceof Paragraph ? r : new Paragraph({ children: [r] }))) });
}
function table(cols, rows) {
  const widths = cols.map((c) => c.w);
  const header = new TableRow({ tableHeader: true, children: cols.map((c) => cell(c.t, c.w, { bold: true, fill: HEADROW })) });
  const body = rows.map((r) => new TableRow({ children: r.map((val, i) => { const v = typeof val === 'object' && val && 'text' in val ? val : { text: val }; return cell(v.text, widths[i], { fill: v.fill, bold: v.bold, color: v.color }); }) }));
  return new Table({ width: { size: CONTENT_W, type: WidthType.DXA }, columnWidths: widths, rows: [header, ...body] });
}

const doc = new Document({
  styles: {
    default: { document: { run: { font: 'Arial', size: 22 } } },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 30, bold: true, font: 'Arial', color: GREEN }, paragraph: { spacing: { before: 300, after: 150 }, outlineLevel: 0 } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 24, bold: true, font: 'Arial', color: ACCENT }, paragraph: { spacing: { before: 180, after: 110 }, outlineLevel: 1 } },
    ],
  },
  numbering: { config: [
    { reference: 'b', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 560, hanging: 280 } } } }] },
    { reference: 's', levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 560, hanging: 280 } } } }] },
  ] },
  sections: [{
    properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
    footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Keriva · Fases, alcance y requerimientos del cliente · Página ', size: 16, color: GREY }), new TextRun({ children: [PageNumber.CURRENT], size: 16, color: GREY })] })] }) },
    children: [
      // COVER
      spacer(1700),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 120 }, children: [new TextRun({ text: 'KERIVA', bold: true, size: 70, color: GREEN })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 }, children: [new TextRun({ text: 'Fases, alcance y requerimientos del cliente', size: 28, color: GREY })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 600 }, children: [new TextRun({ text: 'App de farmacias — República Dominicana', size: 22, italics: true, color: GREY })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Preparado para el cliente · 9 de junio de 2026', size: 22 })] }),
      new Paragraph({ children: [new PageBreak()] }),

      // 1. ALCANCE
      H1('1. Alcance acordado (re-organización por roles)'),
      P('Tras la reunión, la aplicación se reorganiza en tres roles bien diferenciados:'),
      table(
        [{ t: 'Rol', w: 1900 }, { t: 'Enfoque', w: 7460 }],
        [
          [{ text: 'Usuario', bold: true }, 'Busca medicamentos y ve farmacias cercanas. La lista se ordena por proximidad (radio 2 km), no por precio. Conserva “cómo llegar” (Google Maps / Waze).'],
          [{ text: 'Farmacia / Aliado', bold: true }, 'Se le quita el mapa y la búsqueda de medicamento. Se le agregan: sucursales, contribución (carga masiva), precios y descuentos, disponibilidad, métricas y leads.'],
          [{ text: 'Administrador', bold: true }, 'Pasa a una plataforma web: revisar documentos legales y aprobar / rechazar / comentar los registros de farmacias. Se deja para una etapa posterior.'],
        ],
      ),
      spacer(80),
      P('Decisión madre: el modelo de SUCURSALES sostiene casi todo el rol Farmacia (precio, stock, descuento, cuentas internas y métricas dependen de la sucursal). Se diseña primero.', { italics: true, color: GREY }),

      // 2. FASES
      H1('2. Fases y alcance (con estimación)'),
      P('Estado y esfuerzo estimado (en días de desarrollo, referencial y sujeto a las decisiones clave):'),
      table(
        [{ t: 'Fase / Bloque', w: 2700 }, { t: 'Alcance', w: 4760 }, { t: 'Estado', w: 950 }, { t: 'Días', w: 950 }],
        [
          ['Base (Fases 1–5)', 'Búsqueda, mapa, precios, perfiles/familia, registro de farmacia, panel admin en app, CSV, 20 idiomas.', { text: '✅', fill: HEADROW }, 'Hecho'],
          ['Mejora — Reseñas', 'Calificaciones y reseñas de farmacias (Keriva Reviews).', { text: '✅', fill: HEADROW }, 'Hecho'],
          [{ text: 'Re-scope — Rol Usuario', color: 'B03A2E', bold: true }, 'Orden por cercanía (2 km), casos borde de GPS, disponibilidad, “abierta ahora”.', { text: '🟡', fill: NEWROW }, '12–18'],
          [{ text: 'Re-scope — Rol Farmacia', color: 'B03A2E', bold: true }, 'Sucursales, stock, descuentos, contribución por catálogo, métricas, leads, onboarding.', { text: '❌', fill: NEWROW }, '30–45'],
          [{ text: 'Re-scope — Admin web', color: 'B03A2E', bold: true }, 'Plataforma web de administración y aprobación de registros (diferido).', { text: '❌', fill: NEWROW }, '18–28'],
          ['Catálogo / Decisiones', 'Normalización del catálogo maestro y decisiones de modelo.', { text: '🟡', fill: NEWROW }, '3–5'],
          ['Fase 6 (contrato)', 'Agente de IA con Anthropic.', { text: '❌' }, 'Alto'],
          ['Fase 7 (contrato)', 'QA, prueba de carga y documentación.', { text: '❌' }, '—'],
          ['Fase 8 (contrato)', 'Despliegue (keriva.app) y beta pública.', { text: '❌' }, '—'],
          [{ text: 'TOTAL re-scope', bold: true }, { text: 'Suma de los módulos nuevos (Usuario + Farmacia + Admin + Catálogo).', bold: true }, { text: '', fill: 'EFF7F2' }, { text: '67–102', bold: true }],
        ],
      ),
      spacer(80),
      P('Nota: este alcance amplía el contrato original (8 fases). Sucursales, stock, motor de descuentos, leads/analítica y panel web de administración son módulos nuevos; conviene formalizarlos como adenda.', { italics: true, color: GREY }),

      new Paragraph({ children: [new PageBreak()] }),

      // 3. OBLIGATORIO DEL CLIENTE
      H1('3. Lo que necesitamos del cliente (obligatorio)'),
      P('Para avanzar sin bloqueos, el cliente debe proveer / definir lo siguiente. Está ordenado por urgencia.'),

      H2('3.1 Urgente — para que el mapa funcione'),
      P('La app ya tiene la llave de Google Maps; falta habilitarla del lado de Google Cloud (cuenta del cliente):'),
      numbered('Habilitar la API “Maps SDK for Android” en el proyecto de la llave.'),
      numbered('Activar la facturación (billing) de ese proyecto de Google Cloud.'),
      numbered('Autorizar la app en la llave (restricción Android), con estos datos:'),
      table(
        [{ t: 'Campo', w: 2600 }, { t: 'Valor', w: 6760 }],
        [
          ['Nombre del paquete', { text: 'app.keriva.farmacias', bold: true }],
          ['Huella SHA-1', { text: 'B5:D6:16:73:F3:C5:0F:FD:88:E2:03:12:F3:69:18:55:59:95:D9:E5', bold: true }],
        ],
      ),

      H2('3.2 Decisiones que debe confirmar (bloquean el desarrollo)'),
      table(
        [{ t: 'Decisión', w: 3000 }, { t: 'Qué necesitamos que confirme', w: 6360 }],
        [
          [{ text: 'Modelo de sucursales', fill: REQ, bold: true }, '¿Las farmacias manejan varias sucursales/sedes? (Define todo el rol Farmacia.)'],
          [{ text: 'Catálogo maestro', fill: REQ, bold: true }, 'Aprobar que los productos se enlacen a un catálogo único (no texto libre) y qué campos lleva (principio activo, concentración, presentación).'],
          [{ text: 'Disponibilidad / stock', fill: REQ, bold: true }, '¿Se maneja disponibilidad por sucursal (recomendado: “disponible / no disponible”)?'],
          [{ text: 'Definición de “lead”', fill: REQ, bold: true }, 'Qué cuenta como lead/visita: ver producto, clic en “cómo llegar”, contacto, reserva.'],
          [{ text: 'Privacidad de datos', fill: REQ, bold: true }, 'Si se guardan búsquedas para métricas: aprobar la política de tratamiento de datos (Ley 172-13 de RD).'],
          [{ text: 'Reserva / contacto', fill: REQ, bold: true }, '¿El usuario solo ve la farmacia, la contacta (WhatsApp/llamar) o reserva el medicamento?'],
        ],
      ),

      H2('3.3 Credenciales y accesos (cuando se activen)'),
      bullet([new TextRun({ text: 'Documentos de registro de farmacia: ', bold: true }), new TextRun('definir el set exacto exigido en RD (licencia de funcionamiento, registro de la droguería/farmacia, cédula del representante).')]),
      bullet([new TextRun({ text: 'PostHog: ', bold: true }), new TextRun('API key (analítica de uso).')]),
      bullet([new TextRun({ text: 'OneSignal: ', bold: true }), new TextRun('API key (notificaciones push).')]),
      bullet([new TextRun({ text: 'Sentry: ', bold: true }), new TextRun('DSN del proyecto (monitoreo de errores).')]),
      bullet([new TextRun({ text: 'Dominio keriva.app: ', bold: true }), new TextRun('acceso al DNS para el despliegue (Fase 8).')]),
      bullet([new TextRun({ text: 'Google Play Console: ', bold: true }), new TextRun('su cuenta, solo cuando se quiera publicar en la tienda.')]),

      H2('3.4 Contenido / datos para una buena demo'),
      bullet('Catálogo de productos real (o autorización para cargarlo).'),
      bullet('Farmacias afiliadas con sus coordenadas, precios y descuentos.'),
      bullet('Logos / lineamientos de marca, si aplica.'),

      H1('4. Próximos pasos'),
      numbered('Cliente: habilitar la llave de Google Maps (sección 3.1).'),
      numbered('Cliente: confirmar las decisiones de la sección 3.2.'),
      numbered('Equipo: diseñar el modelo de sucursales y el catálogo maestro.'),
      numbered('Equipo: implementar el rol Usuario (orden por cercanía) mientras se cierran las definiciones.'),
      spacer(160),
      P('Quedamos atentos para acompañar las definiciones y avanzar.', { italics: true, color: GREY }),
    ],
  }],
});

Packer.toBuffer(doc).then((buf) => {
  const out = process.argv[2] || 'Keriva_Fases_Alcance_Requerimientos.docx';
  fs.writeFileSync(out, buf);
  console.log('WROTE ' + out + ' (' + buf.length + ' bytes)');
});
