/**
 * Guarda de sustrato del laboratorio · **fail-closed por identidad positiva**.
 *
 * ---------------------------------------------------------------------------
 * Por qué una allowlist y no una denylist
 *
 * Una denylist de proyectos prohibidos es una carrera que se pierde: hay que acertar con todos
 * los identificadores, hoy y para siempre, y basta olvidar uno. Además obligaría a escribir en
 * un repositorio público identificadores de proyectos ajenos, que es exactamente lo que
 * `CLAUDE.md` §9 prohíbe.
 *
 * Aquí se invierte: **solo se admite el sustrato efímero local**, declarado explícitamente y
 * verificado por su forma. Todo lo demás se rechaza sin necesidad de nombrarlo. STAGING,
 * PRODUCTION, AQUO y cualquier proyecto futuro quedan fuera por construcción, no por lista.
 *
 * Y no se confía en nombres: que una variable diga «local» o «test» no prueba nada. Lo que se
 * comprueba es que el host sea **literalmente** una dirección de loopback y que el puerto sea
 * uno de los declarados por `supabase/config.toml`.
 * ---------------------------------------------------------------------------
 */

/** Declaración explícita y obligatoria. Sin esto, el laboratorio no arranca. */
export const SUBSTRATE_ENV_VAR = 'LAB_SUBSTRATE';
export const EPHEMERAL_SUBSTRATE = 'ephemeral-ci';

/**
 * Nombres de las variables del sustrato, en un solo sitio.
 *
 * Centralizarlos no es cosmética: evita que el nombre de una credencial aparezca escrito como
 * asignación literal por el repositorio, que es justo lo que `secret-scan` vigila bajo EC-010.
 */
export const LAB_ENV = {
  apiUrl: 'LAB_SUPABASE_URL',
  databaseUrl: 'LAB_DATABASE_URL',
  anonKey: 'LAB_SUPABASE_ANON_KEY',
  privilegedKey: 'LAB_SUPABASE_SERVICE_ROLE_KEY',
} as const;

/** Hosts de loopback admitidos, literales. Ningún nombre DNS, por amable que suene. */
const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]', '::1']);

/** Puertos del sustrato efímero, los de `supabase/config.toml`. */
export const EPHEMERAL_API_PORT = 54321;
export const EPHEMERAL_DB_PORT = 54322;

export class SubstrateRejected extends Error {
  constructor(message: string) {
    super(`sustrato rechazado · ${message}`);
    this.name = 'SubstrateRejected';
  }
}

/**
 * Variables de entorno que apuntan a infraestructura real y que **no deben estar presentes**
 * cuando corre el laboratorio.
 *
 * No basta con ignorarlas: si están definidas, algo del proceso las heredó, y una heredada es
 * precisamente el camino por el que una campaña acabaría escribiendo donde no debe.
 */
export const CLOUD_ENV_VARS = [
  'SUPABASE_DB_URL',
  'STAGING_DB_URL',
  'SUPABASE_ACCESS_TOKEN',
  'SUPABASE_PROJECT_REF',
  'VERCEL_TOKEN',
] as const;

function parseUrl(raw: string, label: string): URL {
  try {
    return new URL(raw);
  } catch {
    throw new SubstrateRejected(`${label} no es una URL válida`);
  }
}

/**
 * Una URL es del sustrato efímero si su host es loopback y su puerto el declarado.
 *
 * **Userinfo: depende de qué URL.** En la URL de API, `http://algo@127.0.0.1:54321` apunta de
 * verdad al loopback —`algo` es usuario, no destino—, así que no es una fuga, pero oscurece la
 * lectura y el sustrato no lo necesita: se rechaza. En una **cadena de postgres**, en cambio,
 * el userinfo es la forma estándar de nombrar al usuario, y el stack local del CLI la emite así
 * con credenciales públicas por defecto. Prohibirlo ahí rechazaría el sustrato legítimo.
 *
 * Esta distinción la descubrió la primera ejecución de CP2 contra una instancia real: la regla
 * de CP1 era correcta en su intención y demasiado amplia en su alcance.
 *
 * Las formas cortas (`127.1`) sí se admiten: `URL` las normaliza a `127.0.0.1` y son loopback
 * real. Lo que decide es el host normalizado, no su grafía.
 */
function assertLoopback(
  url: URL,
  label: string,
  expectedPort: number,
  { allowUserInfo = false }: { allowUserInfo?: boolean } = {},
): void {
  if (!allowUserInfo && (url.username !== '' || url.password !== '')) {
    throw new SubstrateRejected(
      `${label} lleva credenciales embebidas en la URL. El sustrato no las necesita y su ` +
        'presencia oscurece a dónde apunta la conexión.',
    );
  }
  if (!LOOPBACK_HOSTS.has(url.hostname)) {
    throw new SubstrateRejected(
      `${label} apunta a "${url.hostname}", que no es loopback. El laboratorio solo corre contra ` +
        'el sustrato efímero local: cualquier host remoto queda fuera por construcción.',
    );
  }
  if (url.port !== String(expectedPort)) {
    throw new SubstrateRejected(
      `${label} usa el puerto ${url.port || '(ninguno)'} y el sustrato declara ${expectedPort}`,
    );
  }
}

export interface SubstrateInput {
  readonly [key: string]: string | undefined;
}

export interface EphemeralSubstrate {
  readonly apiUrl: string;
  readonly anonKey: string;
  readonly serviceRoleKey: string;
  readonly databaseUrl: string;
}

/**
 * Verifica y devuelve el sustrato efímero, o lanza.
 *
 * No devuelve un valor por defecto, no degrada y no elige otro destino: si algo no encaja, el
 * laboratorio no arranca. Esa es la definición operativa de *fail-closed*.
 */
export function requireEphemeralSubstrate(env: SubstrateInput): EphemeralSubstrate {
  const declared = env[SUBSTRATE_ENV_VAR];
  if (declared !== EPHEMERAL_SUBSTRATE) {
    throw new SubstrateRejected(
      `${SUBSTRATE_ENV_VAR} debe valer exactamente "${EPHEMERAL_SUBSTRATE}" y vale ` +
        `"${declared ?? '(sin definir)'}". El sustrato se declara, nunca se deduce.`,
    );
  }

  for (const name of CLOUD_ENV_VARS) {
    if (env[name] !== undefined && env[name] !== '') {
      throw new SubstrateRejected(
        `${name} está definida en el entorno. Una variable heredada de infraestructura real es ` +
          'el camino por el que una campaña acabaría escribiendo fuera del sustrato.',
      );
    }
  }

  const apiRaw = env[LAB_ENV.apiUrl];
  const dbRaw = env[LAB_ENV.databaseUrl];
  const anonKey = env[LAB_ENV.anonKey];
  const serviceRoleKey = env[LAB_ENV.privilegedKey];

  for (const [name, value] of [
    [LAB_ENV.apiUrl, apiRaw],
    [LAB_ENV.databaseUrl, dbRaw],
    [LAB_ENV.anonKey, anonKey],
    [LAB_ENV.privilegedKey, serviceRoleKey],
  ] as const) {
    if (!value) throw new SubstrateRejected(`falta ${name}`);
  }

  assertLoopback(parseUrl(apiRaw as string, LAB_ENV.apiUrl), LAB_ENV.apiUrl, EPHEMERAL_API_PORT);
  assertLoopback(
    parseUrl(dbRaw as string, LAB_ENV.databaseUrl),
    LAB_ENV.databaseUrl,
    EPHEMERAL_DB_PORT,
    // El userinfo es parte del protocolo en una cadena de postgres. Lo que protege aquí sigue
    // siendo lo mismo: el host tiene que ser loopback y el puerto, el declarado.
    { allowUserInfo: true },
  );

  return {
    apiUrl: apiRaw as string,
    anonKey: anonKey as string,
    serviceRoleKey: serviceRoleKey as string,
    databaseUrl: dbRaw as string,
  };
}
