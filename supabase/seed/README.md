# supabase/seed

Vacío a propósito.

Phase 0 no siembra ningún dato: `Execution Plan §9` prohíbe explícitamente ingerir
contenido, «ni siquiera de prueba, en tablas canónicas», y en esta fase no existe
todavía ninguna tabla canónica.

Cuando exista contenido (Phase 1), toda semilla deberá:

- llevar `provenance_class` explícita (EC-008);
- ser trazable a una `source_version` si aspira a `OFFICIAL` (INV-110);
- vivir aquí y no incrustada en componentes de interfaz (Manifest §17).

Los _fixtures_ de desarrollo se etiquetan como tales y nunca se presentan como
corpus de producción.
