/**
 * Design tokens — fuente única de verdad del diseño.
 *
 * Todo el styling de la app sale de acá: colores, espaciado, radios, tipografía
 * y sombras. Los componentes de UI (`src/components/ui`) los consumen siempre a
 * través de `useTheme()`, así un cambio de paleta se propaga a toda la app.
 *
 * Nota: no se usan `fontFamily` propias (Inter/…); el sistema ya provee Roboto
 * en Android y San Francisco en iOS, que se ven nativos y cuestan 0 KB.
 */

// ============================================
// Paleta base
// ============================================
export const palette = {
  // Marca — celeste energético (identidad de la app),
  sky50: '#F0F9FF',
  sky100: '#E0F2FE',
  sky200: '#BAE6FD',
  sky300: '#7DD3FC',
  sky400: '#38BDF8',
  sky500: '#0EA5E9',
  sky600: '#0284C7',
  sky700: '#0369A1',
  sky800: '#075985',

  // Neutros cálidos (slate) — fondo ligeramente cálido, no azulado
  slate50: '#F8FAFC',
  slate100: '#F1F5F9',
  slate200: '#E2E8F0',
  slate300: '#CBD5E1',
  slate400: '#94A3B8',
  slate500: '#64748B',
  slate600: '#475569',
  slate700: '#334155',
  slate800: '#1E293B',
  slate900: '#0F172A',

  // Estados
  green500: '#22C55E',
  green600: '#16A34A',
  green100: '#DCFCE7',
  amber500: '#F59E0B',
  amber600: '#D97706',
  amber100: '#FEF3C7',
  rose500: '#F43F5E',
  rose600: '#E11D48',
  rose100: '#FFE4E6',
  violet500: '#8B5CF6',
  violet100: '#EDE9FE',
  pink500: '#EC4899',
  cyan500: '#06B6D4',
  lime500: '#84CC16',
  orange500: '#F97316',
  indigo500: '#6366F1' } as const;

// ============================================
// Temas
// ============================================
export interface ThemeColors {
  /** Fondo de pantalla */
  bg: string;
  /** Fondo elevado (cards) */
  surface: string;
  /** Fondo sutil dentro de una card (filas, chips, wells) */
  surfaceAlt: string;
  /** Fondo de app bar / headers */
  chrome: string;

  border: string;
  borderStrong: string;

  text: string;
  textMuted: string;
  textSubtle: string;
  textInverse: string;

  primary: string;
  primaryDark: string;
  primarySoft: string;
  onPrimary: string;

  success: string;
  successSoft: string;
  warning: string;
  warningSoft: string;
  danger: string;
  dangerSoft: string;
  accent: string;
  accentSoft: string;

  /** Fondo del campo de texto */
  input: string;
  /** Color del placeholder */
  placeholder: string;

  /** Sombra */
  shadow: string;

  /** Overlay de modales */
  overlay: string;

  /** Rampas para gráficos */
  chart: {
    grid: string;
    axis: string;
    series: string[];
  };
  /** Escala del heatmap de adherencia (0 → 5) */
  heatmap: string[];
}

export const lightColors: ThemeColors = {
  bg: '#F6F7F9',
  surface: '#FFFFFF',
  surfaceAlt: palette.slate100,
  chrome: '#FFFFFF',

  border: '#E7E9EE',
  borderStrong: palette.slate300,

  text: palette.slate900,
  textMuted: palette.slate500,
  textSubtle: palette.slate400,
  textInverse: '#FFFFFF',

  primary: palette.sky500,
  primaryDark: palette.sky600,
  primarySoft: palette.sky100,
  onPrimary: '#FFFFFF',

  success: palette.green600,
  successSoft: palette.green100,
  warning: palette.amber600,
  warningSoft: palette.amber100,
  danger: palette.rose600,
  dangerSoft: palette.rose100,
  accent: palette.violet500,
  accentSoft: palette.violet100,

  input: '#FFFFFF',
  placeholder: palette.slate400,

  shadow: '#0F172A',
  overlay: 'rgba(15, 23, 42, 0.45)',

  chart: {
    grid: 'rgba(100, 116, 139, 0.16)',
    axis: palette.slate300,
    series: [
      palette.sky500,
      palette.violet500,
      palette.green500,
      palette.orange500,
      palette.pink500,
      palette.cyan500,
      palette.indigo500,
      palette.lime500,
    ] },
  heatmap: [
    '#EDF0F4',
    palette.amber100,
    '#FDE68A',
    '#FCD34D',
    '#FBBF24',
    palette.amber500,
  ] };

export const darkColors: ThemeColors = {
  bg: '#0B0F19',
  surface: '#151B2B',
  surfaceAlt: '#1D2436',
  chrome: '#0B0F19',

  border: '#252D42',
  borderStrong: '#39435C',

  text: '#F1F5F9',
  textMuted: '#94A3B8',
  textSubtle: '#64748B',
  textInverse: '#0F172A',

  primary: palette.sky400,
  primaryDark: palette.sky300,
  primarySoft: 'rgba(14, 165, 233, 0.16)',
  onPrimary: '#04121E',

  success: '#4ADE80',
  successSoft: 'rgba(34, 197, 94, 0.16)',
  warning: '#FBBF24',
  warningSoft: 'rgba(245, 158, 11, 0.16)',
  danger: '#FB7185',
  dangerSoft: 'rgba(244, 63, 94, 0.16)',
  accent: '#A78BFA',
  accentSoft: 'rgba(139, 92, 246, 0.16)',

  input: '#111827',
  placeholder: '#64748B',

  shadow: '#000000',
  overlay: 'rgba(0, 0, 0, 0.6)',

  chart: {
    grid: 'rgba(148, 163, 184, 0.18)',
    axis: '#39435C',
    series: [
      palette.sky400,
      '#A78BFA',
      '#4ADE80',
      '#FB923C',
      '#F472B6',
      '#22D3EE',
      '#818CF8',
      '#A3E635',
    ] },
  heatmap: [
    '#1D2436',
    '#4A3B12',
    '#6B5410',
    '#8A6A0E',
    '#A9820C',
    palette.amber500,
  ] };

// ============================================
// Espaciado (escala de 4)
// ============================================
export const spacing = {
  none: 0,
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 40 } as const;

// ============================================
// Radios
// ============================================
export const radius = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  xxl: 32,
  pill: 999 } as const;

// ============================================
// Tipografía (escala)
// ============================================
export const typography = {
  display: { fontSize: 30, fontWeight: '800' as const, letterSpacing: -0.6 },
  title: { fontSize: 24, fontWeight: '700' as const, letterSpacing: -0.4 },
  heading: { fontSize: 18, fontWeight: '700' as const, letterSpacing: -0.2 },
  subheading: { fontSize: 16, fontWeight: '600' as const, letterSpacing: -0.1 },
  body: { fontSize: 15, fontWeight: '500' as const },
  bodyStrong: { fontSize: 15, fontWeight: '700' as const },
  small: { fontSize: 13, fontWeight: '500' as const },
  smallStrong: { fontSize: 13, fontWeight: '700' as const },
  caption: { fontSize: 12, fontWeight: '500' as const },
  micro: { fontSize: 11, fontWeight: '600' as const },
  /** Números grandes (peso, 1RM, volumen) */
  metric: { fontSize: 22, fontWeight: '800' as const, letterSpacing: -0.5 },
  metricSmall: { fontSize: 17, fontWeight: '800' as const, letterSpacing: -0.3 } } as const;

/** Alturas de control (toques mínimos de 44dp según accesibilidad). */
export const sizes = {
  controlSm: 36,
  controlMd: 44,
  controlLg: 52,
  tabBar: 58 } as const;

// ============================================
// Sombras
// ============================================
export function shadow(isDark: boolean, level: 1 | 2 | 3) {
  const map = {
    1: { opacity: isDark ? 0.4 : 0.05, radius: 3, y: 1, elevation: 1 },
    2: { opacity: isDark ? 0.5 : 0.08, radius: 12, y: 4, elevation: 3 },
    3: { opacity: isDark ? 0.6 : 0.12, radius: 24, y: 10, elevation: 8 } }[level];

  return {
    shadowColor: isDark ? '#000000' : '#0F172A',
    shadowOpacity: map.opacity,
    shadowRadius: map.radius,
    shadowOffset: { width: 0, height: map.y },
    elevation: map.elevation };
}

// ============================================
// Tema completo
// ============================================
export interface Theme {
  dark: boolean;
  colors: ThemeColors;
  spacing: typeof spacing;
  radius: typeof radius;
  typography: typeof typography;
  sizes: typeof sizes;
  /** Sombras parametrizadas por esquema */
  shadow: (level: 1 | 2 | 3) => ReturnType<typeof shadow>;
}

export function buildTheme(dark: boolean): Theme {
  return {
    dark,
    colors: dark ? darkColors : lightColors,
    spacing,
    radius,
    typography,
    sizes,
    shadow: (level) => shadow(dark, level) };
}