/**
 * REG-HUMAN-01 · referencia humana, **solo como propiedades**.
 *
 * ---------------------------------------------------------------------------
 * Lo que este módulo contiene y lo que deliberadamente no
 *
 * El recorrido humano de Phase 4B es **n = 1**. Su valor es doble: aporta propiedades
 * contractuales observadas en un producto real, y sirve de **control negativo** del observador,
 * porque no contiene patologías.
 *
 * Lo que **no** es: un objetivo. Por eso aquí no hay ni una cifra de aquella ejecución. No está
 * la secuencia de respuestas, ni los estados finales, ni el número de eventos, ni el plan, ni la
 * duración, ni que terminara agotando el día. Si estuvieran, el escenario podría ajustarse a
 * ellos sin que nadie lo notara, y entonces el laboratorio mediría nuestra puntería en lugar de
 * medir el producto.
 *
 * El aprendiz sintético **no importa este módulo**, y hay una prueba que lo comprueba.
 * ---------------------------------------------------------------------------
 */

/** Propiedades derivadas del recorrido humano. Ninguna lleva un valor de aquella ejecución. */
export const REG_HUMAN_01_PROPERTIES = [
  'el stream del aprendiz es contiguo y sin duplicados',
  'cada ítem de pregunta tiene como mucho un intento',
  'la representación evaluada es la presentada',
  'la confianza se registra antes del envío y se conserva',
  'la corrección la fija el servidor',
  'la proyección consumida alcanza la última posición aceptada',
  'una respuesta incorrecta deja la posición negativa en la posición de su envío',
  'el cambio de día reactiva elegibilidad sin crear evidencia',
  'el agotamiento del día no fabrica actividad',
] as const;

/**
 * Valores que **nunca** deben entrar al laboratorio como objetivo.
 *
 * Se enumeran para que su ausencia sea comprobable: una prueba busca estos nombres en los
 * módulos de perfil y escenario y falla si aparecen.
 */
export const FORBIDDEN_AS_TARGET = [
  'secuencia de respuestas humana',
  'estados finales humanos',
  'número de eventos humano',
  'planes humanos',
  'duración objetivo humana',
  'resultado NOTHING_ELIGIBLE humano',
] as const;

/** El golden trace es fuente de propiedades y control negativo; nunca expectativa de salida. */
export const ROLE = 'PROPERTY_SOURCE_AND_NEGATIVE_CONTROL' as const;
