import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

import { describe, expect, it } from 'vitest';

import { REPO_ROOT } from './lib/run-guard';

/**
 * `offline.copy.spec` · el copy no promete lo que no existe.
 *
 * EC-012 · «Offline acotado; la UI no afirma sincronización sin confirmación».
 * INV-107 · el copy no atribuye fracaso moral a la interrupción.
 *
 * ---------------------------------------------------------------------------
 * Qué se corrige
 *
 * La pantalla sin conexión decía «Nada de lo que estabas haciendo se ha perdido
 * por este motivo». En Phase 0 no hay **ninguna** persistencia local: ni cola de
 * eventos, ni IndexedDB, ni reintentos. Eso llega en Phase 9. La frase era una
 * garantía sin respaldo, y de las peores: se descubre falsa justo cuando alguien
 * ya ha perdido trabajo.
 *
 * Este test no comprueba una redacción concreta —el copy definitivo depende del
 * Design System y de Onboarding & Edge States, ambos ausentes—, sino que **no
 * aparezca ninguna afirmación de persistencia o sincronización** mientras no
 * exista el mecanismo que la sostenga.
 * ---------------------------------------------------------------------------
 */

const read = (relative: string) => readFileSync(join(REPO_ROOT, relative), 'utf8');

/** Superficies que hoy pueden hablarle al usuario sobre el estado de la red. */
const USER_FACING_SOURCES = [
  'apps/web/src/app/offline/page.tsx',
  'apps/web/src/app/page.tsx',
  'apps/web/src/app/cuenta/page.tsx',
  'apps/web/src/app/entrar/page.tsx',
  'apps/web/src/app/registro/page.tsx',
  'apps/web/src/app/_components/credentials-form.tsx',
  'apps/web/src/app/_components/service-worker-registrar.tsx',
  'apps/web/src/app/layout.tsx',
  // Phase 2 · onboarding mínimo (REQ-C01). Es la primera pantalla que podría prometer un
  // plan, y en Phase 2 no hay Planner: su marcador se declara provisional y esta vigilancia
  // comprueba que el texto no afirma nada que el sistema no pueda cumplir (EC-012).
  'apps/web/src/app/onboarding/page.tsx',
  'apps/web/src/app/_components/onboarding-form.tsx',
];

/**
 * Afirmaciones prohibidas hasta que exista confirmación real del servidor.
 *
 * Cada una está redactada como aparecería en el texto visible, no como una
 * palabra suelta: «sincroniza» sola aparecería en un comentario técnico legítimo.
 */
const FORBIDDEN_CLAIMS: readonly { readonly pattern: RegExp; readonly why: string }[] = [
  {
    pattern: /no\s+se\s+ha\s+perdido/i,
    why: 'promete persistencia. En Phase 0 no hay cola local ni almacenamiento (Phase 9).',
  },
  {
    pattern: /nada\s+se\s+pierde/i,
    why: 'promete persistencia sin mecanismo que la sostenga.',
  },
  {
    pattern: /se\s+guard(ó|ara|ará|a)\s+autom/i,
    why: 'promete guardado automático. No existe.',
  },
  {
    pattern: /(se\s+)?sincroniz(ará|ara|a)\s+(luego|después|más\s+tarde|cuando)/i,
    why: 'afirma sincronización futura sin ACK del servidor (EC-012).',
  },
  {
    pattern: /todo\s+est(á|a)\s+guardado/i,
    why: 'afirma persistencia confirmada.',
  },
  {
    pattern: /tus?\s+(datos|respuestas|progreso)\s+est(á|a)n?\s+a\s+salvo/i,
    why: 'afirma durabilidad de datos que no se están almacenando.',
  },
  {
    pattern: /guardado\s+sin\s+conexi(ó|o)n/i,
    why: 'afirma almacenamiento offline. Llega en Phase 9.',
  },
];

/** Quita comentarios: la prosa que explica la prohibición no la infringe. */
function visibleCode(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

describe('offline.copy · EC-012 · INV-107', () => {
  it('la pantalla sin conexión existe', () => {
    expect(read('apps/web/src/app/offline/page.tsx')).toContain('offline-page');
  });

  it('ya no promete que no se ha perdido nada', () => {
    const source = visibleCode(read('apps/web/src/app/offline/page.tsx'));
    expect(source).not.toMatch(/no\s+se\s+ha\s+perdido/i);
  });

  describe('ninguna superficie promete persistencia ni sincronización', () => {
    for (const file of USER_FACING_SOURCES) {
      it(file, () => {
        const source = visibleCode(read(file));
        for (const { pattern, why } of FORBIDDEN_CLAIMS) {
          expect(source, `${file} contiene una afirmación prohibida: ${why}`).not.toMatch(pattern);
        }
      });
    }
  });

  it('el service worker sigue sin cachear HTML autenticado ni datos', () => {
    // La otra mitad de EC-012: no basta con no prometerlo en el texto si el
    // service worker sirve una página cacheada como si estuviera al día.
    const sw = read('apps/web/public/sw.js');
    expect(sw).toContain("url.pathname.startsWith('/auth')");
    expect(sw).toContain("url.pathname.startsWith('/api')");
    expect(sw).toContain('No se guarda la respuesta');
  });

  it('INV-107 · el copy no culpa a la persona de la interrupción', () => {
    const forbidden = [/fallida/i, /has\s+perdido/i, /atrasad/i, /racha/i, /abandonaste/i];
    for (const file of USER_FACING_SOURCES) {
      const source = visibleCode(read(file));
      for (const pattern of forbidden) {
        expect(source, `${file} atribuye fracaso a la interrupción`).not.toMatch(pattern);
      }
    }
  });

  it('la lista de superficies vigiladas cubre todas las páginas existentes', () => {
    // Si mañana aparece una pantalla nueva y nadie la añade aquí, este test lo
    // detecta en lugar de dejar un hueco silencioso.
    const appDir = join(REPO_ROOT, 'apps/web/src/app');

    const found: string[] = [];
    const visit = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const child = join(dir, entry.name);
        if (entry.isDirectory()) visit(child);
        else if (/\.(tsx)$/.test(entry.name)) {
          found.push(relative(REPO_ROOT, child).split('\\').join('/'));
        }
      }
    };
    visit(appDir);

    for (const file of found) {
      expect(USER_FACING_SOURCES, `${file} no está en la lista vigilada`).toContain(file);
    }

    for (const file of USER_FACING_SOURCES) {
      expect(() => read(file), `${file} ya no existe: actualiza la lista`).not.toThrow();
    }
  });
});
