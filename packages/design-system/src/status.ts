/**
 * Estado de la fundación del Design System.
 *
 * P0-S7 · «Fundación de tokens del Design System»
 * REQ-A06 · «Tokens del Design System (color, espaciado, radio, tipografía, 44px)»
 * Criterio de aceptación de REQ-A06: «Tokens conformes; contraste AA verificado».
 *
 * ---------------------------------------------------------------------------
 * De BLOCKED a satisfecho bajo restricciones
 *
 * La primera entrega inventó una paleta porque `STUDY_OS_Design_System_v1.0` no
 * estaba disponible, y declaró P0-S7 completo. La auditoría externa lo rechazó,
 * con razón.
 *
 * El documento apareció en `_handoff/originals/` y se verificó —nombre, SHA-256 y
 * naturaleza real del contenido—. Los tokens dejaron de ser inventados. Pero la
 * paleta congelada de §2 contiene tres combinaciones que no alcanzan el AA que §14
 * exige como P0, y corregirlas aquí significaría alterar valores congelados, que es
 * lo que EC-019 prohíbe. Quedó registrado como `SD-019`.
 *
 * **La opción A está autorizada por decisión humana y aplicada.** Acota el uso sin
 * tocar ningún color: `teal` y `amber` no llevan texto normal; `slate` solo como
 * texto sobre `surface`; sobre `canvas`, `ink` o el texto dentro de una superficie
 * válida. Bajo esas restricciones, **todo texto renderizado alcanza el contraste que
 * WCAG le exige**, y eso está medido en el navegador sobre el build de producción,
 * con un fixture negativo que demuestra que la medición no está vacía.
 *
 * Ese es exactamente el criterio de aceptación de REQ-A06. Así que P0-S7 y REQ-A06
 * quedan **satisfechos para Phase 0 bajo las restricciones de la opción A**, y no
 * bloqueados.
 *
 * Lo que sigue abierto es distinto y no es un requisito de Phase 0: **elegir entre
 * la opción B —oscurecer `teal` y `amber`— y la C —modificar §14—** para que la
 * paleta pueda usarse sin restricciones. Es una decisión **diferida**, con plazo
 * antes de Phase 5, cuando lleguen las 18 familias de componentes de §16. Diferido
 * no es bloqueado: nada de Phase 0 espera a esa decisión.
 * ---------------------------------------------------------------------------
 */

/**
 * `SATISFIED_UNDER_SD019_A` · satisfecho bajo las restricciones de la opción A.
 *
 * No es `COMPLETE`: la contradicción entre §2 y §14 sigue viva y la paleta sigue
 * sin poder usarse entera. Tampoco es `BLOCKED`: el criterio de aceptación de
 * REQ-A06 se cumple y está verificado en el navegador.
 */
export const DESIGN_SYSTEM_STATUS = 'SATISFIED_UNDER_SD019_A' as const;

/** Documento gobernante y su verificación. */
export const DESIGN_SYSTEM_SOURCE = {
  document: 'STUDY_OS_Design_System_v1.0',
  availability: 'AVAILABLE',
  sha256: '62a85885709cc2dc9ed4cffd71ed852ed1e54cf0962940ff53da93dd8c357aa4',
  verifiedAs: 'PDF 1.4 · 11 páginas · texto con fuentes incrustadas · 0 imágenes',
  /** Pasos y requisitos que este estado satisface para Phase 0. */
  satisfies: ['P0-S7', 'REQ-A06'],
  decision: 'SD-019 opción A · autorizada para Phase 0',
  /** Decisión diferida. No condiciona ningún entregable de Phase 0. */
  deferred: 'SD-019 · elegir entre B (oscurecer teal y amber) y C (modificar §14)',
  deferredDeadline: 'antes de Phase 5',
  trackedIn: 'docs/GOVERNING_DOCUMENTS.md',
} as const;

/**
 * Qué está verificado, bajo qué restricciones, y qué queda para más adelante.
 *
 * Las tres listas se mantienen separadas a propósito. Mezclarlas produce las dos
 * lecturas cómodas: «hay tokens del documento, luego REQ-A06 está hecho», y su
 * contraria, «queda una decisión abierta, luego nada vale».
 */
export const DESIGN_SYSTEM_COVERAGE = {
  /** Verificado por `tokens.contract.spec` y `tokens.contrast.spec`. */
  verified: [
    'los diez colores de §2, literales del documento',
    'escala de espaciado 4·8·12·16·24·32·48·64 de §2',
    'radios micro/control/card/hero de §2',
    'diana táctil mínima de 44px de §2 y §14',
    'rangos tipográficos de §2',
    'duraciones de movimiento de §13',
    'retícula de §3',
    'ausencia de tokens de gamificación y de los anti-patrones de §15',
    'coherencia entre tokens.ts y tokens.css',
    'trece pares de contraste que sí alcanzan el mínimo exigido',
  ],
  /**
   * Verificado en el navegador, no sobre una lista de tokens.
   *
   * `tests/e2e/static/accessibility.a11y.spec.ts` mide el color computado real de
   * cada texto visible contra su fondo efectivo, y las dianas táctiles con
   * `boundingBox()`. El fixture negativo del mismo fichero demuestra en cada
   * ejecución que la medición detecta los defectos que dice detectar.
   */
  renderedEvidence: [
    'color computado real de cada texto medido en / · /entrar · /registro · /offline, en móvil y escritorio',
    'umbral 4.5:1 para todo texto normal; 3:1 solo para texto grande según WCAG',
    'dianas táctiles de 44×44 px medidas con boundingBox()',
    'fixture negativo: slate sobre canvas (4.31:1) y un control de 24×24 hacen fallar la prueba',
    'control del fixture: la misma auditoría no encuentra nada en una página correcta',
  ],
  /**
   * Restricciones bajo las que se satisface REQ-A06.
   *
   * No son deuda oculta: son el contenido de la opción A, y las hace cumplir la
   * prueba de accesibilidad renderizada en cada ejecución.
   */
  constraints: [
    'teal y amber no llevan texto normal encima · onDark da 3.95 y 4.42, por debajo de 4.5',
    'slate solo como texto sobre surface · sobre canvas da 4.31',
    'sobre canvas, el texto usa ink, o va dentro de una superficie válida',
  ],
  /**
   * Diferido. Ningún entregable de Phase 0 lo espera.
   *
   * Con las 18 familias de componentes de §16 la restricción empieza a estorbar, y
   * ahí sí hay que haber elegido. Antes, no.
   */
  deferred: [
    'SD-019 · elegir entre B (oscurecer teal y amber) y C (modificar §14) · antes de Phase 5',
    'SD-008 · el propio §6 dice «Four/five semantic levels» para la escala de confianza',
    'tema oscuro: el documento no lo especifica y no se inventa',
    'familia tipográfica concreta: §2 da dirección, no nombre',
    'las 18 familias de componentes de §16, que corresponden a Phase 5 en adelante',
  ],
} as const;

/**
 * Procedencia de los valores de la paleta.
 *
 * `DOCUMENT` desde que el Design System está disponible y verificado. Antes era un
 * marcador de posición inventado.
 */
export const PALETTE_PROVENANCE = 'DOCUMENT' as const;

/**
 * ¿Queda algún entregable de Phase 0 esperando una decisión del Design System?
 *
 * No. La opción A está autorizada y aplicada, y el criterio de aceptación de
 * REQ-A06 se verifica en el navegador. Elegir entre B y C está diferido, y una
 * decisión diferida no bloquea nada.
 */
export function isDesignSystemBlocked(): boolean {
  return false;
}

/** ¿Queda alguna decisión del Design System pendiente, aunque no bloquee? */
export function hasDeferredDesignDecision(): boolean {
  return DESIGN_SYSTEM_COVERAGE.deferred.length > 0;
}
