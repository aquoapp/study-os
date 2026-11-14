/**
 * Escenario CORE MVP · CP3.
 *
 * ---------------------------------------------------------------------------
 * Propiedad contractual ≠ trayectoria esperada
 *
 * Este escenario **no dice qué va a pasar**. Dice qué obligaciones deben cumplirse pase lo que
 * pase: que el stream no tenga huecos, que la representación evaluada sea la presentada, que la
 * confianza se registre antes del envío, que la corrección la fije el servidor.
 *
 * No declara cuántas acciones habrá, ni cuántos minutos, ni qué estados quedarán, ni si el día
 * acabará agotado. Si lo hiciera, estaría codificando el resultado que pretende comprobar, y un
 * experimento que ya sabe su resultado no comprueba nada.
 *
 * Por eso tampoco hay ningún valor tomado del recorrido humano: ver `human-reference.ts`.
 * ---------------------------------------------------------------------------
 */

import { createHash } from 'node:crypto';

import { LAB_ACTIONS, type LabAction } from './profile';

export const SCENARIO_ID = 'SC-LAB-CORE-01';
export const SCENARIO_VERSION = '1.0.0';

/** Supuestos de partida. Si no se cumplen, el escenario no aplica. */
export const STARTING_ASSUMPTIONS = [
  'instancia efímera recién creada, con las migraciones canónicas aplicadas',
  'corpus lab-core instalado y verificado',
  'ninguna cuenta previa del aprendiz sintético',
  'una sola ventana temporal real: sin cambio de día',
] as const;

/** Acciones que el aprendiz puede ejecutar. Cualquier otra está fuera del escenario. */
export const ALLOWED_ACTIONS: readonly LabAction[] = LAB_ACTIONS.filter(
  (action) => action !== 'RESUME' || true,
);

export interface ScenarioStep {
  readonly ordinal: number;
  readonly intent: string;
  readonly surface: string;
}

/** Pasos ordenados. Describen **intención**, no resultado. */
export const STEPS: readonly ScenarioStep[] = [
  { ordinal: 1, intent: 'alta de la identidad sintética', surface: '/registro' },
  { ordinal: 2, intent: 'declarar zona horaria y disponibilidad', surface: '/ajustes' },
  {
    ordinal: 3,
    intent: 'elegir el objetivo sobre el corpus del laboratorio',
    surface: '/onboarding',
  },
  { ordinal: 4, intent: 'abrir HOY y leer lo que el sistema decida', surface: '/hoy' },
  { ordinal: 5, intent: 'iniciar la acción que HOY ofrezca', surface: '/hoy' },
  {
    ordinal: 6,
    intent: 'recorrer la acción; interrumpir donde la política lo declara',
    surface: '/aprender o /comprobar',
  },
  { ordinal: 7, intent: 'volver a HOY y continuar si hay continuación', surface: '/hoy' },
  {
    ordinal: 8,
    intent: 'cerrar la sesión cuando el producto la dé por terminada',
    surface: '/fin',
  },
];

/**
 * Propiedades contractuales bajo prueba.
 *
 * Cada una es una obligación del producto con su fuente. Ninguna menciona cantidades concretas
 * de esta ejecución.
 */
export interface ContractProperty {
  readonly id: string;
  readonly statement: string;
  readonly source: string;
  /** Verdadero si afirma la ausencia de algo: exige barrera de completitud. */
  readonly negative: boolean;
}

export const CONTRACT_PROPERTIES: readonly ContractProperty[] = [
  {
    id: 'P-01',
    statement: 'el stream de eventos del aprendiz es contiguo y sin duplicados',
    source: 'ADR-008 · stream_position por usuario sin huecos',
    negative: false,
  },
  {
    id: 'P-02',
    statement: 'cada ítem de pregunta tiene como mucho un intento aceptado',
    source: 'EC-005 · EC-013 · idempotencia de operación',
    negative: false,
  },
  {
    id: 'P-03',
    statement: 'la representación evaluada es la que se presentó',
    source: 'INV-117 · fidelidad de plan y presentación',
    negative: false,
  },
  {
    id: 'P-04',
    statement: 'la confianza se registra antes del envío y se conserva',
    source: 'INV-102 · SD-008 escala v1',
    negative: false,
  },
  {
    id: 'P-05',
    statement: 'la corrección la fija el servidor, no el cliente',
    source: 'INV-101 · la clave no llega al cliente antes del envío',
    negative: false,
  },
  {
    id: 'P-06',
    statement: 'la proyección consumida alcanza la última posición aceptada',
    source: 'ADR-008 · watermark por usuario y proyección',
    negative: false,
  },
  {
    id: 'P-07',
    statement: 'abandonar una pantalla sin enviar no crea evidencia aceptada',
    source: 'EC-002 · autoridad de evento',
    negative: true,
  },
  {
    id: 'P-08',
    statement: 'un concepto sin unidad publicada no se planifica, y eso es escasez de contenido',
    source: 'OBS-4A-B1 · NO_PUBLISHED_UNIT ratificado',
    negative: false,
  },
];

export const COMPLETION_CONDITIONS = [
  'el producto da la sesión por terminada y HOY vuelve a decidir',
  'todas las propiedades aplicables tienen veredicto o INCONCLUSIVE justificado',
] as const;

export const ABORT_CONDITIONS = [
  'la instancia efímera deja de ser la verificada',
  'el corpus instalado no coincide con su contentHash',
  'una acción exigiría una superficie fuera del alcance del Actor',
  'la barrera de observación no puede establecerse y el escenario depende de una aserción negativa',
] as const;

export const REQUIRED_EVIDENCE = [
  'traza de acciones intentadas',
  'conjunto de acciones aceptadas, verificado aparte',
  'lectura de la barrera antes y después',
  'procedencia: build, corpus, perfil, escenario, instancia',
] as const;

/** Reglas de aplicabilidad: cuándo una propiedad **no** aplica a esta ejecución. */
export const APPLICABILITY_RULES = [
  'P-07 solo aplica si el escenario llegó a abandonar una pantalla sin enviar',
  'P-08 solo aplica si el corpus declara escasez estructural',
  'una propiedad cuya precondición no se dio es NOT_APPLICABLE, nunca PASS',
] as const;

export interface ScenarioManifest {
  readonly scenarioId: string;
  readonly scenarioVersion: string;
  readonly startingAssumptions: readonly string[];
  readonly allowedActions: readonly LabAction[];
  readonly steps: readonly ScenarioStep[];
  readonly contractProperties: readonly ContractProperty[];
  readonly completionConditions: readonly string[];
  readonly abortConditions: readonly string[];
  readonly requiredEvidence: readonly string[];
  readonly applicabilityRules: readonly string[];
  readonly scenarioHash: string;
}

export function scenarioManifest(): ScenarioManifest {
  const body = {
    SCENARIO_ID,
    SCENARIO_VERSION,
    STARTING_ASSUMPTIONS,
    STEPS,
    CONTRACT_PROPERTIES,
    COMPLETION_CONDITIONS,
    ABORT_CONDITIONS,
    REQUIRED_EVIDENCE,
    APPLICABILITY_RULES,
  };
  return {
    scenarioId: SCENARIO_ID,
    scenarioVersion: SCENARIO_VERSION,
    startingAssumptions: [...STARTING_ASSUMPTIONS],
    allowedActions: [...ALLOWED_ACTIONS],
    steps: STEPS,
    contractProperties: CONTRACT_PROPERTIES,
    completionConditions: [...COMPLETION_CONDITIONS],
    abortConditions: [...ABORT_CONDITIONS],
    requiredEvidence: [...REQUIRED_EVIDENCE],
    applicabilityRules: [...APPLICABILITY_RULES],
    scenarioHash: createHash('sha256').update(JSON.stringify(body)).digest('hex'),
  };
}
