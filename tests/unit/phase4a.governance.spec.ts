import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import registry from '../../packages/domain/src/authority-registry.json';

import { REPO_ROOT } from './lib/run-guard';

/**
 * `phase4a.governance.spec` · Phase 4A · Planner Domain / Decision Engine · aterrizaje de
 * gobernanza del 2026-09-17.
 *
 * Actualizado el mismo día tras la **validación adversarial**: la revisión independiente encontró
 * que una recomendación emitida contaba como respuesta a la reparación (IR-P4A-01) y que la
 * atomicidad estaba sobreafirmada (IR-P4A-02). El contrato deja de estar aceptado, y este
 * vigilante deja de afirmar que lo está.
 *
 * Vigila lo que la decisión humana dejó fijado y, sobre todo, **lo que prohibió**:
 *
 *   - el contrato solo consta `ACCEPTED` con P4-D3, P4-D4 y P4-D5 cerradas (2026-09-18/19), y ADR-012
 *     sigue aceptado y **sin implementar**: Gate A pasa, pero el BUILD espera al aterrizaje;
 *   - P4-D1 consta con sus siete cláusulas, y P4-D2 consta **diferida**;
 *   - la composición no introduce ningún parámetro de equilibrio: ni ratio, ni cuota, ni ciclo,
 *     ni alternancia, ni azar;
 *   - `EVIDENCE_POSITIVE` no es elegible y `NOTHING_ELIGIBLE` no afirma preparación;
 *   - nada del Planner ha llegado al esquema, al runtime ni a la superficie de cliente: aceptar
 *     un contrato no es construirlo.
 *
 * La derivación completa vive en `docs/PHASE_4A_GOVERNANCE_AUTHORIZATION.md` §6; aquí se vigila
 * que siga diciendo lo que dice y que el repositorio siga sin contradecirla.
 */

const read = (relative: string) => readFileSync(join(REPO_ROOT, relative), 'utf8');
const flat = (text: string) => text.replace(/\s+/g, ' ');

const CONTRACT = 'docs/PLANNER_CONTRACT.md';
const ADR = 'architecture/ADR-012-planner-decision-authority.md';
const AUTHORIZATION = 'docs/PHASE_4A_GOVERNANCE_AUTHORIZATION.md';
const LOG = 'docs/SPEC_DIFF_LOG.md';

const contract = read(CONTRACT);
const adr = read(ADR);
const authorization = read(AUTHORIZATION);

describe('Phase 4A · el contrato del Planner solo se acepta con todas sus decisiones tomadas', () => {
  it('es v1.4, ACCEPTED, y el BUILD solo existe tras aterrizar la gobernanza', () => {
    expect(contract).toContain('# STUDY OS · Planner Contract · v1.4');
    expect(flat(contract)).toContain('**ESTADO:** `ACCEPTED` como contrato de Phase 4A');
    expect(flat(contract)).toContain('**No queda ninguna decisión semántica abierta.**');
    expect(flat(contract)).toContain(
      '**BUILD:** autorizado por separado, con esta gobernanza aterrizada antes en `main`',
    );
    expect(flat(contract)).toContain('**PROPIETARIO NORMATIVO:** ADR-012');
    // La historia no se borra: v1.1 y v1.2 constan como PROPOSED y los dos defectos, nombrados.
    expect(flat(contract)).toContain('**IR-P4A-01**');
    expect(flat(contract)).toContain('**IR-P4A-02**');
    expect(flat(contract)).toContain('v1.3 cierra P4-D5');
  });

  it('las tres decisiones humanas constan cerradas en el cuerpo del contrato', () => {
    const flattened = flat(contract);
    expect(flattened).toContain('**P4-D3 · `ACCEPTED` · híbrida**');
    expect(flattened).toContain('**P4-D4 · `ACCEPTED` · `EXPOSED` primero**');
    expect(flattened).toContain('**P4-D5 · `ACCEPTED` · última evidencia negativa**');
    // Y la tabla de necesidades ya no contradice la granularidad híbrida.
    expect(flattened).toContain('| `NEW` | cobertura | **APRENDER** ·');
    expect(flattened).not.toContain('| `NEW` | cobertura | **APRENDER + COMPROBAR** |');
    expect(flattened).not.toContain('PROPOSED · BLOQUEADO POR DECISIÓN HUMANA P4-D5');
  });

  it('define las veintiséis secciones que la autorización exige', () => {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    for (const letter of letters) {
      expect(contract, `falta la sección ${letter}`).toMatch(new RegExp(`^## ${letter} · `, 'm'));
    }
  });

  it('la selección es categórica: ni puntuación, ni pesos, ni proxy de readiness', () => {
    const flattened = flat(contract);
    expect(flattened).toContain('**puntuación numérica de dominio o estabilidad**');
    expect(flattened).toContain('`priority_score`, pesos, ponderaciones, ratios, cuotas');
    expect(flattened).toContain('ninguna agregación entre conceptos');
    // El Planner no reconstruye el dominio numérico leyendo el vector del motor.
    expect(flattened).toContain('**el vector de evidencia**');
  });
});

describe('Phase 4A · P4-D1 · composición categórica equilibrada', () => {
  it('las siete cláusulas de P4-D1 están registradas', () => {
    const flattened = flat(authorization);
    for (const id of [
      'P4-D1.1',
      'P4-D1.2',
      'P4-D1.3',
      'P4-D1.4',
      'P4-D1.5',
      'P4-D1.6',
      'P4-D1.7',
    ]) {
      expect(flattened, `falta ${id}`).toContain(id);
    }
    expect(flattened).toContain(
      '**PROGRESO + REPARACIÓN · sin castigo · sin ignorar la evidencia.**',
    );
  });

  it('la composición se deriva y la cantidad uno es la aridad de un existencial', () => {
    const flattened = flat(contract);
    expect(flattened).toContain('La aridad de un existencial es uno');
    expect(flattened).toContain('sería una cantidad **elegida**');
    // La asimetría entre reparación y cobertura es derivada, no elegida.
    expect(flattened).toContain('ninguna invariante protege a la reparación de la cobertura');
  });

  it('los contraejemplos semánticos son al menos veinte y llevan veredicto', () => {
    const rows = authorization.split('\n').filter((line) => /^\| \d+ \| /.test(line));
    expect(rows.length).toBeGreaterThanOrEqual(20);
    for (const row of rows) {
      expect(row, row).toMatch(/ACEPTABLE|NO ACEPTABLE|DECISIÓN HUMANA/);
    }
  });

  it('la derivación reconoce que no determina un algoritmo único', () => {
    const flattened = flat(authorization);
    expect(flattened).toContain(
      '**Las siete cláusulas de P4-D1 no determinan un algoritmo único.**',
    );
    expect(flattened).toContain('**P4-D3 · granularidad de la acción**');
    expect(flattened).toContain('**P4-D4 · orden entre `EXPOSED` y `NEW`**');
    // Y Gate A registra que la familia ampliada deja dos supervivientes, no una.
    expect(flattened).toContain('**Sobreviven dos, no equivalentes:**');
  });

  it('IR-P4A-01 consta corregido: una recomendación no es ejecución', () => {
    const flattened = flat(contract);
    expect(flattened).toContain(
      '**Un plan es un registro de decisión, no evidencia de ejecución.**',
    );
    expect(flattened).toContain(
      'este contrato elimina por completo el concepto de «necesidad respondida»',
    );
    // El historial de ejecuciones deja de ser señal de selección.
    expect(flattened).toContain('**auditoría, no señal**');
  });

  it('las decisiones humanas constan con su ficha, su cierre y su historia', () => {
    const flattened = flat(authorization);
    for (const id of ['### P4-D3', '### P4-D4', '## 24 · P4-D5 · decisión humana']) {
      expect(authorization, `falta la ficha ${id}`).toContain(id);
    }
    // Gate A · P4-D3 y P4-D4 quedaron cerradas por decisión humana el 2026-09-18 …
    expect(flattened).toContain('P4-D3 · `ACCEPTED` · granularidad híbrida');
    expect(flattened).toContain('P4-D4 · `ACCEPTED` · `EXPOSED` primero');
    // Gate A falló el 2026-09-18 por la prueba residual A, y ese registro se conserva …
    expect(flattened).toContain('**FAIL**, por la prueba residual A');
    // … P4-D5 la cerró el 2026-09-19 y Gate A pasa, pero Gate B no se abre sin aterrizaje.
    expect(flattened).toContain('**P4-D5 · APPROVED · LAST NEGATIVE EVIDENCE.**');
    expect(flattened).toContain('**Gate A = PASS.**');
    expect(flattened).toContain('**Por tanto Gate B no se abre.**');
  });

  it('ningún parámetro de equilibrio entra por la configuración', () => {
    const flattened = flat(contract);
    expect(flattened).toContain(
      'Una configuración versionada **no es legítima por ser auditable**',
    );
    for (const forbidden of [
      'pesos, ratios, porcentajes, cuotas, puntuaciones',
      'longitudes de ciclo, constantes de alternancia, máximos de categorías consecutivas',
      '**duraciones por defecto**',
    ]) {
      expect(flattened, `falta la prohibición: ${forbidden}`).toContain(forbidden);
    }
  });

  it('EVIDENCE_POSITIVE no es elegible y NOTHING_ELIGIBLE no afirma preparación', () => {
    const flattened = flat(contract);
    expect(flattened).toContain('**no es elegible de forma independiente en v1**');
    expect(flattened).toContain(
      'carece de autoridad para afirmar que un concepto con evidencia positiva deba revisarse',
    );
    expect(flattened).toContain(
      'el modelo actualmente autorizado no tiene ninguna acción de estudio justificada',
    );
    for (const forbidden of [
      'preparado para el examen',
      'dominado para siempre',
      '100 % aprendido',
    ]) {
      expect(flattened, `falta la negación: ${forbidden}`).toContain(forbidden);
    }
  });

  it('no hay actividad sintética: un plan no vacío no es invariante de producto', () => {
    expect(flat(contract)).toContain('Un plan no vacío **no es un invariante de producto**');
    expect(flat(contract)).toContain('Gate P4-G19');
  });
});

describe('Phase 4A · P4-D2 sigue diferida y no deja constantes detrás', () => {
  it('el contrato recibe la duración como entrada y no fija su origen', () => {
    const flattened = flat(contract);
    expect(flattened).toContain(
      'El Planner recibe la duración autoritativa de cada candidato **como entrada del contrato**',
    );
    expect(flattened).toContain('P4-D2 está deliberadamente diferida');
    expect(flattened).toContain('FPS-OBS-04 **no** queda cerrada');
  });

  it('ninguna migración ni paquete introduce metadatos ni valores de duración', () => {
    const migrations = readdirSync(join(REPO_ROOT, 'supabase/migrations')).filter((f) =>
      f.endsWith('.sql'),
    );
    for (const file of migrations) {
      const sql = read(`supabase/migrations/${file}`);
      expect(sql, `${file} introduce duración estimada`).not.toMatch(
        /estimated_minutes|duration_minutes|default_item_minutes/i,
      );
    }
    // Desde el BUILD el paquete existe; lo que no puede contener es una duración de runtime.
    const source = readdirSync(join(REPO_ROOT, 'packages/planner-engine/src'))
      .map((file) => read(`packages/planner-engine/src/${file}`))
      .join('\n');
    // `default_daily_minutes` es una declaración de la persona (§I.2), no una duración.
    expect(source).not.toMatch(/const\s+DEFAULT_[A-Z_]*MINUTES/);
    expect(source).not.toMatch(/estimated_minutes|duration_minutes|minutesPerItem|MINUTES_PER/i);
    // La única procedencia de duración que admite el tipo es la de fixture.
    expect(source).toContain("export const DURATION_PROVENANCES = ['FIXTURE'] as const;");
  });
});

describe('Phase 4A · ADR-012 congela la frontera arquitectónica', () => {
  it('es ACCEPTED v1.0 y, desde el BUILD, AUTHORIZED sin integrar, con su historia', () => {
    expect(adr).toContain('STATUS: ACCEPTED · v1.0');
    expect(flat(adr)).toContain('IMPLEMENTATION STATUS: **AUTHORIZED**');
    expect(flat(adr)).toContain('**sin integrar en `main`**');
    expect(flat(adr)).toContain('Hasta el 2026-09-19 constaba como NOT IMPLEMENTED');
    expect(flat(adr)).toContain('Approved by: Ana Victoria');
  });

  it('cubre los once puntos que la autorización exige', () => {
    const flattened = flat(adr);
    for (const claim of [
      'El Planner es determinista y autoritativo de servidor',
      'La selección es categórica, no numérica',
      '**No hay `priority_score`.**',
      '**Ningún proxy de readiness.**',
      'La ejecución es una instantánea inmutable',
      '**Ningún esquema privado nuevo.**',
      'Prueba en la frontera real de runtime',
    ]) {
      expect(flattened, `falta: ${claim}`).toContain(claim);
    }
    // La lección de D-26 es autoridad de aceptación mecánica, no prosa.
    expect(flattened).toContain('es complementario y **no suficiente**');
    expect(flattened).toContain('gate P4-G16');
  });

  it('conserva la estructura obligatoria de la ADR Policy v1.0', () => {
    for (const heading of [
      '## Context',
      '## Decision',
      '## Alternatives considered',
      '## Consequences',
      '## Product impact',
      '## Data/migration impact',
      '## Security impact',
      '## Test/acceptance impact',
      '## Rollback',
      '## Human approval',
    ]) {
      expect(adr, `falta ${heading}`).toContain(heading);
    }
  });
});

describe('Phase 4A · disposiciones registradas', () => {
  const log = read(LOG);

  it('SD-030 y SD-031 constan en la adenda, con propietario normativo', () => {
    expect(log).toContain('## SD-030 · disposición de los requisitos con fuente retirada');
    expect(log).toContain('## SD-031 · Planner Contract v1.0');
    expect(flat(log)).toContain('**Total tras esta adenda: 31 entradas SPEC_DIFF y 1 errata.**');
    expect(flat(log)).toContain('propietario normativo **ADR-012**');
  });

  it('los cuatro tipos de evento sin contrato quedan dispuestos y ninguno se inventa', () => {
    const flattened = flat(authorization);
    expect(flattened).toContain('`TODAY_OVERRIDE_SET` | **DEFERRED TO 4B**');
    for (const event of ['RESCUE_MODE_ENTERED', 'REPLAN_CONFIRMED', 'RECOVERY_STARTED']) {
      expect(flattened).toMatch(new RegExp(`\`${event}\` \\| \\*\\*NOT EMITTED\\*\\*`));
    }
    expect(flattened).toContain('Gate **P4-G17**');
  });

  it('el contenido retirado en sesión abierta se dispone sin tocar Phase 2', () => {
    expect(flat(authorization)).toContain('**Disposición: no es un asunto de Phase 4A.**');
    expect(flat(authorization)).toContain('WATCH-4A-1');
  });

  it('OBS-3.1-01 se registra como prerrequisito con milestone, sin tocar Vercel', () => {
    const flattened = flat(authorization);
    expect(flattened).toContain('BUILD de Phase 4A en local, CI y STAGING | **No**');
    expect(flattened).toContain('Recorrido humano en un Preview desplegado (4B) | **Sí**');
    expect(flattened).toContain(
      '**No se ha cambiado Vercel, no se ha pedido ninguna credencial, no se ha impreso ninguna credencial y no se ha añadido ninguna.**',
    );
  });

  it('P4-G18 pertenece a 4B y no figura como gate de 4A', () => {
    expect(flat(authorization)).toContain('**P4-G18 pertenece a Phase 4B**');
    const gateRows = authorization
      .split('\n')
      .filter((line) => /^\| \*\*P4-G\d+\*\*/.test(line))
      .map((line) => /\*\*(P4-G\d+)\*\*/.exec(line)?.[1]);
    expect(gateRows).not.toContain('P4-G18');
    for (const gate of ['P4-G16', 'P4-G19', 'P4-G20', 'P4-G21', 'P4-G22']) {
      expect(gateRows, `falta ${gate}`).toContain(gate);
    }
  });

  it('el modelo de referencia existe y ningún código de producción lo importa', () => {
    const files = readdirSync(join(REPO_ROOT, 'tests/governance'));
    expect(files).toContain('modelCheck.spec.ts');
    expect(files).toContain('simulation.spec.ts');
    expect(files).toContain('negativeControls.spec.ts');
    for (const root of ['apps/web/src', 'packages']) {
      const hits = execFileSync(
        'node',
        [
          '-e',
          `const {readdirSync,readFileSync,statSync}=require('fs');const {join}=require('path');` +
            `let out=[];const walk=(d)=>{for(const e of readdirSync(d)){const p=join(d,e);` +
            `if(statSync(p).isDirectory()){if(e!=='node_modules')walk(p);}` +
            `else if(/\\.(ts|tsx)$/.test(e)&&readFileSync(p,'utf8').includes('tests/governance'))out.push(p);}};` +
            `walk(process.argv[1]);console.log(out.join('\\n'));`,
          join(REPO_ROOT, root),
        ],
        { encoding: 'utf8' },
      ).trim();
      expect(hits, `${root} importa el modelo de gobernanza`).toBe('');
    }
  });
});

describe('Phase 4A · el BUILD construye solo lo autorizado', () => {
  /**
   * Hasta el 2026-09-19 este bloque decía «aceptar un contrato no es construirlo». Con el BUILD de
   * Phase 4A autorizado, la guarda cambia de forma pero no de fuerza: el sustrato del Planner solo
   * puede nacer en la migración autorizada de Phase 4A, y lo que 4A no construye —almacenamiento
   * del override del día, que es 4B— no puede aparecer en ninguna.
   */
  const PLANNER_OBJECTS = [
    'planner_runs',
    'planner_items',
    'planner_config',
    'create_planner_run',
    'start_planned_session',
  ];
  const PLANNER_MIGRATION = '00000000000023_planner_domain.sql';

  it('el sustrato del Planner solo aparece en su migración autorizada', () => {
    const migrations = readdirSync(join(REPO_ROOT, 'supabase/migrations')).filter((f) =>
      f.endsWith('.sql'),
    );
    for (const file of migrations) {
      if (file === PLANNER_MIGRATION) continue;
      const sql = read(`supabase/migrations/${file}`)
        .replace(/--[^\n]*/g, '')
        .toLowerCase();
      for (const object of PLANNER_OBJECTS) {
        expect(sql, `${file} crea ${object}`).not.toContain(object);
      }
    }
  });

  it('ninguna migración crea almacenamiento del override del día: es de Phase 4B', () => {
    const migrations = readdirSync(join(REPO_ROOT, 'supabase/migrations')).filter((f) =>
      f.endsWith('.sql'),
    );
    for (const file of migrations) {
      const sql = read(`supabase/migrations/${file}`)
        .replace(/--[^\n]*/g, '')
        .toLowerCase();
      // El enum de eventos contiene `TODAY_OVERRIDE_SET` desde la migración 18: es una etiqueta, no
      // almacenamiento. Lo prohibido es una tabla o columna que guarde el override.
      expect(sql, `${file} crea almacenamiento de override`).not.toMatch(
        /learner_today_overrides|create\s+table\s+(if\s+not\s+exists\s+)?[a-z_.]*override|add\s+column\s+(if\s+not\s+exists\s+)?[a-z_]*override/,
      );
    }
  });

  it('la superficie de RPC invocable por el cliente sigue siendo exactamente dos', () => {
    expect(registry.clientInvokableRpcs.names).toEqual([
      'append_learning_event',
      'create_study_session',
    ]);
  });

  it('la lista de exposición del Data API no cambia', () => {
    expect(registry.dataApi.exposedSchemas).toEqual(['public']);
    expect(registry.dataApi.nonExposedSchemas).toEqual(['content', 'ingest', 'engine']);
  });

  /**
   * Hasta el BUILD: «ningún módulo de aplicación menciona un Planner». Desde el BUILD el módulo de
   * servidor existe, pero **ninguna ruta** lo consume: la selección visible sigue siendo
   * `fps-fixed-v1` durante toda Phase 4A (P4-G15). HOY consumiendo el plan es Phase 4B.
   */
  it('ninguna ruta de la aplicación consume el Planner: cero cambio visible', () => {
    const hits = execFileSync(
      'node',
      [
        '-e',
        `const {readdirSync,readFileSync,statSync}=require('fs');const {join}=require('path');` +
          `let out=[];const walk=(d)=>{for(const e of readdirSync(d)){const p=join(d,e);` +
          `if(statSync(p).isDirectory())walk(p);` +
          `else if(/\\.(ts|tsx)$/.test(e)&&/server\\/planner|planner-engine/.test(readFileSync(p,'utf8')))out.push(p);}};` +
          `walk(process.argv[1]);console.log(out.join('\\n'));`,
        join(REPO_ROOT, 'apps/web/src/app'),
      ],
      { encoding: 'utf8' },
    ).trim();
    expect(hits, 'una ruta consume el Planner').toBe('');
    expect(readdirSync(join(REPO_ROOT, 'apps/web/src/server/planner')).sort()).toEqual([
      'admin.ts',
      'run.ts',
      'start.ts',
    ]);
  });
});

describe('Phase 4A · P4-D6 · el motor proyecta la clave de P4-D5', () => {
  const engine = read('docs/LEARNING_ENGINE_CONTRACT.md');
  const annex = engine.slice(engine.indexOf('## 25 · '));

  it('el contrato del motor gana un anexo v1.1 aditivo y conserva su historia', () => {
    // La cabecera histórica no se reescribe: el vigilante de Phase 3 la fija en «v1.0».
    expect(engine).toMatch(/^# STUDY OS · Learning Engine Contract · v1\.0$/m);
    expect(flat(engine)).toContain('**Versión vigente:** **v1.1** · anexo aditivo §25');
    expect(annex).toMatch(
      /^## 25 · Anexo v1\.1 · posición de la última evidencia negativa · P4-D6/,
    );
  });

  it('§0–§24 siguen byte a byte como se aterrizaron en Phase 3', () => {
    // Huella del tramo §0–§24 en `main` 3a8025f, antes del anexo.
    const span = engine
      .slice(engine.indexOf('## 0 ·'), engine.indexOf('## 25 ·'))
      .replace(/\n---\n*$/, '')
      .trimEnd();
    expect(createHash('sha256').update(span).digest('hex')).toBe(
      '7ca80a568f9140031546e61691294a01dd0eb98e418e2e7a30cadab226e51262',
    );
  });

  it('la regla es la derivada: intento elegible no correcto más reciente, por posición de stream', () => {
    const text = flat(annex);
    expect(text).toContain('**`last_negative_position`** · la **posición de stream**');
    expect(text).toContain('es **elegible** según §5.1');
    expect(text).toContain('`INCORRECT` o `BLANK`');
    expect(text).toContain('**Nunca** por `client_created_at`');
    // La equivalencia con el estado es una invariante mecánica, no una convención.
    expect(text).toContain(
      '`last_negative_position IS NOT NULL` ⇔ el estado es `EVIDENCE_NEGATIVE` o `EVIDENCE_CONFLICTING`',
    );
    expect(text).toContain('**No existe patrón activo sobre un concepto `EVIDENCE_POSITIVE`**');
  });

  it('es un hecho y no una puntuación, vive fuera del vector y solo lo mueve la evidencia', () => {
    const text = flat(annex);
    expect(text).toContain('`last_negative_position` es **procedencia**');
    expect(text).toContain('Vive **fuera del vector** de §5.2');
    expect(text).toContain(
      '**No lo mueven:** una recomendación, presentar o abrir contenido, leer, abandonar',
    );
    expect(text).toContain(
      '**`rebuild == incremental` (EC-006) se exige también para este campo**',
    );
  });

  it('hay un solo pliegue autoritativo: el Planner no reconstruye la clave', () => {
    expect(flat(annex)).toContain(
      '**hay un solo pliegue autoritativo de evidencia, y es el del motor.**',
    );
    expect(flat(contract)).toContain('**`last_negative_position`** por (persona, concepto)');
    expect(flat(contract)).toContain('**no** deriva `last_negative_position` consultando intentos');
    expect(flat(adr)).toContain('**14. Un solo pliegue autoritativo de evidencia.**');
  });

  it('el anexo del motor no filtra semántica del Planner ni del corpus oficial', () => {
    for (const forbidden of [
      'planner_runs',
      'planner_items',
      'run_planner',
      'available_minutes',
      'OFFICIAL',
      'source_versions',
    ]) {
      expect(engine, `el contrato del motor introduce ${forbidden}`).not.toContain(forbidden);
    }
  });

  it('P4-D6 consta aceptada y registrada por adenda, sin reabrir nada', () => {
    const log = read(LOG);
    expect(log).toContain(
      '## SD-032 · Learning Engine Contract · anexo v1.1 · `last_negative_position` · P4-D6',
    );
    expect(flat(log)).toContain('**Total tras esta adenda: 32 entradas SPEC_DIFF y 1 errata.**');
    expect(flat(authorization)).toContain('**P4-D6 · APPROVED · OPTION A**');
    for (const closed of [
      'P4-D3 · `ACCEPTED` · híbrida',
      'P4-D4 · `ACCEPTED` · `EXPOSED` primero',
      'P4-D5 · `ACCEPTED` · última evidencia negativa',
    ]) {
      expect(flat(contract)).toContain(closed);
    }
  });
});

describe('Phase 4A · decisión 15 de ADR-012 · cada entrada del modelo tiene fuente autorizada', () => {
  /**
   * El hallazgo que motivó P4-D6: el modelo de referencia tomó `lastNegativeAt` como entrada libre
   * y probó la política sin preguntar de dónde saldría ese dato. Este mapa convierte la lección en
   * prueba: un campo nuevo en la entrada del modelo sin fuente registrada rompe la suite.
   */
  const PROVENANCE: Record<string, string> = {
    // Concept
    id: 'identidad estable del concepto · contenido canónico',
    syllabus: 'orden de sílabo · sort_order de bloque, tema y concepto',
    state: 'Learning Engine · mastery_state (contrato del Planner §W.1)',
    errorPattern: 'Learning Engine · error_patterns activos (§W.1)',
    lastNegativeAt: 'Learning Engine · last_negative_position (P4-D6, contrato del motor §25)',
    firstNegativeAt: 'SIN FUENTE · variante FIRST_UNRESOLVED, falsada y rechazada',
    lastContactAt: 'SIN FUENTE · variante LAST_CONTACT, rechazada por P4-D5',
    learnMinutes: 'ENTRADA DE DURACIÓN · P4-D2 diferida · solo fixtures de prueba',
    checkMinutes: 'ENTRADA DE DURACIÓN · P4-D2 diferida · solo fixtures de prueba',
    eligibleContent: 'contenido publicado con mapeo PRIMARY VALIDATED (§E)',
    // PlannerInput
    concepts: 'colección de candidatos de servidor',
    budget: 'declaraciones de la persona · override, día de la semana, valor por defecto (§I.2)',
    completedToday: 'session_items completados en el día de plan (§E.5)',
    granularity: 'P4-D3 · constante HYBRID',
    coverageOrder: 'P4-D4 · constante EXPOSED_FIRST',
    remediationOrder: 'P4-D5 · constante EVIDENCE_OLDEST',
    engineStale: 'comparación de la tupla de frescura (§M)',
    mutations: 'SOLO PRUEBAS · controles negativos, nunca producción',
  };

  const model = read('tests/governance/model/planner-model.ts');
  const fieldsOf = (name: string) => {
    const body = model.slice(model.indexOf(`export interface ${name} {`));
    const block = body.slice(0, body.indexOf('\n}'));
    return [...block.matchAll(/^\s+readonly (\w+)\??:/gm)].map((m) => m[1]!);
  };

  it('toda entrada de Concept y de PlannerInput tiene una procedencia registrada', () => {
    const fields = [...fieldsOf('Concept'), ...fieldsOf('PlannerInput')];
    expect(fields.length).toBeGreaterThan(10);
    for (const field of fields) {
      expect(
        PROVENANCE[field],
        `la entrada ${field} del modelo no tiene fuente registrada`,
      ).toBeDefined();
    }
  });

  it('las entradas sin fuente de producción solo sirven a variantes rechazadas', () => {
    const unsourced = Object.entries(PROVENANCE).filter(([, source]) =>
      source.startsWith('SIN FUENTE'),
    );
    expect(unsourced.map(([field]) => field).sort()).toEqual(['firstNegativeAt', 'lastContactAt']);
    // Y la política aceptada usa la clave que sí tiene fuente.
    expect(model).toContain("const order = input.remediationOrder ?? 'EVIDENCE_OLDEST';");
  });
});
