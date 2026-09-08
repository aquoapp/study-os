# STUDY OS · Propuesta de dependencias · Phase 0

**Contrato:** `Builder Handoff Manifest §7` · «New dependencies require a concrete
reason… Avoid infrastructure novelty.»
**Estado:** propuesto con la fundación de Phase 0. Ninguna dependencia cae fuera del
stack que fija `ADR-001` punto 1.

Cada entrada declara: paquete, problema que resuelve, por qué la plataforma no basta,
implicación de mantenimiento y seguridad, y si es crítica para el MVP.

---

## Ejecución

| Paquete | Problema | ¿Por qué no basta la plataforma? | Mantenimiento / seguridad | ¿Crítica MVP? |
|---|---|---|---|---|
| `next` | Framework de aplicación con App Router, renderizado en servidor y rutas | Escribir SSR, enrutado y bundling a mano es reconstruir el framework | Fijado por `ADR-001` punto 1 y `Technical Architecture §1`. Actualizaciones frecuentes; superficie grande, muy auditada | **Sí** |
| `react`, `react-dom` | Capa de vista | Requerido por Next | Ídem | **Sí** |
| `@supabase/supabase-js` | Cliente de datos y de Auth | La alternativa es hablar con PostgREST y GoTrue a mano y reimplementar el refresco de token | Cliente oficial. Es también el que da `getClaims()`/`getUser()`, de los que depende **INV-116** | **Sí** |
| `@supabase/ssr` | Puente de sesión entre cookies y renderizado en servidor | Sin él hay que gestionar a mano cookies de sesión en middleware y Server Components: es exactamente el punto donde se cometen los errores de autorización | Oficial y pequeño. Habilita el camino verificado de INV-116 | **Sí** |
| `server-only` | Hace que el **build falle** si un módulo de servidor entra en un Client Component | Sin él, EC-010 depende de que nadie se equivoque al importar | Paquete trivial (un fichero). Convierte una convención en un control | **Sí** |

## Desarrollo y verificación

| Paquete | Problema | ¿Por qué no basta la plataforma? | Mantenimiento / seguridad | ¿Crítica MVP? |
|---|---|---|---|---|
| `typescript` | Tipado estricto | Exigido por `REQ-A02` (`strict: true`) | Estándar | **Sí** |
| `@types/node`, `@types/react`, `@types/react-dom` | Tipos de las plataformas usadas | — | Solo tipos, sin código en ejecución | **Sí** |
| `eslint`, `@eslint/js`, `typescript-eslint` | Check de CI `lint`, incluida la regla de import de motores y la prohibición de `getSession()` como autoridad | `tsc` no expresa reglas de arquitectura | Estándar | **Sí** |
| `prettier` | Formato uniforme | Evita que el ruido de formato oculte cambios reales en la revisión | Estándar | No, pero barato |
| `vitest` | `test:unit`, `test:integration`, `test:rls` | Ejecutar TypeScript en el runner de Node sin transpilación previa | Estándar. Rápido | **Sí** |
| `@playwright/test` | `test:e2e` · gate P0-G1 | Los gates de arranque, PWA y auth solo se prueban en un navegador real | Descarga navegadores; en CI se instala solo Chromium | **Sí** |

## Herramientas externas (no son dependencias de npm del producto)

| Herramienta | Uso | Nota |
|---|---|---|
| Supabase CLI | `supabase start`, `db reset`, `db diff` | Se invoca con `npx`; en CI mediante `supabase/setup-cli`. No entra en el bundle |
| Docker | Requisito de `supabase start` en local | **No está instalado en la máquina de desarrollo actual.** Ver `docs/PHASE_0_CHECKPOINT.md` |

---

## Descartadas deliberadamente en Phase 0

| Candidata | Motivo |
|---|---|
| `next-pwa`, `workbox` | El service worker de Phase 0 son ~60 líneas con un alcance deliberadamente mínimo (EC-012). Una librería de caché generosa facilita romper el invariante de offline acotado sin darse cuenta |
| Librería de componentes (shadcn, MUI, Radix…) | El Design System es propio y está congelado. Adoptar una librería antes de tener el documento disponible sería decidir la estética por omisión |
| Tailwind u otra utilidad de CSS | Los tokens son variables CSS y el contrato se verifica en test. Añadir un compilador de estilos en Phase 0 no resuelve ningún problema presente |
| `zod` u otro validador de esquemas | Todavía no hay ningún límite de confianza con datos externos. Se reevaluará cuando existan endpoints con entrada de usuario |
| `pg` | Los tests de integración y RLS usan `@supabase/supabase-js` autenticado, que atraviesa PostgREST **y** RLS igual que en producción. Conectar por `pg` como superusuario probaría un camino que la aplicación no recorre |
| `pgvector` | `ADR-001` punto 4 lo difiere a Phase 8 y solo si existe corpus ingerido que lo justifique |
| Cualquier proveedor de IA | `MI-05b` es entrada de **Phase 8**, no de Phase 0. No se solicita ni se configura ahora |
