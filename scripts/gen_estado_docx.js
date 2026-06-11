const fs = require('fs');
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, LevelFormat, TableOfContents, HeadingLevel,
  BorderStyle, WidthType, ShadingType, PageNumber, PageBreak, VerticalAlign,
} = require('docx');

const GREEN = '106B4F';
const ACCENT = '16A34A';
const GREY = '6B7280';
const LIGHT = 'F0FDF4';
const HEADROW = 'DCFCE7';
const WARNROW = 'FDF1E6';

const CONTENT_W = 9360;

// ---- helpers ----------------------------------------------------------
const P = (text, opts = {}) =>
  new Paragraph({
    spacing: { after: opts.after ?? 120, before: opts.before ?? 0 },
    alignment: opts.align,
    children: [new TextRun({ text, bold: opts.bold, italics: opts.italics, color: opts.color, size: opts.size })],
  });

const H1 = (text) => new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(text)] });
const H2 = (text) => new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(text)] });

const bullet = (text, opts = {}) =>
  new Paragraph({
    numbering: { reference: 'bullets', level: 0 },
    spacing: { after: 80 },
    children: Array.isArray(text)
      ? text
      : [new TextRun({ text, bold: opts.bold, color: opts.color })],
  });

const numbered = (text) =>
  new Paragraph({ numbering: { reference: 'steps', level: 0 }, spacing: { after: 80 }, children: [new TextRun(text)] });

const border = { style: BorderStyle.SINGLE, size: 1, color: 'D7DEDB' };
const borders = { top: border, bottom: border, left: border, right: border };

function cell(text, width, opts = {}) {
  const runs = Array.isArray(text) ? text : [new TextRun({ text: String(text), bold: opts.bold, color: opts.color, size: opts.size })];
  return new TableCell({
    borders,
    width: { size: width, type: WidthType.DXA },
    shading: opts.fill ? { fill: opts.fill, type: ShadingType.CLEAR } : undefined,
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    verticalAlign: VerticalAlign.CENTER,
    children: runs.map((r) => (r instanceof Paragraph ? r : new Paragraph({ children: [r] }))),
  });
}

function table(cols, rows, headerFill = HEADROW) {
  const widths = cols.map((c) => c.w);
  const headerRow = new TableRow({
    tableHeader: true,
    children: cols.map((c) => cell(c.t, c.w, { bold: true, fill: headerFill })),
  });
  const bodyRows = rows.map(
    (r) =>
      new TableRow({
        children: r.map((val, i) => {
          const v = typeof val === 'object' && val !== null && 'text' in val ? val : { text: val };
          return cell(v.text, widths[i], { fill: v.fill, bold: v.bold, color: v.color });
        }),
      }),
  );
  return new Table({ width: { size: CONTENT_W, type: WidthType.DXA }, columnWidths: widths, rows: [headerRow, ...bodyRows] });
}

const spacer = (h = 120) => new Paragraph({ spacing: { after: h }, children: [] });

// ---- document ---------------------------------------------------------
const doc = new Document({
  styles: {
    default: { document: { run: { font: 'Arial', size: 22 } } },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 30, bold: true, font: 'Arial', color: GREEN },
        paragraph: { spacing: { before: 320, after: 160 }, outlineLevel: 0 } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 25, bold: true, font: 'Arial', color: ACCENT },
        paragraph: { spacing: { before: 200, after: 120 }, outlineLevel: 1 } },
    ],
  },
  numbering: {
    config: [
      { reference: 'bullets', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 560, hanging: 280 } } } }] },
      { reference: 'steps', levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 560, hanging: 280 } } } }] },
    ],
  },
  sections: [
    {
      properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({ text: 'Keriva  ·  Informe de estado y guía de pruebas  ·  Página ', size: 16, color: GREY }),
                new TextRun({ children: [PageNumber.CURRENT], size: 16, color: GREY }),
              ],
            }),
          ],
        }),
      },
      children: [
        // ---------- COVER ----------
        spacer(1600),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 120 }, children: [new TextRun({ text: 'KERIVA', bold: true, size: 72, color: GREEN })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 }, children: [new TextRun({ text: 'App de farmacias — República Dominicana', size: 28, color: GREY })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 600 }, children: [new TextRun({ text: 'Informe de estado, guía de pruebas y pendientes', size: 24, italics: true, color: GREY })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 }, children: [new TextRun({ text: 'Preparado para el cliente', size: 22 })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 }, children: [new TextRun({ text: 'Fecha: 9 de junio de 2026', size: 22 })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Plataforma: Android (APK) y Web', size: 22 })] }),
        new Paragraph({ children: [new PageBreak()] }),

        // ---------- TOC ----------
        new Paragraph({ spacing: { after: 160 }, children: [new TextRun({ text: 'Contenido', bold: true, size: 28, color: GREEN })] }),
        new TableOfContents('Contenido', { hyperlink: true, headingStyleRange: '1-2' }),
        new Paragraph({ children: [new PageBreak()] }),

        // ---------- 1. RESUMEN ----------
        H1('1. Resumen ejecutivo'),
        P('Keriva es una aplicación móvil (Android, con versión web) que ayuda a las personas en Santiago a buscar medicamentos, comparar precios y encontrar la farmacia más conveniente, con tres tipos de usuario: usuario final, farmacia y administrador. La app está construida sobre tecnología moderna (Expo / React Native y Supabase) y soporta 20 idiomas.'),
        P('Este documento resume: (a) lo que ya está implementado y funcionando, (b) cómo probar la aplicación, (c) una acción que depende del cliente para que el mapa funcione, y (d) lo que queda pendiente.'),
        P('Estado general: la app está funcional y lista para probarse en teléfono. Se entregó un APK instalable, y queda un punto de configuración del lado del cliente (la llave de Google Maps) además del roadmap de fases restantes del contrato.'),

        // ---------- 2. FUNCIONALIDADES ----------
        H1('2. Funcionalidades implementadas (qué ya está)'),
        P('A continuación, lo que ya está construido y cómo funciona para el usuario:'),

        H2('2.1 Búsqueda de medicamentos y comparación de precios'),
        bullet('El usuario busca un medicamento desde la pantalla principal y ve un listado con precios “desde” y categorías.'),
        bullet('Al entrar al detalle del medicamento ve el precio estimado en farmacias afiliadas, descuentos, distancia y la opción de reservar por WhatsApp.'),

        H2('2.2 Mapa de farmacias y rutas'),
        bullet('Mapa con 839 farmacias georreferenciadas (Santiago) usando Google Maps en el teléfono.'),
        bullet('Buscador de medicamento DENTRO del mapa: marca las farmacias que lo venden y las lista de más barato a más caro.'),
        bullet('Botón “Cómo llegar” con selección de app de navegación: Google Maps o Waze.'),

        H2('2.3 Keriva Reviews — calificaciones y reseñas (nuevo)'),
        bullet('Los usuarios pueden calificar farmacias con estrellas (1 a 5) y dejar un comentario.'),
        bullet('Cada farmacia muestra su promedio, total de reseñas y distribución de estrellas.'),
        bullet('Una reseña por usuario por farmacia (se puede editar o eliminar la propia).'),
        bullet('Acceso directo a las reseñas desde el listado de farmacias y desde la ficha de cada farmacia.'),

        H2('2.4 Reportar precios y puntos (colaborativo)'),
        bullet('Los usuarios reportan el precio de un medicamento (con foto opcional) y ganan puntos Keriva.'),
        bullet('Los reportes pueden ser verificados; existe un historial de contribuciones y de puntos.'),

        H2('2.5 Perfiles, familia y roles'),
        bullet('Tres roles: usuario, farmacia y administrador, cada uno con sus permisos.'),
        bullet('Multi-perfil / familia: gestión de dependientes y perfil de niños.'),
        bullet('Edición de perfil con foto (avatar), dirección y ubicación.'),

        H2('2.6 Herramientas de farmacia y administración'),
        bullet('Flujo de solicitud de registro como farmacia (con documento y ubicación).'),
        bullet('Panel de administración de farmacias, con importación/exportación masiva por CSV.'),
        bullet('Moderación de contenidos y de contribuciones.'),

        H2('2.7 Experiencia general'),
        bullet('Soporte de 20 idiomas (la app cambia de idioma de forma integral).'),
        bullet('Diseño cuidado, consistente y con animaciones suaves.'),
        bullet('Pin patrocinado por categoría en la pantalla principal.'),

        new Paragraph({ children: [new PageBreak()] }),

        // ---------- 3. PRUEBAS ----------
        H1('3. Cómo probar la aplicación (proceso de pruebas)'),
        P('La aplicación se puede probar de dos maneras complementarias:'),

        H2('3.1 Opción A — APK de Android (instalable en el teléfono)'),
        P('Es la app real nativa. Se genera un archivo .apk que se instala directamente en el teléfono Android (sin pasar por la Play Store). Pasos:'),
        numbered('Abrir el enlace de descarga del APK desde el navegador del teléfono.'),
        numbered('Descargar el archivo .apk y abrirlo.'),
        numbered('Android pedirá permitir “Instalar apps de orígenes desconocidos” para el navegador: activarlo y continuar.'),
        numbered('La app se instala como “Keriva” y se abre normalmente.'),
        spacer(60),
        new Paragraph({
          spacing: { after: 120 },
          children: [
            new TextRun({ text: 'Enlace de descarga del APK: ', bold: true }),
            new TextRun({ text: 'https://expo.dev/artifacts/eas/wnbP2bDaU21Ku5dAXMgXro.apk', color: ACCENT }),
          ],
        }),
        P('(El enlace de descarga tiene una vigencia aproximada de 30 días; si caduca, se genera uno nuevo.)', { italics: true, color: GREY }),
        P('Recomendado para la demostración completa, incluyendo el mapa (una vez activada la llave de Google Maps — ver sección 4).', { italics: true, color: GREY }),

        H2('3.2 Opción B — Versión Web en el teléfono (respaldo)'),
        P('Como respaldo, la app se puede abrir en el navegador del teléfono conectándose a la misma red Wi-Fi del equipo de desarrollo. Sirve para mostrar todas las funciones excepto el mapa (en web el mapa usa otra tecnología). Es útil si el APK no estuviera a mano.'),

        H2('3.3 Cuentas de prueba'),
        bullet([new TextRun({ text: 'Administrador: ', bold: true }), new TextRun('credencial provista por el cliente.')]),
        bullet([new TextRun({ text: 'Usuario y Farmacia: ', bold: true }), new TextRun('cuentas de prueba creadas para validar cada rol.')]),

        new Paragraph({ children: [new PageBreak()] }),

        // ---------- 4. ACCION CLIENTE ----------
        H1('4. Acción requerida del cliente (Google Maps)'),
        P('Para que el mapa se muestre dentro de la app en Android, hace falta una configuración en la llave (API key) de Google Maps, que pertenece a la cuenta de Google Cloud del cliente. La llave ya está integrada y es correcta; solo falta autorizarla y habilitar el servicio del lado de Google. Pasos en Google Cloud Console:'),
        numbered('Habilitar la API “Maps SDK for Android” en el proyecto de esa llave (es posible que solo esté habilitado el SDK para web).'),
        numbered('Confirmar que la facturación (billing) esté activa en ese proyecto (Google Maps lo exige, aunque exista cupo gratuito).'),
        numbered('Si la llave está restringida por aplicación Android, autorizar la app agregando su identificador de paquete y su huella SHA-1 (ver datos abajo).'),
        spacer(80),
        P('Datos de la app para autorizar la llave (sección “Application restrictions → Android apps”):', { bold: true }),
        table(
          [{ t: 'Campo', w: 2600 }, { t: 'Valor', w: 6760 }],
          [
            ['Nombre del paquete (Package name)', { text: 'app.keriva.farmacias', bold: true }],
            ['Huella SHA-1', { text: 'B5:D6:16:73:F3:C5:0F:FD:88:E2:03:12:F3:69:18:55:59:95:D9:E5', bold: true }],
            ['Huella SHA-256 (si la solicitan)', 'C6:77:DB:78:FA:98:F1:02:45:BC:F2:9D:9A:71:7A:C4:9D:82:D8:E0:0D:20:A2:13:6B:44:C0:72:58:92:DD:0D'],
          ],
        ),
        spacer(80),
        P('Estos valores corresponden a la firma de la app y no cambian entre versiones del APK.', { italics: true, color: GREY }),
        P('Una vez hecho esto, el mapa se mostrará correctamente en el APK. Sin esta configuración, el mapa seguirá en blanco aunque se instale la versión más reciente, porque el ajuste vive en la cuenta de Google del cliente, no en el código.', { italics: true, color: GREY }),

        // ---------- 6. PENDIENTES ----------
        H1('5. Lo que falta (pendientes y siguientes fases)'),
        P('De acuerdo con el alcance contratado (8 fases), esto es lo que resta. Algunos puntos requieren credenciales o cuentas del cliente para poder integrarse.'),
        table(
          [{ t: 'Pendiente', w: 4200 }, { t: 'Qué implica', w: 3600 }, { t: 'Requiere del cliente', w: 1560 }],
          [
            ['Activar la llave de Google Maps', 'Configuración en Google Cloud (sección 4) para que el mapa funcione.', { text: 'Sí', bold: true, fill: WARNROW }],
            ['Reseñas — versión 2', 'Respuestas de la farmacia a las reseñas y sección “Mis reseñas” en el perfil.', 'No'],
            ['Tema oscuro / claro', 'Interruptor de tema persistente en toda la app.', 'No'],
            ['Agente de IA (Fase 6)', 'Asistente inteligente con Anthropic (componente contractual de mayor esfuerzo).', 'No'],
            ['Analítica (PostHog)', 'Métricas de uso de la app.', { text: 'Sí (llave)', fill: WARNROW }],
            ['Notificaciones push (OneSignal)', 'Recordatorios y avisos al usuario.', { text: 'Sí (llave)', fill: WARNROW }],
            ['Monitoreo de errores (Sentry)', 'Reporte automático de fallas en producción.', { text: 'Sí (DSN)', fill: WARNROW }],
            ['QA y prueba de carga (Fase 7)', 'Pruebas finales, rendimiento y documentación.', 'No'],
            ['Despliegue y beta pública (Fase 8)', 'Publicación (keriva.app) y beta para usuarios.', { text: 'Sí', fill: WARNROW }],
            ['Entregables finales', 'Documentación técnica, guía de despliegue y entrega de propiedad intelectual.', 'No'],
          ],
        ),

        // ---------- 7. PROXIMOS PASOS ----------
        H1('6. Próximos pasos inmediatos'),
        numbered('Cliente: habilitar la llave de Google Maps (sección 4) para destrabar el mapa.'),
        numbered('Equipo: entregar la versión del APK para pruebas en el teléfono.'),
        numbered('Cliente: proveer las llaves/credenciales de los servicios que requieren su cuenta (analítica, notificaciones, monitoreo) cuando se desee activarlos.'),
        numbered('Equipo: continuar con el roadmap de fases (tema oscuro, agente de IA, QA y despliegue).'),
        spacer(200),
        P('Cualquier duda sobre este informe o las pruebas, quedamos atentos para acompañar el proceso.', { italics: true, color: GREY }),
      ],
    },
  ],
});

Packer.toBuffer(doc).then((buf) => {
  const out = process.argv[2] || 'Keriva_Estado_y_Pruebas.docx';
  fs.writeFileSync(out, buf);
  console.log('WROTE ' + out + ' (' + buf.length + ' bytes)');
});
