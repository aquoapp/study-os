# supabase/functions

Vacío en Phase 0.

Aquí vivirán las Edge Functions. La primera prevista es la frontera de corrección de
respuestas: `INV-101` exige que la clave correcta no llegue nunca al cliente antes
del envío, de modo que la corrección ocurre en servidor y devuelve resultado y
explicación, nunca la clave.

No se implementa todavía porque depende de `SD-007`, que sigue en `PROPOSED`.
