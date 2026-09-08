#!/usr/bin/env node
/**
 * `npm run verify:originals` · comprobación **local** de los documentos de origen.
 *
 * ---------------------------------------------------------------------------
 * Por qué está fuera de los nueve checks y fuera de CI
 *
 * `_handoff/` está en `.gitignore`: no existe en un checkout limpio ni en el
 * runner de CI. Un test versionado que lo leyera sería verde o rojo según en qué
 * máquina se ejecute, que es lo contrario de una prueba.
 *
 * La separación es deliberada:
 *
 *   · `tests/unit/governingDocuments.registry.spec.ts` verifica el **contrato**
 *     —que el registro está bien formado, que los nombres y hashes son coherentes
 *     y que el código cita los mismos— usando solo el árbol Git;
 *   · este comando verifica los **ficheros reales**, cuando están delante.
 *
 * No pertenece a los nueve checks bloqueantes y no se ejecuta en CI. Falla con un
 * mensaje explícito si falta un documento o si su hash ha cambiado: eso no es un
 * detalle de entorno, es que el material de entrada ya no es el que se auditó.
 * ---------------------------------------------------------------------------
 */

import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url));

const registry = JSON.parse(readFileSync(join(REPO_ROOT, 'docs/governing-documents.json'), 'utf8'));

const ORIGINALS = join(REPO_ROOT, registry.originalsPath);

/** Todo lo que el registro dice que debería estar. */
const expected = [...registry.documents, ...registry.controlLayer, ...registry.nonGoverning];

const problems = [];
let verified = 0;

if (!existsSync(ORIGINALS)) {
  console.error(`✘ verify:originals: no existe ${registry.originalsPath}`);
  console.error('');
  console.error('  Es material de entrada y no se versiona. Este comando solo puede ejecutarse');
  console.error('  en un árbol de trabajo donde los originales estén presentes.');
  process.exit(1);
}

function inspectContent(entry, bytes) {
  const head = bytes.subarray(0, 5).toString('latin1');

  if (entry.kind === 'pdf') {
    if (head !== '%PDF-') return `no empieza por %PDF- sino por ${JSON.stringify(head)}`;

    const text = bytes.toString('latin1');
    const pages = (text.match(/\/Type\s*\/Page\b/g) ?? []).length;
    const images = (text.match(/\/Subtype\s*\/Image/g) ?? []).length;
    const fonts = (text.match(/\/Font/g) ?? []).length;

    if (fonts === 0) return 'no declara fuentes: no parece un PDF de texto';
    if (typeof entry.pages === 'number' && pages !== entry.pages) {
      return `páginas: registradas ${entry.pages}, reales ${pages}`;
    }
    if (typeof entry.images === 'number' && images !== entry.images) {
      return `objetos de imagen: registrados ${entry.images}, reales ${images}`;
    }
    return null;
  }

  if (entry.kind === 'ooxml') {
    if (bytes.subarray(0, 4).toString('latin1') !== 'PK') {
      return 'no empieza por la firma ZIP de un OOXML';
    }
    if (!bytes.toString('latin1').includes('word/document.xml')) {
      return 'no contiene word/document.xml';
    }
    return null;
  }

  if (entry.kind === 'markdown') {
    // Suficiente para distinguir texto de un binario renombrado.
    if (bytes.includes(0)) return 'contiene bytes nulos: no es texto';
    return null;
  }

  return `tipo desconocido en el registro: ${String(entry.kind)}`;
}

for (const entry of expected) {
  const path = join(ORIGINALS, entry.file);

  if (!existsSync(path)) {
    problems.push(`${entry.file} · AUSENTE en ${registry.originalsPath}`);
    continue;
  }

  const bytes = readFileSync(path);
  const actual = createHash('sha256').update(bytes).digest('hex');

  if (actual !== entry.sha256) {
    problems.push(
      `${entry.file} · HASH DISTINTO\n      registrado: ${entry.sha256}\n      real:       ${actual}`,
    );
    continue;
  }

  const contentProblem = inspectContent(entry, bytes);
  if (contentProblem) {
    problems.push(`${entry.file} · contenido inesperado · ${contentProblem}`);
    continue;
  }

  verified += 1;
}

// El paquete congelado, si está.
const frozen = join(REPO_ROOT, registry.frozenPackage.file);
if (existsSync(frozen)) {
  const actual = createHash('sha256').update(readFileSync(frozen)).digest('hex');
  if (actual !== registry.frozenPackage.sha256) {
    problems.push(
      `${registry.frozenPackage.file} · HASH DISTINTO\n      registrado: ${registry.frozenPackage.sha256}\n      real:       ${actual}`,
    );
  } else {
    verified += 1;
  }
} else {
  problems.push(`${registry.frozenPackage.file} · AUSENTE`);
}

console.log(`  ${verified} de ${expected.length + 1} artefactos de origen verificados`);

if (problems.length === 0) {
  console.log('✔ verify:originals: nombres, hashes y contenido coinciden con el registro');
  process.exit(0);
}

console.error(`✘ verify:originals: ${problems.length} problema(s)\n`);
for (const problem of problems) console.error(`  - ${problem}\n`);
console.error('El registro vive en docs/governing-documents.json.');
console.error('Un documento que no coincide no es trazable y no debe usarse como autoridad.');
process.exit(1);
