/**
 * Tokens del Design System.
 *
 * **Fuente:** `STUDY_OS_Design_System_v1.0` §2, §3, §13 — FROZEN FOR MVP HANDOFF.
 * SHA-256 del documento: `62a85885709cc2dc9ed4cffd71ed852ed1e54cf0962940ff53da93dd8c357aa4`
 * (registrado en `docs/PROVENANCE.md`).
 *
 * REQ-A06 · P0-S7 · dirección visual: CALM INTELLIGENCE.
 *
 * ---------------------------------------------------------------------------
 * Dos clases de valor, y conviene no confundirlas
 *
 * **DOCUMENT** · literal del Design System. Cambiarlo contradice un artefacto
 * FROZEN y exige ADR más cambio de especificación versionado (EC-019).
 *
 * **PROVISIONAL** · default de implementación que el documento **no** especifica.
 * Existe porque el código necesita un valor para funcionar, es reversible sin ADR y
 * se sustituye cuando la decisión se tome. Están enumerados en `TOKEN_PROVENANCE`.
 *
 * La entrega anterior afirmaba que «todos los valores proceden del documento». Era
 * falso: el documento no nombra familias tipográficas, ni pesos, ni interlineados,
 * ni anchos de ruptura, ni un color de papel sobre fondos oscuros. Presentar un
 * default como si fuera decisión de marca es la misma clase de error que inventar
 * la paleta, solo que más difícil de detectar.
 *
 * Cuando el documento no especifica algo y el código tampoco lo necesita —el caso
 * más visible es el **tema oscuro**— aquí no aparece nada.
 * ---------------------------------------------------------------------------
 */

/** Escala de espaciado. §2 · «Spacing 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64». */
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

/**
 * Radios. §2 · «micro: 8 · control: 12 · card: 16 · hero/resume: 20».
 *
 * Los nombres son los del documento. `none` y `full` se añaden porque un sistema de
 * radios necesita el caso cero y el caso píldora, y ninguno contradice nada.
 */
export const RADIUS = {
  none: 0,
  micro: 8,
  control: 12,
  card: 16,
  hero: 20,
  full: 9999,
} as const;

export type RadiusToken = keyof typeof RADIUS;

/**
 * Diana táctil mínima.
 *
 * §2 · «Minimum interactive target: 44 × 44 px», reiterado en §14 como requisito
 * P0 de accesibilidad.
 */
export const TOUCH_TARGET_MIN_PX = 44 as const;

/**
 * Tipografía. §2 · «Typography direction».
 *
 * El documento no nombra una familia concreta: pide «a modern humanist/grotesk sans
 * with strong long-form readability». Las pilas de aquí son la lectura mínima de esa
 * instrucción con fuentes de sistema; **no** son una elección de marca y se
 * sustituyen cuando se decida la familia.
 *
 * Los tamaños sí son del documento, que los da como rangos. Se conservan como
 * rangos en lugar de elegir un punto intermedio arbitrario.
 */
export const TYPOGRAPHY = {
  family: {
    /** Texto largo y contenido de estudio · §2 «strong long-form readability». */
    reading:
      "'Segoe UI', system-ui, -apple-system, 'Helvetica Neue', 'Noto Sans', Arial, sans-serif",
    /** Interfaz, etiquetas y datos. */
    ui: "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
    /** §2 · «Use tabular numerals for timers, readiness and numeric study data». */
    numeric: "'Segoe UI', system-ui, ui-sans-serif, sans-serif",
    mono: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace",
  },
  /** §2 · rangos declarados por el documento. */
  size: {
    metadataMin: 12,
    metadataMax: 13,
    secondaryMin: 14,
    secondaryMax: 15,
    bodyMin: 16,
    bodyMax: 18,
    titleMin: 20,
    titleMax: 24,
    headlineMin: 28,
    headlineMax: 34,
  },
  lineHeight: {
    tight: 1.2,
    snug: 1.35,
    normal: 1.5,
    reading: 1.65,
  },
  weight: {
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
  /** §2 · numerales tabulares para temporizadores y datos numéricos. */
  numericVariant: 'tabular-nums',
} as const;

/**
 * Paleta. §2 · «Core tokens · Colour».
 *
 * Los diez valores son literales del documento. El nombre de cada rol conserva el
 * del documento para que la trazabilidad sea directa.
 *
 * El documento define **una sola paleta**. No especifica tema oscuro, así que aquí
 * no hay ninguno: un tema oscuro exigiría decidir diez colores más, y eso es una
 * decisión de diseño que no corresponde tomar aquí.
 */
export const COLOR = {
  /** Fondo de página · Canvas / Warm Ivory. */
  canvas: '#F7F3EA',
  /** Superficie elevada · Surface / Soft White. */
  surface: '#FFFDF9',
  /** Texto principal · Deep Ink. */
  ink: '#17262D',
  /** Acción primaria · Primary / Deep Navy. */
  navy: '#0B2D3A',
  /** Adaptación y estados de aprendizaje · Adaptive / Teal. */
  teal: '#2B8C8C',
  /** Micro-acento, y solo eso · Signature / Magenta. */
  magenta: '#C13A8B',
  /** Éxito · Success / Forest. */
  forest: '#2F6B57',
  /** Aviso · Warning / Amber. */
  amber: '#A56A18',
  /** Error · Error / Brick. */
  brick: '#A8473F',
  /** Texto secundario y bordes · Muted / Slate. */
  slate: '#66757C',
  /** Papel sobre fondos oscuros. No es un token de marca de §2: es Soft White. */
  onDark: '#FFFDF9',
} as const;

export type ColorToken = keyof typeof COLOR;

/**
 * Roles semánticos sobre la paleta.
 *
 * §2 · «No semantic state may depend on colour alone», reiterado en §14. Cada rol
 * declara el primer plano que sí alcanza el contraste exigido: el color acompaña a
 * la etiqueta y al icono, nunca los sustituye.
 */
export const SEMANTIC_ROLES = {
  accent: { background: 'navy', foreground: 'onDark' },
  success: { background: 'forest', foreground: 'onDark' },
  error: { background: 'brick', foreground: 'onDark' },
  signature: { background: 'magenta', foreground: 'onDark' },
} as const satisfies Record<string, { background: ColorToken; foreground: ColorToken }>;

/**
 * Colores que **no** pueden llevar texto normal encima.
 *
 * Con la paleta congelada, ningún primer plano alcanza 4.5:1 sobre ellos:
 * `onDark` sobre `teal` da 3.95 y sobre `amber` 4.42. Se acotan aquí a superficies
 * no textuales —indicadores, bordes, iconografía, texto grande— para que la
 * limitación sea explícita y no se descubra en una auditoría de accesibilidad.
 *
 * La contradicción entre §2 (paleta) y §14 (AA como P0) está registrada como
 * **SD-019** y bloquea el cierre de REQ-A06.
 */
export const NON_TEXT_BACKGROUNDS = ['teal', 'amber'] as const;

export type NonTextBackground = (typeof NON_TEXT_BACKGROUNDS)[number];

/** Movimiento, en milisegundos. §13. */
export const MOTION = {
  answerSubmitMin: 150,
  answerSubmitMax: 220,
  sessionResumeMin: 200,
  sessionResumeMax: 300,
  replanMin: 250,
  replanMax: 350,
  masteryStateChange: 200,
  drawerMin: 180,
  drawerMax: 240,
  progressRevealMin: 250,
  progressRevealMax: 400,
} as const;

/**
 * Retícula. §3 · «Layout».
 *
 * El documento describe tres contextos por número de columnas y márgenes, no por
 * anchos de ruptura. Los anchos de `BREAKPOINTS` son los mínimos coherentes con la
 * única referencia numérica que da: 390 px lógicos en móvil.
 */
export const LAYOUT = {
  mobile: {
    referenceWidth: 390,
    referenceHeight: 844,
    columns: 4,
    marginMin: 16,
    marginMax: 20,
    gutter: 12,
  },
  tablet: { columns: 8, marginMin: 24 },
  desktop: { columns: 12, marginMin: 32, marginMax: 48 },
} as const;

export const BREAKPOINTS = {
  mobile: 390,
  tablet: 768,
  desktop: 1024,
  wide: 1280,
} as const;

/**
 * Pares de contraste verificados por `tokens.contrast.spec`.
 *
 * WCAG 2.1 AA: 4.5 para texto normal; 3.0 para texto grande, componentes de
 * interfaz y contornos de foco (1.4.11). §14 lo exige como P0.
 */
export interface ContrastRequirement {
  readonly label: string;
  readonly foreground: ColorToken;
  readonly background: ColorToken;
  readonly minRatio: number;
}

export const CONTRAST_REQUIREMENTS: readonly ContrastRequirement[] = [
  { label: 'texto principal sobre canvas', foreground: 'ink', background: 'canvas', minRatio: 4.5 },
  {
    label: 'texto principal sobre superficie',
    foreground: 'ink',
    background: 'surface',
    minRatio: 4.5,
  },
  {
    label: 'texto secundario sobre superficie',
    foreground: 'slate',
    background: 'surface',
    minRatio: 4.5,
  },
  {
    label: 'texto sobre acción primaria',
    foreground: 'onDark',
    background: 'navy',
    minRatio: 4.5,
  },
  { label: 'texto sobre éxito', foreground: 'onDark', background: 'forest', minRatio: 4.5 },
  { label: 'texto sobre error', foreground: 'onDark', background: 'brick', minRatio: 4.5 },
  { label: 'texto sobre micro-acento', foreground: 'onDark', background: 'magenta', minRatio: 4.5 },
  {
    label: 'acción primaria como texto sobre canvas',
    foreground: 'navy',
    background: 'canvas',
    minRatio: 4.5,
  },
  {
    label: 'éxito como texto sobre canvas',
    foreground: 'forest',
    background: 'canvas',
    minRatio: 4.5,
  },
  {
    label: 'error como texto sobre canvas',
    foreground: 'brick',
    background: 'canvas',
    minRatio: 4.5,
  },
  // Componentes de interfaz y contornos: 3:1 (WCAG 1.4.11).
  {
    label: 'borde y metadato sobre canvas',
    foreground: 'slate',
    background: 'canvas',
    minRatio: 3,
  },
  { label: 'contorno de foco sobre canvas', foreground: 'navy', background: 'canvas', minRatio: 3 },
  {
    label: 'contorno de foco sobre superficie',
    foreground: 'navy',
    background: 'surface',
    minRatio: 3,
  },
  {
    label: 'indicador adaptativo sobre canvas',
    foreground: 'teal',
    background: 'canvas',
    minRatio: 3,
  },
  {
    label: 'aviso como indicador sobre canvas',
    foreground: 'amber',
    background: 'canvas',
    minRatio: 3,
  },
  {
    label: 'micro-acento como indicador sobre canvas',
    foreground: 'magenta',
    background: 'canvas',
    minRatio: 3,
  },
] as const;

/** Contrato de tokens que `tokens.contract.spec` verifica. */
export const TOKEN_CONTRACT = {
  source: 'STUDY_OS_Design_System_v1.0',
  requiredScales: [
    'SPACING',
    'RADIUS',
    'TYPOGRAPHY',
    'COLOR',
    'MOTION',
    'BREAKPOINTS',
    'LAYOUT',
  ] as const,
  /** Los diez colores de §2, más el papel para fondos oscuros. */
  requiredColorTokens: [
    'canvas',
    'surface',
    'ink',
    'navy',
    'teal',
    'magenta',
    'forest',
    'amber',
    'brick',
    'slate',
    'onDark',
  ] as const,
  touchTargetMinPx: TOUCH_TARGET_MIN_PX,
  /**
   * §15 · anti-patrones prohibidos, y EC-017 · sin economía de compromiso. Ningún
   * token puede nombrar estos conceptos.
   */
  forbiddenTokenSubstrings: [
    'xp',
    'coin',
    'streak',
    'leaderboard',
    'badge',
    'trophy',
    'confetti',
    'sparkle',
    'mascot',
    'orb',
    'glow',
  ] as const,
} as const;

/**
 * Procedencia de cada valor.
 *
 * `DOCUMENT` es literal del Design System §2, §3 o §13: cambiarlo contradice un
 * artefacto FROZEN y exige ADR más cambio de especificación versionado (EC-019).
 *
 * `PROVISIONAL` es un default de implementación que el documento **no** especifica.
 * Existe porque el código necesita un valor, es reversible sin ADR y se sustituye
 * cuando la decisión se tome.
 *
 * Está aquí para que la distinción sea legible por máquina y no dependa de que
 * alguien recuerde qué salió del PDF. `tokens.provenance.spec` comprueba que la
 * clasificación cubre todo lo exportado.
 */
export const TOKEN_PROVENANCE = {
  document: {
    'COLOR (los diez de §2)':
      'canvas · surface · ink · navy · teal · magenta · forest · amber · brick · slate',
    'SPACING (todos)': '4 · 8 · 12 · 16 · 24 · 32 · 48 · 64',
    'RADIUS.micro/control/card/hero': '8 · 12 · 16 · 20',
    TOUCH_TARGET_MIN_PX: '44 × 44 px · §2 y §14',
    'TYPOGRAPHY.size (todos los rangos)': '12–13 · 14–15 · 16–18 · 20–24 · 28–34',
    'TYPOGRAPHY.numericVariant': 'numerales tabulares · §2',
    'MOTION (las once duraciones)': '§13',
    'LAYOUT (columnas, márgenes, referencia móvil)': '§3',
  },

  provisional: {
    'COLOR.onDark':
      'El documento no nombra un color de papel sobre fondos oscuros. Se usa Soft White, que sí es suyo, pero el rol es una decisión de implementación.',
    'RADIUS.none': 'Un sistema de radios necesita el caso cero. El documento no lo declara.',
    'RADIUS.full': 'Caso píldora. El documento no lo declara.',
    'SPACING.none': 'El cero de la escala. El documento empieza en 4.',
    'TYPOGRAPHY.family':
      '§2 pide «a modern humanist/grotesk sans» y no nombra ninguna. Las pilas son de sistema y se sustituyen al decidir la familia.',
    'TYPOGRAPHY.weight': 'El documento no declara pesos. 400/500/600/700 es la escala habitual.',
    'TYPOGRAPHY.lineHeight':
      'El documento no declara interlineados. `reading: 1.65` responde a «editorial reading comfort» de §16, pero el número es propio.',
    BREAKPOINTS:
      '§3 describe tres contextos por columnas y márgenes, no por anchos. Los anchos son mínimos coherentes con la única referencia numérica que da (390 px).',
    SEMANTIC_ROLES:
      'El emparejamiento fondo/primer plano es una decisión de accesibilidad tomada al aplicar SD-019 opción A, no una tabla del documento.',
    NON_TEXT_BACKGROUNDS:
      'Consecuencia medida de SD-019: el documento no marca ningún color como no apto para texto.',
    CONTRAST_REQUIREMENTS:
      'La lista de pares a verificar la define este repositorio. §14 exige AA; qué pares comprobar es decisión de implementación.',
  },
} as const;
