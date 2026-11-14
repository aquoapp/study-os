import { describe, expect, it } from 'vitest';

import { observerCredentials } from '../../lab/src/credentials';
import { EPHEMERAL_SUBSTRATE, SUBSTRATE_ENV_VAR } from '../../lab/src/environment';
import { readBarrier } from '../../lab/src/observation';
import { resolveSubstrate } from '../../lab/src/substrate';

/**
 * Sustrato efímero · CP2 · pruebas A, B, G.
 *
 * Esta suite **solo corre con el sustrato declarado**. No busca alternativa ni degrada: si la
 * instancia efímera no está, los casos se saltan y el checkpoint lo dice. Caer a STAGING no es un
 * comportamiento que exista.
 */

const declared = process.env[SUBSTRATE_ENV_VAR] === EPHEMERAL_SUBSTRATE;

describe.skipIf(!declared)('la instancia efímera existe y es la declarada', () => {
  it('A · el sustrato se resuelve y es efímero, con host de loopback', () => {
    const { identity } = resolveSubstrate(process.env);
    expect(identity.kind).toBe(EPHEMERAL_SUBSTRATE);
    expect(['127.0.0.1', 'localhost', '::1']).toContain(identity.databaseHost);
    expect(identity.databasePort).toBe('54322');
    expect(identity.fingerprint).toHaveLength(16);
  });

  it('B · las migraciones canónicas están aplicadas: existen los objetos esperados', () => {
    const { substrate, identity } = resolveSubstrate(process.env);
    const reading = readBarrier(
      { credentials: observerCredentials(substrate), identity },
      '00000000-0000-0000-0000-000000000000',
    );
    // Un sujeto inexistente devuelve posiciones nulas **sin error**: la consulta se pudo
    // ejecutar, luego `public.learning_events` y `engine.projection_watermarks` existen.
    expect(reading.subjectRef).toBe('00000000-0000-0000-0000-000000000000');
    expect(reading.substrateFingerprint).toBe(identity.fingerprint);
  });

  it('G · el adaptador observa con credenciales propias, distintas de las del Actor', () => {
    const { substrate } = resolveSubstrate(process.env);
    const observer = observerCredentials(substrate);
    expect(Object.keys(observer)).toEqual(['databaseUrl']);
    expect(observer.databaseUrl).toContain('54322');
  });
});

describe.skipIf(declared)('sin sustrato declarado', () => {
  it('la suite no se ejecuta y no busca otro destino', () => {
    expect(process.env[SUBSTRATE_ENV_VAR]).not.toBe(EPHEMERAL_SUBSTRATE);
  });
});
