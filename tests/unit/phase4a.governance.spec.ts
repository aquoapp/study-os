import { execFileSync } from 'node:child_process';
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
 *   - el contrato consta `PROPOSED · BLOQUEADO` mientras P4-D3 y P4-D4 sigan abiertas, y ADR-012
 *     sigue aceptado y **sin implementar**;
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

describe('Phase 4A · el contrato del Planner no se declara aceptado con una decisión abierta', () => {
  it('es v1.1 y consta PROPOSED · BLOQUEADO, con sus dos bloqueantes nombrados', () => {
    expect(contract).toContain('# STUDY OS · Planner Contract · v1.1');
    expect(flat(contract)).toContain(
      '**ESTADO:** `PROPOSED · BLOQUEADO POR DECISIÓN HUMANA` · **no aceptado como v1.1**',
    );
    expect(flat(contract)).toContain('**BLOQUEANTES:** **P4-D3**');
    expect(flat(contract)).toContain('**P4-D4**');
    expect(flat(contract)).toContain('**PROPIETARIO NORMATIVO:** ADR-012');
    // La historia del defecto no se borra: v1.0 se aterrizó como ACCEPTED y se corrigió.
    expect(flat(contract)).toContain('**IR-P4A-01**');
    expect(flat(contract)).toContain('**IR-P4A-02**');
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

  it('las dos decisiones vuelven como fichas y ninguna está marcada aceptada', () => {
    const flattened = flat(authorization);
    for (const id of ['### P4-D3', '### P4-D4']) {
      expect(authorization, `falta la ficha ${id}`).toContain(id);
    }
    expect(flattened).toContain('Ninguna está tomada. Ninguna lleva `ACCEPTED`.');
    expect(flattened).not.toMatch(/P4-D3[^.]{0,40}`ACCEPTED`/);
    expect(flattened).not.toMatch(/P4-D4[^.]{0,40}`ACCEPTED`/);
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
    expect(readdirSync(join(REPO_ROOT, 'packages'))).not.toContain('planner-engine');
  });
});

describe('Phase 4A · ADR-012 congela la frontera arquitectónica', () => {
  it('es ACCEPTED v1.0 y NOT IMPLEMENTED', () => {
    expect(adr).toContain('STATUS: ACCEPTED · v1.0');
    expect(flat(adr)).toContain('IMPLEMENTATION STATUS: **NOT IMPLEMENTED**');
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

describe('Phase 4A · aceptar un contrato no es construirlo', () => {
  it('ninguna migración crea sustrato de Planner', () => {
    const migrations = readdirSync(join(REPO_ROOT, 'supabase/migrations')).filter((f) =>
      f.endsWith('.sql'),
    );
    expect(migrations).toHaveLength(22);
    for (const file of migrations) {
      const sql = read(`supabase/migrations/${file}`)
        .replace(/--[^\n]*/g, '')
        .toLowerCase();
      for (const object of [
        'planner_runs',
        'planner_items',
        'planner_config',
        'create_planner_run',
        'start_planned_session',
        'learner_today_overrides',
      ]) {
        expect(sql, `${file} crea ${object}`).not.toContain(object);
      }
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

  it('ningún módulo de aplicación importa ni menciona un motor de Planner', () => {
    expect(readdirSync(join(REPO_ROOT, 'apps/web/src/server'))).not.toContain('planner');
  });
});
