/**
 * Fundación de tokens del Design System.
 *
 * REQ-A06 · «Tokens del Design System (color, espaciado, radio, tipografía, 44px)»
 * P0-S7   · «Paquete design-system con tokens y test de contraste»
 * DS-08 / INV-105 · ningún estado se comunica solo por color
 *
 * ---------------------------------------------------------------------------
 * ESTADO DE ESTOS VALORES
 *
 * `STUDY_OS_Design_System_v1.0` **no está disponible** en el material de origen
 * (ver `docs/PROVENANCE.md` §3.1 · AMB-01 abierto para ese documento). Por tanto:
 *
 *   - la **estructura** de tokens es la que exige REQ-A06 y es la que los tests
 *     verifican como contrato;
 *   - los **valores cromáticos concretos** son una base provisional coherente con
 *     la dirección «Calm Intelligence» declarada en Manifest §5 y §16, y quedan
 *     sujetos a sustitución cuando el Design System esté disponible.
 *
 * Sustituir un valor no exige ADR. Cambiar la **estructura** —quitar una escala,
 * romper un par de contraste, introducir tokens de gamificación (EC-017)— sí.
 * ---------------------------------------------------------------------------
 */

/** Escala de espaciado en píxeles. Base 4. */
export const SPACING = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  '2xl': 32,
  '3xl': 48,
  '4xl': 64,
} as const;

export type SpacingToken = keyof typeof SPACING;

/** Radios de esquina en píxeles. */
export const RADIUS = {
  none: 0,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
} as const;

export type RadiusToken = keyof typeof RADIUS;

/**
 * Tamaño mínimo de diana táctil.
 *
 * REQ-A06 lo nombra explícitamente (44px) y Manifest §20 lo exige como puerta de
 * accesibilidad. Es un mínimo, no una sugerencia.
 */
export const TOUCH_TARGET_MIN_PX = 44 as const;

/** Tipografía: familias, escala y pesos. Comodidad de lectura editorial (Manifest §16). */
export const TYPOGRAPHY = {
  family: {
    /** Texto largo y contenido de estudio. */
    reading: "'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, serif",
    /** Interfaz, etiquetas y datos. */
    ui: "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
    /** Código y valores técnicos. */
    mono: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace",
  },
  size: {
    xs: 12,
    sm: 14,
    base: 16,
    lg: 18,
    xl: 20,
    '2xl': 24,
    '3xl': 30,
    '4xl': 38,
  },
  lineHeight: {
    tight: 1.2,
    snug: 1.35,
    normal: 1.5,
    /** Lectura larga: interlineado generoso. */
    reading: 1.65,
  },
  weight: {
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
} as const;

/**
 * Color.
 *
 * Cada tema declara los mismos roles. Un rol ausente en un tema es un fallo de
 * tipos, no un problema descubierto en producción.
 */
export interface ColorScale {
  /** Fondo de página. */
  readonly surface: string;
  /** Fondo de superficie elevada (tarjeta, panel). */
  readonly surfaceRaised: string;
  /** Fondo hundido (campo, zona de lectura). */
  readonly surfaceSunken: string;
  /** Texto principal sobre `surface` / `surfaceRaised`. */
  readonly textPrimary: string;
  /** Texto secundario sobre `surface` / `surfaceRaised`. */
  readonly textSecondary: string;
  /** Texto sobre fondos de acento y semánticos. */
  readonly textOnAccent: string;
  /** Separadores no interactivos. */
  readonly border: string;
  /** Bordes de componentes interactivos y contornos de foco. */
  readonly borderStrong: string;
  /** Acento de acción primaria. */
  readonly accent: string;
  /** Acento en estado presionado. */
  readonly accentPressed: string;
  /** Anillo de foco. */
  readonly focusRing: string;
  readonly success: string;
  readonly warning: string;
  readonly danger: string;
  readonly info: string;
}

export const COLOR: Readonly<Record<'light' | 'dark', ColorScale>> = {
  light: {
    surface: '#FBFBFD',
    surfaceRaised: '#FFFFFF',
    surfaceSunken: '#F1F2F6',
    textPrimary: '#14181F',
    textSecondary: '#4A5260',
    textOnAccent: '#FFFFFF',
    border: '#DDE0E7',
    borderStrong: '#6B7280',
    accent: '#2A4FBF',
    accentPressed: '#1E3A93',
    focusRing: '#1E3A93',
    success: '#1B6B45',
    warning: '#7A5200',
    danger: '#A82318',
    info: '#1A5A85',
  },
  dark: {
    surface: '#101318',
    surfaceRaised: '#171B22',
    surfaceSunken: '#0B0E12',
    textPrimary: '#EEF1F6',
    textSecondary: '#B3BCCB',
    textOnAccent: '#0B0E12',
    border: '#2A303A',
    borderStrong: '#8C97A8',
    accent: '#9DB8FF',
    accentPressed: '#7E9EF0',
    focusRing: '#9DB8FF',
    success: '#6FD3A2',
    warning: '#E5B65C',
    danger: '#F09189',
    info: '#7FC1E8',
  },
} as const;

export type ThemeName = keyof typeof COLOR;

/**
 * Pares de contraste que el test `tokens.contrast.spec` verifica.
 *
 * `minRatio` sigue WCAG 2.1 AA: 4.5 para texto normal, 3.0 para texto grande y para
 * componentes de interfaz y contornos de foco (1.4.11).
 */
export interface ContrastRequirement {
  readonly label: string;
  readonly foreground: keyof ColorScale;
  readonly background: keyof ColorScale;
  readonly minRatio: number;
}

export const CONTRAST_REQUIREMENTS: readonly ContrastRequirement[] = [
  {
    label: 'texto principal sobre fondo',
    foreground: 'textPrimary',
    background: 'surface',
    minRatio: 4.5,
  },
  {
    label: 'texto principal sobre superficie elevada',
    foreground: 'textPrimary',
    background: 'surfaceRaised',
    minRatio: 4.5,
  },
  {
    label: 'texto principal sobre superficie hundida',
    foreground: 'textPrimary',
    background: 'surfaceSunken',
    minRatio: 4.5,
  },
  {
    label: 'texto secundario sobre fondo',
    foreground: 'textSecondary',
    background: 'surface',
    minRatio: 4.5,
  },
  {
    label: 'texto secundario sobre superficie elevada',
    foreground: 'textSecondary',
    background: 'surfaceRaised',
    minRatio: 4.5,
  },
  { label: 'texto sobre acento', foreground: 'textOnAccent', background: 'accent', minRatio: 4.5 },
  {
    label: 'texto sobre acento presionado',
    foreground: 'textOnAccent',
    background: 'accentPressed',
    minRatio: 4.5,
  },
  { label: 'texto sobre éxito', foreground: 'textOnAccent', background: 'success', minRatio: 4.5 },
  { label: 'texto sobre aviso', foreground: 'textOnAccent', background: 'warning', minRatio: 4.5 },
  { label: 'texto sobre error', foreground: 'textOnAccent', background: 'danger', minRatio: 4.5 },
  {
    label: 'texto sobre información',
    foreground: 'textOnAccent',
    background: 'info',
    minRatio: 4.5,
  },
  {
    label: 'borde interactivo sobre fondo',
    foreground: 'borderStrong',
    background: 'surface',
    minRatio: 3,
  },
  {
    label: 'anillo de foco sobre fondo',
    foreground: 'focusRing',
    background: 'surface',
    minRatio: 3,
  },
  {
    label: 'anillo de foco sobre superficie elevada',
    foreground: 'focusRing',
    background: 'surfaceRaised',
    minRatio: 3,
  },
] as const;

/**
 * Duraciones de movimiento. Toda animación debe respetar `prefers-reduced-motion`
 * (Manifest §20).
 */
export const MOTION = {
  instant: 0,
  fast: 120,
  base: 200,
  slow: 320,
} as const;

/** Puntos de ruptura responsive, en píxeles. Móvil primero. */
export const BREAKPOINTS = {
  sm: 480,
  md: 768,
  lg: 1024,
  xl: 1280,
} as const;

/**
 * Contrato de tokens que `tokens.contract.spec` verifica.
 *
 * Existe para que quitar una escala completa sea un fallo de test y no un
 * descubrimiento tardío en una pantalla.
 */
export const TOKEN_CONTRACT = {
  requiredScales: ['SPACING', 'RADIUS', 'TYPOGRAPHY', 'COLOR', 'MOTION', 'BREAKPOINTS'] as const,
  requiredColorRoles: [
    'surface',
    'surfaceRaised',
    'surfaceSunken',
    'textPrimary',
    'textSecondary',
    'textOnAccent',
    'border',
    'borderStrong',
    'accent',
    'accentPressed',
    'focusRing',
    'success',
    'warning',
    'danger',
    'info',
  ] as const,
  themes: ['light', 'dark'] as const,
  touchTargetMinPx: TOUCH_TARGET_MIN_PX,
  /**
   * EC-017 · sin XP, monedas, ranking ni economía de rachas. Ningún token puede
   * nombrar estos conceptos.
   */
  forbiddenTokenSubstrings: [
    'xp',
    'coin',
    'streak',
    'leaderboard',
    'badge',
    'trophy',
    'confetti',
  ] as const,
} as const;
