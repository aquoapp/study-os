# supabase/functions

Vacío en Phase 0.

Aquí vivirán las Edge Functions. La primera prevista es la frontera de corrección de
respuestas: `INV-101` exige que la clave correcta no llegue nunca al cliente antes
del envío, de modo que la corrección ocurre en servidor y devuelve resultado y
explicación, nunca la clave.

No se implementa todavía. `SD-007` está `ACCEPTED · NOT IMPLEMENTED` desde el 2026-09-07,
con `ADR-006` como propietario normativo: la frontera está decidida, pero la aceptación no
autoriza implementación alguna, y Phase 0 no construye funciones de dominio.
