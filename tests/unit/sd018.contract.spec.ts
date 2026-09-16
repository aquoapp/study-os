import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { REPO_ROOT } from './lib/run-guard';

/**
 * `sd018.contract.spec` · SD-018 es un contrato, y la implementación se corresponde con él.
 *
 * ---------------------------------------------------------------------------
 * Qué vigila este fichero
 *
 * SD-018 corrige la interacción entre el contador de posición y la clave de
 * idempotencia. La decisión humana llegó el 2026-09-07 —ADR-008, `ACCEPTED · NOT
 * IMPLEMENTED` hasta el 2026-09-09— y la Phase 2 Build Authorization (2026-09-09)
 * autoriza su implementación con dos prerrequisitos aceptados: SD-022 (canonicalización)
 * y SD-023 (autoridad de representación y de tiempo). Estas pruebas verifican tres cosas:
 *
 *   1. que el contrato escrito dice lo que tiene que decir —el orden de las
 *      operaciones es el punto entero de SD-018, y una redacción que lo pierda
 *      reintroduce el defecto sin que nadie lo note—;
 *   2. que las migraciones no usan los mecanismos que el contrato prohíbe: secuencias
 *      globales, `nextval`, `ON CONFLICT DO NOTHING` tras asignar posición, y bloqueos
 *      de fila fuera de los contadores que ADR-008 define;
 *   3. que contrato, migración y suites van juntos: sin migración de eventos no existe
 *      ninguna suite de ADR-008, y con ella existen todas las exigibles en Phase 2.
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

  it('las pruebas de la triple coincidencia están declaradas en el contrato', () => {
    for (const spec of [
      'attempts.tripleMatchRequired.spec',
      'attempts.conflictDoesNotConsumeAttemptNumber.spec',
      'attempts.canonicalHashIsDeterministic.spec',
    ]) {
      expect(log, `${spec} no está declarada en el contrato`).toContain(spec);
    }
  });

  it('consta ACCEPTED con ADR-008 como propietario normativo y autorizada en Phase 2', () => {
    const fromFirstHeading = log.slice(log.indexOf('## SD-018 · Orden total de eventos'));
    const correction = log.slice(log.indexOf('## SD-018 · **corrección del contrato**'));

    // La corrección se conserva tal como se aceptó el 2026-09-07 (cronología).
    expect(correction).toContain('ACCEPTED · NOT IMPLEMENTED');
    expect(correction).toContain('ADR-008');
    expect(correction).toContain('2026-09-07');
    expect(correction).toContain('no autoriza');
    expect(correction).toContain('No se ha creado ninguna migración');
    // Ninguna de las dos redacciones de SD-018 sigue diciendo «pendiente».
    expect(fromFirstHeading).not.toContain('**Aprobación:** pendiente.');

    // Y el estado operativo vigente es el de la Phase 2 Build Authorization.
    const phase2 = log.slice(
      log.indexOf('## Estado de la adenda · tras la Phase 2 Build Authorization'),
    );
    expect(phase2.length, 'falta el estado de la adenda tras Phase 2').toBeGreaterThan(0);
    expect(phase2).toContain('SD-018 `ACCEPTED` con');
    expect(phase2).toContain('implementación autorizada en Phase 2');
    expect(read('architecture/ADR-008-per-user-event-order-and-idempotency.md')).toMatch(
      /^IMPLEMENTATION STATUS: AUTHORIZED · Phase 2 \(2026-09-09\)/m,
    );
  });

  it('sus prerrequisitos están aceptados: SD-022 (canonicalización) y SD-023 (autoridad)', () => {
    expect(log).toContain('## SD-022 · Contrato de canonicalización v1');
    expect(log).toContain('## SD-023 · Autoridad de representación y de tiempo');
    for (const heading of ['## SD-022 ·', '## SD-023 ·']) {
      const entry = log.slice(log.indexOf(heading));
      const status = entry.slice(0, entry.indexOf('###'));
      expect(status, `${heading} no consta ACCEPTED`).toContain('**`ACCEPTED`** · 2026-09-09');
    }
  });
});

describe('SD-018 · las migraciones respetan los mecanismos del contrato', () => {
  const migrationsDir = join(REPO_ROOT, 'supabase', 'migrations');
  const migrations = readdirSync(migrationsDir).filter((name) => name.endsWith('.sql'));

  /**
   * Filas que se bloquean con `SELECT … FOR UPDATE`.
   *
   * ADR-008 puntos 2 y «mismo orden» fijan los dos contadores. El **anexo de reconciliación
   * de watermark** (2026-09-10) añade el progreso del consumidor: dos ejecuciones concurrentes
   * del motor para el mismo aprendiz deben serializarse, y el bloqueo precede a toda
   * comprobación, igual que en la ingestión. SD-013 añade la versión de configuración, que se
   * bloquea para que dos promociones simultáneas no dejen dos versiones activas.
   */
  const LOCKABLE_COUNTERS = [
    'user_event_counters',
    'user_question_counters',
    'projection_watermarks',
    'engine_config',
    // D-21 · la frontera de transición de un mapeo bloquea su fila antes de validar la
    // transición: dos cambios simultáneos del mismo mapeo se serializan, y la generación de
    // atribución avanza una vez por cambio real.
    'question_concepts',
  ];

  it('ningún bloqueo de fila fuera de los contadores de ADR-008, ninguna secuencia global', () => {
    for (const migration of migrations) {
      const sql = readFileSync(join(migrationsDir, migration), 'utf8').toLowerCase();

      // `for update` aparece legítimamente en `create policy … for update`, que es
      // el verbo de la política RLS. El bloqueo de fila `select … for update` solo
      // puede recaer sobre los contadores que ADR-008 define; se mira la sentencia
      // completa, no la línea.
      const withoutComments = sql.replace(/--[^\n]*/g, '');
      for (const statement of withoutComments.split(';')) {
        if (!statement.includes('for update')) continue;
        if (statement.includes('create policy')) continue;
        expect(
          LOCKABLE_COUNTERS.some((counter) => statement.includes(counter)),
          `${migration}: bloqueo de fila fuera de los contadores de ADR-008:\n${statement.trim()}`,
        ).toBe(true);
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

      /**
       * Inserciones donde `ON CONFLICT DO NOTHING` es legítimo porque **no hay ninguna
       * posición incrementada delante**:
       *
       *   - el alta del perfil, para que un reintento del trigger de registro no falle;
       *   - el alta de la fila de watermark (Phase 3, 2026-09-10), que nace en
       *     `consumed_position = 0` y se bloquea inmediatamente después: «ya existía» es
       *     exactamente la respuesta correcta, y ningún avance la precede.
       */
      const IDEMPOTENT_ROW_CREATION = [
        'insert into public.profiles',
        'insert into engine.projection_watermarks',
      ];
      for (const match of code.matchAll(/on\s+conflict[^;]*?do\s+nothing/g)) {
        const window = code.slice(Math.max(0, match.index - 300), match.index);
        expect(
          IDEMPOTENT_ROW_CREATION.some((insertion) => window.includes(insertion)),
          `${migration}: ON CONFLICT DO NOTHING fuera del alta idempotente de una fila`,
        ).toBe(true);
      }

      expect(sql, `${migration} crea una secuencia global`).not.toContain('create sequence');
      expect(sql, `${migration} usa nextval`).not.toContain('nextval');
    }
  });

  /**
   * ADR-008 punto 10 · «los watermarks acompañan a la primera proyección (Phase 3)».
   *
   * Actualizado el 2026-09-10 por la Phase 3 Build Authorization: la primera proyección ya
   * existe, de modo que la tabla debe existir **y** ser exactamente la que el punto 10
   * describe. La regla deja de ser «no existe» y pasa a ser «existe con esta forma»: por
   * usuario y por proyección, para que un aprendiz atrasado no detenga a otro y una
   * proyección lenta no detenga a las demás.
   */
  it('projection_watermarks es por usuario y por proyección, y nace con la primera proyección', () => {
    const creators = migrations.filter((name) =>
      /create\s+table\s+(if\s+not\s+exists\s+)?[a-z_.]*projection_watermarks\b/.test(
        readFileSync(join(migrationsDir, name), 'utf8').toLowerCase(),
      ),
    );
    expect(creators, 'la tabla de watermarks debe crearse exactamente una vez').toHaveLength(1);

    const sql = readFileSync(join(migrationsDir, creators[0] as string), 'utf8').toLowerCase();
    expect(sql).toContain('primary key (user_id, projection_name)');
    expect(sql).toContain('consumed_position');
    // Sigue sin existir ninguna secuencia global: el orden es `stream_position` por usuario.
    expect(sql).not.toContain('create sequence');
    expect(sql).not.toContain('server_sequence');
  });
});

describe('SD-018 · contrato, migración y suites van juntos', () => {
  const migrationsDir = join(REPO_ROOT, 'supabase', 'migrations');
  const migrations = readdirSync(migrationsDir).filter((name) => name.endsWith('.sql'));
  const eventsMigrated = migrations.some((name) =>
    /create\s+table\s+(if\s+not\s+exists\s+)?[a-z_.]*learning_events\b/.test(
      readFileSync(join(migrationsDir, name), 'utf8').toLowerCase(),
    ),
  );

  /**
   * Suites de ADR-008 exigibles en Phase 2. Las dos de proyección
   * (`watermark.perUserPerProjection`, `rebuild.deterministicOrder`) acompañan a la
   * primera proyección, en Phase 3, y no entran aquí.
   */
  const PHASE_2_SUITES = [
    'events.lockBeforeIdempotencyCheck.spec.ts',
    'events.duplicateEventIdReturnsExisting.spec.ts',
    'events.conflictingEventIdAborts.spec.ts',
    'events.noGapsUnderRollback.spec.ts',
    'events.noOnConflictDoNothing.spec.ts',
    'events.streamPositionMonotonic.spec.ts',
    'events.concurrentInsertSerialized.spec.ts',
    'events.lateArrivalNoTimeout.spec.ts',
    'attempts.idempotentBeforeAttemptNumber.spec.ts',
    'attempts.tripleMatchRequired.spec.ts',
    'attempts.conflictDoesNotConsumeAttemptNumber.spec.ts',
    'attempts.canonicalHashIsDeterministic.spec.ts',
  ];

  const existing = new Set<string>();
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) walk(join(dir, entry.name));
      else existing.add(entry.name);
    }
  };
  walk(join(REPO_ROOT, 'tests'));

  it('sin migración de eventos no existe ninguna suite; con ella existen todas', () => {
    for (const spec of PHASE_2_SUITES) {
      expect(
        existing.has(spec),
        eventsMigrated
          ? `${spec} falta: la migración de eventos existe y ADR-008 la exige`
          : `${spec} existe sin migración de eventos: estaría implementándose sin esquema`,
      ).toBe(eventsMigrated);
    }
  });

  it('las suites de proyección esperan a Phase 3', () => {
    for (const spec of [
      'watermark.perUserPerProjection.spec.ts',
      'rebuild.deterministicOrder.spec.ts',
    ]) {
      expect(existing.has(spec), `${spec} existe antes de la primera proyección`).toBe(false);
    }
  });

  it('el andamiaje de tipos declara el estado real del contrato', () => {
    const authority = read('packages/domain/src/authority.ts');
    expect(authority).toContain('SD-018');
    expect(authority).toContain('implementación autorizada en Phase 2');
    expect(authority).toContain('ACCEPTED · NOT IMPLEMENTED');
    // Y ya no cita el contrato que quedó superseded como si estuviera vigente.
    expect(authority).not.toContain('pendiente de SD-015');
  });
});
