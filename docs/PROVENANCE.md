# STUDY OS · PROVENANCE.md

**Propósito:** dejar constancia verificable del origen de cada artefacto versionado en este
repositorio. Ningún fichero de `/spec`, `/architecture` o `/docs` es obra del agente salvo los
marcados explícitamente como creados en Phase 0.

**Regla:** `_handoff/` **no forma parte definitiva del repositorio**. Está en `.gitignore`.
Es material de entrada; su contenido se conserva fuera del control de versiones y esta página
es la única traza que queda de él.

---

## 1. Paquete de handoff congelado

| Campo | Valor |
|---|---|
| Paquete | `STUDY_OS_Phase_Minus_1_v1_2` |
| Fichero de entrada | `_handoff/STUDY_OS_Phase_Minus_1_v1_2.zip` |
| SHA-256 del ZIP | `8193934333099c0af331acbb12f590af8dc9b6d9026436f585265a87f763814a` |
| Ficheros en el ZIP | 19 (verificado) |
| Estado declarado | PASS WITH DEBT · Phase −1 FROZEN |
| Requirement count | **123** (verificado programáticamente, ver §4) |

## 2. Artefactos importados (P0-S9)

Copiados **byte a byte** desde el ZIP. Los SHA-256 de la copia en el repositorio coinciden
con los del paquete. Cualquier divergencia futura es una modificación y debe justificarse.

| Ruta en el repositorio | SHA-256 (origen y copia) |
|---|---|
| `spec/acceptance-matrix.md` | `1968813c2325ff010536f15ede4dca2b293c77ea0e2e7c88192627c6a252af2c` |
| `spec/authority-map.md` | `281b9cf9f5d8ac54c1edfd8da5b7d6a97909352a21607870550b1b21efe85824` |
| `spec/contradiction-register.md` | `f4953721d2ddc1148987c7a324547bc4b8b71207d472a7149540f1dbbf5bf2d3` |
| `spec/deferred-requirements.md` | `8aa63b9ca0186fe59893cab218fde7e261cda41c601a267992f818b725264fd7` |
| `spec/domain-model.md` | `e1f028e1bbcbd8c2f4ca7b87bcef5f816da254bb932a393ce72d9ca4522d3203` |
| `spec/invariant-register.md` | `860793cb1541da3856e663e91ffb5c5621c65a6f28d2e9b42936552112e47b96` |
| `spec/requirement-index.md` | `39426a8d0ca0983e0be82b526afcfe240fd6f5f13ce9d1b4b7cb102c85a8dfb9` |
| `spec/risk-register.md` | `601d6d1183fbc8fb00a69eed4e9f261362eb6b4c323dd01137f9625211cb0dff` |
| `spec/terminology.md` | `1bf26b82b3de941ef7b00d9b948e6fc4df3e34cf81eccf9891bc9a9ea1031086` |
| `architecture/ADR-000-template.md` | `383782a8bbf69333c7f3d0c97b47d2993098f623a73728636580e76bd2886103` |
| `architecture/ADR-001-stack-and-boundaries.md` | `9eeb3be861da6b1b0eb1bedfa70e33e5e06908042e5eda37ce1f7c135de3990c` |
| `architecture/ADR-002-canonical-evidence-events.md` | `2234c873a809503fe4137997902a8771298350464795a0557597729f6424e03e` |
| `architecture/ADR-003-mastery-vs-readiness.md` | `4155d6d2b54caad99c9bc5ce4bd5c5e5fce9f5f66ec6f3410ff2942d52c3cf4a` |
| `architecture/ADR-004-offline-reconciliation.md` | `f7a9833f787d2d3e939f54d9b758bf1ec0a8c9f7bbd97454b6529a5a0c4518fd` |
| `architecture/ADR-005-provenance-and-official-versioning.md` | `aa5414eb34f024f03778ea4456e56a3159ce02e391d1fee3458d2cac5d833406` |
| `docs/ARCHITECTURE_STATE.md` | `595437cca7ed13d09f78a0544fa26a8ad034d28b0cb8ecd97a71e08aff6b7fa1` |
| `docs/PHASE_0_EXECUTION_PLAN.md` | `d7371a2e31cc7ea1ddbd5ef7505d962ad2625c9c81035520d7e386ac20164d57` |
| `docs/PHASE_MINUS_1_INDEX.md` | `769c24175400db4e5fb5359025fbf509cbecd8e088fc09e3ca1a5cf79cd8b415` |
| `docs/SPEC_DIFF_LOG.md` | `4a4ba01d3e211aa0c2200239826a14f3b56dbe788fe40064a5f0a087da6f2fd3` (**estado de importación**) |

> **`SPEC_DIFF_LOG.md` es el único artefacto importado que se modifica en Phase 0**, y solo
> por **adición** de entradas nuevas (`SD-016`, `SD-017`) y de una sección de erratas, tal como
> autoriza el propio documento y la decisión humana de arranque de Phase 0. Las 18 entradas
> anteriores quedan intactas. El hash de la tabla es el del estado en el momento de importar;
> el fichero vivo diverge a partir de ahí por adición trazable.

## 3. Documentos gobernantes de origen

Presentes en `_handoff/originals/` en el momento del preflight. **No se versionan** (son
material de entrada, y su lugar canónico es la auditoría de Drive `APP_OPOS`, Manifest §22–§23).

| Fichero de origen | SHA-256 | Contenido real verificado |
|---|---|---|
| `STUDY OS · Source of Truth Index v1.0.docx` | `d1b3dfac163781dc7248beafe396d18b5054061d680037b376969ae718551a08` | OOXML real (`word/document.xml`, 65 KB de texto) |
| `STUDY_OS_Technical_Architecture_v1.0.docx` | `248eba10082ccd0dfa644362d4af77e9df7bd118df5b45e8c1c00ba81bdc3a5f` | OOXML real (`word/document.xml`, 177 KB de texto) |
| `STUDY_OS_Master_Product_Specification_v1.0.pdf` | `aa9ba0965e37daaa3a1f16138900b67e0b084a15b10f25fb98f160f7f59d1923` | PDF 1.4 real · 31 páginas · fuentes incrustadas + `ToUnicode` · **0 imágenes** |
| `STUDY_OS_Canonical_Data_Event_Model_v1.0.pdf` | `08a8588f1bbd56a0d269b33d67add98897ada204ff12b735443beecdb3aac125` | PDF 1.4 real · 25 páginas · texto · **0 imágenes** |
| `STUDY_OS_Builder_Handoff_Manifest_v1.0.pdf` | `0087c301d259e1aad27ffbb77ab4484d546959bceecfac993ee907153b8ee1c3` | PDF 1.4 real · 19 páginas · texto · **0 imágenes** |
| `STUDY_OS_Engineering_Constitution_v1.0.md` | `717c661a9f508ca05aea38a9264621d815caadf31d2ad083465a55b7a82f1544` | Markdown |
| `STUDY_OS_Checkpoint_Contract_v1.0.md` | `e94f10f1741b794d3953a7fd8da2becb4ad911febdcc36013a96b44ca948595c` | Markdown |
| `STUDY_OS_ADR_Policy_v1.0.md` | `3e723d756c63144b09ee07935b44d7988bf1e69106005873318b77dcd0760a23` | Markdown |
| `STUDY_OS_Phase_Minus_1_Specification_Compilation_v1.0.md` | `98279c50828608df23ac92bfcff1d82e030ac7ff92bf8a1eca939deac4fb8298` | Markdown |
| `STUDY_OS_Founder_Portfolio_Master_Context_v0.1.md` | `6304f5957aba93c01f89563a834d1f2d5f0d86689278ac4daa7e8a19ba40613d` | Markdown · **no figura en `authority-map.md`** |

### 3.1 AMB-01 · resolución parcial contra los originales

`spec/authority-map.md` §0a afirma que los ocho documentos gobernantes «llegan con extensión
`.pdf` pero su contenido real es un **archivo ZIP de imágenes de página**». Contrastado contra
`_handoff/originals/`, **esa afirmación no se sostiene para los cinco documentos presentes**:
los tres `.pdf` son PDF 1.4 auténticos con texto y fuentes incrustadas (cero objetos
`/Subtype /Image`, cero `/DCTDecode`), y los dos `.docx` son OOXML auténticos con
`word/document.xml`. El texto es extraíble.

| Documento gobernante | Extensión de origen | Estado AMB-01 |
|---|---|---|
| Master Product Specification v1.0 | `.pdf` | **RESUELTO** |
| Canonical Data & Event Model v1.0 | `.pdf` | **RESUELTO** |
| Builder Handoff Manifest v1.0 | `.pdf` | **RESUELTO** |
| Technical Architecture v1.0 | `.docx` | **RESUELTO** (ya confirmado por la revisión) |
| Source of Truth Index v1.0 | `.docx` | **RESUELTO** (ya confirmado por la revisión) |
| Functional Closure / MVP Scope v0.1 | — | **ABIERTO** · ausente de `_handoff/originals/` |
| Design System v1.0 | — | **ABIERTO** · ausente de `_handoff/originals/` |
| Onboarding & Edge States Visual Spec v1.0 | — | **ABIERTO** · ausente de `_handoff/originals/` |

AMB-01 pasa de **8 documentos sin verificar** a **3**. La corrección de `authority-map.md`
queda propuesta como `SD-017` en `docs/SPEC_DIFF_LOG.md`; no se aplica sin aprobación humana.

## 4. Verificación programática ejecutada en el preflight

| Comprobación | Método | Resultado |
|---|---|---|
| Ficheros en el ZIP | `unzip -l` | 19 ✔ (coincide con `PHASE_MINUS_1_INDEX.md`) |
| Integridad de la copia | `sha256sum` origen vs repositorio | 19/19 idénticos ✔ |
| REQ únicos en `requirement-index.md` | `grep -oE 'REQ-[A-Z][0-9]{2}' \| sort -u \| wc -l` | **123** ✔ |
| Distribución de REQ | por prefijo | A:9 B:15 C:16 D:11 E:13 F:15 G:9 H:8 I:12 J:9 K:6 = 123 ✔ |
| `REQ-C13` = RLS | inspección de fila | ✔ (corrección v1.2 confirmada) |
| `REQ-C15` restaurado (`devices` + `sync_state`) | inspección de fila | ✔ |
| `REQ-C16` (idempotencia por `submitted_event_id`) | inspección de fila | ✔ |
| `REQ-A07` = auth con perfil separado | inspección de fila | ✔ (ancla de `INV-116`) |
| Naturaleza real de los documentos de origen | cabeceras, `unzip -l`, análisis de objetos PDF | ver §3 |

## 5. Herramientas de extracción

El texto de los documentos gobernantes se leyó con extractores escritos ad hoc durante el
preflight (descompresión de streams `FlateDecode` + mapeo `ToUnicode` para PDF; lectura de
`word/document.xml` para OOXML). **Viven en el directorio temporal de la sesión, no en el
repositorio**: no son un artefacto de producto y no deben convertirse en dependencia.

## 6. Artefactos creados en Phase 0

Todo lo que **no** aparece en §2 y está versionado en este repositorio se creó durante Phase 0
sobre la rama `phase/0-foundation`. En particular: `apps/`, `packages/`, `supabase/`, `tests/`,
`tools/`, `CLAUDE.md`, `README.md`, `docs/PROVENANCE.md`, `docs/PHASE_0_CHECKPOINT.md` y la
configuración de raíz.
