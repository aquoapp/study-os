# STUDY OS · Phase 3.1 · Learning Engine Runtime Invocation Corrective · registro de autorización

**Fecha:** 2026-09-16
**Decisora:** Ana Victoria
**Estado:** `AUTORIZADO` para gobernanza y **candidato correctivo** únicamente
**Base:** `main` = `64158b5ad19e1edcc76c21f3dd50e86e884db058` · `phase-3-v1.0` → `f5d0b101b58bae4d1003ea91f15ff0ecfe924f97`

Copia de trabajo, en el idioma del repositorio, de lo que la autorización decide. No añade
ninguna decisión.

## 1 · Origen

La reconciliación de pre-autorización de Phase 4 (2026-09-16) descubrió y verificó una
contradicción real en la línea base congelada: el motor y su base de datos existen y sus pruebas
de base de datos pasan, pero el runtime de la aplicación accedía a los esquemas privados
`engine` e `ingest` por PostgREST. ADR-011 v1.1 los mantiene fuera del Data API a propósito, y
las pruebas de seguridad congeladas demuestran `PGRST106` incluso para el rol de servicio. La
ruta de invocación de la aplicación no podía ejecutarse, y la de recuperación no tenía ningún
llamador.

## 2 · Disposición de gobernanza

Se registra **D-26 · LEARNING ENGINE RUNTIME INVOCATION BOUNDARY**, clasificada como
**defecto correctivo de línea base congelada**. **No es** un rediseño semántico del motor, una
funcionalidad del Planner, un modelo nuevo, una funcionalidad de Phase 4, una razón para exponer
`engine` o `ingest`, para añadir puntuación numérica ni para cambiar la semántica de la
evidencia. **D-26 permanece ABIERTA** hasta que el candidato correctivo quede probado
mecánicamente y aceptado.

## 3 · Lo que se autoriza

- la frontera de invocación de servidor más pequeña y segura que permita ejecutar el
  comportamiento ya aceptado **sin exponer** ningún esquema privado, sobre la superficie
  gobernada `public` y el precedente existente;
- reparar `apps/web/src/server/engine/run.ts` y los módulos de servidor de Phase 3 directamente
  necesarios, con una prueba que ejercite el **módulo real** y habría fallado en `phase-3-v1.0`;
- ruta A tras aceptar evidencia sin que la aceptación dependa del éxito de la proyección;
- ruta B con un llamador real, de coste cero, limitado al aprendiz verificado, sin plan, sin
  selección de contenido y sin cambiar la semántica del FPS;
- mutación de STAGING **solo** para pruebas correctivas acotadas, con residuo cero y la evidencia
  de aceptación de Ana intacta;
- la migración siguiente del canon (`00000000000021`) con su rollback;
- rama `phase/3.1-engine-runtime-corrective` desde `main` congelado.

## 4 · Lo que no se autoriza

Exponer `engine`, `ingest` o `content`; debilitar ADR-011 v1.1; conceder acceso de cliente a
objetos privados del motor; tablas, columnas o configuración de Planner; campos de override de
hoy o de zona horaria; esquema de Phase 4; implementar o registrar como aceptada ninguna de
H-P4-1 … H-P4-7 (solo **H-P4-0 · reparar Phase 3 primero** está aceptada); merge, tag,
congelación, `phase-3-v1.1`; modificar `phase-3-v1.0`, que es inmutable para siempre; Phase 4,
UX, Phase 1B; PRODUCTION (pausado); release de Vercel; recursos de pago; Docker para Ana.

## 5 · Gates correctivos

| Gate | Enunciado |
| --- | --- |
| P3.1-G1 | El acceso directo por el Data API a esquemas privados sigue denegado |
| P3.1-G2 | El módulo real de servidor puede invocar el Learning Engine |
| P3.1-G3 | La invocación tras evidencia produce la proyección esperada sin que la aceptación dependa de ella |
| P3.1-G4 | La recuperación de proyecciones atrasadas tiene un llamador real y funciona |
| P3.1-G5 | Repetir invocación o recuperación es seguro y determinista |
| P3.1-G6 | Incremental == rebuild (EC-006) |
| P3.1-G7 | Frontera de seguridad: anon, authenticated, autoridad de cliente y ataques entre usuarios fallan |
| P3.1-G8 | Ninguna fuga de claves de respuesta ni de internos del motor |
| P3.1-G9 | Prueba de extremo a extremo en STAGING con residuo cero; evidencia de Ana intacta |
| P3.1-G10 | Migración up/down/up y roundtrip semántico idénticos |
| P3.1-G11 | Regresión completa y CI exigida en verde sobre el candidato exacto |
| P3.1-G12 | Alcance negativo: sin Planner, sin Phase 1B, sin readiness, sin semántica nueva, sin PRODUCTION, sin pago, sin AQUO |

## 6 · Salida

Un **candidato correctivo** con evidencia reproducible y sin secretos. Tras revisión
independiente y aceptación humana explícita, una autorización de aterrizaje separada podrá
crear `phase-3-v1.1` sobre el futuro merge correctivo.
