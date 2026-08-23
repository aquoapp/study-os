/**
 * Estado de la fundación del Design System.
 *
 * P0-S7 · «Fundación de tokens del Design System»
 * REQ-A06 · «Tokens del Design System (color, espaciado, radio, tipografía, 44px)»
 * Criterio de aceptación de REQ-A06: «Tokens conformes; contraste AA verificado».
 *
 * ---------------------------------------------------------------------------
 * Qué cambió, y por qué el bloqueo sigue en pie con otro motivo
 *
 * La entrega anterior inventó una paleta porque `STUDY_OS_Design_System_v1.0` no
 * estaba disponible, y declaró P0-S7 completo. La auditoría externa lo rechazó.
 *
 * El documento **apareció** en `_handoff/originals/` durante la ronda correctiva y
 * se verificó (nombre, SHA-256 y naturaleza real del contenido). Los tokens ya no
 * son inventados: todos los valores salen de §2, §3 y §13.
 *
 * Pero REQ-A06 sigue **BLOQUEADO**, ahora por un motivo verificado en lugar de
 * supuesto: la paleta congelada de §2 contiene tres combinaciones que **no alcanzan
 * el AA que §14 exige como P0**. No se pueden corregir aquí sin alterar valores
 * congelados, que es precisamente lo que EC-019 prohíbe. Está registrado como
 * `SD-019` y necesita decisión humana.
 * ---------------------------------------------------------------------------
 */

export const DESIGN_SYSTEM_STATUS = 'BLOCKED' as const;

/** Documento gobernante y su verificación. */
export const DESIGN_SYSTEM_SOURCE = {
  document: 'STUDY_OS_Design_System_v1.0',
  availability: 'AVAILABLE',
  sha256: '62a85885709cc2dc9ed4cffd71ed852ed1e54cf0962940ff53da93dd8c357aa4',
  verifiedAs: 'PDF 1.4 · 11 páginas · texto con fuentes incrustadas · 0 imágenes',
  blocks: ['P0-S7', 'REQ-A06'],
  blockedBy: 'SD-019',
  trackedIn: 'docs/GOVERNING_DOCUMENTS.md',
} as const;

/**
 * Qué está verificado y qué no.
 *
 * Separar ambas cosas evita la lectura cómoda de «hay tokens del documento, luego
 * REQ-A06 está hecho». Los valores son correctos y trazables; el criterio de
 * aceptación no se cumple entero.
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
  /** Impide cerrar REQ-A06. */
  blocked: [
    'SD-019 · onDark sobre teal da 3.95 y sobre amber 4.42: por debajo del 4.5 de §14',
    'SD-019 · slate sobre canvas da 4.31: texto secundario sobre el fondo de página no alcanza AA',
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

export function isDesignSystemBlocked(): boolean {
  return DESIGN_SYSTEM_STATUS === 'BLOCKED';
}
