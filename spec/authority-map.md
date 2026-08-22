# STUDY OS · authority-map.md

**Fase:** −1 · Specification Compilation
**Versión:** 1.2 · patch correctivo (nomenclatura de ficheros en tres columnas)
**Estado:** PROPUESTO
**Fecha:** 2026-08-22

## 0a. Convención de nombres (nueva en v1.2)

La v1.1 declaró todos los documentos gobernantes como `.pdf` con guiones bajos en la versión. Era incorrecto por dos motivos distintos, y ambos importan para la auditoría de Drive (`Manifest §21`):

1. **La extensión mostrada no corresponde al contenido.** Los ocho documentos gobernantes llegan al entorno de proyecto con extensión `.pdf`, pero su contenido real es un **archivo ZIP de imágenes de página** (`1.jpeg`, `2.jpeg`, …), no un PDF ni un OOXML. Verificado con `file` y `unzip -l`.
2. **El nombre de origen no es el nombre entregado.** La revisión de Product/Architecture indica que los originales usan espacios, el separador `·` y puntos de versión (p. ej. `STUDY OS · Source of Truth Index v1.0.docx`).

Por tanto se distinguen **tres** nombres y no se declara ninguna extensión que no se haya podido verificar:

| Columna | Significado |
|---|---|
| `original_filename` | Nombre en el origen (Drive). Solo se afirma cuando está confirmado por la revisión; en el resto se marca `UNVERIFIED`. |
| `project_delivered_name` | Nombre exacto tal como aparece en el entorno de proyecto. Verificado con `ls`. |
| `canonical_repo_filename` | Nombre normalizado para el repositorio: `snake_case`, sin espacios ni `·`, versión con guion bajo. Es el nombre al que apuntan las referencias de `/spec` y `/architecture`. |

**Acción pendiente para Ana (AMB-01):** confirmar la extensión real de origen de los seis documentos gobernantes que la revisión no nombró explícitamente. La discrepancia extensión/contenido afecta a los doce pasos de la auditoría de Drive.

## 0b. Orden de autoridad efectivo

Según `Source of Truth Index` (contenido v1.1) §1. Ver **C-18**.

| Nivel | Documento | Nota |
|---|---|---|
| 1 | Master Product Specification | Gana siempre |
| 2 | Engineering Constitution | Operacionaliza; si contradice al Master, gana el Master y se reporta |
| 3 | Especialista FROZEN / v1.0 | Design System, Onboarding & Edge States, Technical Architecture, Canonical Data & Event Model, Functional Closure |
| 4 | Builder Handoff Manifest | Contrato de ejecución |
| 5 | Hi-Fi aprobado | Intención visual; nunca invalida regla funcional o de accesibilidad |
| 6 | Especialista v0.x | Detalle de dominio |
| 7 | Material exploratorio | No gobierna |
| 8 | Archivo/histórico | Solo trazabilidad |

---

## 1. Capa de control del builder

| original_filename | project_delivered_name | canonical_repo_filename | Rol | Auth | Supersedes | Superseded by | Ambigüedad |
|---|---|---|---|---|---|---|---|
| `CLAUDE.md` | `CLAUDE.md` | `CLAUDE.md` | Instrucciones persistentes de repositorio y agente | Control | — | — | Orden de autoridad omite la Constitution → **C-18**; enmienda SD-009 |
| UNVERIFIED (`.md` probable) | `STUDY_OS_Engineering_Constitution_v1_0.md` | `STUDY_OS_Engineering_Constitution_v1.0.md` | Invariantes EC-001…EC-020 | 2 | — | — | Ninguna |
| UNVERIFIED (`.md` probable) | `STUDY_OS_Phase_Minus_1_Specification_Compilation_v1_0.md` | `STUDY_OS_Phase_Minus_1_Specification_Compilation_v1.0.md` | Define esta fase y sus outputs | Control | — | — | Ninguna |
| UNVERIFIED (`.md` probable) | `STUDY_OS_ADR_Policy_v1_0.md` | `STUDY_OS_ADR_Policy_v1.0.md` | Cuándo un cambio exige ADR | Control | — | — | Ninguna |
| UNVERIFIED (`.md` probable) | `STUDY_OS_Checkpoint_Contract_v1_0.md` | `STUDY_OS_Checkpoint_Contract_v1.0.md` | Formato de checkpoint y fallos duros | Control | — | — | Ninguna |

Los cinco ficheros de control llegan como texto legible y su extensión `.md` sí es coherente con su contenido.

## 2. Artefactos gobernantes de producto y técnica

Los ocho llegan con extensión `.pdf` y contenido ZIP-de-imágenes. Ninguna de esas extensiones debe propagarse al repositorio.

| original_filename | project_delivered_name | canonical_repo_filename | Rol | Auth | Supersedes | Superseded by | Ambigüedad |
|---|---|---|---|---|---|---|---|
| UNVERIFIED | `STUDY_OS_Master_Product_Specification_v1_0.pdf` (contenido: ZIP de imágenes) | `STUDY_OS_Master_Product_Specification_v1.0` | Contrato maestro de producto | 1 | Material exploratorio previo | — | §12 mezcla estados (**C-09**); §20 exige simulacro sin modelo de datos (**C-04**) |
| UNVERIFIED | `STUDY_OS_Functional_Closure_MVP_Scope_v0_1.pdf` (contenido: ZIP de imágenes) | `STUDY_OS_Functional_Closure_MVP_Scope_v0.1` | Cierre funcional y alcance MVP | 3 (elevado por Manifest §A) | — | — | v0.x por número, gobernante por rol |
| **`STUDY_OS_Technical_Architecture_v1.0.docx`** (confirmado por la revisión) | `STUDY_OS_Technical_Architecture_v1_0.pdf` (contenido: ZIP de imágenes) | `STUDY_OS_Technical_Architecture_v1.0` | Stack y fronteras técnicas | 3 | — | — | Extensión entregada ≠ extensión de origen ≠ contenido. No declara autoridad de persistencia de motores → **C-25** |
| UNVERIFIED | `STUDY_OS_Canonical_Data_Event_Model_v1_0.pdf` (contenido: ZIP de imágenes) | `STUDY_OS_Canonical_Data_Event_Model_v1.0` | Contrato de datos y eventos | 3 | Hoja `02_Event_Model` de `TAI_STUDY_OS_Pre_Build_Closure_v0_6.xlsx` | — | Sin sitting/ocurrencia/simulacro (**C-02, C-04**); RLS expone claves (**C-13**); sin orden total de eventos (**C-26**) |
| UNVERIFIED | `STUDY_OS_Design_System_v1_0.pdf` (contenido: ZIP de imágenes) | `STUDY_OS_Design_System_v1.0` | Sistema visual congelado | 3 | `STUDY_OS_Visual_Product_Direction_v0.1` (no suministrado) | — | "cuatro/cinco niveles" de confianza (**C-05**) |
| UNVERIFIED | `STUDY_OS_Onboarding_Edge_States_Visual_Spec_v1_0.pdf` (contenido: ZIP de imágenes) | `STUDY_OS_Onboarding_Edge_States_Visual_Spec_v1.0` | Comportamiento pre-evidencia y estados límite | 3 | — | — | Ninguna relevante |
| UNVERIFIED | `STUDY_OS_Builder_Handoff_Manifest_v1_0.pdf` (contenido: ZIP de imágenes) | `STUDY_OS_Builder_Handoff_Manifest_v1.0` | Contrato de ejecución y fases | 4 | — | — | Orden de lectura distinto al SoT Index → **C-19** |
| **`STUDY OS · Source of Truth Index v1.0.docx`** (confirmado por la revisión) | `STUDY_OS___Source_of_Truth_Index_v1_0.pdf` (contenido: ZIP de imágenes) | `STUDY_OS_Source_of_Truth_Index_v1.1` | Índice y capa de control | Control | Source of Truth Index v1.0 (según su propio encabezado) | — | **Triple discrepancia**: nombre de origen dice v1.0, nombre entregado dice `v1_0` con triple guion bajo, y el **contenido es v1.1** → **C-20**; renombrado en SD-011 |

## 3. Detalle de dominio

Los seis llegan como `.xlsx` y su extensión sí corresponde al contenido (verificado con `openpyxl`).

| original_filename | project_delivered_name | canonical_repo_filename | Rol | Auth | Supersedes | Superseded by |
|---|---|---|---|---|---|---|
| UNVERIFIED | `TAI_STUDY_OS_Learning_System_v0_4.xlsx` | `TAI_STUDY_OS_Learning_System_v0.4.xlsx` | Mastery Engine, Planner Contract, Priority Model, Session Allocator, Risk Engine, Ingestion Contract | 6 · contrato de motor | `TAI_STUDY_OS_Learning_Brain_v0.3` (no suministrado); hoja *Mastery & Planner* del Vertical Slice IV.7 | — |
| UNVERIFIED | `TAI_STUDY_OS_Pre_Build_Intelligence_v0_5.xlsx` | `TAI_STUDY_OS_Pre_Build_Intelligence_v0.5.xlsx` | Question/Practical/Exam/Intervention Intelligence, UX Contract, Evidence Ledger | 6 | — | Rescue 0/10/20/30 superseded por Master §8 (**C-17**) |
| UNVERIFIED | `TAI_STUDY_OS_Pre_Build_Closure_v0_6.xlsx` | `TAI_STUDY_OS_Pre_Build_Closure_v0.6.xlsx` | Continuidad, eventos, AI/RAG, seguridad, integridad, 42 acceptance tests | 6 · fuente de tests | — | Taxonomía e idempotencia superseded por el Canonical Data & Event Model (**C-11, C-12**) |
| UNVERIFIED | `TAI_STUDY_OS_UX_Architecture_v0_1.xlsx` | `TAI_STUDY_OS_UX_Architecture_v0.1.xlsx` | IA de navegación, estados por espacio, tutor, responsive | 6 | — | — |
| UNVERIFIED | `TAI_STUDY_OS_Wireflows_LowFi_v0_2.xlsx` | `TAI_STUDY_OS_Wireflows_LowFi_v0.2.xlsx` | Golden path, excepciones, inventario, copy seeds | 6 | — | — |
| UNVERIFIED | `STUDY_OS_Screen_Design_Spec_v0_1.xlsx` | `STUDY_OS_Screen_Design_Spec_v0.1.xlsx` | Blueprints por pantalla, tokens, estados, design gates | 6 | — | — |

## 4. Corpus de contenido

| original_filename | project_delivered_name | canonical_repo_filename | Rol | Auth | Ambigüedad |
|---|---|---|---|---|---|
| UNVERIFIED | `TAI_STUDY_OS_Official_Exam_Corpus_v1_0.xlsx` | `TAI_STUDY_OS_Official_Exam_Corpus_v1.0.xlsx` | 270 preguntas canónicas, 405 ocurrencias, claves PROVISIONAL, 4 prácticos | Evidencia | **Sin textos de opción** (**C-01 · MI-01**); entidades ausentes del modelo (**C-02**) |
| UNVERIFIED | `TAI_STUDY_OS_Official_Mapping_Practical_v1_1.xlsx` | `TAI_STUDY_OS_Official_Mapping_Practical_v1.1.xlsx` | Mapping pregunta→tema/concepto/skill, 4 prácticos, cobertura | Evidencia | 40 asignaciones de concepto erróneas (**C-07 · MI-04**); estado a corregir (SD-012) |
| UNVERIFIED | `TAI_STUDY_OS_Knowledge_Engine_v0_2.xlsx` | `TAI_STUDY_OS_Knowledge_Engine_v0.2.xlsx` | Estructura oficial del examen, KG I.7, banco GENERATED (8), Practical/Risk Engine | 6 · fuente del formato oficial | Formato y scoring no representados en el modelo (**C-04**) |
| UNVERIFIED | `TAI_STUDY_OS_Technical_Vertical_Slice_IV7_v0_1.xlsx` | `TAI_STUDY_OS_Technical_Vertical_Slice_IV7_v0.1.xlsx` | Grafo IV.7 (33 conceptos), banco GENERATED (20), ingestión oficial | 6 (inferior) | Registra los PDF oficiales como no ingeridos (**C-01**) |

**Ausencia crítica:** ningún fichero contiene contenido didáctico (`learning_units`) → **C-22 / MI-02**.

## 5. Referencias visuales aprobadas

Extensión `.PNG` en mayúsculas en los cinco casos; el `Manifest §21` exige normalizar la caja durante la auditoría.

| original_filename | project_delivered_name | canonical_repo_filename | Auth | Ambigüedad |
|---|---|---|---|---|
| UNVERIFIED | `STUDY_OS_HOY_HiFi_v0_1.PNG` | `STUDY_OS_HOY_HiFi_v0.1.png` | 5 | Dashboard, "nivel global" sin proyección, tarjeta motivacional (**C-06 b,c,d**) |
| UNVERIFIED | `STUDY_OS_Learn_Check_Feedback_Design_Spec_v0_1.PNG` | `STUDY_OS_Learn_Check_Feedback_Design_Spec_v0.1.png` | 5 | Confianza 1–5 (**C-05**) |
| UNVERIFIED | `STUDY_OS_PRACTICAL_HiFi_v0_1.PNG` | `STUDY_OS_PRACTICAL_HiFi_v0.1.png` | 5 | Confianza 1–5; temporizador y envío diferido (**C-16**) |
| UNVERIFIED | `STUDY_OS_PRACTICAL_Design_Spec_v0_1.PNG` | `STUDY_OS_PRACTICAL_Design_Spec_v0.1.png` | 5 | Coherente con 42/58 |
| UNVERIFIED | `STUDY_OS_SessionEnd_Progress_Plan_HiFi_v0_1.PNG` | `STUDY_OS_SessionEnd_Progress_Plan_HiFi_v0.1.png` | 5 | **Confeti + trofeo** (**C-06 a**) |

## 6. Entradas esperadas y ausentes (MISSING_INPUT)

| ID | Entrada | Estado | Impacto | Responsable |
|---|---|---|---|---|
| **MI-01** | 6 PDF oficiales (cuestionarios y plantillas TAI-L A/B y extraordinario) | **AUSENTE** | Bloquea el PASS de Phase 1 | Ana |
| **MI-02** | Contenido didáctico (`learning_units`) | **NO EXISTE** | Limita LEARN al contenido que se produzca | Producción de contenido |
| **MI-03** | Corpus normativo ingerido (Bloque I) | **NO EXISTE** | Restringe la capacidad legal del Tutor (C-21) | Producción de contenido |
| **MI-04** | Mapping concepto↔pregunta revalidado | Existe pero **no fiable** | Bloquea siembra de `question_concepts` (C-07) | Contenido |
| **MI-05a** | Repositorio Git · organización/proyecto Supabase · cuenta Vercel | Pendiente | Entrada de Phase 0 | Ana |
| **MI-05b** | Proveedor y credencial de IA | Pendiente | **Entrada de Phase 8**, no de Phase 0 | Ana |
| **AMB-01** | Confirmación de la extensión de origen de los 6 documentos gobernantes no nombrados por la revisión | Pendiente | Afecta a la auditoría de Drive | Ana |
| — | Plantillas `ARCHITECTURE_STATE` y `SPEC_DIFF_LOG` | No subidas por diseño (SoT §8) | Creadas en esta entrega | — |
| — | `STUDY_OS_Project_Setup_Claude_Code_v1.0` | Activo de operador | No es requisito de producto | Ana |
| — | `TAI_STUDY_OS_Foundation_v0.1`, `TAI_STUDY_OS_Learning_Brain_v0.3`, `STUDY_OS_Visual_Product_Direction_v0.1` | No suministrados (soporte) | Solicitar solo si un slice los requiere | Ana |
