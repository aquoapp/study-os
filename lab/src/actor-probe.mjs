/**
 * Sonda del proceso Actor · CP2.
 *
 * Se ejecuta **como proceso hijo** con exactamente el entorno que el laboratorio daría al Actor,
 * y desde dentro intenta encontrar lo que no debería tener. Informa por stdout en JSON.
 *
 * Por qué un proceso aparte: una comprobación hecha en el mismo proceso del test demuestra que
 * el objeto de credenciales está bien construido, no que el Actor carezca de privilegios. Lo
 * segundo solo se ve desde dentro del proceso que de verdad correría.
 *
 * El primer argumento es la lista de secretos a buscar, separada por saltos de línea. La sonda
 * los recibe para poder *buscarlos*; el Actor real nunca los recibe.
 */

const needles = (process.argv[2] ?? '').split('\n').filter(Boolean);

const env = process.env;
const values = Object.values(env).filter((value) => typeof value === 'string');

/** ¿Aparece algún secreto, bajo cualquier nombre de variable? */
const leaked = needles.filter((needle) => values.some((value) => value.includes(needle)));

/** ¿Hay alguna cadena de conexión utilizable? */
const sqlLike = Object.entries(env)
  .filter(([, value]) => typeof value === 'string' && /postgres(ql)?:\/\//.test(value))
  .map(([name]) => name);

/** ¿Hay alguna variable que huela a privilegio por su nombre? */
const privilegedNames = Object.keys(env).filter((name) =>
  /SERVICE_ROLE|DB_URL|DATABASE_URL|ACCESS_TOKEN/i.test(name),
);

process.stdout.write(
  JSON.stringify({
    leakedSecrets: leaked.length,
    sqlConnectionVariables: sqlLike,
    privilegedNames,
    sawAnonKey: typeof env['LAB_SUPABASE_ANON_KEY'] === 'string',
    sawApiUrl: typeof env['LAB_SUPABASE_URL'] === 'string',
  }),
);
