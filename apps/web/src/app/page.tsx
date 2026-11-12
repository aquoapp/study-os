import Link from 'next/link';

import { getVerifiedIdentity } from '../server/auth/identity';

/**
 * Página raíz · entrada a la aplicación.
 *
 * No es un espacio de producto: HOY lo es. Esta pantalla solo decide **por dónde se entra**.
 *
 * ---------------------------------------------------------------------------
 * Phase 4B · por qué cambia
 *
 * Decía «Phase 0 · Foundation» y «Todavía no existe contenido, ni motores, ni espacios de
 * estudio», y su única navegación autenticada era «Ir a mi cuenta». Las tres cosas eran
 * ciertas en Phase 0 y son falsas desde que existen el corpus, el Learning Engine, el Planner
 * y el vertical de estudio.
 *
 * No era solo una falsedad: era **la mitad del bloqueo**. `/cuenta` no enlaza a ninguna parte
 * y `/onboarding` solo se alcanza desde HOY, de modo que la portada dejaba a una cuenta nueva
 * sin ningún camino navegable hacia el producto.
 *
 * Es el mismo defecto que EC-012 prohíbe, al revés: negar una capacidad que sí existe. Lo que
 * lo sustituye no promete nada —ni cuánto, ni qué, ni que haya algo hoy—: dice qué hace el
 * sistema y por dónde se entra.
 * ---------------------------------------------------------------------------
 */
export default async function HomePage() {
  const identity = await getVerifiedIdentity();

  return (
    <div data-testid="app-root" className="so-page">
      <h1 style={{ fontFamily: 'var(--so-font-reading)', lineHeight: 'var(--so-leading-tight)' }}>
        Study OS
      </h1>

      {/* SD-019 opción A · el texto secundario vive sobre `surface`, no sobre `canvas`. */}
      <div className="so-panel">
        <p className="so-text-secondary" style={{ margin: 0 }}>
          Cada día decide qué te toca a partir de lo que ya has estudiado. Si hoy no toca nada,
          también te lo dice.
        </p>
      </div>

      {identity ? (
        <p data-testid="session-state" data-authenticated="true">
          <Link className="so-action" href="/hoy" data-testid="raiz-ir-a-hoy">
            Ir a Hoy
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

      {identity ? (
        <p style={{ marginTop: 24 }}>
          <Link href="/cuenta" data-testid="raiz-mi-cuenta">
            Mi cuenta
          </Link>
        </p>
      ) : null}
    </div>
  );
}
