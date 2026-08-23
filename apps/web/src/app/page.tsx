import Link from 'next/link';

import { getVerifiedIdentity } from '../server/auth/identity';

/**
 * Página raíz.
 *
 * No es una pantalla de producto: es la superficie mínima que prueba que la
 * aplicación arranca (gate P0-G1 · `app.boot.e2e`). HOY y el resto de espacios
 * primarios se construyen en Phase 5.
 */
export default async function HomePage() {
  const identity = await getVerifiedIdentity();

  return (
    <div data-testid="app-root" className="so-page">
      <h1 style={{ fontFamily: 'var(--so-font-reading)', lineHeight: 'var(--so-leading-tight)' }}>
        Study OS
      </h1>

      <p data-testid="phase-marker">Phase 0 · Foundation</p>

      {/* SD-019 opción A · el texto secundario vive sobre `surface`, no sobre `canvas`. */}
      <div className="so-panel">
        <p className="so-text-secondary" style={{ margin: 0 }}>
          Fundación de repositorio, entornos, migraciones, esqueleto de autenticación y tokens del
          Design System. Todavía no existe contenido, ni motores, ni espacios de estudio.
        </p>
      </div>

      {identity ? (
        <p data-testid="session-state" data-authenticated="true">
          Sesión verificada en servidor.{' '}
          <Link className="so-action" href="/cuenta">
            Ir a mi cuenta
          </Link>
        </p>
      ) : (
        <p data-testid="session-state" data-authenticated="false">
          <Link className="so-action" href="/entrar">
            Entrar
          </Link>{' '}
          <Link className="so-action" href="/registro">
            Crear cuenta
          </Link>
        </p>
      )}
    </div>
  );
}
