# STUDY OS · Phase 3 · Acceptance Review · registro de decisión

**Fecha:** 2026-09-11
**Decisora:** Ana Victoria
**Candidato revisado:** `96c08de486571faa41a57c5952a4d1232498d3af` (`phase/3-learning-engine`)
**Orden:** «PHASE 3 · ACCEPTANCE REVIEW · D-24 APPROVAL + D-25 SECURITY REMEDIATION PREPARATION»

Copia de trabajo, en el idioma del repositorio, de lo que la orden decide. No añade ninguna
decisión: la registra para que el anexo de ADR-011 pueda citarla.

## 1 · Disposición del candidato

La revisión independiente del candidato `96c08de` terminó. La implementación queda
**técnicamente aceptada, sujeta al cierre de D-24 y D-25**. **El merge final no está
autorizado.** No se requiere ninguna decisión nueva de producto ni de ciencia del aprendizaje.

## 2 · D-24 · decisión humana

**ADR-011 · anexo v1.1 · APROBADO.**

El esquema privado y no expuesto `engine` se acepta como la topología correcta de Phase 3.
Motivos registrados:

- las proyecciones del motor son autoridad derivada de servidor;
- los clientes de aprendiz no necesitan autoridad directa de ejecución sobre el motor;
- forzar esas tablas en `public` ampliaría o distorsionaría la superficie de cliente gobernada;
- **se rechaza** debilitar la prueba de aislamiento dirigida por catálogo;
- ADR-011 ya preveía crear esquemas privados adicionales mediante enmienda explícita.

**Límites de la aprobación:** no amplía el anexo más allá de la necesidad ya revisada de
Phase 3 y **no autoriza crear ningún otro esquema privado**. `audit` sigue exigiendo su propia
enmienda.

## 3 · D-25 · estado de seguridad

**D-25 es una exposición real de credencial.** La credencial de base de datos de STAGING
expuesta se trata como **comprometida**. No se vuelve a imprimir: ni la contraseña, ni la cadena
de conexión, ni `STAGING_DB_URL`, ni comandos o volcados de entorno que la contengan. Ningún
informe incluye la credencial vieja ni la nueva.

**Un `secret-scan` en verde no cierra D-25.** D-25 solo se cierra con evidencia mecánica de:
credencial rotada, credencial anterior inválida, secreto `STAGING_DB_URL` reemplazado, CI en
verde con el secreto nuevo, esquema de STAGING coherente, pruebas de Phase 3 en verde, sin
pérdida de datos en STAGING, evidencia del FPS de Ana intacta, sin residuo de pruebas,
`secret-scan` en verde, paquete del candidato sin credencial y PRODUCTION sin tocar.

Si la rotación exige una acción humana en el panel de Supabase, se para **antes** de rotar y se
dan a Ana solo las instrucciones mínimas. **Nunca se le pide que pegue la credencial en el
chat.**

## 4 · Integridad del candidato

Todo commit de remediación cambia el HEAD del candidato. La evidencia final de aceptación debe
corresponder al **HEAD final confirmado**, y `96c08de` deja de citarse como candidato final en
cuanto un commit lo cambie.

## 5 · Frontera

No se autoriza: fusionar el PR de implementación, fusionar en `main`, crear `phase-3-v1.0`,
congelar Phase 3, empezar Phase 4 o Phase 1B, mutar PRODUCTION, rotar ninguna credencial de
PRODUCTION ni tocar AQUO.
