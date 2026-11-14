/**
 * Browser Adapter · CP2 · alcance mínimo.
 *
 * ---------------------------------------------------------------------------
 * Qué puede hacer en CP2 y por qué tan poco
 *
 * Abrir la aplicación, darse de alta con una identidad sintética y llegar a una superficie de
 * aprendiz. **Nada más.** No completa LEARN ni COMPROBAR, y no produce Route A como evidencia del
 * laboratorio: eso es campaña, y la campaña es de checkpoints posteriores.
 *
 * El adaptador conduce el navegador como lo haría una persona: abre rutas, escribe en campos y
 * pulsa botones. No inyecta estado, no escribe cookies a mano y no llama a ninguna RPC. Si una
 * pantalla no se puede alcanzar pulsando, para el laboratorio no se puede alcanzar.
 * ---------------------------------------------------------------------------
 */

import type { ActorCredentials } from './credentials';
import type { SyntheticIdentity } from './harness';

/** Lo mínimo que el adaptador necesita de la página, sin atarse a Playwright en los tipos. */
export interface PageLike {
  goto(url: string): Promise<unknown>;
  fill(selector: string, value: string): Promise<void>;
  click(selector: string): Promise<void>;
  waitForURL(pattern: RegExp, options?: { timeout?: number }): Promise<void>;
  textContent(selector: string): Promise<string | null>;
  url(): string;
}

export class BrowserAdapterRefused extends Error {
  constructor(message: string) {
    super(`adaptador de navegador · ${message}`);
    this.name = 'BrowserAdapterRefused';
  }
}

/** Superficies que CP2 puede alcanzar. Ampliar esta lista es ampliar el alcance del checkpoint. */
export const CP2_REACHABLE = ['/', '/registro', '/entrar', '/hoy'] as const;
export type Cp2Surface = (typeof CP2_REACHABLE)[number];

export interface BrowserAdapterContext {
  readonly page: PageLike;
  readonly credentials: ActorCredentials;
  readonly baseUrl: string;
}

function assertReachable(path: string): asserts path is Cp2Surface {
  if (!(CP2_REACHABLE as readonly string[]).includes(path)) {
    throw new BrowserAdapterRefused(
      `"${path}" está fuera del alcance de CP2. Ampliarlo sería ejecutar campaña sin ` +
        'autorización: los escenarios llegan en checkpoints posteriores.',
    );
  }
}

/** Abre una superficie permitida. */
export async function open(context: BrowserAdapterContext, path: Cp2Surface): Promise<void> {
  assertReachable(path);
  await context.page.goto(`${context.baseUrl}${path}`);
}

/**
 * Alta de la identidad sintética **por la interfaz real**.
 *
 * Pasa por `/registro` y por su server action, como cualquier persona. No usa el API de
 * administración: si se usara, el alta probaría que el laboratorio tiene privilegios, no que el
 * producto permite registrarse.
 */
export async function registerThroughUi(
  context: BrowserAdapterContext,
  identity: SyntheticIdentity,
): Promise<void> {
  await open(context, '/registro');
  await context.page.fill('[data-testid="email-input"]', identity.email);
  await context.page.fill('[data-testid="password-input"]', identity.password);
  await context.page.click('[data-testid="submit-button"]');
  await context.page.waitForURL(/\/hoy/, { timeout: 30_000 });
}

/** Lee el texto de una superficie alcanzada, para que el ledger registre qué se vio. */
export async function readSurface(context: BrowserAdapterContext): Promise<string> {
  const text = await context.page.textContent('body');
  if (text === null) throw new BrowserAdapterRefused('la página no devolvió contenido');
  return text;
}
