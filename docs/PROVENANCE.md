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
| `architecture/ADR-001-stack-and-boundaries.md` | `9eeb3be861da6b1b0eb1bedfa70e33e5e06908042e5eda37ce1f7c135de3990c` (**anotado el 2026-09-07**, ver §2.1) |
| `architecture/ADR-002-canonical-evidence-events.md` | `2234c873a809503fe4137997902a8771298350464795a0557597729f6424e03e` (**anotado el 2026-09-07**, ver §2.1) |
| `architecture/ADR-003-mastery-vs-readiness.md` | `4155d6d2b54caad99c9bc5ce4bd5c5e5fce9f5f66ec6f3410ff2942d52c3cf4a` (**enmendado el 2026-09-10**, ver §2.1) |
| `architecture/ADR-004-offline-reconciliation.md` | `f7a9833f787d2d3e939f54d9b758bf1ec0a8c9f7bbd97454b6529a5a0c4518fd` |
| `architecture/ADR-005-provenance-and-official-versioning.md` | `aa5414eb34f024f03778ea4456e56a3159ce02e391d1fee3458d2cac5d833406` (**anotado el 2026-09-07**, ver §2.1) |
| `docs/ARCHITECTURE_STATE.md` | `595437cca7ed13d09f78a0544fa26a8ad034d28b0cb8ecd97a71e08aff6b7fa1` (**estado de importación**) |
| `docs/PHASE_0_EXECUTION_PLAN.md` | `d7371a2e31cc7ea1ddbd5ef7505d962ad2625c9c81035520d7e386ac20164d57` |
| `docs/PHASE_MINUS_1_INDEX.md` | `769c24175400db4e5fb5359025fbf509cbecd8e088fc09e3ca1a5cf79cd8b415` |
| `docs/SPEC_DIFF_LOG.md` | `4a4ba01d3e211aa0c2200239826a14f3b56dbe788fe40064a5f0a087da6f2fd3` (**estado de importación**) |

> **Seis artefactos importados divergen de su hash base, y solo seis.** Dos son copias
> vivas por su propia regla; tres son ADR anotados por decisión humana el 2026-09-07 y uno
> —ADR-003— es un ADR **enmendado y aceptado** por decisión humana el 2026-09-10 (§2.1).
>
> **`ARCHITECTURE_STATE.md`** es una **copia viva**: su propia regla de mantenimiento
> dice que «se actualiza en cada checkpoint» y que «si describe estado futuro o
> intenciones, se está usando mal». La versión 1.2 describía un repositorio que no
> existía; conservarla intacta la habría convertido en lo contrario de lo que dice
> ser. La divergencia respecto al hash base queda registrada en su §0.
>
> **`SPEC_DIFF_LOG.md`** se modifica solo por **adición** de entradas nuevas y de una
> sección de erratas, tal como autoriza el propio documento. Las 15 entradas congeladas quedan intactas: las primeras
> 174 líneas del fichero conservan el hash
> `4a4ba01d3e211aa0c2200239826a14f3b56dbe788fe40064a5f0a087da6f2fd3`, comprobable con
> `head -174 docs/SPEC_DIFF_LOG.md | sha256sum`. Adenda actual: ERRATA P0-IN-1, SD-016,
> SD-017, SD-018, SD-019 y el **registro de aceptación del 2026-09-07**.
>
> Los otros 13 artefactos importados conservan su hash original sin excepción. En
> particular, `docs/PHASE_0_EXECUTION_PLAN.md`, `docs/PHASE_MINUS_1_INDEX.md` y todo
> `spec/` siguen intactos: lo que dicen sobre BD-02, BD-05, SD-006, SD-007 o SD-015
> —«pendiente», «PROPUESTO»— es cronología histórica del paquete importado, y el estado
> operativo lo fijan los registros vivos. Un test lo verifica por hash.
>
> El aterrizaje de gobernanza de Phase 3 (2026-09-10) **no editó ningún fichero de
> `spec/`**: sus nueve hashes siguen siendo los de importación, y `phase3.governance.spec`
> los comprueba uno a uno. Las disposiciones de Phase 3 sobre `requirement-index`,
> `acceptance-matrix`, `contradiction-register`, `deferred-requirements` y `domain-model`
> viven como adenda en `docs/SPEC_DIFF_LOG.md` (SD-024 … SD-029), que es el mecanismo de
> supersesión del repositorio.

### 2.1 ADR anotados por decisión humana · 2026-09-07

Ana Victoria aprobó cinco decisiones mediante `STUDY_OS_Phase_0_Human_Decision_Packet_v1.0.md`
(SHA-256 `6772d7021a2c1e3513d1bb7900cb1e1f1131e7f71e9386cd1e6533c695ecad7d`, baseline
`8823c2bdf2d31ec01a2f15b1566a94c1ad0eb04a`). El propio paquete exige que los ADR
existentes marquen **solo sus puntos solapados** como subordinados o superseded por los
ADR nuevos, conservando el texto histórico. Es la única modificación que han recibido, y
por eso —y solo por eso— divergen de su hash de importación:

| Ruta | Hash de importación (histórico) | Hash tras la anotación | Qué se anotó |
|---|---|---|---|
| `architecture/ADR-001-stack-and-boundaries.md` | `9eeb3be861da6b1b0eb1bedfa70e33e5e06908042e5eda37ce1f7c135de3990c` | `f951d6156650bdf25c1da7ce658a95347784899c5b8b77863b304c0c55417e4c` | Nota de supersesión parcial; punto 3 subordinado a ADR-006 |
| `architecture/ADR-002-canonical-evidence-events.md` | `2234c873a809503fe4137997902a8771298350464795a0557597729f6424e03e` | `c6f1192883aa1f3214031ffc35a36245a37650beccc39fa2d414b24916fb804c` | Nota de supersesión parcial; punto 6 superseded por ADR-007; puntos 4 y 10 superseded por ADR-008; SD-015 superseded |
| `architecture/ADR-005-provenance-and-official-versioning.md` | `aa5414eb34f024f03778ea4456e56a3159ce02e391d1fee3458d2cac5d833406` | `333b18e9a5694556f61584c6c613247c5816574315fa15d3ea43084043cd4e8a` (antes `abafcd77b056588dd09e63dd2652a94b71534cbfd3bd5fef62224bbb7f8a76e1`) | Nota de supersesión parcial (2026-09-07); nota de disposición para Phase 1A (2026-09-09): sigue PROPOSED |

Los tres siguen `PROPOSED` en conjunto. `ADR-000` y `ADR-004` no se han tocado y conservan su
hash, verificado por `adr.acceptedDecisions.spec`.

### 2.2 ADR-003 · enmendado y aceptado por decisión humana · 2026-09-10

La Phase 3 Governance Landing Authorization (copia aceptada en
`docs/PHASE_3_GOVERNANCE_AUTHORIZATION.md`, SHA-256
`3b1bcc38ca3e13d7a75d7e0ab3ff2b4ffbdf2a2d396cf77308ee5b92fae423d4`; propuesta de entrada
`STUDY_OS_Learning_Engine_Contract_v1.0_Proposal_d3581ba.md`, SHA-256
`cfb07a1ed05602b74daacb742472e21a94c7b602c6bbae634d9d2df42b33f6c7`) acepta ADR-003 como v1.2.

| Ruta | Hash de importación (histórico) | Hash tras la enmienda | Qué se anotó |
|---|---|---|---|
| `architecture/ADR-003-mastery-vs-readiness.md` | `4155d6d2b54caad99c9bc5ce4bd5c5e5fce9f5f66ec6f3410ff2942d52c3cf4a` | `2514bb12683618161ed3afd40a88c1d9d93970f8d11d0fae1e826bb86893e191` | Cabecera `ACCEPTED · v1.2` con registro de decisión, `IMPLEMENTATION STATUS: NOT IMPLEMENTED` y `OWNS: BD-04`; nota de supersesión parcial; punto 1 superseded y punto 6 no operativo, **con su texto histórico intacto**; Anexo v1.2; bloque de aprobación cumplimentado |

`ADR-008` recibe además un **anexo de reconciliación de watermark** el 2026-09-10, sin
enmendar ninguno de sus once puntos: hash vigente
`d1f0ee49265c4cef1ab033737d2840fedc455233f99c2896cb3273764208007a` (antes
`fcc4385fd36dafe0e99b0c024b697a366140fc993d29345beafffda0f98b84bd`).

Artefactos **creados** en este aterrizaje, no importados:

| Ruta | SHA-256 |
|---|---|
| `docs/LEARNING_ENGINE_CONTRACT.md` | `3770d7d903af7e092d97b7279867a84dbcca75ba825488aecffa1e2f332d6068` |
| `docs/PHASE_3_GOVERNANCE_AUTHORIZATION.md` | `3b1bcc38ca3e13d7a75d7e0ab3ff2b4ffbdf2a2d396cf77308ee5b92fae423d4` |

Los ADR aceptados son artefactos **creados en Phase 0 y Phase 1A** (§6), no importados. Hash
de creación (2026-09-07) y hash vigente tras la Phase 1A Build Authorization (2026-09-09):

| Ruta | SHA-256 de creación | SHA-256 vigente | Qué cambió el 2026-09-09 |
|---|---|---|---|
| `architecture/ADR-006-answer-key-data-api-boundary.md` | `96f955c1a9e063141005f7091db18093af529cbea836b8e84764280ad8a191ef` | `2fee211783f1e3f9ad334669754aa1ca510c1ebae6bd2072951f6e9602b6e096` | cabecera IMPLEMENTATION STATUS → AUTHORIZED · Phase 1A |
| `architecture/ADR-007-enforceable-item-targets.md` | `d0af2c3acba40b7ec9b18e21bdb6f00a2647eddfee97ca5aee28cdf5ccb5e520` | `bc2f45dcbbddbd0ed2ad57ff68403175d61b076c65d55acbd7a93bdccf327d3e` | sin cambios en Phase 1A; el 2026-09-09 (Phase 2 Build Authorization) anexo v1.1 aceptado (H-P2-1) y cabecera AUTHORIZED · Phase 2 |
| `architecture/ADR-008-per-user-event-order-and-idempotency.md` | `0282ad130f28ac303e6a2f85ce5eb5fa683a491452a6964ed19a35ec52d5c7bc` | `fcc4385fd36dafe0e99b0c024b697a366140fc993d29345beafffda0f98b84bd` | sin cambios en Phase 1A; el 2026-09-09 (Phase 2 Build Authorization) registro de autorización de implementación sin enmienda y cabecera AUTHORIZED · Phase 2 |
| `architecture/ADR-009-stable-concept-identity.md` | `105b441b5ad572b38c8b100be735e1e3344f99cda8d22bdecbc321be2429f225` | `defe63ec63e004a778ea6a2d388b70bc81d9f0c0a989c65d383af53fee6e484d` | anexo v1.1 aceptado (C-2); cabecera AUTHORIZED |
| `architecture/ADR-010-official-exam-occurrences.md` | `6a19b7e3cc494edc12f613fb8ee52b27501781320cca967751b471744bc1c463` | `0467e3e28932d3c86666875c156c606f956305c486ca2397cfc41ffcb6ed7116` | anexo v1.1 aceptado (C-3); cabecera AUTHORIZED |
| `architecture/ADR-011-schema-topology-and-data-api-exposure.md` | — | `12f8641ab296f2993b0ed27a3b021b9ad8c1551ae204b379f0bc569ad54e4242` (antes `77c9f74207dc97b2aa0a46e4ca35e76a15dc554f6131787ee3c08d90134979a5`, y antes aún `4b7a80cf1ea349be0dd5d775ab8007a8d5bd90447a5a5e75d36a290ae27eb9a0`) | creado y aceptado el 2026-09-09 (C-1); el 2026-09-10 recibió el anexo v1.1 que da de alta el esquema `engine`, previsto en su punto 10; el 2026-09-11 Ana lo firmó en la Phase 3 Acceptance Review (**D-24**), sin ampliarlo, y la cabecera pasó a `ACCEPTED · v1.1`. El cuerpo v1.0 y su aprobación quedan intactos |

Registro de decisión de Phase 1A: `STUDY_OS_Phase_1A_Authorization_Packet_PROPOSED_a263ec1.md`
· SHA-256 `806c6f5908a05f12c94d9931bf05bcd1df03f0d13b71abf117a70708b38552b4` · copia
aceptada en `docs/PHASE_1A_AUTHORIZATION_PACKET.md`.

Registro de decisión de Phase 2: `STUDY_OS_Phase_2_PreAuthorization_Packet_PROPOSED_be5a26a.md`
· SHA-256 `da4558c54ce25825d5a75da9021f65e082964885295a92d523a6a7eadcba2a67` · copia
aceptada en `docs/PHASE_2_AUTHORIZATION_PACKET.md` (2026-09-09).

El registro de decisión no se versiona: es material de entrada, como los originales de
§3, y su hash queda aquí y en cada ADR aceptado.

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
| `STUDY_OS_Founder_Portfolio_Master_Context_v0.1.md` | `6304f5957aba93c01f89563a834d1f2d5f0d86689278ac4daa7e8a19ba40613d` | Markdown · **no figura en `authority-map.md`** · nivel 7, no gobierna |
| `STUDY_OS_Design_System_v1.0.pdf` | `62a85885709cc2dc9ed4cffd71ed852ed1e54cf0962940ff53da93dd8c357aa4` | PDF 1.4 real · 11 páginas · texto · **0 imágenes** · llegó en la ronda correctiva |
| `STUDY_OS_Functional_Closure_MVP_Scope_v0.1.pdf` | `6645bc17aca99a6070f7c958d07569857f596a07bac88fc285cf411918c07f3f` | PDF 1.4 real · 4 páginas · texto · **0 imágenes** · llegó en la ronda correctiva |
| `STUDY_OS_Onboarding_Edge_States_Visual_Spec_v1.0.pdf` | `e7bb2e91ed114778b6a46b15eb75b89a33e2c7261c1f7eee3e6d2cbb59ca9078` | PDF 1.4 real · 12 páginas · texto · **0 imágenes** · llegó en la ronda correctiva |

### 3.1 AMB-01 · **RESUELTO** · 8 de 8

`spec/authority-map.md` §0a afirma que los ocho documentos gobernantes «llegan con extensión
`.pdf` pero su contenido real es un **archivo ZIP de imágenes de página**». Contrastado contra
`_handoff/originals/`, **esa afirmación no se sostiene para ninguno de los ocho**: los seis
`.pdf` son PDF 1.4 auténticos con texto y fuentes incrustadas (cero objetos
`/Subtype /Image`, cero `/DCTDecode`) y los dos `.docx` son OOXML auténticos con
`word/document.xml`. El texto es extraíble en los ocho.

| Documento gobernante | Extensión de origen | Estado AMB-01 |
|---|---|---|
| Master Product Specification v1.0 | `.pdf` | **RESUELTO** |
| Canonical Data & Event Model v1.0 | `.pdf` | **RESUELTO** |
| Builder Handoff Manifest v1.0 | `.pdf` | **RESUELTO** |
| Technical Architecture v1.0 | `.docx` | **RESUELTO** |
| Source of Truth Index v1.0 | `.docx` | **RESUELTO** |
| Design System v1.0 | `.pdf` | **RESUELTO** · llegó en la ronda correctiva |
| Functional Closure / MVP Scope v0.1 | `.pdf` | **RESUELTO** · llegó en la ronda correctiva |
| Onboarding & Edge States Visual Spec v1.0 | `.pdf` | **RESUELTO** · llegó en la ronda correctiva |

Trazabilidad: AMB-01 pasó de **8 sin verificar** en el preflight, a **3** tras inspeccionar
los originales disponibles, a **0** al llegar los tres que faltaban.

La corrección de `spec/authority-map.md` sigue propuesta como `SD-017` y pendiente de
aprobación humana. El artefacto congelado **no se ha editado**.

Hallazgo adicional: `STUDY_OS_Founder_Portfolio_Master_Context_v0.1.md` está en los
originales y **no figura en `authority-map.md`**. Propuesta en SD-017: nivel 7, material
exploratorio, **no gobierna**. Que un documento esté disponible no lo convierte en autoridad.


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
`tools/`, `CLAUDE.md`, `README.md`, `docs/PROVENANCE.md`, `docs/PHASE_0_CHECKPOINT.md`,
`docs/GOVERNING_DOCUMENTS.md`, `docs/governing-documents.json`, los ADR aceptados
`architecture/ADR-006` … `ADR-010` (§2.1) y la configuración de raíz.
