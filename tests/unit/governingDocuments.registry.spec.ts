import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { DESIGN_SYSTEM_SOURCE } from '@study-os/design-system';

import registry from '../../docs/governing-documents.json';

import { REPO_ROOT } from './lib/run-guard';

/**
 * `governingDocuments.registry.spec` · contrato del registro de documentos.
 *
 * ---------------------------------------------------------------------------
 * Este test NO toca `_handoff/`
 *
 * La versión anterior calculaba el SHA-256 de los ficheros reales dentro de
 * `test:unit`. `_handoff/` está en `.gitignore`: no existe en un checkout limpio
 * ni en el runner de CI, así que ese test era verde o rojo según la máquina. Un
 * check que depende de material no versionado no demuestra nada sobre el commit.
 *
 * Aquí se verifica lo que **sí** está en el árbol Git: que el registro está bien
 * formado, que los nombres y hashes son coherentes, y que el código que cita un
 * hash cita el mismo que el registro.
 *
 * La comprobación contra los ficheros reales es `npm run verify:originals`, local
 * y fuera de los nueve checks.
 * ---------------------------------------------------------------------------
 */

const read = (relative: string) => readFileSync(join(REPO_ROOT, relative), 'utf8');

interface RegistryEntry {
  file: string;
  title: string;
  sha256: string;
  kind: string;
  authorityLevel?: number;
  pages?: number;
  images?: number;
  governs?: string[];
  note?: string;
}

const documents = registry.documents as RegistryEntry[];
const controlLayer = registry.controlLayer as RegistryEntry[];
const nonGoverning = registry.nonGoverning as RegistryEntry[];
const all: RegistryEntry[] = [...documents, ...controlLayer, ...nonGoverning];

describe('registro de documentos gobernantes · contrato', () => {
  it('no depende de _handoff: este fichero no lo menciona como ruta a leer', () => {
    // La regla que este test encarna, comprobada sobre sí mismo.
    const self = read('tests/unit/governingDocuments.registry.spec.ts');
    expect(self).not.toMatch(/readFileSync\([^)]*_handoff/);
    expect(self).not.toMatch(/existsSync\([^)]*_handoff/);
  });

  it('ningún test versionado lee ficheros de _handoff', () => {
    const offenders: string[] = [];
    const specs = [
      'tests/unit/designSystem.blocked.spec.ts',
      'tests/unit/governingDocuments.registry.spec.ts',
      'tests/unit/tokens.contract.spec.ts',
      'tests/unit/tokens.contrast.spec.ts',
      'tests/unit/toolchain.pinning.spec.ts',
      'tests/unit/operational-security.spec.ts',
      'tests/unit/offline.copy.spec.ts',
      'tests/unit/guards.adversarial.spec.ts',
    ];

    for (const spec of specs) {
      let source: string;
      try {
        source = read(spec);
      } catch {
        continue; // el fichero puede no existir; otras pruebas lo cubren
      }
      if (/(readFileSync|existsSync|readdirSync)\([^)]*_handoff/.test(source)) offenders.push(spec);
    }

    expect(offenders, `estos tests leen _handoff: ${offenders.join(', ')}`).toEqual([]);
  });

  it('declara los ocho documentos gobernantes', () => {
    expect(documents).toHaveLength(8);
  });

  it('cada entrada tiene nombre, título, hash y tipo', () => {
    for (const entry of all) {
      expect(entry.file, JSON.stringify(entry)).toBeTruthy();
      expect(entry.title, entry.file).toBeTruthy();
      expect(entry.sha256, entry.file).toMatch(/^[0-9a-f]{64}$/);
      expect(['pdf', 'ooxml', 'markdown'], entry.file).toContain(entry.kind);
    }
  });

  it('no hay nombres ni hashes repetidos', () => {
    const files = all.map((entry) => entry.file);
    const hashes = all.map((entry) => entry.sha256);
    expect(new Set(files).size, 'nombre repetido').toBe(files.length);
    expect(new Set(hashes).size, 'hash repetido').toBe(hashes.length);
  });

  it('los niveles de autoridad son los del orden declarado', () => {
    for (const entry of documents) {
      expect(entry.authorityLevel, entry.file).toBeGreaterThanOrEqual(1);
      expect(entry.authorityLevel, entry.file).toBeLessThanOrEqual(4);
    }
  });

  it('las entradas PDF declaran páginas e imágenes esperadas', () => {
    for (const entry of all.filter((candidate) => candidate.kind === 'pdf')) {
      expect(entry.pages, entry.file).toBeGreaterThan(0);
      // Cero imágenes es lo que distingue un PDF de texto de un escaneo.
      expect(entry.images, entry.file).toBe(0);
    }
  });

  it('el paquete congelado está registrado con su hash', () => {
    expect(registry.frozenPackage.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(registry.frozenPackage.files).toBe(19);
  });
});

describe('coherencia entre el registro y el código', () => {
  const designSystem = documents.find((entry) => entry.title === 'Design System v1.0');

  it('el Design System está en el registro', () => {
    expect(designSystem).toBeDefined();
  });

  it('`status.ts` cita el mismo hash que el registro', () => {
    expect(DESIGN_SYSTEM_SOURCE.sha256).toBe(designSystem?.sha256);
  });

  it('`tokens.ts` cita el mismo hash que el registro', () => {
    expect(read('packages/design-system/src/tokens.ts')).toContain(designSystem?.sha256 ?? '·');
  });

  it('los ficheros que el registro dice que gobierna el Design System existen', () => {
    for (const path of designSystem?.governs ?? []) {
      expect(() => read(path), `${path} no existe`).not.toThrow();
    }
  });

  it('`docs/GOVERNING_DOCUMENTS.md` no contradice al registro', () => {
    const doc = read('docs/GOVERNING_DOCUMENTS.md');
    for (const entry of documents) {
      expect(doc, `falta el hash de ${entry.file}`).toContain(entry.sha256);
    }
  });

  it('el Founder Portfolio consta como material que no gobierna', () => {
    const founder = nonGoverning.find((entry) => entry.file.includes('Founder_Portfolio'));
    expect(founder).toBeDefined();
    expect(founder?.authorityLevel).toBe(7);
    expect(founder?.note).toContain('NO gobierna');
  });
});

describe('`verify:originals` es una comprobación separada', () => {
  const pkg = JSON.parse(read('package.json')) as { scripts: Record<string, string> };

  it('existe como script propio', () => {
    expect(pkg.scripts['verify:originals']).toBe('node tools/verify-originals.mjs');
  });

  it('no forma parte de los nueve checks bloqueantes', () => {
    const verify = read('tools/verify.mjs');
    expect(verify).not.toContain('verify:originals');
  });

  it('no se ejecuta en CI', () => {
    const ci = read('.github/workflows/ci.yml');
    expect(ci).not.toContain('verify:originals');
    // Y CI tampoco toca _handoff por ninguna otra vía.
    expect(ci).not.toContain('_handoff');
  });

  it('lee el mismo registro que este test', () => {
    const tool = read('tools/verify-originals.mjs');
    expect(tool).toContain('docs/governing-documents.json');
  });

  it('falla si falta un documento o si cambia su hash', () => {
    const tool = read('tools/verify-originals.mjs');
    expect(tool).toContain('AUSENTE');
    expect(tool).toContain('HASH DISTINTO');
    expect(tool).toContain('process.exit(1)');
  });
});
