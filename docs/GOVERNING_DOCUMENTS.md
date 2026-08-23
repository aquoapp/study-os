# STUDY OS · Documentos gobernantes · inventario y verificación

**Propósito:** dejar por escrito qué artefactos gobernantes están disponibles, cómo se
verificaron y qué siguen bloqueando.

**Regla que lo motiva:** `Builder Handoff Manifest §6` — regla de no invención. Si un
comportamiento requerido es materialmente ambiguo y no se resuelve en los artefactos
gobernantes, se emite un `BLOCKED_DECISION` y **se detiene el slice afectado**. No se
inventan reglas para poder seguir escribiendo código.

> **Cambio de estado durante la ronda correctiva.** En el preflight de Phase 0 faltaban
> tres de los ocho documentos gobernantes. Los tres aparecieron en `_handoff/originals/`
> mientras se ejecutaba la ronda. Este documento sustituye al registro de ausencias.

---

## 1. Inventario verificado

Los ocho documentos gobernantes están disponibles (el nivel 2, la Engineering
Constitution, llega como Markdown; los demás como PDF u OOXML). Cada uno se verificó por hash y por
naturaleza real del contenido —cabecera del fichero, recuento de objetos de página y de
imagen— y no por su extensión.

| Documento | Origen | SHA-256 | Contenido verificado |
| --- | --- | --- | --- |
| Master Product Specification v1.0 | `.pdf` | `aa9ba0965e37daaa3a1f16138900b67e0b084a15b10f25fb98f160f7f59d1923` | PDF 1.4 · 31 págs · texto · 0 imágenes |
| Engineering Constitution v1.0 | `.md` | `717c661a9f508ca05aea38a9264621d815caadf31d2ad083465a55b7a82f1544` | Markdown |
| Canonical Data & Event Model v1.0 | `.pdf` | `08a8588f1bbd56a0d269b33d67add98897ada204ff12b735443beecdb3aac125` | PDF 1.4 · 25 págs · texto · 0 imágenes |
| Builder Handoff Manifest v1.0 | `.pdf` | `0087c301d259e1aad27ffbb77ab4484d546959bceecfac993ee907153b8ee1c3` | PDF 1.4 · 19 págs · texto · 0 imágenes |
| Technical Architecture v1.0 | `.docx` | `248eba10082ccd0dfa644362d4af77e9df7bd118df5b45e8c1c00ba81bdc3a5f` | OOXML · `word/document.xml` |
| Source of Truth Index v1.0 | `.docx` | `d1b3dfac163781dc7248beafe396d18b5054061d680037b376969ae718551a08` | OOXML · `word/document.xml` |
| **Design System v1.0** | `.pdf` | `62a85885709cc2dc9ed4cffd71ed852ed1e54cf0962940ff53da93dd8c357aa4` | PDF 1.4 · 11 págs · texto · 0 imágenes |
| **Functional Closure / MVP Scope v0.1** | `.pdf` | `6645bc17aca99a6070f7c958d07569857f596a07bac88fc285cf411918c07f3f` | PDF 1.4 · 4 págs · texto · 0 imágenes |
| **Onboarding & Edge States Visual Spec v1.0** | `.pdf` | `e7bb2e91ed114778b6a46b15eb75b89a33e2c7261c1f7eee3e6d2cbb59ca9078` | PDF 1.4 · 12 págs · texto · 0 imágenes |

Los tres en negrita son los que llegaron durante la ronda correctiva. Sus nombres de
fichero exactos, tal como están depositados:

```text
_handoff/originals/STUDY_OS_Design_System_v1.0.pdf
_handoff/originals/STUDY_OS_Functional_Closure_MVP_Scope_v0.1.pdf
_handoff/originals/STUDY_OS_Onboarding_Edge_States_Visual_Spec_v1.0.pdf
```

El registro legible por máquina es `docs/governing-documents.json`, y es la única fuente
de verdad sobre nombres y hashes.

**Dos comprobaciones separadas, y la separación importa:**

| Comprobación | Qué verifica | Dónde |
| --- | --- | --- |
| `tests/unit/governingDocuments.registry.spec.ts` | El **contrato**: registro bien formado, sin duplicados, y que el código cita los mismos hashes | `test:unit` · solo el árbol Git |
| `npm run verify:originals` | Los **ficheros reales** de `_handoff/originals/`: hash, tipo, páginas e imágenes | Local · **fuera** de los nueve checks y de CI |

`_handoff/` está en `.gitignore`: no existe en un checkout limpio ni en CI. Un test
versionado que lo leyera sería verde o rojo según la máquina, que es lo contrario de una
prueba. Por eso el contrato y los ficheros se verifican por separado.

### AMB-01 · resuelto

AMB-01 pedía confirmar la extensión de origen de los documentos gobernantes. Con los ocho
disponibles y verificados, **queda resuelto: 8 de 8**. Pasó de 8 sin verificar en el
preflight, a 3 tras inspeccionar los originales, a 0 ahora.

La corrección de `spec/authority-map.md` —que afirma que los documentos gobernantes son
«un ZIP de imágenes de página», cosa que ninguno de los ocho es— sigue propuesta como
`SD-017` y pendiente de aprobación humana. El artefacto congelado no se ha editado.

## 2. Qué desbloqueó la llegada del Design System

Los tokens de `packages/design-system` ya **no son inventados**. Todos los valores salen
de `STUDY_OS_Design_System_v1.0` §2, §3 y §13:

- los diez colores de §2, literales;
- la escala de espaciado `4 · 8 · 12 · 16 · 24 · 32 · 48 · 64`;
- los radios `micro 8 · control 12 · card 16 · hero 20`;
- la diana táctil mínima de 44 × 44 px;
- los rangos tipográficos y los numerales tabulares;
- las once duraciones de movimiento de §13;
- la retícula de §3.

Se eliminó además el **tema oscuro** que la entrega anterior había inventado: el documento
define una sola paleta y no menciona ninguno. Añadir uno exigiría decidir diez colores más.

## 3. Qué está satisfecho bajo restricción, y qué queda diferido

### `P0-S7` y `REQ-A06` · **satisfechos** bajo `SD-019` opción A

Esta sección decía «BLOQUEADOS». Era una descripción equivocada del estado, y se corrige
aquí.

El criterio de aceptación de REQ-A06 es literal: «Tokens conformes; **contraste AA
verificado**». La paleta congelada de §2 y el requisito de §14 —«WCAG-minded AA contrast»
como P0— **no son compatibles en tres combinaciones**, medidas:

| Combinación | Ratio | Mínimo AA de texto | Diferencia |
| --- | --- | --- | --- |
| Soft White sobre Adaptive/Teal | **3.95** | 4.5 | −0.55 |
| Soft White sobre Warning/Amber | **4.42** | 4.5 | −0.08 |
| Muted/Slate sobre Canvas/Warm Ivory | **4.31** | 4.5 | −0.19 |

Las tres alcanzan el 3:1 de componentes de interfaz (WCAG 1.4.11), así que sirven como
indicador, borde o icono. Ninguna sirve para texto normal.

**No se han retocado los colores.** Alterar un valor de un documento FROZEN sin ADR es
exactamente lo que EC-019 prohíbe. Lo que se ha hecho es acotar su uso y registrar la
contradicción como **SD-019**.

La **opción A** de SD-019 está autorizada por decisión humana, aplicada y verificada:

- `teal` y `amber` no llevan texto normal encima (`NON_TEXT_BACKGROUNDS`);
- `slate` solo como texto normal sobre `surface`;
- sobre `canvas`, `ink`, o el texto dentro de una superficie válida.

Bajo esas restricciones **todo texto renderizado alcanza el contraste que WCAG le exige**,
medido en el navegador sobre el build de producción, en móvil y escritorio, con un fixture
negativo que demuestra en cada ejecución que la medición detecta lo que dice detectar. Eso
es exactamente el criterio de aceptación de REQ-A06, de modo que **`REQ-A06` y `P0-S7`
quedan satisfechos para Phase 0**.

Lo que sigue abierto es **elegir entre la opción B** (oscurecer los tres colores, con ADR y
v1.1 del Design System) **y la C** (declarar en §14 que el AA aplica al texto y que estos
tres son colores de indicador), para poder usar la paleta **sin restricciones**. Eso lo
necesitan las 18 familias de componentes de §16, que empiezan en Phase 5. Es una decisión
**diferida con plazo antes de Phase 5**, no un bloqueo de Phase 0: ningún entregable de
Phase 0 la espera.

### `SD-018` · corregido técnicamente, **PROPOSED** y sin aprobar

No lo gobierna el Design System, pero conviene que conste junto al resto del estado. El
contrato de orden e idempotencia del stream de eventos se ha corregido dos veces —el orden
de las operaciones dentro de la transacción, y la triple coincidencia que convierte un
`submitted_event_id` repetido en idempotencia— y está completo. **No está implementado**:
no existe ninguna migración de eventos, ninguna tabla, ningún contador y ninguna función, y
un test lo comprueba. Sigue **PROPOSED** y **pendiente de aprobación humana explícita**.

### Decisiones de dominio pendientes antes del PASS final de Phase 0

**BD-02** (identidad estable de concepto), **BD-05** (convocatoria/modelo/ocurrencia),
**SD-006** y **SD-007**. Determinan la forma de las primeras migraciones de dominio.
Mientras sigan abiertas, el checkpoint no puede declarar PASS.

### Otros pendientes del mismo documento

| Elemento | Estado |
| --- | --- |
| Escala de confianza | §6 dice «Four/five semantic levels». La ambigüedad que ya recogía C-05 / SD-008 sigue viva, ahora confirmada por el propio documento. Phase 5 |
| Familia tipográfica | §2 da dirección («modern humanist/grotesk sans»), no nombre. Las pilas actuales son de sistema y se sustituyen cuando se decida |
| Tema oscuro | No especificado. No se inventa |
| Las 18 familias de componentes de §16 | Phase 5 en adelante. Fuera del alcance de Phase 0 |

### `Onboarding & Edge States Visual Spec v1.0`

Disponible y verificado. Gobierna el comportamiento pre-evidencia y los estados límite.
Afecta a `INV-107`, `INV-111` y al texto definitivo de la pantalla sin conexión, hoy
redactado con el criterio mínimo de no prometer nada que no exista.

Sus 12 páginas se incorporan en **Phase 5**, no en Phase 0: Phase 0 no construye pantallas
de producto.

### `Functional Closure / MVP Scope v0.1`

Disponible y verificado. Delimita el alcance del MVP y qué es P0. Es la referencia de
`SD-014`. Bloquea el PASS de **Phase 1**, no el de Phase 0.

## 4. `STUDY_OS_Founder_Portfolio_Master_Context_v0.1.md`

Presente en `_handoff/originals/` y **ausente de `spec/authority-map.md`**.

**No es autoridad de producto.** Se clasifica como **nivel 7 · material exploratorio**,
que según el orden de autoridad **no gobierna**. Puede leerse como contexto; no puede
citarse para resolver una ambigüedad ni para justificar una decisión de producto. La
clasificación está propuesta en `SD-017` y pendiente de aprobación humana.

Que un documento esté disponible no lo convierte en gobernante.

## 5. Procedimiento para incorporar un documento nuevo

1. Depositarlo en `_handoff/originals/` con su nombre de origen, sin normalizar.
2. Calcular el SHA-256 y anotarlo en la tabla de §1 y en `docs/PROVENANCE.md`.
3. Verificar la **naturaleza real** del contenido, no la extensión.
4. Añadirlo a `docs/governing-documents.json`, que es lo que leen tanto el test de
   contrato como `npm run verify:originals`.
5. Reevaluar qué desbloquea y reemitir el checkpoint.

```bash
npm run verify:originals
```

Un documento sin hash registrado no es trazable y no debe usarse como autoridad.
