/**
 * Corpus controlado del laboratorio · CP3.
 *
 * ---------------------------------------------------------------------------
 * Qué es este corpus y por qué es tan aburrido
 *
 * Es contenido **sintético, neutro y deliberadamente insulso**. No enseña nada, no imita a
 * ningún temario oficial y no reutiliza TAI. Su único trabajo es dar al escenario material
 * suficiente para recorrerlo sin agotarse por accidente.
 *
 * Tres propiedades que no son adorno:
 *
 *   1. **Determinista.** El contenido está escrito aquí, literal. No hay generador, ni azar, ni
 *      fecha. Dos instalaciones producen el mismo `contentHash`.
 *   2. **Dimensionado.** Hay más preguntas por concepto de las que el escenario consume, para
 *      que un agotamiento nunca se confunda con una patología del Planner.
 *   3. **Con una escasez declarada.** Un concepto se queda **a propósito** sin unidad publicada,
 *      para poder comprobar que `NO_PUBLISHED_UNIT` se clasifica como escasez de contenido y no
 *      como defecto de decisión. La escasez forma parte del experimento, no es un descuido.
 *
 * Las claves de respuesta viven donde el producto las pone —`content.answer_key_versions`, por
 * la frontera de ingestión— y **no se exponen al Actor**: ver `lab/src/profile.ts`.
 * ---------------------------------------------------------------------------
 */

import { createHash } from 'node:crypto';

export const CORPUS_ID = 'lab-core';
export const CORPUS_VERSION = '1.0.0';
/**
 * Slug del pack en el producto.
 *
 * `exam_packs_slug_format` exige `^[a-z0-9]+(-[a-z0-9]+)*$` (migración 4): **sin puntos**. La
 * primera versión de este slug era `lab-core-1.0.0` y el producto la rechazaba, con razón;
 * nada lo detectó porque ninguna prueba instalaba el corpus.
 *
 * Los puntos de la versión se sustituyen por guiones. El slug **no entra** en
 * `corpusContentHash`, de modo que la identidad congelada del corpus no cambia por esto.
 */
export const CORPUS_SLUG = `${CORPUS_ID}-${CORPUS_VERSION.replace(/\./g, '-')}`;

export const OPTION_KEYS = ['A', 'B', 'C', 'D'] as const;

export interface CorpusConcept {
  readonly key: string;
  readonly title: string;
  /** Falso solo en el caso de escasez estructural declarada. */
  readonly hasUnit: boolean;
}

export interface CorpusUnit {
  readonly concept: string;
  readonly title: string;
  readonly body: string;
  /** ADR-013 §2.1 · la duración es autoría, nunca inferencia. Obligatoria. */
  readonly minutes: number;
}

export interface CorpusQuestion {
  readonly key: string;
  readonly concept: string;
  readonly stem: string;
  readonly options: readonly [string, string, string, string];
  /** Índice de la opción correcta. **El Actor nunca ve este campo.** */
  readonly correct: 0 | 1 | 2 | 3;
  readonly explanation: string;
}

export const CONCEPTS: readonly CorpusConcept[] = [
  { key: 'c1', title: 'Unidades de medida sintéticas', hasUnit: true },
  { key: 'c2', title: 'Ordenación de series neutras', hasUnit: true },
  { key: 'c3', title: 'Correspondencias entre figuras', hasUnit: true },
  // Escasez estructural **declarada**: sin unidad publicada, nunca planificable.
  { key: 'c4', title: 'Concepto sin material asociado', hasUnit: false },
];

export const UNITS: readonly CorpusUnit[] = [
  {
    concept: 'c1',
    title: 'Unidades de medida sintéticas',
    body: 'Una unidad sintética equivale a diez subunidades. Las conversiones se hacen multiplicando o dividiendo por diez.',
    minutes: 4,
  },
  {
    concept: 'c2',
    title: 'Ordenación de series neutras',
    body: 'Una serie neutra se ordena de menor a mayor. Cuando dos elementos coinciden, se conserva el orden de aparición.',
    minutes: 5,
  },
  {
    concept: 'c3',
    title: 'Correspondencias entre figuras',
    body: 'Dos figuras se corresponden cuando tienen el mismo número de lados. El tamaño no interviene en la correspondencia.',
    minutes: 3,
  },
];

/**
 * Tres preguntas por concepto con unidad.
 *
 * El escenario MVP consume **una** por concepto; las otras dos existen para que el agotamiento
 * no pueda ocurrir por accidente durante la ejecución.
 */
export const QUESTIONS: readonly CorpusQuestion[] = [
  {
    key: 'q-c1-1',
    concept: 'c1',
    stem: '¿A cuántas subunidades equivale una unidad sintética?',
    options: ['A cinco', 'A diez', 'A cien', 'A una'],
    correct: 1,
    explanation: 'Una unidad sintética equivale a diez subunidades.',
  },
  {
    key: 'q-c1-2',
    concept: 'c1',
    stem: '¿Cómo se convierte de unidades a subunidades?',
    options: ['Multiplicando por diez', 'Restando diez', 'Dividiendo por dos', 'No se convierte'],
    correct: 0,
    explanation: 'Se multiplica por diez.',
  },
  {
    key: 'q-c1-3',
    concept: 'c1',
    stem: '¿Cuántas unidades son veinte subunidades?',
    options: ['Veinte', 'Diez', 'Dos', 'Doscientas'],
    correct: 2,
    explanation: 'Veinte subunidades son dos unidades.',
  },
  {
    key: 'q-c2-1',
    concept: 'c2',
    stem: '¿Cómo se ordena una serie neutra?',
    options: ['De mayor a menor', 'De menor a mayor', 'Al azar', 'Por longitud del nombre'],
    correct: 1,
    explanation: 'Una serie neutra se ordena de menor a mayor.',
  },
  {
    key: 'q-c2-2',
    concept: 'c2',
    stem: 'Si dos elementos coinciden, ¿qué orden se conserva?',
    options: ['El de aparición', 'El alfabético', 'El inverso', 'Ninguno'],
    correct: 0,
    explanation: 'Se conserva el orden de aparición.',
  },
  {
    key: 'q-c2-3',
    concept: 'c2',
    stem: '¿Interviene el tamaño en la ordenación de una serie neutra?',
    options: ['Siempre', 'Solo al final', 'No', 'Solo con tres elementos'],
    correct: 2,
    explanation: 'El tamaño no interviene.',
  },
  {
    key: 'q-c3-1',
    concept: 'c3',
    stem: '¿Cuándo se corresponden dos figuras?',
    options: ['Con el mismo color', 'Con el mismo número de lados', 'Con el mismo tamaño', 'Nunca'],
    correct: 1,
    explanation: 'Se corresponden cuando tienen el mismo número de lados.',
  },
  {
    key: 'q-c3-2',
    concept: 'c3',
    stem: '¿Interviene el tamaño en la correspondencia entre figuras?',
    options: ['Sí', 'No', 'Solo en triángulos', 'Solo en cuadrados'],
    correct: 1,
    explanation: 'El tamaño no interviene.',
  },
  {
    key: 'q-c3-3',
    concept: 'c3',
    stem: 'Dos figuras de cuatro lados, ¿se corresponden?',
    options: ['Sí', 'No', 'Solo si son iguales', 'Falta información'],
    correct: 0,
    explanation: 'Sí: tienen el mismo número de lados.',
  },
];

/** Lo que el laboratorio instala, sin claves ni explicaciones. */
export interface CorpusManifest {
  readonly corpusId: string;
  readonly corpusVersion: string;
  readonly slug: string;
  readonly conceptCount: number;
  readonly conceptsWithUnit: number;
  readonly structuralScarcityConcepts: readonly string[];
  readonly unitCount: number;
  readonly questionCount: number;
  readonly questionsPerConcept: Readonly<Record<string, number>>;
  readonly totalAuthoredMinutes: number;
  readonly contentHash: string;
}

/**
 * Huella del contenido.
 *
 * Incluye enunciados, opciones y duraciones —todo lo que define el material— **y también las
 * claves**, porque un corpus con otra clave es otro corpus. El hash es un digest: no revela la
 * clave, y el manifiesto que se publica no la contiene.
 */
export function corpusContentHash(): string {
  const material = JSON.stringify({ CONCEPTS, UNITS, QUESTIONS, version: CORPUS_VERSION });
  return createHash('sha256').update(material).digest('hex');
}

export function corpusManifest(): CorpusManifest {
  const perConcept: Record<string, number> = {};
  for (const question of QUESTIONS) {
    perConcept[question.concept] = (perConcept[question.concept] ?? 0) + 1;
  }
  return {
    corpusId: CORPUS_ID,
    corpusVersion: CORPUS_VERSION,
    slug: CORPUS_SLUG,
    conceptCount: CONCEPTS.length,
    conceptsWithUnit: CONCEPTS.filter((concept) => concept.hasUnit).length,
    structuralScarcityConcepts: CONCEPTS.filter((concept) => !concept.hasUnit).map(
      (concept) => concept.key,
    ),
    unitCount: UNITS.length,
    questionCount: QUESTIONS.length,
    questionsPerConcept: perConcept,
    totalAuthoredMinutes: UNITS.reduce((total, unit) => total + unit.minutes, 0),
    contentHash: corpusContentHash(),
  };
}

export class CorpusInvalid extends Error {
  constructor(message: string) {
    super(`corpus · ${message}`);
    this.name = 'CorpusInvalid';
  }
}

/** Comprobaciones que deben cumplirse antes de instalar nada. */
export function assertCorpusWellFormed(): void {
  const conceptKeys = new Set(CONCEPTS.map((concept) => concept.key));

  for (const unit of UNITS) {
    if (!conceptKeys.has(unit.concept)) {
      throw new CorpusInvalid(`la unidad "${unit.title}" cuelga de un concepto inexistente`);
    }
    if (!Number.isInteger(unit.minutes) || unit.minutes < 1) {
      throw new CorpusInvalid(
        `la unidad "${unit.title}" no declara duración de autoría válida (ADR-013 §2.1)`,
      );
    }
  }

  const withUnit = new Set(UNITS.map((unit) => unit.concept));
  for (const concept of CONCEPTS) {
    if (concept.hasUnit !== withUnit.has(concept.key)) {
      throw new CorpusInvalid(
        `el concepto "${concept.key}" declara hasUnit=${concept.hasUnit} y el corpus dice lo ` +
          'contrario. La escasez estructural se declara, no se descubre.',
      );
    }
  }

  const keys = new Set<string>();
  for (const question of QUESTIONS) {
    if (keys.has(question.key)) throw new CorpusInvalid(`pregunta duplicada: ${question.key}`);
    keys.add(question.key);
    if (!conceptKeys.has(question.concept)) {
      throw new CorpusInvalid(`la pregunta ${question.key} cuelga de un concepto inexistente`);
    }
    if (new Set(question.options).size !== question.options.length) {
      throw new CorpusInvalid(`la pregunta ${question.key} repite opciones`);
    }
  }
}
