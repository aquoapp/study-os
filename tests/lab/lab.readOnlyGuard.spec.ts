import { describe, expect, it } from 'vitest';

import { MUTATING_VERBS, ObservationRefused, assertReadOnly } from '../../lab/src/observation';

/**
 * Guarda de solo lectura · CP4.
 *
 * ---------------------------------------------------------------------------------------
 * Una guarda se afloja con cuidado y se prueba por los dos lados
 *
 * La primera versión buscaba las palabras prohibidas como **subcadenas** con un espacio
 * delante, y por eso rechazaba `order by created_at`. La campaña lo destapó: una lectura
 * legítima quedaba prohibida, y los otros dos nombres más comunes del esquema —`updated_at` y
 * `deleted_at`— caían igual.
 *
 * El arreglo pasa a límite de palabra. Como eso **relaja** una guarda de seguridad, aquí se
 * prueba que sigue rechazando todas las mutaciones reales, no solo que ya acepta lo que antes
 * rechazaba. La tentación alternativa era cualificar las columnas para esquivarla, y una guarda
 * que se esquiva con formato acaba esquivándose siempre.
 * ---------------------------------------------------------------------------------------
 */

describe('la guarda sigue rechazando lo que no es una lectura', () => {
  it('exige que la sentencia empiece por SELECT', () => {
    expect(() => assertReadOnly('with x as (select 1) select * from x')).toThrow(
      /empieza por SELECT/,
    );
    expect(() => assertReadOnly('update t set a = 1')).toThrow(ObservationRefused);
  });

  it('rechaza varias sentencias en una observación', () => {
    expect(() => assertReadOnly('select 1; select 2')).toThrow(/varias sentencias/);
  });

  it.each([
    'select * from t where id in (insert into u values (1) returning id)',
    'select 1 from t union select 1 from u; delete from t',
    'select (drop table t)',
    'select 1 where false or alter_table()',
  ])('rechaza «%s»', (statement) => {
    expect(() => assertReadOnly(statement)).toThrow(ObservationRefused);
  });

  it('cada verbo prohibido sigue siendo rechazado como palabra', () => {
    for (const verb of MUTATING_VERBS) {
      expect(() => assertReadOnly(`select 1 from t where x = 1 ${verb} y`)).toThrow(
        new RegExp(`"${verb}"`),
      );
    }
  });
});

describe('y acepta las lecturas que antes rechazaba por descuido', () => {
  it.each(['created_at', 'updated_at', 'deleted_at', 'inserted_at', 'granted_at'])(
    'acepta ordenar por %s',
    (column) => {
      expect(() =>
        assertReadOnly(`select ${column} from public.t order by ${column}`),
      ).not.toThrow();
    },
  );

  it('acepta la sentencia real que destapó el defecto', () => {
    const statement =
      'select reason::text as reason, from_position, to_position, ' +
      'to_char(created_at at time zone \'UTC\', \'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"\') as created_at ' +
      "from engine.mastery_history where user_id = '00000000-0000-0000-0000-000000000000' " +
      'order by created_at';
    expect(() => assertReadOnly(statement)).not.toThrow();
  });

  it('acepta una columna que continúa el verbo en otra palabra', () => {
    expect(() => assertReadOnly('select copying from public.t')).not.toThrow();
    expect(() => assertReadOnly('select dropout_rate from public.t')).not.toThrow();
  });
});

describe('pero no se afloja donde debilitaría la guarda', () => {
  it('un identificador que **empieza** por el verbo sí cae: el subrayado es separador', () => {
    // `\b` a secas no cortaría aquí, porque el subrayado es carácter de palabra. Si no cayera,
    // la corrección del falso positivo habría debilitado la guarda, que es peor.
    expect(() => assertReadOnly('select 1 where false or alter_table()')).toThrow(/"alter"/);
    expect(() => assertReadOnly('select drop_user()')).toThrow(/"drop"/);
    expect(() => assertReadOnly('select delete_all() from t')).toThrow(/"delete"/);
  });

  it('se rechaza de más antes que de menos, y se dice', () => {
    // `update_count` sería un nombre de columna plausible y cae. En este esquema no existe, y
    // la alternativa —dejar pasar `update_x()`— no es aceptable.
    expect(() => assertReadOnly('select update_count from public.t')).toThrow(/"update"/);
  });
});
