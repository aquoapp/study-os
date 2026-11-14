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
 * **La opción A se autorizó para Phase 0 y se aplicó.** Acotaba el uso sin
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
 * ---------------------------------------------------------------------------
 * SD-019 · cerrada el 2026-09-20 con la opción C
 *
 * Lo que quedaba abierto —elegir entre la opción B, oscurecer `teal` y `amber`, y
 * la C, aclarar §14— lo resolvió Ana en la resolución final de Product UX · Wave 3
 * (VIS-D5). **Opción C:** ningún valor de color congelado se mueve y §14 se aclara
 * por cambio de especificación versionado: **AA aplica al texto**, y los colores
 * que no admiten un emparejamiento de texto accesible en la paleta congelada son,
 * **en esos contextos**, colores de indicador, de superficie o de acento.
 *
 * El suelo de WCAG **no se debilita**. Lo que cambia es qué cuenta como texto, no
 * cuánto contraste exige el texto. Las restricciones siguen siendo exactamente las
 * mismas —y una más, medida en esta ronda, **AA-1**: `magenta` sobre `canvas` da
 * 4.47:1 y nunca es texto normal ahí—, solo que ahora son **la norma** y no el
 * precio temporal de una decisión pendiente.
 *
 * Este fichero y `tokens.ts` decían hasta hoy que B y C seguían diferidas «antes de
 * Phase 5». Era cierto cuando se escribió y dejó de serlo el 2026-09-20; el desfase
 * se registró como **OBS-4B-03** y se corrige aquí, **con su prueba, en el mismo
 * acto**, en el primer acto de implementación autorizado de Phase 4B.
 * ---------------------------------------------------------------------------
 */

/**
 * `SATISFIED_UNDER_SD019_C` · satisfecho bajo la norma de la opción C.
 *
 * Ya no es «bajo restricciones provisionales»: las restricciones son la
 * especificación aclarada. Tampoco es `COMPLETE`, porque las 18 familias de
 * componentes de §16 siguen sin existir y ese trabajo es de Phase 5 en adelante.
 */
export const DESIGN_SYSTEM_STATUS = 'SATISFIED_UNDER_SD019_C' as const;

/** Documento gobernante y su verificación. */
export const DESIGN_SYSTEM_SOURCE = {
  document: 'STUDY_OS_Design_System_v1.0',
  availability: 'AVAILABLE',
  sha256: '62a85885709cc2dc9ed4cffd71ed852ed1e54cf0962940ff53da93dd8c357aa4',
  verifiedAs: 'PDF 1.4 · 11 páginas · texto con fuentes incrustadas · 0 imágenes',
  /** Pasos y requisitos que este estado satisface para Phase 0. */
  satisfies: ['P0-S7', 'REQ-A06'],
  decision: 'SD-019 opción C · aceptada el 2026-09-20 · AA aplica al texto',
  decisionRecordedIn:
    'docs/SPEC_DIFF_LOG.md · SD-019 · aceptación · docs/PRODUCT_UX_CONTRACT.md §R',
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
   * Restricciones de la opción C. **Ya no son provisionales: son la norma.**
   *
   * Las cuatro están medidas, ninguna inventada, y las hace cumplir la prueba de
   * accesibilidad renderizada en cada ejecución.
   */
  constraints: [
    'teal y amber no llevan texto normal encima · onDark da 3.95 y 4.42, por debajo de 4.5',
    'slate solo como texto sobre surface · sobre canvas da 4.31',
    'magenta nunca como texto normal sobre canvas · da 4.47 (AA-1); sobre surface da 4.87',
    'sobre canvas, el texto usa ink, o va dentro de una superficie válida',
  ],
  /**
   * Restricción de **profundidad**, no de contraste de texto.
   *
   * `surface` y `canvas` se separan solo 1.09:1: la paleta congelada no da
   * profundidad tonal, así que la hacen el espacio, la escala, la tipografía, un
   * borde óptico y una luz de suelo, y la sombra se reserva a las superposiciones
   * (PRODUCT_UX_CONTRACT §S.7). Queda escrito aquí para que no vuelva a leerse
   * como una excepción de contraste, que no lo es.
   */
  depthConstraint: 'surface/canvas se separan 1.09:1 · la profundidad no la da el tono',
  /**
   * Diferido. Ningún entregable en curso lo espera.
   *
   * SD-019 salió de esta lista el 2026-09-20 al aceptarse la opción C, y la familia
   * tipográfica salió al ratificarse IBM Plex Sans (VIS-D2, VIS-D3).
   */
  deferred: [
    'SD-008 · el propio §6 dice «Four/five semantic levels» para la escala de confianza',
    'tema oscuro: el documento no lo especifica y no se inventa',
    'marca / logotipo externo definitivo · diferido y no bloqueante (PRODUCT_UX_CONTRACT §S.12)',
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
