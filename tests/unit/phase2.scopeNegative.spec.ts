import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { REPO_ROOT } from './lib/run-guard';

/**
 * `phase2.scopeNegative.spec` · gates P2-G8 y FPS-G1 · registro de alcance vigente.
 *
 * Phase 2 entregó el núcleo de aprendiz y de evidencia; el FPS añade **un solo vertical de
 * producto** sobre esa base congelada. Lo que aquí se comprueba no es que algo funcione, sino
 * que algo **no existe**: motores, proyecciones, planner, puntuación, recálculo, corpus
 * oficial y el resto de la superficie de Phase 5. La ausencia es la garantía, y por eso se
 * vigila mecánicamente.
 *
 * El aterrizaje de gobernanza del FPS actualizó este registro para autorizar exactamente
 * cuatro rutas (`docs/FPS_AUTHORIZATION_PACKET.md` §4.5). No se relajó ninguna otra ausencia.
 *
 * `schema.drift.spec` cubre la ausencia en las migraciones; este fichero cubre el resto del
 * árbol: paquetes, código de aplicación, dependencias y semilla.
 */

const read = (relative: string) => readFileSync(join(REPO_ROOT, relative), 'utf8');
const migrationsDir = join(REPO_ROOT, 'supabase', 'migrations');
const migrations = readdirSync(migrationsDir).filter((name) => name.endsWith('.sql'));
const allMigrationSql = migrations
  .map((name) => readFileSync(join(migrationsDir, name), 'utf8').toLowerCase())
  .join('\n');

describe('no existe ningún motor ni proyección (Phases 3 y 4)', () => {
  it('no hay paquete de motor de aprendizaje ni de planner', () => {
    for (const pkg of ['learning-engine', 'planner-engine', 'risk-engine']) {
      expect(existsSync(join(REPO_ROOT, 'packages', pkg)), `packages/${pkg} existe`).toBe(false);
    }
    const packages = readdirSync(join(REPO_ROOT, 'packages'));
    expect(packages.sort()).toEqual(['config', 'design-system', 'domain']);
  });

  it('ninguna migración crea una tabla de proyección, de planner o de configuración de motor', () => {
    for (const table of [
      'concept_mastery',
      'mastery_history',
      'exam_readiness',
      'error_patterns',
      'intervention_outcomes',
      'review_schedule',
      'planner_runs',
      'planner_items',
      'projection_watermarks',
      'engine_config',
      'attempt_recalculations',
      'content_change_events',
      'user_recalculation_jobs',
      'simulation_runs',
      'notes',
      'source_chunks',
      'ai_interactions',
    ]) {
      // Se busca la **creación** de la tabla, no su mención: `exam_sittings.notes` es una
      // columna legítima de Phase 1A, y una prueba que confundiera una subcadena con una
      // tabla obligaría a relajarla en cuanto apareciera la primera coincidencia inocente.
      expect(allMigrationSql, `alguna migración crea la tabla ${table}`).not.toMatch(
        new RegExp(
          `create\\s+table\\s+(if\\s+not\\s+exists\\s+)?(public\\.|ingest\\.|content\\.)?${table}\\b`,
        ),
      );
    }
  });

  it('ninguna columna de la evidencia agrega dominio: mastery no es readiness (EC-004)', () => {
    // La separación se protege por ausencia: en Phase 2 no hay ninguna columna agregada
    // —«score», «level», «readiness», «mastery»— en ninguna tabla de usuario. Sin agregado
    // no puede confundirse el dominio del concepto con la preparación para el examen.
    for (const marker of [
      'mastery_state',
      'mastery_score',
      'stability_score',
      'readiness_score',
      'readiness_state',
      'next_review_at',
      'uncertainty',
      'engine_version',
      'event_watermark',
    ]) {
      expect(allMigrationSql, `alguna migración introduce ${marker}`).not.toContain(marker);
    }
  });

  it('no hay política de puntuación: BD-06 es de Phase 6', () => {
    for (const marker of ['scoring_policy', 'penalty', 'eliminatory', 'cut_score']) {
      expect(allMigrationSql, `alguna migración introduce ${marker}`).not.toContain(marker);
    }
  });

  it('no hay pgvector ni cola offline: ADR-001 las difiere', () => {
    expect(allMigrationSql).not.toContain('create extension if not exists "vector"');
    expect(allMigrationSql).not.toContain('extension vector');
    expect(allMigrationSql).not.toContain('offline_queue');
  });
});

describe('la superficie de producto es exactamente el vertical del FPS', () => {
  const webRoot = join(REPO_ROOT, 'apps', 'web', 'src', 'app');

  /**
   * Registro de alcance actualizado por el aterrizaje de gobernanza del FPS
   * (`docs/FPS_AUTHORIZATION_PACKET.md` §4.5). Las cuatro rutas del vertical quedan
   * autorizadas; todo lo demás sigue perteneciendo a Phase 5.
   */
  it('las rutas de la aplicación son las de Phase 0, el onboarding y el vertical del FPS', () => {
    const routes = readdirSync(webRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith('_'))
      .map((entry) => entry.name)
      .sort();
    const permitidas = [
      'actions',
      'aprender',
      'comprobar',
      'cuenta',
      'entrar',
      'fin',
      'hoy',
      'offline',
      'onboarding',
      'registro',
    ];
    for (const route of routes) {
      expect(permitidas, `ruta no autorizada en el FPS: /${route}`).toContain(route);
    }
  });

  it('ninguna ruta implementa los espacios primarios que el FPS no cubre', () => {
    // FEEDBACK es un estado de /comprobar, no una ruta: crear /feedback sería surface creep.
    const prohibidas = ['entrenar', 'progreso', 'plan', 'check', 'feedback', 'sesion'];
    const routes = readdirSync(webRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name.toLowerCase());
    for (const route of prohibidas) {
      expect(routes, `la ruta /${route} pertenece a Phase 5, no al FPS`).not.toContain(route);
    }
  });

  it('el FPS no monta la navegación de los cinco espacios primarios', () => {
    const layout = read('apps/web/src/app/layout.tsx');
    expect(layout).not.toMatch(/PRIMARY_SPACES|ENTRENAR|PROGRESO/);
  });

  it('el cliente no calcula corrección: ningún fichero de la aplicación resuelve claves', () => {
    const walk = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
        entry.isDirectory()
          ? walk(join(dir, entry.name))
          : /\.(ts|tsx)$/.test(entry.name)
            ? [join(dir, entry.name)]
            : [],
      );
    /*
     * La regla es «el cliente no calcula corrección», no «el cliente no nombra el resultado».
     * El FPS **muestra** el resultado que devuelve la RPC tras el envío, porque esa es la
     * pantalla de FEEDBACK y sin ella no hay producto (REQ-F10). Lo que sigue prohibido es:
     *
     *  · tocar la clave: `answer_key_versions`, `resolve_answer_key` o cualquier consulta
     *    contra una tabla de claves —viven en un esquema no expuesto y no son alcanzables—;
     *  · nombrar el identificador de la versión de clave, que es una referencia opaca del
     *    servidor y nunca material de pantalla (EC-007);
     *  · **decidir** si una respuesta es correcta comparando lo elegido con lo correcto.
     */
    const forbidden: Array<{ pattern: RegExp; why: string }> = [
      { pattern: /answer_key_versions/, why: 'consulta la tabla de claves' },
      { pattern: /resolve_answer_key/, why: 'resuelve la clave en el cliente' },
      { pattern: /answer_key_version_id/, why: 'nombra el identificador de la versión de clave' },
      { pattern: /from\(\s*['"][^'"]*answer_key/, why: 'consulta una tabla de claves' },
      {
        pattern: /(selected\w*\s*===?\s*correct\w*)|(correct\w*\s*===?\s*selected\w*)/i,
        why: 'compara la opción elegida con la correcta',
      },
    ];
    const offenders: string[] = [];
    for (const file of walk(join(REPO_ROOT, 'apps', 'web', 'src'))) {
      const source = readFileSync(file, 'utf8');
      for (const rule of forbidden) {
        if (rule.pattern.test(source)) {
          offenders.push(`${file.replace(REPO_ROOT, '')} · ${rule.why}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('la corrección que se muestra viene del resultado de la RPC, no de una tabla', () => {
    // `question_attempts` no guarda la opción correcta ni la explicación: si aparecieran en un
    // `select`, alguien habría inventado una fuente que no existe.
    const sources = [
      'apps/web/src/server/fps/events.ts',
      'apps/web/src/server/fps/session.ts',
      'apps/web/src/server/fps/content.ts',
    ].map((relative) => read(relative));
    for (const source of sources) {
      expect(source).not.toMatch(/select\([^)]*correct_option_id/);
      expect(source).not.toMatch(/select\([^)]*explanation/);
    }
  });
});

describe('no entra contenido oficial ni infraestructura de corpus (Phase 1B)', () => {
  it('la semilla sigue vacía', () => {
    const seed = readdirSync(join(REPO_ROOT, 'supabase', 'seed'));
    expect(seed).toEqual(['README.md']);
  });

  it('no existe ninguna Edge Function', () => {
    expect(readdirSync(join(REPO_ROOT, 'supabase', 'functions'))).toEqual(['README.md']);
  });

  it('los fixtures de Phase 2 son sintéticos y visiblemente sintéticos', () => {
    const fixtures = read('tests/support/phase2-fixtures.ts');
    expect(fixtures).toContain('fixture:');
    // Ninguna clase de procedencia distinta de GENERATED se publica desde los fixtures.
    expect(fixtures).not.toMatch(/provenance_class:\s*'(OFFICIAL|VERIFIED)'/);
  });

  it('ninguna dependencia nueva entró con Phase 2', () => {
    const pkg = JSON.parse(read('package.json')) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const all = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
    for (const forbidden of ['pgvector', 'openai', '@anthropic-ai/sdk', 'bullmq', 'ioredis']) {
      expect(Object.keys(all), `dependencia no autorizada: ${forbidden}`).not.toContain(forbidden);
    }
  });
});

describe('neutralidad de examen (EC-018)', () => {
  /**
   * El nombre del primer pack se construye a partir de sus códigos de carácter y **no se
   * escribe** en este fichero. La guarda de literal de pack (EC-018) lo prohíbe en todo el
   * shell reutilizable, y una prueba de neutralidad de examen que lo escribiera sería el
   * primer incumplimiento de la regla que dice vigilar.
   */
  const PACK = String.fromCharCode(84, 65, 73);
  const pack = PACK.toLowerCase();

  it('ninguna migración de Phase 2 nombra un examen concreto', () => {
    const named = new RegExp(`(?<![A-Za-z0-9])${PACK}(?![A-Za-z0-9])`, 'i');
    for (const name of migrations.filter((m) => /^000000000000(15|16|17|18)_/.test(m))) {
      const sql = readFileSync(join(migrationsDir, name), 'utf8');
      expect(named.test(sql), `${name} nombra el pack`).toBe(false);
    }
  });

  it('el dominio de Phase 2 no tiene ninguna columna atada a un examen', () => {
    for (const marker of [`${pack}_`, 'oposicion', `convocatoria_${pack}`]) {
      expect(allMigrationSql, `alguna migración introduce ${marker}`).not.toContain(marker);
    }
    // El objetivo del aprendiz apunta a un pack, que es una fila y no una identidad: un
    // segundo examen no exige cambio de esquema (CDEM §29.11).
    expect(allMigrationSql).toContain(
      'exam_pack_id uuid not null references public.exam_packs (id)',
    );
  });
});
