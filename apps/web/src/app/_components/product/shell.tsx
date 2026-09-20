import type { ReactNode } from 'react';

import styles from './product.module.css';

/**
 * Las piezas estructurales del sistema visual L2 · `docs/PRODUCT_UX_CONTRACT.md` §S.
 *
 * Son componentes de servidor: no llevan estado y no deciden nada. La decisión ya viene tomada
 * del Planner, y lo único que hacen aquí es **representarla** con la gramática aceptada.
 */

/**
 * El marco de una superficie de producto.
 *
 * `adapting` es la firma adaptativa **AS-2 · solo activo** (§S.4): se pone a `true` únicamente
 * mientras STUDY OS está computando, recomponiendo o produciendo una decisión nueva de verdad.
 * En reposo no se pasa, y entonces no hay teal en ninguna parte. El teal significa exactamente
 * una cosa —*STUDY OS está actuando o adaptándose*— y no significa correcto, bueno, progreso,
 * dominio, validez, preparación ni completitud.
 */
export function ProductShell({
  children,
  adapting = false,
  testId,
}: {
  readonly children: ReactNode;
  readonly adapting?: boolean;
  readonly testId?: string;
}) {
  return (
    <div className={styles.page} data-adapting={adapting ? 'true' : undefined} data-testid={testId}>
      {/* §S.2 · ancla estructural persistente. En reposo, neutra. No mide nada. */}
      <div className={styles.spine} aria-hidden="true" />
      {children}
    </div>
  );
}

/**
 * El wordmark de producto v1 · **W1** (§S.12).
 *
 * Aprobado **para producto v1 únicamente**. No es logotipo corporativo permanente, ni marca
 * externa, ni identidad de marketing, ni icono de aplicación: esas preguntas quedan diferidas y
 * no bloquean Phase 4B. Se mantiene callado a propósito, para que HOY y la acción actual dominen.
 */
export function Wordmark() {
  return (
    <p className={styles.wordmark}>
      STUDY<span className={styles.wordmarkGap}> </span>
      <span className={styles.wordmarkOs}>OS</span>
    </p>
  );
}

/** Voz de sistema (§S.11): versal, micro, tracking. Indica **autoría**, no jerarquía de valor. */
export function SystemVoice({
  children,
  testId,
}: {
  readonly children: ReactNode;
  readonly testId?: string;
}) {
  return (
    <p className={styles.systemVoice} data-testid={testId}>
      {children}
    </p>
  );
}

/**
 * La superficie de decisión dominante, anclada a la espina (§S.3).
 *
 * **Una por pantalla.** Su anclaje significa algo concreto: *este objeto lo produjo y lo sostiene
 * STUDY OS*. Por eso no se generaliza a cualquier tarjeta.
 */
export function DecisionSurface({
  children,
  testId,
}: {
  readonly children: ReactNode;
  readonly testId?: string;
}) {
  return (
    <section className={styles.anchored} data-testid={testId}>
      {children}
    </section>
  );
}

/** Superficie neutra, no dominante. Para lo que no es la decisión del sistema. */
export function Panel({
  children,
  testId,
}: {
  readonly children: ReactNode;
  readonly testId?: string;
}) {
  return (
    <section className={styles.panel} data-testid={testId}>
      {children}
    </section>
  );
}

export function PageTitle({
  children,
  testId,
}: {
  readonly children: ReactNode;
  readonly testId?: string;
}) {
  return (
    <h1 className={styles.pageTitle} data-testid={testId}>
      {children}
    </h1>
  );
}

export function ActionTitle({
  children,
  testId,
}: {
  readonly children: ReactNode;
  readonly testId?: string;
}) {
  return (
    <h2 className={styles.actionTitle} data-testid={testId}>
      {children}
    </h2>
  );
}

/** Texto secundario. Solo legible dentro de una superficie: `slate` sobre `canvas` da 4.31. */
export function Secondary({
  children,
  testId,
}: {
  readonly children: ReactNode;
  readonly testId?: string;
}) {
  return (
    <p className={styles.secondary} data-testid={testId}>
      {children}
    </p>
  );
}

/** Contenedor de acciones. UX-INV-1 · exactamente una primaria, y **cero** en S6, S7 y S8. */
export function Actions({ children }: { readonly children: ReactNode }) {
  return <div className={styles.actions}>{children}</div>;
}

/**
 * La ranura reservada de retroalimentación computacional (§S.6).
 *
 * Existe **siempre**, incluso vacía, de modo que nada se reajusta cuando aparece el texto. Su
 * contenido son hechos —*Tu tiempo cambió*, *Ajustando la sesión a N min*, *Sesión reajustada*—
 * y nunca porcentajes, mensajes rotatorios ni «analizando».
 */
export function ActivitySlot({ children }: { readonly children?: ReactNode }) {
  return (
    <div className={styles.activitySlot} aria-live="polite" data-testid="actividad">
      {children ? <span className={styles.systemVoice}>{children}</span> : null}
    </div>
  );
}

/**
 * La cabecera de una acción (UX-INV-17, UX-INV-24).
 *
 * Es **contexto, no encabezado**: no entra en el orden de encabezados (§R). Los dos pasos de una
 * acción de dos pasos la llevan **idéntica** y muestran la **misma** posición; una acción de un
 * solo paso no muestra indicador de fase.
 */
export function ActionHeader({
  nature,
  position,
  total,
  phase,
}: {
  readonly nature: string;
  readonly position: number;
  readonly total: number;
  readonly phase?: string;
}) {
  return (
    <div className={styles.actionHeader} data-testid="cabecera-accion">
      <span className={styles.systemVoice} data-testid="accion-naturaleza">
        {nature}
      </span>
      <span className={`${styles.systemVoice} ${styles.numeric}`} data-testid="accion-posicion">
        Acción {position} de {total}
      </span>
      {phase ? (
        <span className={styles.systemVoice} data-testid="accion-fase">
          {phase}
        </span>
      ) : null}
    </div>
  );
}

export { styles as productStyles };
