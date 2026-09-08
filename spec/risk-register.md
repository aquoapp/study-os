# STUDY OS · risk-register.md

**Fase:** −1 · Specification Compilation
**Criterio de ordenación:** probabilidad × daño × **dificultad de detección**. Los riesgos peores de este proyecto no son los que rompen la pantalla, sino los que producen un producto que parece funcionar y cuya promesa es falsa.

Escala: Prob (Alta/Media/Baja) · Impacto (Crítico/Alto/Medio) · Detección (Difícil/Media/Fácil).

---

## R-01 · Mastery decorativo
**Prob:** Alta · **Impacto:** Crítico · **Detección:** Difícil · **Fase:** 1–3
El motor produce números plausibles pero sin significado, por dos vías independientes: (a) `question_concepts` sembrado desde un mapping con errores verificables (C-07: 40 etiquetas erróneas comprobadas); (b) pesos hipotéticos cableados y presentados como precisión.
**Por qué es el peor riesgo:** no genera ningún error visible. La UI funciona, los porcentajes se mueven, y toda la propuesta de valor —"decidir con evidencia"— es ruido.
**Mitigación:** mapping revalidado antes de sembrar · `engine_config` versionada (ADR-003) · test de reproducibilidad · INV-111 (sin porcentajes exactos bajo umbral) · validación cualitativa con USER_001 ("¿esto que dice el sistema se corresponde con lo que sabes?").
**Señal temprana:** un concepto marcado como Dominado que la usuaria falla dos veces seguidas.

## R-02 · Deriva del estado derivado
**Prob:** Media · **Impacto:** Crítico · **Detección:** Difícil · **Fase:** 3
Las proyecciones se actualizan incrementalmente y dejan de ser reconstruibles desde evidencia. Viola EC-006 y no tiene arreglo retroactivo: cuando se detecta, el historial ya no es reproducible.
**Mitigación:** job de rebuild desde el día uno · comparación rebuild vs incremental como gate duro de Phase 3 · `engine_version` + `event_watermark` obligatorios en cada fila derivada.

## R-03 · Fuga entre usuarios por RLS
**Prob:** Media · **Impacto:** Crítico · **Detección:** Media · **Fase:** 2+
Basta una tabla nueva sin política. El riesgo crece con cada migración, no con cada línea de UI.
**Mitigación:** **política RLS + test de aislamiento en la misma migración que crea la tabla** (no al final, como sugiere el orden de CDEM §28) · AT-21/AT-22 en CI · revisión de grants en cada checkpoint.

## R-04 · Filtración de la clave de respuesta al cliente
**Prob:** Media · **Impacto:** Crítico · **Detección:** Difícil · **Fase:** 1–6
La matriz RLS de CDEM §22 permite lectura autenticada de contenido canónico y `answer_key_versions` es contenido canónico (C-13). Invalida CHECK, PRÁCTICO y simulacro simultáneamente sin producir ningún fallo aparente.
**Mitigación:** INV-101 · tabla fuera del esquema expuesto · corrección en Edge Function/RPC · test de inspección de payload en E2E.

## R-05 · Replay offline que duplica evidencia
**Prob:** Media · **Impacto:** Alto · **Detección:** Difícil · **Fase:** 2, 9
Duplica intentos → infla accuracy → corrompe mastery → corrompe el plan. Silencioso y acumulativo.
**Mitigación:** `event_id` UUID de cliente + UNIQUE en servidor · UNIQUE `(user_id, question_id, attempt_number)` · AT-24/AT-35 en CI · **contrato de evento desde Phase 2** aunque la cola llegue en Phase 9.

## R-06 · Fuga de autoridad de la IA
**Prob:** Media · **Impacto:** Crítico · **Detección:** Media · **Fase:** 8
El día que el planner sea difícil o el mastery dé un resultado incómodo, la salida fácil será "que lo decida el modelo". Rompe reproducibilidad y auditabilidad de golpe, y es un cambio de una línea.
**Mitigación:** sin grants de escritura para la capa IA · contrato `AITaskContract` por endpoint (INV-115) · AT-18 · revisión explícita de este punto en cada checkpoint desde Phase 8.

## R-07 · Falso OFFICIAL
**Prob:** Media · **Impacto:** Crítico (reputacional) · **Detección:** Media · **Fase:** 1, 8
Un ítem GENERATED presentado como oficial destruye la única ventaja realmente defendible del producto: la confianza en la trazabilidad. Riesgo agravado por C-01 (si se rellena el hueco de contenido con material generado para "tener banco").
**Mitigación:** constraint que exige `source_version_id` para procedencia OFFICIAL (INV-110) · cuarentena por defecto · `ProvenanceChip` obligatorio · AT-16/AT-17.

## R-08 · Contaminación de TAI en el shell
**Prob:** Alta · **Impacto:** Alto · **Detección:** Media · **Fase:** todas
Enums, rutas, copy o lógica con TAI dentro. No duele hasta el segundo pack, y entonces duele en todas partes a la vez.
**Mitigación:** check de CI sobre el literal `TAI` fuera de `content/` y seeds · prueba CDEM 11 (segundo pack sin rediseño) ejecutada en Phase 1, no al final.

## R-09 · Offline diseñado tarde
**Prob:** Alta · **Impacto:** Alto · **Detección:** Fácil (pero cara) · **Fase:** 2→9
Si Phases 2–8 se construyen sin el contrato de evento offline, Phase 9 obliga a refactorizar seis fases (C-23).
**Mitigación:** contrato en Phase 2 · implementación en Phase 9 · test de idempotencia desde Phase 2.

## R-10 · Corpus insuficiente descubierto tarde
**Prob:** **Alta (ya materializado parcialmente)** · **Impacto:** Crítico · **Detección:** Fácil ahora, difícil después · **Fase:** 1, 5
No hay textos de opción (C-01) ni contenido didáctico (C-22). Se puede construir motor, planner y UX completos y llegar a Phase 5 sin nada que enseñar y sin preguntas respondibles.
**Mitigación:** **MI-01 aportado antes del PASS de Phase 1** (es entrada ausente, no decisión de producto) · alcance de validación acotado formalmente a IV.7 + I.7 · producción de contenido como línea de trabajo paralela con su propio calendario.

## R-11 · Sobre-ingeniería de offline y RAG
**Prob:** Alta · **Impacto:** Medio (coste de oportunidad alto) · **Detección:** Fácil · **Fase:** 8, 9
Es donde más semanas se pierden con menos retorno antes de tener un usuario.
**Mitigación:** contrato offline explícitamente acotado (Master §33) · pgvector diferido (F-3, DEF-16) · el checkpoint debe justificar cada pieza de infraestructura frente a un requisito P0.

## R-12 · Construcción completa antes de un usuario real
**Prob:** Alta · **Impacto:** Alto · **Detección:** Fácil · **Fase:** 5→9
Seis hipótesis del Evidence Ledger están en PENDING y solo se validan con uso. Doce fases antes del primer uso real es el riesgo de gestión más probable del proyecto.
**Mitigación:** **checkpoint de validación con USER_001 al terminar Phase 5**, sobre el vertical IV.7, antes de invertir en Phases 6–9. Es la recomendación de mayor retorno de este Phase −1.

## R-13 · Deriva visual hacia dashboard/academia
**Prob:** Alta · **Impacto:** Alto · **Detección:** Fácil · **Fase:** 5, 7
Los Hi-Fi aprobados ya empujan en esa dirección (C-06). Sin decisión explícita, gana quien implemente primero, y revertirlo después cuesta más que decidirlo ahora.
**Mitigación:** correcciones de C-06 aprobadas antes de Phase 5 · design gates DS-01…DS-10 como pruebas E2E, no como opinión.

## R-14 · Coste de IA sin telemetría
**Prob:** Media · **Impacto:** Medio · **Detección:** Media (llega en la factura) · **Fase:** 8
**Mitigación:** `ai_interactions` con tokens, latencia y coste desde el primer endpoint · modelo barato para transformaciones de bajo riesgo · sin llamada a IA donde el contenido canónico o la lógica determinista ya resuelven (Master §46).

## R-15 · Deriva de versión normativa
**Prob:** Media · **Impacto:** Alto · **Detección:** Difícil · **Fase:** 8, 10
Contenido jurídico obsoleto presentado como vigente. El propio KG advierte que la LOPDGDD consolidada cambió el 27/12/2025.
**Mitigación:** filtrado por vigencia **antes** de la similitud (TA §7.3) · INV-109 · DEF-15 (capacidad legal desactivada en MVP).

## R-16 · Erosión del alcance por buenas ideas
**Prob:** Alta · **Impacto:** Medio · **Detección:** Fácil · **Fase:** todas
El alcance está protegido por escrito (Functional Closure §10), pero la presión real llega desde la propia construcción.
**Mitigación:** toda idea nueva va a backlog salvo que repare un fallo P0 · el checkpoint enumera lo diferido, con lo que la lista es visible en cada fase.

## R-17 · Límites del almacenamiento local en WebKit
**Prob:** Media · **Impacto:** Medio · **Detección:** Media · **Fase:** 9
**Corrección respecto a la v1.0**, que afirmaba de forma incorrecta que iOS desaloja IndexedDB en toda PWA a los 7 días. Según la documentación oficial de WebKit (https://webkit.org/tracking-prevention/):
- ITP aplica un límite de 7 días sin interacción a todo el almacenamiento escribible por script —IndexedDB, LocalStorage, SessionStorage, claves de medios y registros de Service Worker— para sitios abiertos **en el navegador**.
- **El dominio de primera parte de las aplicaciones web añadidas a la pantalla de inicio está exento** de ese límite, y sus datos se mantienen aislados de Safari.

**Riesgo real, por tanto:** la usuaria que accede desde una pestaña de Safari sin instalar la PWA sí está sujeta al límite de 7 días; la que la instala, no. En cualquier caso IndexedDB es almacenamiento local **best-effort** (desalojo por presión de disco, borrado manual, cambio de dispositivo) y **nunca la única fuente canónica**: la evidencia canónica vive en el servidor.
**Mitigación:** promover la instalación en pantalla de inicio · sincronización al reconectar y al volver a primer plano · estado de sync siempre veraz (EC-012) · ningún dato con valor de evidencia depende exclusivamente del almacenamiento local · documentar el límite en lugar de prometer offline completo.

---

## Resumen de exposición

| Nivel | Riesgos |
|---|---|
| **Crítico + detección difícil** (atención máxima) | R-01, R-02, R-04, R-06 |
| **Crítico + detección media/fácil** | R-03, R-05, R-07, R-10 |
| **Alto** | R-08, R-09, R-12, R-13, R-15 |
| **Medio** | R-11, R-14, R-16, R-17 |

Cuatro de los cinco riesgos peores se mitigan con la **misma disciplina**: pruebas ejecutables sobre invariantes, no confianza en la revisión visual.
