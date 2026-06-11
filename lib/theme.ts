// =====================================================================
// Keriva — Sistema de Diseño (Design System)
// =====================================================================
// Rediseño premium: fondo claro, verde Keriva como acento vibrante,
// tipografía jerarquizada, sombras suaves y tokens de animación.
//
// Regla: NINGÚN color/medida hardcodeado en componentes. Todo vive aquí.
// Referencias de estilo: Rappi Health, Farmacias del Ahorro, 1Doc3.
//
// Uso:
//   import { theme } from '@/lib/theme';
//   <View style={{ backgroundColor: theme.colors.bg, padding: theme.spacing.lg }} />
//   <Text style={theme.text.h2}>Título</Text>
//   ...theme.shadow.card
// =====================================================================

import { Platform } from 'react-native';

// ---------------------------------------------------------------------
// 1. Color
// ---------------------------------------------------------------------
const palette = {
  // Cuerpo / superficies (paleta CLARA — valores exactos del cliente, Mejora 06)
  bg: '#F9FAFB', //  Pantallas, formularios, cards
  bgSecondary: '#F3F4F6', //  Inputs, secciones alternadas
  surface: '#FFFFFF', //  Cards / superficies elevadas
  surfaceMuted: '#F9FBFC', //  Cards secundarias

  // Acento / marca (verde Keriva — valor exacto del cliente)
  accent: '#16A34A', //  Botones primarios, nav activo, énfasis
  accentDark: '#15803D', //  Estados presionados / gradiente
  accentDarker: '#116932',
  accentSoft: '#DCFCE7', //  Chips, badges, fondos de ícono
  accentSofter: '#F0FDF4', //  Fondos muy sutiles
  accentText: '#FFFFFF', //  Texto sobre el acento

  // Marca oscura (headers / splash / mapa se mantienen oscuros)
  headerDark: '#0D3B2A',
  brandGreen: '#106B4F',
  brandGreenLight: '#34C26A',
  brandDarkest: '#052419',

  // Texto (valores exactos del cliente)
  textPrimary: '#111827', //  Títulos, texto de formulario
  textSecondary: '#6B7280', //  Subtítulos, hints, metadata
  textMuted: '#9AA3AF', //  Placeholders
  textInverse: '#FFFFFF',

  // Estados semánticos
  success: '#15A862',
  successSoft: '#DDF5E8',
  danger: '#E5484D',
  dangerSoft: '#FDECEC',
  warning: '#F2994A',
  warningSoft: '#FDF1E6',
  info: '#2E90FA',
  infoSoft: '#E9F2FE',
  gold: '#F5A623', //  Estrellas / reviews / premium

  // Marcas externas
  whatsapp: '#25D366',
  maps: '#1A73E8', //  Google Maps azul
  waze: '#05C8F7', //  Waze celeste

  // Neutros / utilidades
  white: '#FFFFFF',
  black: '#000000',
  border: '#E7ECEA',
  borderLight: '#F0F3F2',
  overlay: 'rgba(8, 20, 15, 0.55)',
  scrim: 'rgba(8, 20, 15, 0.35)',

  // --- Glass (glassmorphism) ---
  glass: 'rgba(255,255,255,0.10)', //  superficie de vidrio sobre fondo oscuro
  glassStrong: 'rgba(255,255,255,0.16)', //  vidrio más opaco (cards principales)
  glassBorder: 'rgba(255,255,255,0.22)', //  borde sutil del vidrio
  glassBorderStrong: 'rgba(255,255,255,0.35)',
  glassDark: 'rgba(6,28,20,0.35)', //  vidrio oscuro (sobre fondos claros)

  // --- Glow / orbes de luz ---
  glowMint: '#3DF59B',
  glowEmerald: '#15A862',
  glowTeal: '#16C2C2',
  glowLime: '#9BE86B',

  // --- Paleta vibrante / divertida (estilo Duolingo/Cleo) ---
  funGreen: '#2FCC71', //  verde alegre para CTAs grandes
  funGreenEdge: '#23A85C', //  borde 3D inferior del botón verde
  funYellow: '#FFC83D',
  funYellowEdge: '#E0A718',
  funBlue: '#26C6F5',
  funBlueEdge: '#1AA3CC',
  funCoral: '#FF6F61',
  funCoralEdge: '#E0564A',
  funPurple: '#B583FF',
  funPurpleEdge: '#9A63E8',
  funPink: '#FF8FB1',
  funInk: '#1B2B23', //  texto oscuro suave sobre fondos claros

  // --- Tema oscuro neón (referencia del cliente: "Exploración Atmosférica") ---
  nightBg: '#070C09', //  fondo casi negro con tinte verde
  nightBg2: '#0B120E',
  nightSurface: '#141D18', //  tarjetas
  nightSurfaceAlt: '#10180F',
  nightBorder: 'rgba(61,245,155,0.16)', //  borde sutil neón
  nightHairline: 'rgba(255,255,255,0.06)',
  nightText: '#EAF5EE',
  nightTextSoft: 'rgba(234,245,238,0.60)',
  nightTextFaint: 'rgba(234,245,238,0.40)',
  neon: '#3DF59B', //  verde neón principal (uso puntual)
  neonDim: '#2BBE7A',
  // Verde sobrio para el tema oscuro (menos vibrante, más elegante)
  nightAccent: '#57C293',
  nightAccentSoft: 'rgba(87,194,147,0.12)',
  nightAccentBorder: 'rgba(87,194,147,0.22)',
  cream: '#F2F5EC', //  botón primario claro sobre oscuro
} as const;

// ---------------------------------------------------------------------
// 2. Tipografía
// ---------------------------------------------------------------------
const font = {
  // Display / títulos — Poppins
  display: 'Poppins-Black',
  bold: 'Poppins-Bold',
  semibold: 'Poppins-SemiBold',
  regular: 'Poppins-Regular',
  // Cuerpo — DM Sans
  body: 'DMSans-Regular',
  bodyMedium: 'DMSans-Medium',
  bodyBold: 'DMSans-Bold',
} as const;

// Presets de texto (sin color → lo define el consumidor para flexibilidad).
const text = {
  display: { fontFamily: font.display, fontSize: 30, lineHeight: 36, letterSpacing: -0.5 },
  h1: { fontFamily: font.bold, fontSize: 24, lineHeight: 30, letterSpacing: -0.3 },
  h2: { fontFamily: font.semibold, fontSize: 19, lineHeight: 25, letterSpacing: -0.2 },
  h3: { fontFamily: font.semibold, fontSize: 16, lineHeight: 22 },
  title: { fontFamily: font.bodyBold, fontSize: 15, lineHeight: 20 },
  body: { fontFamily: font.body, fontSize: 14, lineHeight: 20 },
  bodyMedium: { fontFamily: font.bodyMedium, fontSize: 14, lineHeight: 20 },
  caption: { fontFamily: font.body, fontSize: 12, lineHeight: 16 },
  label: { fontFamily: font.bodyBold, fontSize: 11, lineHeight: 14, letterSpacing: 0.4 },
  button: { fontFamily: font.semibold, fontSize: 15, lineHeight: 20, letterSpacing: 0.2 },
} as const;

// ---------------------------------------------------------------------
// 3. Espaciado (escala de 4)
// ---------------------------------------------------------------------
const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 40,
} as const;

// ---------------------------------------------------------------------
// 4. Radios
// ---------------------------------------------------------------------
const radius = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  xxl: 32,
  pill: 999,
} as const;

// ---------------------------------------------------------------------
// 5. Sombras (suaves, multinivel) — multiplataforma
// ---------------------------------------------------------------------
function makeShadow(
  yOffset: number,
  blur: number,
  opacity: number,
  elevation: number,
  color = '#0B2A1E',
) {
  return Platform.select({
    ios: {
      shadowColor: color,
      shadowOffset: { width: 0, height: yOffset },
      shadowOpacity: opacity,
      shadowRadius: blur,
    },
    android: { elevation },
    default: {
      // Web: boxShadow nativo (más fiel que las props RN).
      boxShadow: `0px ${yOffset}px ${blur * 2}px rgba(11, 42, 30, ${opacity})`,
    },
  }) as object;
}

const shadow = {
  none: {},
  sm: makeShadow(2, 6, 0.06, 2),
  card: makeShadow(6, 14, 0.08, 4),
  md: makeShadow(10, 22, 0.1, 8),
  lg: makeShadow(16, 32, 0.14, 14),
  accent: makeShadow(8, 18, 0.28, 8, '#0E8A4F'), //  glow verde para CTAs
} as const;

// ---------------------------------------------------------------------
// 6. Gradientes
// ---------------------------------------------------------------------
const gradient = {
  // Encabezado de marca (oscuro)
  header: ['#106B4F', '#052419'] as const,
  headerSoft: ['#15A862', '#0E7A47'] as const,
  // Splash / pantallas de marca
  brand: ['#052419', '#106B4F', '#052419'] as const,
  // CTA premium (acento)
  accent: ['#1FBE77', '#0E8A4F'] as const,
  // Tarjeta de héroe sutil
  freshMint: ['#EFFBF4', '#DDF5E8'] as const,
  // Fondo premium glassmorphism (profundo, con vida)
  glassBg: ['#072A1E', '#0E5C40', '#06231A'] as const,
} as const;

// ---------------------------------------------------------------------
// 7. Movimiento / animación
// ---------------------------------------------------------------------
const motion = {
  duration: { fast: 150, base: 240, slow: 400 },
  // Para Reanimated entering: usar .delay(i * stagger)
  stagger: 60,
  scale: { pressIn: 0.96, tap: 0.92 },
  spring: { damping: 16, stiffness: 180, mass: 0.7 },
} as const;

// ---------------------------------------------------------------------
// Export principal
// ---------------------------------------------------------------------
export const theme = {
  colors: palette,
  font,
  text,
  spacing,
  radius,
  shadow,
  gradient,
  motion,

  // Compat con consumidores previos:
  headerGradient: gradient.header,
  brandGradient: gradient.brand,
} as const;

export type Theme = typeof theme;

// ---------------------------------------------------------------------
// Compat hacia atrás: objeto `colors` legado usado por algunos componentes.
// ---------------------------------------------------------------------
export const colors = {
  brand: {
    dark: palette.brandGreen,
    accent: palette.brandGreenLight,
    darker: palette.brandDarkest,
  },
  wordmark: {
    text: '#004B2D',
    dot: '#00A651',
  },
  gradient: {
    splash: gradient.brand,
  },
  alpha: {
    accent10: 'rgba(52, 194, 106, 0.1)',
    accent20: 'rgba(52, 194, 106, 0.2)',
    accent30: 'rgba(52, 194, 106, 0.3)',
    dark10: 'rgba(16, 107, 79, 0.1)',
    dark20: 'rgba(16, 107, 79, 0.2)',
  },
} as const;
