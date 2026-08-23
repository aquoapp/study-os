import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { REPO_ROOT } from './lib/run-guard';

/**
 * `sd018.contract.spec` · SD-018 sigue siendo un contrato, no una implementación.
 *
 * ---------------------------------------------------------------------------
 * Qué vigila este fichero
 *
 * SD-018 corrige la interacción entre el contador de posición y la clave de
 * idempotencia. Nada de eso está implementado y **no debe estarlo** hasta que haya
 * decisión humana. Estas pruebas verifican dos cosas distintas:
 *
 *   1. que el contrato escrito dice lo que tiene que decir —el orden de las
 *      operaciones es el punto entero de SD-018, y una redacción que lo pierda
 *      reintroduce el defecto sin que nadie lo note—;
 *   2. que **nada** de eso ha llegado al esquema.
 * ---------------------------------------------------------------------------
 */

const read = (relative: string) => readFileSync(join(REPO_ROOT, relative), 'utf8');
const log = read('docs/SPEC_DIFF_LOG.md');

describe('SD-018 · el contrato dice lo que debe', () => {
  it('sustituye expresamente a SD-015', () => {
    expect(log).toContain('sustituye a SD-015');
    expect(log).toContain('superseded');
  });

  const clauses: Array<[string, string]> = [
    ['bloqueo transaccional del contador', 'FOR UPDATE'],
    ['la comprobación de event_id va después del bloqueo', 'Después del bloqueo, comprobar'],
    ['unicidad por usuario y posición', 'unique(user_id, stream_position)'],
    ['event_id como clave de idempotencia', 'event_id'],
    ['watermark por usuario y proyección', 'Watermark por usuario y por proyección'],
    ['client_created_at para la semántica temporal', 'client_created_at'],
    ['ninguna inferencia de ausencia por timeout', 'ausencia definitiva'],
    ['sin ON CONFLICT DO NOTHING tras incrementar', 'Nada de `ON CONFLICT DO NOTHING`'],
    ['el conflicto inesperado revierte la transacción entera', 'revierte la transacción entera'],
    ['tras el rollback se recupera y se valida', 'Tras el rollback puede recuperarse'],
    ['mismo event_id con otro payload es conflicto', 'conflicto de integridad'],
    ['el mismo principio en question_attempts', 'question_attempts'],
    ['la idempotencia precede a attempt_number', 'sin asignar `attempt_number` nuevo'],
  ];

  for (const [name, needle] of clauses) {
    it(name, () => {
      expect(log, `falta en SD-018: ${needle}`).toContain(needle);
    });
  }

  it('declara por qué el orden importa, no solo cuál es', () => {
    // Sin el motivo, la próxima reescritura lo pierde.
    expect(log).toContain('abre una ventana');
    expect(log).toContain('Huecos en el stream');
    expect(log).toContain('Éxito idempotente falso');
  });

  /**
   * Triple coincidencia · lo que la última auditoría señaló que faltaba.
   *
   * El contrato decía que un `submitted_event_id` repetido era idempotente si
   * coincidían usuario y pregunta. Falta la tercera: el payload. Dos envíos con el
   * mismo identificador, el mismo usuario y la misma pregunta pueden llevar
   * respuestas distintas, y aceptar el segundo como idempotente descarta una de las
   * dos en silencio.
   */
  const tripleMatch: Array<[string, string]> = [
    ['exige las tres coincidencias', 'coinciden **las tres**'],
    ['la tercera es el payload canónico completo', 'payload canónico completo'],
    ['se compara por hash canónico de la respuesta', 'answer_payload_hash'],
    ['«completo» excluye un subconjunto de campos', 'no sobre un resumen ni sobre un subconjunto'],
    ['cualquier diferencia es conflicto de integridad', 'es un **conflicto de integridad**'],
    ['el conflicto revierte por completo', 'aborta y revierte por completo'],
    ['el conflicto no consume attempt_number', 'no consume número de intento'],
    [
      'no se devuelve el intento antiguo como respuesta al envío nuevo',
      'como si fuera la respuesta al envío nuevo',
    ],
    ['no se sobrescribe el intento original', 'intento original con el payload nuevo'],
    [
      'la canonicalización se fija antes de la primera migración',
      'canonicalización debe estar fijada',
    ],
    ['la regla es simétrica con learning_events', 'Simetría con'],
  ];

  for (const [name, needle] of tripleMatch) {
    it(`triple coincidencia · ${name}`, () => {
      const section = log.slice(log.indexOf('### Triple coincidencia'));
      expect(section.length, 'no existe la sección de triple coincidencia').toBeGreaterThan(0);
      expect(section, `falta en el contrato: ${needle}`).toContain(needle);
    });
  }

  it('las pruebas de la triple coincidencia están declaradas y ninguna existe', () => {
    for (const spec of [
      'attempts.tripleMatchRequired.spec',
      'attempts.conflictDoesNotConsumeAttemptNumber.spec',
      'attempts.canonicalHashIsDeterministic.spec',
    ]) {
      expect(log, `${spec} no está declarada en el contrato`).toContain(spec);
    }
  });

  it('sigue PROPOSED y sin aprobar', () => {
    const section = log.slice(log.indexOf('## SD-018 · **corrección del contrato**'));
    expect(section).toContain('NO IMPLEMENTADO');
    expect(section).toContain('decisión humana explícita');
    expect(section).toContain('**Aprobación:** pendiente.');
  });
});

describe('SD-018 · nada de esto está implementado', () => {
  const migrationsDir = join(REPO_ROOT, 'supabase', 'migrations');
  const migrations = readdirSync(migrationsDir).filter((name) => name.endsWith('.sql'));

  const forbidden = [
    'learning_events',
    'user_event_counters',
    'projection_watermarks',
    'stream_position',
    'question_attempts',
    'server_sequence',
  ];

  for (const table of forbidden) {
    it(`ninguna migración menciona ${table}`, () => {
      for (const migration of migrations) {
        const sql = readFileSync(join(migrationsDir, migration), 'utf8').toLowerCase();
        expect(sql, `${migration} menciona ${table}`).not.toContain(table);
      }
    });
  }

  it('no existe ningún bloqueo de fila ni secuencia global en el esquema', () => {
    for (const migration of migrations) {
      const sql = readFileSync(join(migrationsDir, migration), 'utf8').toLowerCase();

      // `for update` aparece legítimamente en `create policy … for update`, que es
      // el verbo de la política RLS y suele escribirse en varias líneas. Lo que no
      // puede haber es el bloqueo de fila `select … for update`, que es el
      // mecanismo de SD-018. Por eso se mira la sentencia completa, no la línea.
      const withoutComments = sql.replace(/--[^\n]*/g, '');
      for (const statement of withoutComments.split(';')) {
        if (!statement.includes('for update')) continue;
        expect(statement.trim(), `${migration}: bloqueo de fila`).toContain('create policy');
      }

      /**
       * `ON CONFLICT DO NOTHING` no está prohibido en general: el alta del perfil
       * lo usa para que un reintento del trigger de registro no falle, y ahí no hay
       * ningún contador de por medio.
       *
       * Lo que SD-018 prohíbe es usarlo **después de incrementar una posición**,
       * porque entonces el incremento sobrevive a un INSERT que no ocurrió y deja
       * un hueco. Se acota a la única inserción donde hoy es legítimo.
       */
      // Se quitan también los literales entre comillas: el `COMMENT ON FUNCTION`
      // explica la cláusula en prosa, y esa mención no es código. La forma real es
      // `on conflict (col) do nothing`, con la lista de columnas en medio.
      const code = withoutComments.replace(/'[^']*'/g, "''");

      for (const match of code.matchAll(/on\s+conflict[^;]*?do\s+nothing/g)) {
        const window = code.slice(Math.max(0, match.index - 300), match.index);
        expect(window, `${migration}: ON CONFLICT DO NOTHING fuera del alta de perfil`).toContain(
          'insert into public.profiles',
        );
      }

      expect(sql, `${migration} crea una secuencia global`).not.toContain('create sequence');
      expect(sql, `${migration} usa nextval`).not.toContain('nextval');
    }
  });

  it('las suites de intentos declaradas en el contrato no existen todavía', () => {
    // Declarar una prueba en el contrato no es escribirla. Si algún día aparecen,
    // será porque SD-018 se implementó, y eso exige decisión humana antes.
    const testsDir = join(REPO_ROOT, 'tests');
    const existing = new Set<string>();
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.isDirectory()) walk(join(dir, entry.name));
        else existing.add(entry.name);
      }
    };
    walk(testsDir);

    for (const spec of [
      'attempts.tripleMatchRequired.spec.ts',
      'attempts.conflictDoesNotConsumeAttemptNumber.spec.ts',
      'attempts.canonicalHashIsDeterministic.spec.ts',
      'events.lockBeforeIdempotencyCheck.spec.ts',
    ]) {
      expect(existing.has(spec), `${spec} existe: SD-018 estaría implementándose`).toBe(false);
    }
  });

  it('el andamiaje de tipos no pretende ser una implementación', () => {
    const authority = read('packages/domain/src/authority.ts');
    expect(authority).toContain('SD-018');
    expect(authority).toContain('no implementado');
    // Y ya no cita el contrato que quedó superseded como si estuviera vigente.
    expect(authority).not.toContain('pendiente de SD-015');
  });
});
