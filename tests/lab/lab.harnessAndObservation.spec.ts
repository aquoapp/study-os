import { describe, expect, it, vi } from 'vitest';

import { harnessCredentials, observerCredentials } from '../../lab/src/credentials';
import type { EphemeralSubstrate } from '../../lab/src/environment';
import {
  DestructiveRefused,
  assertDestructiveAllowed,
  isSynthetic,
  syntheticIdentity,
  teardown,
  type HarnessContext,
} from '../../lab/src/harness';
import { ObservationRefused, assertReadOnly, readBarrier } from '../../lab/src/observation';
import { substrateIdentity } from '../../lab/src/substrate';

/** Harness, teardown y adaptador de observación · CP2 · pruebas G, H, K, L. */

const SUBSTRATE: EphemeralSubstrate = {
  apiUrl: 'http://127.0.0.1:54321',
  anonKey: 'anon',
  serviceRoleKey: 'PRIVILEGIADA',
  databaseUrl: ['postgre', 'sql://', '127.0.0.1:54322/postgres'].join(''),
};

const IDENTITY = substrateIdentity(SUBSTRATE);
const CONTEXT: HarnessContext = {
  credentials: harnessCredentials(SUBSTRATE),
  identity: IDENTITY,
};

describe('identidades sintéticas', () => {
  it('son inequívocamente sintéticas y únicas', () => {
    const a = syntheticIdentity('cp2');
    const b = syntheticIdentity('cp2');
    expect(isSynthetic(a.email)).toBe(true);
    expect(a.email).not.toBe(b.email);
    expect(a.email).toContain('@study-os.test');
  });

  it('una cuenta humana nunca pasa por sintética', () => {
    expect(isSynthetic('persona@example.com')).toBe(false);
    expect(isSynthetic('lab-synthetic-x@gmail.com')).toBe(false);
  });
});

describe('K · guarda destructiva fail-closed', () => {
  it('permite destruir el sustrato que se verificó', () => {
    expect(() => assertDestructiveAllowed(CONTEXT, IDENTITY)).not.toThrow();
  });

  it('adversarial 5 · una instancia distinta no se destruye, se aborta', () => {
    const otra = substrateIdentity({ ...SUBSTRATE, apiUrl: 'http://127.0.0.1:54321/otra' });
    expect(() => assertDestructiveAllowed(CONTEXT, otra)).toThrow(DestructiveRefused);
  });

  it('un destino que cambió de host se rechaza', () => {
    const movido = { ...IDENTITY, databaseHost: 'otro-host', fingerprint: IDENTITY.fingerprint };
    expect(() => assertDestructiveAllowed(CONTEXT, movido)).toThrow(/host/);
  });

  it('L · el teardown destruye y reporta, y no toca ninguna fila', () => {
    const destroy = vi.fn();
    const result = teardown(CONTEXT, IDENTITY, destroy);
    expect(destroy).toHaveBeenCalledOnce();
    expect(result.destroyed).toBe(true);
    expect(result.substrateFingerprint).toBe(IDENTITY.fingerprint);
  });

  it('si la identidad no coincide, el destructor ni siquiera se invoca', () => {
    const destroy = vi.fn();
    const otra = substrateIdentity({ ...SUBSTRATE, apiUrl: 'http://127.0.0.1:54321/x' });
    expect(() => teardown(CONTEXT, otra, destroy)).toThrow(DestructiveRefused);
    expect(destroy).not.toHaveBeenCalled();
  });
});

describe('adaptador de observación · solo lectura', () => {
  it('rechaza cualquier sentencia que no sea una lectura', () => {
    for (const statement of [
      'delete from public.learning_events',
      'update engine.projection_watermarks set consumed_position = 0',
      'select 1; drop table public.profiles',
      'insert into public.profiles values (1)',
    ]) {
      expect(() => assertReadOnly(statement)).toThrow(ObservationRefused);
    }
  });

  it('acepta una lectura', () => {
    expect(() =>
      assertReadOnly('select max(stream_position) from public.learning_events'),
    ).not.toThrow();
  });

  it('lee la barrera y calcula si queda trabajo pendiente', () => {
    const reading = readBarrier(
      {
        credentials: observerCredentials(SUBSTRATE),
        identity: IDENTITY,
        runQuery: () => JSON.stringify([{ max_position: 49, consumed_position: 49 }]),
      },
      '00000000-0000-0000-0000-000000000001',
    );
    expect(reading.maxPosition).toBe(49);
    expect(reading.consumedPosition).toBe(49);
    expect(reading.pending).toBe(false);
    expect(reading.substrateFingerprint).toBe(IDENTITY.fingerprint);
  });

  it('con atraso, pending es verdadero', () => {
    const reading = readBarrier(
      {
        credentials: observerCredentials(SUBSTRATE),
        identity: IDENTITY,
        runQuery: () => JSON.stringify([{ max_position: 49, consumed_position: 41 }]),
      },
      'sujeto',
    );
    expect(reading.pending).toBe(true);
  });

  it('fail-closed · ante error no inventa un cero: deja nulos', () => {
    const reading = readBarrier(
      {
        credentials: observerCredentials(SUBSTRATE),
        identity: IDENTITY,
        runQuery: () => {
          throw new Error('la base no respondió');
        },
      },
      'sujeto',
    );
    expect(reading.maxPosition).toBeNull();
    expect(reading.consumedPosition).toBeNull();
    expect(reading.pending).toBeNull();
  });

  it('un error de la base no propaga su texto: podría llevar la cadena de conexión', () => {
    const reading = readBarrier(
      {
        credentials: observerCredentials(SUBSTRATE),
        identity: IDENTITY,
        runQuery: () => {
          throw new Error(`fallo con ${SUBSTRATE.databaseUrl}`);
        },
      },
      'sujeto',
    );
    expect(JSON.stringify(reading)).not.toContain(SUBSTRATE.databaseUrl);
  });

  it('la lectura lleva la procedencia de qué instancia se observó', () => {
    const reading = readBarrier(
      {
        credentials: observerCredentials(SUBSTRATE),
        identity: IDENTITY,
        runQuery: () => '[]',
      },
      'sujeto',
    );
    expect(reading.substrateFingerprint).toHaveLength(16);
    expect(reading.readAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('la huella de procedencia no deriva de ninguna credencial', () => {
    const conOtraClave = substrateIdentity({ ...SUBSTRATE, serviceRoleKey: 'DISTINTA' });
    expect(conOtraClave.fingerprint).toBe(IDENTITY.fingerprint);
  });
});
