// Generate Word document with the checklist of pending requests to the client.
// Run: node generate-keriva-pedidos.js
const fs = require('fs');
const path = require('path');

const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, LevelFormat, HeadingLevel, BorderStyle, WidthType, ShadingType,
  PageOrientation, VerticalAlign,
} = require('docx');

// ---- helpers ----
const C = {
  green: '106B4F',
  greenLight: 'E8F5E9',
  red: 'C0392B',
  redLight: 'FBEAE8',
  orange: 'D97706',
  orangeLight: 'FDF1E6',
  yellow: 'B7791F',
  yellowLight: 'FFF8E1',
  greenAccent: '15A862',
  greenAccentLight: 'DDF5E8',
  text: '111827',
  muted: '6B7280',
  border: 'CCCCCC',
};

const border = (color = C.border) => ({ style: BorderStyle.SINGLE, size: 6, color });
const cellBorders = {
  top: border(), bottom: border(), left: border(), right: border(),
};

function H1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 300, after: 180 },
    children: [new TextRun({ text, bold: true, size: 36, color: C.green, font: 'Arial' })],
  });
}

function H2(text, color = C.green) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 240, after: 120 },
    children: [new TextRun({ text, bold: true, size: 28, color, font: 'Arial' })],
  });
}

function H3(text, color = C.text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 160, after: 80 },
    children: [new TextRun({ text, bold: true, size: 22, color, font: 'Arial' })],
  });
}

function P(text, opts = {}) {
  return new Paragraph({
    spacing: { after: 100 },
    children: [new TextRun({ text, size: 22, color: opts.color ?? C.text, font: 'Arial', italics: !!opts.italic })],
  });
}

function Bullet(text, opts = {}) {
  return new Paragraph({
    numbering: { reference: 'bullets', level: 0 },
    spacing: { after: 60 },
    children: [new TextRun({ text, size: 22, color: opts.color ?? C.text, font: 'Arial', bold: !!opts.bold })],
  });
}

function Check(text) {
  // Casilla cuadrada antes del texto (no bullet circular — el cliente lo marca)
  return new Paragraph({
    spacing: { after: 80 },
    children: [
      new TextRun({ text: '☐  ', size: 26, color: C.green, font: 'Arial', bold: true }),
      new TextRun({ text, size: 22, color: C.text, font: 'Arial' }),
    ],
  });
}

// Banner box that introduces each priority section
function BannerCell(label, sublabel, fill, textColor) {
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [9360],
    rows: [new TableRow({
      children: [new TableCell({
        borders: { top: border(textColor), bottom: border(textColor), left: border(textColor), right: border(textColor) },
        width: { size: 9360, type: WidthType.DXA },
        shading: { fill, type: ShadingType.CLEAR },
        margins: { top: 160, bottom: 160, left: 220, right: 220 },
        children: [
          new Paragraph({ children: [new TextRun({ text: label, bold: true, size: 24, color: textColor, font: 'Arial' })] }),
          new Paragraph({ children: [new TextRun({ text: sublabel, size: 20, color: textColor, font: 'Arial' })] }),
        ],
      })],
    })],
  });
}

// Two-column table row helper for the cover info
function infoRow(label, value) {
  return new TableRow({
    children: [
      new TableCell({
        borders: cellBorders,
        width: { size: 2400, type: WidthType.DXA },
        shading: { fill: C.greenLight, type: ShadingType.CLEAR },
        margins: { top: 100, bottom: 100, left: 160, right: 120 },
        children: [new Paragraph({ children: [new TextRun({ text: label, bold: true, size: 20, color: C.green, font: 'Arial' })] })],
      }),
      new TableCell({
        borders: cellBorders,
        width: { size: 6960, type: WidthType.DXA },
        margins: { top: 100, bottom: 100, left: 160, right: 120 },
        children: [new Paragraph({ children: [new TextRun({ text: value, size: 20, color: C.text, font: 'Arial' })] })],
      }),
    ],
  });
}

// Build the document
const doc = new Document({
  creator: 'Keriva — KRV Dominicana SRL',
  title: 'Pedidos pendientes al cliente — Keriva',
  description: 'Checklist de llaves, accesos y decisiones que necesitamos del cliente para cerrar la app.',
  styles: {
    default: { document: { run: { font: 'Arial', size: 22 } } },
    paragraphStyles: [
      {
        id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 36, bold: true, font: 'Arial', color: C.green },
        paragraph: { spacing: { before: 300, after: 180 }, outlineLevel: 0 },
      },
      {
        id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 28, bold: true, font: 'Arial' },
        paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 1 },
      },
      {
        id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 22, bold: true, font: 'Arial' },
        paragraph: { spacing: { before: 160, after: 80 }, outlineLevel: 2 },
      },
    ],
  },
  numbering: {
    config: [{
      reference: 'bullets',
      levels: [{
        level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 720, hanging: 360 } } },
      }],
    }],
  },
  sections: [{
    properties: {
      page: {
        size: { width: 12240, height: 15840, orientation: PageOrientation.PORTRAIT },
        margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
      },
    },
    children: [
      // ===== Cover =====
      new Paragraph({
        alignment: AlignmentType.LEFT,
        spacing: { after: 80 },
        children: [new TextRun({ text: 'KERIVA', bold: true, size: 56, color: C.green, font: 'Arial' })],
      }),
      new Paragraph({
        spacing: { after: 280 },
        children: [new TextRun({ text: 'Pedidos pendientes al cliente — para cerrar la app y arrancar la beta', size: 26, color: C.text, font: 'Arial' })],
      }),

      // Info box
      new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [2400, 6960],
        rows: [
          infoRow('Documento', 'Checklist de pedidos al cliente · v1.0'),
          infoRow('Para', 'Alfredo Castro — Keriva / KRV Dominicana SRL'),
          infoRow('De', 'Michael — MY Tech Solutions (Colombia)'),
          infoRow('Fecha', '11 de junio de 2026'),
          infoRow('Contexto', 'Cerramos el plan completo de la app móvil. Para activar push, hacer deploy y arrancar fases siguientes necesitamos lo que va abajo.'),
        ],
      }),

      new Paragraph({ spacing: { before: 280, after: 60 }, children: [new TextRun({ text: '', size: 22 })] }),

      // ===== Intro =====
      P('Hola Alfredo,'),
      P('Esta semana cerramos todo lo que figuraba como pendiente para la app móvil según la documentación que enviaste (Brief Técnico Fase 1, Anexo de Roles, Plan Trabajo Farmacia, Fases & Alcance, Mejoras 20.05). Las únicas tareas que quedan abiertas requieren llaves, accesos o decisiones de tu lado.'),
      P('Está organizado por urgencia. Lo de la primera sección bloquea cosas que ya están construidas y esperando para activarse.'),

      // ===== URGENTE =====
      H1('1. URGENTE — Bloquea features ya construidas'),
      BannerCell('Prioridad ALTA', 'Estas piezas ya están listas en el código y esperan tu insumo para activarse.', C.redLight, C.red),
      new Paragraph({ spacing: { after: 120 }, children: [] }),

      H2('1.1 OneSignal — Notificaciones push', C.red),
      P('Para activar los avisos automáticos (nueva reserva → farmacia, reserva confirmada → usuario, alertas de onboarding) necesitamos:'),
      Bullet('OneSignal App ID — se crea en dashboard.onesignal.com → New App → React Native → "Keriva".'),
      Bullet('OneSignal REST API Key — para que el server dispare los push.'),
      Bullet('FCM Server Key (Firebase Cloud Messaging) — proyecto Firebase para app.keriva.farmacias. Console Firebase → Configuración del proyecto → Cloud Messaging.'),
      Bullet('Si entra iOS desde el día 1: cert APNs (.p8) + Team ID + Bundle iOS.'),

      H2('1.2 Datos reales para una beta creíble', C.red),
      Bullet('Catálogo de productos real (Excel/CSV) — o autorización para usar/comprar el catálogo DIGEMAPS.'),
      Bullet('Farmacias afiliadas confirmadas con: nombre comercial, dirección exacta, teléfono, WhatsApp en formato E.164 (+1-809-…), horario por día, ubicación lat/lng.'),
      Bullet('Logos de farmacias afiliadas (si quieren mostrarse con su marca).'),

      // ===== IMPORTANTE =====
      H1('2. IMPORTANTE — Bloquea el deploy a producción'),
      BannerCell('Prioridad MEDIA-ALTA', 'Para publicar la app en stores y dominio público.', C.orangeLight, C.orange),
      new Paragraph({ spacing: { after: 120 }, children: [] }),

      H2('2.1 Acceso a hosting + DNS', C.orange),
      Bullet('Acceso al panel de DNS del dominio keriva.app (Cloudflare, Namecheap o donde lo tengan).'),
      Bullet('Vercel/Netlify: o nos invitan a su cuenta, o nos autorizan a crear el proyecto y les pasamos accesos.'),
      Bullet('Decisión: ¿keriva.app muestra la landing pública o la app? ¿Prefieren app.keriva.app para la app y keriva.app para marketing?'),

      H2('2.2 Google Play Console', C.orange),
      Bullet('Acceso a la cuenta de Google Play Console como editor — para subir el APK preview a closed testing y luego producción.'),
      Bullet('Confirmar: ¿publicamos bajo MY Tech Solutions o bajo KRV Dominicana SRL?'),

      H2('2.3 iOS App Store (si aplica)', C.orange),
      Bullet('Apple Developer account activa (USD 99/año) a nombre de KRV Dominicana SRL.'),
      Bullet('Confirmar: ¿quieren iOS desde el día 1, o solo Android para empezar?'),

      // ===== DECISIONES =====
      H1('3. DECISIONES DE SCOPE — Definen trabajo futuro'),
      BannerCell('Prioridad MEDIA', 'Sin cerrar estas decisiones no podemos arrancar las siguientes fases.', C.yellowLight, C.yellow),
      new Paragraph({ spacing: { after: 120 }, children: [] }),

      H2('3.1 Fase 6 — Agente IA con Anthropic (contractual)', C.yellow),
      P('Esta fase necesita una conversación corta de scoping (~1 hora). Preguntas concretas:'),
      Bullet('¿Qué preguntas responde el agente? Ej: "¿qué genérico es Lipitor?", "¿con qué interactúa la metformina?", "¿cuánto paracetamol pediátrico para 12 kg?".'),
      Bullet('¿Hasta dónde llega? Solo info de medicamentos, o también recomendar farmacias, recordatorios, etc.'),
      Bullet('Disclaimers obligatorios: qué casos derivan a médico / emergencia (lo legal en RD).'),
      Bullet('¿La API key de Anthropic la pone el cliente, o la facturamos por separado?'),
      Bullet('Modelo de cobro: por mensaje vs flat mensual (los tokens de Anthropic se pagan por uso).'),

      H2('3.2 Definición Admin Web (proyecto aparte)', C.yellow),
      P('Cerramos en esta sesión que el admin sale de la app y va en plataforma web. Para arrancar ese proyecto:'),
      Bullet('Stack preferido: Next.js (recomendado), Remix o Astro.'),
      Bullet('¿Misma BD Supabase o aparte? Recomendamos la misma — la vista v_demanda_insatisfecha y las tablas ya están listas.'),
      Bullet('¿Quiénes usan el admin? ¿Equipo Keriva interno, o también soporte externo?'),
      Bullet('¿SSO con Google, o auth email+password como la app?'),

      H2('3.3 Tema oscuro completo', C.yellow),
      P('La infraestructura del tema oscuro está lista (toggle persistido, StatusBar dinámico). El refactor visual de cada pantalla para que respete el modo es ~2-3 días.'),
      Bullet('¿Lo metemos en esta fase, o lo dejamos para una siguiente?'),

      // ===== OPCIONAL =====
      H1('4. OPCIONAL — Mejoran el producto, no bloquean'),
      BannerCell('Recomendado', 'Para una beta sólida y profesional.', C.greenAccentLight, C.greenAccent),
      new Paragraph({ spacing: { after: 120 }, children: [] }),

      H2('4.1 Analítica y monitoreo', C.greenAccent),
      Bullet('PostHog: ¿quieren dashboards específicos? (búsquedas, reservas, demanda insatisfecha).'),
      Bullet('Sentry: ¿a qué email/Slack quieren que lleguen las alertas de errores críticos?'),

      H2('4.2 Términos y condiciones / Privacidad', C.greenAccent),
      Bullet('Textos legales finalizados: TyC y política de privacidad alineada a Ley 172-13 RD.'),
      Bullet('Quién los firma — necesitamos el PDF/texto para mostrarlo en el consentimiento y en el footer.'),

      H2('4.3 Soporte al usuario', C.greenAccent),
      Bullet('WhatsApp business o email de soporte para mostrar en la app cuando algo falle.'),
      Bullet('FAQ inicial: 5–10 preguntas frecuentes para el primer release.'),

      // ===== CHECKLIST =====
      H1('5. Checklist resumido — para que marques'),
      P('Casillas para que vayas marcando lo que vayas resolviendo:'),

      H3('Urgente'),
      Check('OneSignal App ID + REST API Key.'),
      Check('FCM Server Key de Firebase.'),
      Check('Catálogo de productos real o autorización DIGEMAPS.'),
      Check('Lista final de farmacias afiliadas con teléfonos y horarios.'),

      H3('Para deploy'),
      Check('Acceso al DNS de keriva.app.'),
      Check('Acceso a Google Play Console (editor).'),
      Check('Si va iOS — Apple Developer account.'),

      H3('Decisiones'),
      Check('Scope detallado del Agente IA (Fase 6) — agendar 1 reunión.'),
      Check('Decisión Admin Web (stack + alcance + auth).'),
      Check('Confirmar si tema oscuro entra ahora o en otra fase.'),

      H3('Opcional'),
      Check('Email / WhatsApp de soporte para mostrar en la app.'),
      Check('Textos legales finales (TyC + Política de Privacidad).'),
      Check('FAQ inicial.'),

      // ===== Cierre =====
      new Paragraph({ spacing: { before: 280, after: 60 }, children: [] }),
      P('Cualquier duda con cualquiera de los puntos me avisas y lo aclaramos por aquí mismo. Mientras llegan estas piezas yo sigo con la documentación técnica y el plan de pruebas E2E, así cuando los tengamos, el deploy a beta es directo.'),
      P('Un abrazo,'),
      new Paragraph({
        spacing: { before: 100 },
        children: [new TextRun({ text: 'Michael — MY Tech Solutions', bold: true, size: 22, color: C.green, font: 'Arial' })],
      }),
      P('Keriva · KRV Dominicana SRL  ·  Uso interno · Confidencial', { color: C.muted, italic: true }),
    ],
  }],
});

const outPath = path.join(__dirname, 'Keriva_Pedidos_al_Cliente.docx');
Packer.toBuffer(doc).then((buffer) => {
  fs.writeFileSync(outPath, buffer);
  console.log('✅ Documento generado:', outPath);
});
