import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { SERVER_AUTHORITATIVE_PROJECTIONS } from '@study-os/domain';

import { REPO_ROOT } from './lib/run-guard';

/**
 * `phase3.governance.spec` · aterrizaje de gobernanza de Phase 3 · Learning Engine.
 *
 * ---------------------------------------------------------------------------
 * Qué vigila este fichero
 *
 * El 2026-09-10 Ana Victoria aceptó el `Learning Engine Contract v1.0` con diez decisiones
 * humanas y dos correcciones (`docs/PHASE_3_GOVERNANCE_AUTHORIZATION.md`). El aterrizaje es
 * **solo de gobernanza**: no crea ninguna tabla, ninguna migración y ningún objeto de runtime.
 *
 * Un contrato semántico que solo vive en prosa se erosiona en la fase siguiente. Este fichero
 * convierte en mecánico lo que se puede comprobar sin motor:
 *
 *   1. el contrato existe, es canónico y no conserva estado de propuesta;
 *   2. las diecinueve comprobaciones del red team de gobernanza (§5 de la autorización);
 *   3. lo congelado sigue congelado: `spec/` intacto por hash y cuerpo del SPEC_DIFF_LOG
 *      inalterado;
 *   4. **nada de Phase 3 ha llegado al esquema**, y el registro de alcance negativo no se ha
 *      relajado: su actualización es prerrequisito del BUILD, no de este aterrizaje.
 * ---------------------------------------------------------------------------
 */

const read = (relative: string) => readFileSync(join(REPO_ROOT, relative), 'utf8');
const flat = (text: string) => text.replace(/\s+/g, ' ');
const sha256 = (relative: string) =>
  createHash('sha256')
    .update(readFileSync(join(REPO_ROOT, relative)))
    .digest('hex');

const CONTRACT = 'docs/LEARNING_ENGINE_CONTRACT.md';
const AUTHORIZATION = 'docs/PHASE_3_GOVERNANCE_AUTHORIZATION.md';
const ADR_003 = 'architecture/ADR-003-mastery-vs-readiness.md';
const ADR_008 = 'architecture/ADR-008-per-user-event-order-and-idempotency.md';
const LOG = 'docs/SPEC_DIFF_LOG.md';

const contract = read(CONTRACT);
const authorization = read(AUTHORIZATION);
const log = read(LOG);

/** Estados categóricos autoritativos del motor v1 (H-P3-7). */
const V1_STATES = [
  'NEW',
  'EXPOSED',
  'EVIDENCE_POSITIVE',
  'EVIDENCE_NEGATIVE',
  'EVIDENCE_CONFLICTING',
];

/** Vocabulario heredado que v1 **no emite** y que no se redefine. */
const RESERVED_STATES = ['LEARNING', 'CONSOLIDATING', 'MASTERED', 'STRONG'];

describe('el contrato canónico existe y no conserva estado de propuesta', () => {
  it('está en `docs/` y es `ACCEPTED` v1.0 con su decisora', () => {
    expect(existsSync(join(REPO_ROOT, CONTRACT))).toBe(true);
    expect(contract).toMatch(/^# STUDY OS · Learning Engine Contract · v1\.0$/m);
    expect(contract).toContain('`ACCEPTED` · 2026-09-10');
    expect(contract).toContain('Ana Victoria');
    expect(contract).toContain(AUTHORIZATION);
  });

  it('no se presenta como propuesta ni como borrador', () => {
    // §14 de la autorización: el contrato canónico no conserva estado PROPOSAL.
    expect(contract).not.toMatch(/\bPROPOSAL\b/);
    expect(contract).not.toMatch(/^STATUS: PROPOSED/m);
    expect(contract).not.toMatch(/\bDRAFT\b(?!\s*→)/);
  });

  it('declara que no autoriza BUILD', () => {
    const flatText = flat(contract);
    expect(flatText).toContain('No autoriza BUILD');
    expect(flatText).toContain('autorización humana independiente y posterior');
  });

  it('la autorización registra las diez decisiones y las dos correcciones', () => {
    for (const decision of [
      'H-P3-1',
      'H-P3-2',
      'H-P3-3',
      'H-P3-4',
      'H-P3-5',
      'H-P3-6',
      'H-P3-7',
      'H-P3-8',
      'H-P3-9',
      'H-P3-10',
    ]) {
      expect(authorization, `falta ${decision}`).toContain(decision);
    }
    // Corrección §7 (EC-006 no se debilita) y §10 (trazabilidad del recuento 3).
    expect(authorization).toContain('EC-006 NO SE DEBILITA');
    expect(authorization).toContain('TRAZABILIDAD DE LA FUENTE');
  });
});

describe('red team de gobernanza · A … S', () => {
  it('A · ninguna puntuación numérica de mastery sigue siendo autoritativa en v1', () => {
    const flatText = flat(contract);
    expect(flatText).toContain('No hay ninguna puntuación numérica autoritativa de mastery en v1');
    expect(flatText).toContain('`mastery_score_internal` y `stability_score` numérico');
    expect(flatText).toContain('quedan superseded');
    // Y no se cuela por otro nombre.
    expect(flatText).toContain(
      'se admite porcentaje sustituto, puntuación normalizada, probabilidad ni pseudopuntuación oculta',
    );
    // El vector de la proyección no declara ningún campo de puntuación.
    const vector = contract.slice(
      contract.indexOf('### 5.2 · Campos del vector'),
      contract.indexOf('### 5.3 ·'),
    );
    expect(vector.length).toBeGreaterThan(0);
    for (const forbidden of ['mastery_score', 'stability_score', 'readiness_score', 'score_']) {
      expect(vector, `el vector declara ${forbidden}`).not.toContain(forbidden);
    }
  });

  it('B · ningún peso oculto influye en el estado emitido de v1', () => {
    const flatText = flat(contract);
    expect(flatText).toContain('Sin puntuación no hay pesos');
    expect(flatText).toContain('no se usan y no se redistribuyen');
    expect(flatText).toContain('cero parámetros numéricos de aprendizaje');
    // La función de estado no menciona ningún peso ni coeficiente.
    const stateFn = contract.slice(
      contract.indexOf('### 9.1 · Vocabulario autoritativo v1'),
      contract.indexOf('### 9.2 ·'),
    );
    expect(stateFn.length).toBeGreaterThan(0);
    for (const forbidden of ['peso', 'weight', 'coeficiente', '0.3', '.30']) {
      expect(stateFn, `la función de estado menciona ${forbidden}`).not.toContain(forbidden);
    }
  });

  it('C · los intentos de diagnóstico no afectan al estado autoritativo de v1', () => {
    const eligibility = contract.slice(
      contract.indexOf('### 5.1 · Elegibilidad'),
      contract.indexOf('### 5.2 ·'),
    );
    expect(flat(eligibility)).toContain('`diagnostic_run_id` **es nulo**');
    expect(flat(contract)).toContain('no contribuyen al estado autoritativo');
    // Se contabilizan aparte: la política futura no exige backfill.
    expect(contract).toContain('diagnostic_attempt_count');
    expect(flat(authorization)).toContain(
      'Los intentos de diagnóstico **no contribuyen al estado de aprendizaje autoritativo** en el motor v1',
    );
    expect(flat(authorization)).toContain('su corrección y su confianza **no alteran** el estado');
  });

  it('D · `Dominado` no puede emitirse mientras la suficiencia esté sin fijar', () => {
    const visible = contract.slice(contract.indexOf('## 23 · Estados visibles'));
    expect(visible).toContain('✓ Dominado');
    expect(flat(visible)).toContain('**no alcanzable** · `mastery_sufficiency` sin fijar');
    const policies = contract.slice(
      contract.indexOf('## 22 · Políticas explícitamente sin fijar'),
      contract.indexOf('## 23 ·'),
    );
    expect(flat(policies)).toContain('`mastery_sufficiency` | **sin fijar** · DEF-30');
  });

  it('E · `Repaso pendiente` no puede emitirse mientras los intervalos estén sin fijar', () => {
    const visible = contract.slice(contract.indexOf('## 23 · Estados visibles'));
    expect(flat(visible)).toContain('**no alcanzable** · `review_intervals` sin fijar');
    expect(flat(contract)).toContain('`review_intervals` queda sin fijar en v1');
    expect(flat(contract)).toContain('`next_review_at` es `NULL`');
  });

  it('F · `Preparado para examen` no puede emitirse a nivel de concepto', () => {
    const visible = contract.slice(contract.indexOf('## 23 · Estados visibles'));
    expect(flat(visible)).toContain('**nunca a nivel de concepto** · BD-04');
    expect(flat(contract)).toContain('**no se emite** a nivel de concepto');
    expect(read(ADR_003)).toContain('BD-04 · CERRADA · opción A');
  });

  it('G · la evidencia contradictoria tiene un estado autoritativo explícito', () => {
    const stateFn = contract.slice(
      contract.indexOf('### 9.1 · Vocabulario autoritativo v1'),
      contract.indexOf('### 9.2 ·'),
    );
    for (const state of V1_STATES) {
      expect(stateFn, `falta el estado ${state}`).toContain(state);
    }
    expect(flat(stateFn)).toContain(
      '`eligible > 0`, `ever_correct > 0`, `ever_incorrect > 0` | `EVIDENCE_CONFLICTING`',
    );
    // Y el motivo de la supersesión queda registrado donde gobierna.
    expect(flat(read(ADR_003))).toContain(
      'la escalera monótona heredada no puede representar evidencia contradictoria',
    );
  });

  it('G-bis · el vocabulario heredado queda reservado y no se emite ni se redefine', () => {
    const reserved = contract.slice(
      contract.indexOf('### 9.2 · Vocabulario heredado'),
      contract.indexOf('## 10 · Puntuación'),
    );
    expect(reserved.length).toBeGreaterThan(0);
    for (const state of RESERVED_STATES) {
      expect(reserved, `falta el estado reservado ${state}`).toContain(state);
    }
    expect(flat(reserved)).toContain('**no se emiten** como estado autoritativo de v1');
    expect(flat(reserved)).toContain('**no se redefinen**');
    // No aparecen en la función de estado autoritativa.
    const stateFn = contract.slice(
      contract.indexOf('### 9.1 · Vocabulario autoritativo v1'),
      contract.indexOf('### 9.2 ·'),
    );
    for (const state of RESERVED_STATES) {
      expect(stateFn, `${state} es alcanzable en la función de estado`).not.toContain(state);
    }
  });

  it('H · la evidencia cero no se representa como mastery numérica cero', () => {
    const flatText = flat(contract);
    expect(flatText).toContain('El cero nunca significa desconocido');
    expect(flatText).toContain('no existe ninguna columna de puntuación que pueda valer cero');
    expect(flatText).toContain('`NO_EVIDENCE` | `eligible = 0`');
  });

  it('I · la confianza no puede convertirse silenciosamente en mastery', () => {
    const flatText = flat(contract);
    expect(flatText).toContain('La confianza **no participa en el estado de conocimiento**');
    expect(flatText).toContain('no puede convertirse en mastery');
    // Comprobación estructural: ninguna condición de la función de estado usa confianza.
    const stateFn = contract.slice(
      contract.indexOf('### 9.1 · Vocabulario autoritativo v1'),
      contract.indexOf('### 9.2 ·'),
    );
    for (const forbidden of ['confidence', 'confianza']) {
      expect(stateFn, `la función de estado usa ${forbidden}`).not.toContain(forbidden);
    }
  });

  it('J · el tiempo por sí solo no puede degradar el estado', () => {
    const flatText = flat(contract);
    expect(flatText).toContain('Sin decaimiento. Sin curva de retención. Sin semivida');
    expect(flatText).toContain(
      'El paso del tiempo por sí solo no puede bajar el estado autoritativo',
    );
    // Comprobación estructural: la función de estado no depende de ninguna marca temporal.
    const stateFn = contract.slice(
      contract.indexOf('### 9.1 · Vocabulario autoritativo v1'),
      contract.indexOf('### 9.2 ·'),
    );
    for (const forbidden of ['_at`', 'días', 'tiempo', 'decay']) {
      expect(stateFn, `la función de estado depende de ${forbidden}`).not.toContain(forbidden);
    }
  });

  it('K · la evidencia no mapeada no desaparece en silencio', () => {
    const flatText = flat(contract);
    expect(flatText).toContain('unattributed_attempt_count');
    expect(flatText).toContain('Perder evidencia sin declararlo sería una mentira por omisión');
  });

  it('L · una mutación de atribución no es continuación incremental ordinaria', () => {
    const flatText = flat(contract);
    expect(flatText).toContain('El motor **se niega a mezclar generaciones**');
    expect(flatText).toContain('Una mutación de atribución **nunca** es continuación incremental');
    expect(flatText).toContain('RECALCULATION_ATTRIBUTION_CHANGED');
    expect(flat(log)).toContain('nunca es continuación incremental ordinaria');
  });

  it('M · EC-006 sigue siendo un gate mecánico duro', () => {
    const flatText = flat(contract);
    expect(flatText).toContain('EC-006 sigue siendo un gate mecánico duro');
    expect(flatText).toContain('no exime de probarlo');
    // La batería adversarial mínima está enumerada, no resumida.
    const rebuild = flat(contract.slice(contract.indexOf('## 15 · Semántica de reconstrucción')));
    for (const needle of [
      'órdenes de proceso distintos',
      'tamaños de lote distintos',
      'interrupción y reinicio en varios watermarks',
      'intentos repetidos',
      'evidencia contradictoria',
      'evidencia tardía',
      'evidencia de diagnóstico',
      'evidencia no mapeada',
      'cambios de generación de mapeo',
      'rebuild desde cero',
      'incremental desde watermarks intermedios',
    ]) {
      expect(rebuild, `falta de la batería adversarial: ${needle}`).toContain(needle);
    }
    // Y el anexo de ADR-008 dice lo mismo, sin debilitar el ADR.
    expect(flat(read(ADR_008))).toContain('EC-006 no se debilita');
  });

  it('N · los requisitos diferidos no se marcan PASS', () => {
    const disposition = log.slice(log.indexOf('## SD-027 ·'), log.indexOf('## SD-028 ·'));
    expect(disposition.length).toBeGreaterThan(0);
    expect(disposition).toContain('REQ-D05 | **PARCIALMENTE DIFERIDO**');
    expect(disposition).toContain('REQ-D07 | **DIFERIDO**');
    // La frase, literal: un requisito diferido no se marca PASS.
    expect(flat(disposition)).toContain('un requisito diferido no se marca PASS');
    expect(flat(disposition)).toContain('Ningún requisito canónico se debilita');
  });

  it('O · no se crea sustrato de intervención ni de readiness', () => {
    // La tabla de intervención no entra en el registro de autoridad: no se crea en Phase 3.
    expect([...SERVER_AUTHORITATIVE_PROJECTIONS]).not.toContain('intervention_outcomes');
    const flatText = flat(contract);
    expect(flatText).toContain('No se crea `intervention_outcomes` en Phase 3');
    expect(flatText).toContain('Una tabla sin escritor posible no es sustrato');
    expect(flatText).toContain('**No se crea `exam_readiness` en Phase 3**');
    expect(flatText).toContain('Una tabla llena de nulos no es útil');
    // El motivo es mecánico y verificable en la migración de Phase 2, no una opinión.
    const evidence = read('supabase/migrations/00000000000018_evidence_core.sql');
    expect(evidence).toContain("'INTERVENTION_SHOWN'");
    expect(evidence).not.toMatch(/when 'INTERVENTION_SHOWN' then '\{/);
  });

  it('P · no se filtra semántica del Planner de Phase 4', () => {
    for (const forbidden of ['planner_runs', 'planner_items', 'run_planner', 'available_minutes']) {
      expect(contract, `el contrato introduce ${forbidden}`).not.toContain(forbidden);
    }
  });

  it('Q · no se introduce dependencia del corpus oficial de Phase 1B', () => {
    for (const forbidden of ['OFFICIAL', 'corpus oficial de entrada', 'source_versions']) {
      expect(contract, `el contrato depende de ${forbidden}`).not.toContain(forbidden);
    }
  });

  it('R · no se implica ninguna mutación de PRODUCTION', () => {
    // La autorización nombra PRODUCTION solo para prohibirla, y el contrato repite la frontera.
    expect(flat(authorization)).toContain('ni mutación de STAGING o de PRODUCTION');
    const boundary = flat(authorization.slice(authorization.indexOf('## 6. Frontera absoluta')));
    expect(boundary).toContain('Prohibido en este aterrizaje');
    expect(boundary).toContain('mutar STAGING; mutar PRODUCTION');
    expect(flat(contract)).toContain('ni ninguna mutación de PRODUCTION');
    // Y ninguno de los dos autoriza nada sobre PRODUCTION.
    for (const document of [contract, authorization]) {
      expect(flat(document)).not.toMatch(/autoriza[^.]{0,60}PRODUCTION/i);
    }
  });

  it('S · ningún identificador de proyecto ajeno entra en los documentos nuevos', () => {
    // Una referencia de proyecto Supabase son veinte letras minúsculas seguidas. Ninguna
    // aparece: así la comprobación no necesita escribir ningún identificador prohibido.
    for (const [name, document] of [
      [CONTRACT, contract],
      [AUTHORIZATION, authorization],
      [ADR_003, read(ADR_003)],
    ] as const) {
      const matches = document.match(/\b[a-z]{20}\b/g) ?? [];
      expect(matches, `${name} contiene una referencia de proyecto`).toEqual([]);
    }
  });
});

describe('ADR-003 · aceptada, enmendada y con su supersesión registrada', () => {
  const text = read(ADR_003);

  it('es ACCEPTED v1.2, con decisora, registro de decisión y aprobación', () => {
    expect(text).toMatch(/^STATUS: ACCEPTED · v1\.2/m);
    expect(text).toMatch(/^DECISION OWNER: Ana Victoria$/m);
    expect(text).toMatch(/^Approved by: Ana Victoria$/m);
    expect(text).toMatch(/^Date: 2026-09-10$/m);
    expect(text).toContain('PHASE_3_GOVERNANCE_AUTHORIZATION.md');
  });

  it('la aceptación no autoriza migraciones ni BUILD', () => {
    expect(text).toMatch(/^IMPLEMENTATION STATUS: NOT IMPLEMENTED/m);
    expect(text).toContain('no autoriza migraciones');
  });

  it('el texto histórico se conserva marcado, no reescrito', () => {
    expect(text).toContain('[SUPERSEDED por el Anexo v1.2 · texto histórico]');
    expect(text).toContain('[NO OPERATIVO en v1 · Anexo v1.2 · texto histórico]');
    // Los seis estados heredados siguen legibles como historia.
    expect(text).toContain('NEW · EXPOSED · LEARNING · CONSOLIDATING · MASTERED · STRONG');
    // Y los pesos heredados también, sin usarse.
    expect(text).toContain('accuracy .30 · retention .20 · transfer .20');
  });

  it('`Learning System v0.4` deja de ser referencia normativa', () => {
    expect(flat(text)).toContain(
      '`Learning System v0.4` (Mastery Engine) · NO DISPONIBLE · referencia histórica, ya no normativa',
    );
  });

  it('los puntos 2, 3, 4, 5 y 7 siguen vigentes', () => {
    expect(flat(text)).toContain('siguen vigentes tal como están redactados');
    expect(flat(text)).toContain('nunca derivada como media de mastery');
    // El punto 5 —gobierno de `engine_config`— se conserva íntegro.
    expect(flat(text)).toContain('Todo el punto 5 sigue vigente');
    expect(flat(text)).toContain('se aplica **cuando existan pesos**');
  });
});

describe('ADR-008 · anexo de reconciliación sin enmendar el ADR', () => {
  const text = read(ADR_008);

  it('el anexo existe, es aclaración y no cambia ningún punto', () => {
    expect(text).toContain(
      '## Anexo de reconciliación de watermark · Phase 3 · ACCEPTED 2026-09-10',
    );
    expect(flat(text)).toContain('**Aclaración, no enmienda:**');
    expect(text).toMatch(/^STATUS: ACCEPTED · v1\.0$/m);
  });

  it('separa progreso del consumidor y procedencia de la fila', () => {
    const annex = text.slice(text.indexOf('## Anexo de reconciliación de watermark'));
    expect(flat(annex)).toContain('**progreso del consumidor**');
    expect(flat(annex)).toContain('**procedencia del cálculo de la fila**');
    expect(flat(annex)).toContain('misma\ntransacción'.replace(/\s+/g, ' '));
    expect(flat(annex)).toContain('no\navanza el watermark'.replace(/\s+/g, ' '));
    expect(flat(annex)).toContain('exactamente una vez');
  });

  it('el texto de orden global queda declarado no operativo, sin editar el fichero congelado', () => {
    const annex = text.slice(text.indexOf('## Anexo de reconciliación de watermark'));
    expect(flat(annex)).toContain('NO OPERATIVO');
    expect(flat(annex)).toContain('el fichero congelado no se\nedita'.replace(/\s+/g, ' '));
  });

  it('las cláusulas vinculantes originales siguen intactas', () => {
    const flatText = flat(text);
    for (const needle of [
      'monotónica y sin huecos',
      'por usuario y por proyección',
      'Ninguna ausencia se declara definitiva por timeout',
      'triple coincidencia',
    ]) {
      expect(flatText, `falta la cláusula original: ${needle}`).toContain(needle);
    }
  });
});

describe('las entradas del SPEC_DIFF_LOG existen y no reescriben lo congelado', () => {
  it('SD-013 queda aceptada sin editar su entrada congelada', () => {
    const acceptance = log.slice(log.indexOf('## SD-013 · **aceptación**'));
    expect(acceptance.length).toBeGreaterThan(0);
    expect(acceptance).toContain('`ACCEPTED`');
    expect(acceptance).toContain('Ana Victoria');
    const frozen = log.slice(
      log.indexOf('## SD-013 · Gobierno de `engine_config`'),
      log.indexOf('## SD-014'),
    );
    expect(frozen).toContain('**Aprobación:** pendiente.');
  });

  it('SD-024 … SD-029 existen y están aceptadas', () => {
    for (const id of ['SD-024', 'SD-025', 'SD-026', 'SD-027', 'SD-028', 'SD-029']) {
      const start = log.indexOf(`## ${id} ·`);
      expect(start, `falta la entrada ${id}`).toBeGreaterThan(-1);
      const entry = log.slice(start, start + 4000);
      expect(entry, `${id} no está aceptada`).toContain('`ACCEPTED`');
    }
  });

  it('SD-028 registra C-27 y los cierres de C-09, C-10 y C-24', () => {
    const entry = log.slice(log.indexOf('## SD-028 ·'), log.indexOf('## SD-029 ·'));
    expect(entry).toContain('**C-27** · **ALTA**');
    expect(entry).toContain('C-09');
    expect(entry).toContain('C-10');
    expect(entry).toContain('C-24');
    expect(flat(entry)).toContain('no es un problema de calibración sino de vocabulario');
  });

  it('SD-029 registra DEF-28, DEF-29 y DEF-30 con propietario', () => {
    const entry = log.slice(log.indexOf('## SD-029 ·'));
    for (const id of ['DEF-28', 'DEF-29', 'DEF-30']) {
      expect(entry, `falta ${id}`).toContain(id);
    }
    expect(flat(entry)).toContain('el motor no emite ninguna salida que dependa de ella');
  });

  it('el resumen vigente es el de Phase 3 y sustituye al del FPS', () => {
    const phase3 = log.indexOf('## Estado de la adenda · tras la Phase 3 Governance Landing');
    const fps = log.indexOf('## Estado de la adenda · tras la FPS Build Authorization');
    expect(phase3).toBeGreaterThan(-1);
    expect(fps).toBeGreaterThan(-1);
    expect(phase3).toBeGreaterThan(fps);
  });

  it('el cuerpo congelado del log conserva su hash', () => {
    // Equivale a `head -174 docs/SPEC_DIFF_LOG.md | sha256sum`: 174 líneas con su salto final.
    const body = `${log.split('\n').slice(0, 174).join('\n')}\n`;
    expect(createHash('sha256').update(Buffer.from(body, 'utf8')).digest('hex')).toBe(
      '4a4ba01d3e211aa0c2200239826a14f3b56dbe788fe40064a5f0a087da6f2fd3',
    );
  });
});

describe('lo congelado sigue congelado · `spec/` intacto por hash', () => {
  /** Hashes de importación de `docs/PROVENANCE.md` §2, escritos literalmente. */
  const FROZEN_SPEC: Record<string, string> = {
    'spec/acceptance-matrix.md': '1968813c2325ff010536f15ede4dca2b293c77ea0e2e7c88192627c6a252af2c',
    'spec/authority-map.md': '281b9cf9f5d8ac54c1edfd8da5b7d6a97909352a21607870550b1b21efe85824',
    'spec/contradiction-register.md':
      'f4953721d2ddc1148987c7a324547bc4b8b71207d472a7149540f1dbbf5bf2d3',
    'spec/deferred-requirements.md':
      '8aa63b9ca0186fe59893cab218fde7e261cda41c601a267992f818b725264fd7',
    'spec/domain-model.md': 'e1f028e1bbcbd8c2f4ca7b87bcef5f816da254bb932a393ce72d9ca4522d3203',
    'spec/invariant-register.md':
      '860793cb1541da3856e663e91ffb5c5621c65a6f28d2e9b42936552112e47b96',
    'spec/requirement-index.md': '39426a8d0ca0983e0be82b526afcfe240fd6f5f13ce9d1b4b7cb102c85a8dfb9',
    'spec/risk-register.md': '601d6d1183fbc8fb00a69eed4e9f261362eb6b4c323dd01137f9625211cb0dff',
    'spec/terminology.md': '1bf26b82b3de941ef7b00d9b948e6fc4df3e34cf81eccf9891bc9a9ea1031086',
  };

  for (const [file, hash] of Object.entries(FROZEN_SPEC)) {
    it(`${file} conserva su hash de importación`, () => {
      expect(sha256(file)).toBe(hash);
    });
  }

  it('la disposición de Phase 3 vive en el SPEC_DIFF_LOG, no en `spec/`', () => {
    // La regla del repositorio: los outputs de Phase −1 se superseden por adenda.
    expect(log).toContain('`spec/requirement-index.md` §D');
    expect(log).toContain('`spec/contradiction-register.md` (congelado; **no se edita**)');
    expect(log).toContain('`spec/deferred-requirements.md` (congelado; **no se edita**)');
  });
});

describe('aterrizaje de gobernanza · nada de Phase 3 ha llegado al runtime', () => {
  const migrationsDir = join(REPO_ROOT, 'supabase', 'migrations');
  const migrations = readdirSync(migrationsDir).filter((name) => name.endsWith('.sql'));

  it('no hay ninguna migración nueva', () => {
    expect(migrations).toHaveLength(19);
    expect(migrations.sort().at(-1)).toBe('00000000000018_evidence_core.sql');
  });

  it('ninguna migración menciona un objeto de Phase 3', () => {
    const sql = migrations
      .map((name) => readFileSync(join(migrationsDir, name), 'utf8').toLowerCase())
      .join('\n');
    for (const table of [
      'concept_mastery',
      'mastery_history',
      'error_patterns',
      'intervention_outcomes',
      'exam_readiness',
      'projection_watermarks',
      'engine_config',
      'attribution_generation',
      'attribution_pack_version_id',
    ]) {
      expect(sql, `alguna migración menciona ${table}`).not.toContain(table);
    }
  });

  it('no existe el paquete del motor', () => {
    expect(existsSync(join(REPO_ROOT, 'packages', 'learning-engine'))).toBe(false);
    expect(readdirSync(join(REPO_ROOT, 'packages')).sort()).toEqual([
      'config',
      'design-system',
      'domain',
    ]);
  });

  it('el registro de alcance negativo no se ha relajado', () => {
    // Su actualización es prerrequisito del BUILD, no de este aterrizaje: mientras nada exista,
    // la prohibición sigue siendo la única garantía de que nada existe.
    const scope = read('tests/unit/phase2.scopeNegative.spec.ts');
    for (const table of [
      'concept_mastery',
      'mastery_history',
      'exam_readiness',
      'error_patterns',
      'intervention_outcomes',
      'projection_watermarks',
      'engine_config',
    ]) {
      expect(scope, `el registro de alcance ya no vigila ${table}`).toContain(table);
    }
    expect(scope).toContain('engine_version');
    expect(scope).toContain('event_watermark');
    expect(flat(log)).toContain(
      'su actualización es un **prerrequisito del BUILD**, no de este aterrizaje',
    );
  });

  it('el registro de autoridad declara las proyecciones nuevas como escritura de servidor', () => {
    for (const table of ['error_patterns', 'projection_watermarks', 'engine_config']) {
      expect([...SERVER_AUTHORITATIVE_PROJECTIONS], `falta ${table}`).toContain(table);
    }
  });

  it('las RPC del motor siguen reservadas y ninguna es invocable por cliente', () => {
    const registry = JSON.parse(read('packages/domain/src/authority-registry.json')) as {
      rpcs: { names: string[] };
      clientInvokableRpcs?: { names: string[] };
    };
    for (const rpc of [
      'rebuild_projections',
      'recalculate_mastery',
      'advance_event_watermark',
      'promote_engine_config',
    ]) {
      expect(registry.rpcs.names, `falta la RPC reservada ${rpc}`).toContain(rpc);
      expect(registry.clientInvokableRpcs?.names ?? []).not.toContain(rpc);
    }
  });
});
