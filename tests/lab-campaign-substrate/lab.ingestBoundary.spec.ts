import { createClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';

import { corpusManifest } from '../../lab/src/corpus';
import { publicationPlan } from '../../lab/src/corpus-install';
import { harnessCredentials } from '../../lab/src/credentials';
import { EPHEMERAL_SUBSTRATE, SUBSTRATE_ENV_VAR } from '../../lab/src/environment';
import { IngestFailed, installLabCorpus, verifyInstalled } from '../../lab/src/ingest';
import { resolveSubstrate } from '../../lab/src/substrate';

/**
 * Frontera de ingestión real · CP4.
 *
 * ---------------------------------------------------------------------------------------
 * Por qué esta suite existe
 *
 * El plan de publicación de CP3 se escribió sin atarse a la frontera: omitía `syllabus_block`
 * y `topic` y ordenaba las fuentes antes de los conceptos. Nada lo detectó, porque ninguna
 * prueba ejecutaba el instalador real contra la frontera real.
 *
 * Es la misma lección de Phase 3.1 y de Phase 4B: **una ruta solo está probada cuando una
 * prueba la recorre de verdad**. Así que esta suite ejecuta el módulo real contra la instancia
 * efímera, sin dobles.
 * ---------------------------------------------------------------------------------------
 */

const declared = process.env[SUBSTRATE_ENV_VAR] === EPHEMERAL_SUBSTRATE;

describe.skipIf(!declared)('el corpus se instala por la frontera real de ingestión', () => {
  it('publica la secuencia declarada, en el orden declarado, y la frontera la acepta', async () => {
    const { substrate, identity } = resolveSubstrate(process.env);
    const harness = harnessCredentials(substrate);
    const admin = createClient(harness.apiUrl, harness.serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const installed = await installLabCorpus(admin, identity);

    // La atadura: lo que el plan declara y lo que la frontera aceptó son la misma secuencia.
    expect(installed.publishedKinds).toEqual(publicationPlan().map((item) => item.kind));

    const counts = await verifyInstalled(admin, installed.packId);
    const manifest = corpusManifest();
    expect(counts.concepts).toBe(manifest.conceptCount);
    expect(counts.units).toBe(manifest.unitCount);
    expect(counts.questions).toBe(manifest.questionCount);

    // El contenido instalado es el del manifiesto congelado, no otro.
    expect(installed.manifest.contentHash).toBe(manifest.contentHash);
  });

  it('un destino que no es la instancia efímera no recibe una sola fila', async () => {
    const { substrate, identity } = resolveSubstrate(process.env);
    const harness = harnessCredentials(substrate);
    const admin = createClient(harness.apiUrl, harness.serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const impostor = { ...identity, kind: 'staging' } as unknown as typeof identity;
    await expect(installLabCorpus(admin, impostor)).rejects.toThrow(/instancia efímera/);
  });

  it('un rechazo de la frontera se propaga; no se publica lo que no validó', async () => {
    const { identity } = resolveSubstrate(process.env);
    // Cliente que devuelve un estado de rechazo **como dato**, que es como lo devuelve la
    // frontera de verdad. Comprobar solo `error` daría el ítem por validado.
    const rechazo = {
      rpc: async (fn: string) =>
        fn === 'validate_staged_item'
          ? { data: 'REJECTED', error: null }
          : { data: '00000000-0000-0000-0000-000000000000', error: null },
    } as unknown as Parameters<typeof installLabCorpus>[0];

    await expect(installLabCorpus(rechazo, identity)).rejects.toThrow(IngestFailed);
    await expect(installLabCorpus(rechazo, identity)).rejects.toThrow(/REJECTED/);
  });
});

describe.skipIf(declared)('sin sustrato declarado', () => {
  it('la suite no se ejecuta y no busca otro destino', () => {
    expect(process.env[SUBSTRATE_ENV_VAR]).not.toBe(EPHEMERAL_SUBSTRATE);
  });
});
