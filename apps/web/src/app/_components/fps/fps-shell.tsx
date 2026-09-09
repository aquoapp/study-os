import type { ReactNode } from 'react';

import styles from './fps.module.css';

/**
 * Primitivas de pantalla del First Product Slice.
 *
 * Solo existen las que el contrato de pantalla necesita (`docs/FPS_SCREEN_CONTRACT.md` §7).
 * No es la biblioteca de componentes de Phase 5, y no pretende serlo: cualquier familia que
 * este vertical no use, no se escribe.
 *
 * El FPS no monta la navegación de los cinco espacios primarios (REQ-F13): es un vertical, y
 * cada pantalla ofrece su propia continuación.
 */

export function FpsShell({ children }: { readonly children: ReactNode }) {
  return (
    <div className={styles.shell}>
      <div className={styles.column}>{children}</div>
    </div>
  );
}

export function FpsHeading({
  kicker,
  title,
  testId,
}: {
  readonly kicker?: string;
  readonly title: string;
  readonly testId?: string;
}) {
  return (
    <header>
      {kicker ? <p className={styles.kicker}>{kicker}</p> : null}
      <h1 className={styles.title} data-testid={testId}>
        {title}
      </h1>
    </header>
  );
}

export function FpsCard({
  children,
  testId,
}: {
  readonly children: ReactNode;
  readonly testId?: string;
}) {
  return (
    <section className={styles.card} data-testid={testId}>
      {children}
    </section>
  );
}

export function FpsSurface({
  children,
  label,
  testId,
}: {
  readonly children: ReactNode;
  readonly label?: string;
  readonly testId?: string;
}) {
  return (
    <section className={styles.surface} aria-label={label} data-testid={testId}>
      {children}
    </section>
  );
}

export function FpsNote({
  children,
  testId,
}: {
  readonly children: ReactNode;
  readonly testId?: string;
}) {
  return (
    <p className={styles.note} data-testid={testId}>
      {children}
    </p>
  );
}

export function FpsSecondary({ children }: { readonly children: ReactNode }) {
  return <p className={styles.secondary}>{children}</p>;
}

export function FpsActions({ children }: { readonly children: ReactNode }) {
  return <div className={styles.actions}>{children}</div>;
}

export function FpsReading({ children }: { readonly children: ReactNode }) {
  return <div className={styles.reading}>{children}</div>;
}

export function FpsSectionTitle({ children }: { readonly children: ReactNode }) {
  return <h2 className={styles.sectionTitle}>{children}</h2>;
}

/** Recuentos de FIN. Solo hechos contados; ninguna proyección y ningún porcentaje. */
export function FpsSummary({
  rows,
}: {
  readonly rows: readonly { readonly label: string; readonly value: string }[];
}) {
  return (
    <dl className={styles.summary} data-testid="resumen">
      {rows.map((row) => (
        <div key={row.label} style={{ display: 'contents' }}>
          <dt className={styles.summaryTerm}>{row.label}</dt>
          <dd className={styles.summaryValue}>{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}
