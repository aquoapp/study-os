import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { REPO_ROOT } from './lib/run-guard';

/**
 * `fps.governance.spec` · gate FPS-G1 · aterrizaje de gobernanza del First Product Slice.
 *
 * Vigila que las tres decisiones humanas resueltas (H-FPS-A, H-FPS-B, H-FPS-C) sigan
 * registradas con su literal, que la semántica aceptada no se desdibuje y que lo que el FPS
 * **no** promete siga sin prometerse. Es documental por diseño: el aterrizaje no crea ningún
 * objeto de runtime, y una fase que se autoriza a sí misma en la conversación no se autoriza.
 */

const read = (relative: string) => readFileSync(join(REPO_ROOT, relative), 'utf8');

describe('SD-010 queda aceptada sin editar el cuerpo congelado', () => {
  const log = read('docs/SPEC_DIFF_LOG.md');

  it('la entrada de aceptación existe, cita C-06 y nombra a la decisora', () => {
    const entry = log.slice(log.indexOf('## SD-010 · **aceptación**'));
    expect(entry.length).toBeGreaterThan(0);
    expect(entry).toContain('`ACCEPTED`');
    expect(entry).toContain('C-06');
    expect(entry).toContain('Ana Victoria');
    expect(entry).toContain('docs/FPS_AUTHORIZATION_PACKET.md');
  });

  it('la entrada congelada original se conserva con su «Aprobación: pendiente»', () => {
    // El cuerpo congelado no se reescribe: se corrige con una entrada posterior (ADR Policy).
    const frozen = log.slice(
      log.indexOf('## SD-010 · Correcciones de referencias visuales aprobadas'),
      log.indexOf('## SD-011'),
    );
    expect(frozen).toContain('**Aprobación:** pendiente.');
  });

  it('las siete correcciones de C-06 siguen vigentes, no se debilita ninguna', () => {
    const entry = log.slice(log.indexOf('## SD-010 · **aceptación**'));
    expect(entry).toContain('Ninguna corrección se debilita');
    expect(entry).toContain('Phase 5');
  });

  it('el resumen vigente de la adenda es el del FPS, y sustituye al de Phase 2', () => {
    const fps = log.indexOf('## Estado de la adenda · tras la FPS Build Authorization');
    const phase2 = log.indexOf('## Estado de la adenda · tras la Phase 2 Build Authorization');
    expect(fps).toBeGreaterThan(-1);
    expect(phase2).toBeGreaterThan(-1);
    // El resumen vigente es el último: los anteriores se conservan sin editar.
    expect(fps).toBeGreaterThan(phase2);
  });
});

describe('el paquete de autorización del FPS registra las decisiones y la semántica', () => {
  const packet = read('docs/FPS_AUTHORIZATION_PACKET.md');

  it('las tres decisiones humanas constan resueltas', () => {
    expect(packet).toContain('H-FPS-A');
    expect(packet).toContain('H-FPS-B');
    expect(packet).toContain('H-FPS-C');
    expect(packet).toContain('`ACCEPTED`');
  });

  it('declara `fps-fixed-v1` como algoritmo determinista sin columna nueva', () => {
    expect(packet).toContain('fps-fixed-v1');
    expect(packet).toContain('determinista');
    expect(packet).toContain('No se añade\nninguna columna de metadatos');
  });

  it('declara el marcador persistido de la sesión', () => {
    expect(packet).toContain('FPS_FIXED');
    expect(packet).toContain('planner_run_id');
    expect(packet).toContain('planner_run_id IS NULL');
  });

  it('declara las cuatro rutas y que FEEDBACK no es una ruta', () => {
    for (const route of ['/hoy', '/aprender/[ordinal]', '/comprobar/[ordinal]', '/fin']) {
      expect(packet, `falta la ruta ${route}`).toContain(route);
    }
    expect(packet).toContain('FEEDBACK es un **estado**');
  });

  it('define los diez gates y deja FPS-G10 en manos humanas', () => {
    for (let gate = 1; gate <= 10; gate += 1) {
      expect(packet, `falta FPS-G${gate}`).toMatch(new RegExp(`\\*\\*FPS-G${gate}\\*\\*`));
    }
    expect(packet).toContain('PENDING HUMAN WALKTHROUGH');
    expect(packet).toMatch(/FPS-G10 \*\*no puede\*\* marcarlo Claude/);
  });

  it('hereda WATCH-P2-1 sin mitigarlo y con su restricción vinculante', () => {
    expect(packet).toContain('WATCH-P2-1');
    expect(packet).toContain('no se mitiga en FPS');
    expect(packet).toMatch(
      /ninguna mitigación futura puede comprometer la retroalimentación pedagógica veraz\s+posterior al envío/,
    );
  });

  it('registra D-20 como vigilancia, sin cerrarla ni ampliarla', () => {
    expect(packet).toContain('D-20');
    expect(packet).toContain('ni cerrada ni ampliada');
    expect(packet).toContain('storage_path');
  });

  it('no autoriza nada más', () => {
    for (const forbidden of ['Phase 1B', 'Phase 3', 'PRODUCTION', 'merge final']) {
      expect(packet, `el paquete no declara la exclusión de ${forbidden}`).toContain(forbidden);
    }
  });
});

describe('la disposición REQ-F es explícita y no debilita Phase 5', () => {
  const packet = read('docs/FPS_AUTHORIZATION_PACKET.md');

  const satisfechos = ['F01', 'F02', 'F04', 'F07', 'F08', 'F09', 'F11', 'F13', 'F15'];
  const diferidos = ['F03', 'F05', 'F06', 'F14'];
  const parciales = ['F10', 'F12'];

  it('los quince requisitos tienen disposición declarada', () => {
    for (const id of [...satisfechos, ...diferidos, ...parciales]) {
      expect(packet, `falta REQ-${id}`).toContain(`REQ-${id}`);
    }
  });

  it('los diferidos y los parciales dicen qué NO se fabrica', () => {
    expect(packet).toContain('**DIFERIDO**');
    expect(packet).toContain('**PARCIALMENTE SATISFECHO**');
    expect(packet).toContain('No se fabrica');
    expect(packet).toContain('distractor');
    expect(packet).toContain('Tutor');
    expect(packet).toContain('próximo repaso');
  });

  it('declara que diferido no significa rebajado', () => {
    expect(packet).toContain('no se debilitan');
  });
});

describe('el contrato de pantalla es autoridad de FPS v1 y no congela el futuro', () => {
  const contract = read('docs/FPS_SCREEN_CONTRACT.md');

  it('cubre las cinco superficies', () => {
    for (const surface of ['HOY', 'APRENDER', 'COMPROBAR', 'FEEDBACK', 'FIN']) {
      expect(contract, `falta la superficie ${surface}`).toContain(surface);
    }
  });

  it('declara su propio alcance temporal', () => {
    expect(contract).toContain('No congela el diseño visual futuro');
    expect(contract).toContain('recorrido manual de Ana');
  });

  it('recoge los invariantes que gobiernan estas pantallas', () => {
    for (const inv of ['INV-101', 'INV-102', 'INV-103', 'INV-104', 'INV-107', 'INV-111']) {
      expect(contract, `falta ${inv}`).toContain(inv);
    }
    expect(contract).toContain('EC-012');
    expect(contract).toContain('EC-017');
  });

  it('prohíbe la economía de celebración y la inteligencia fingida', () => {
    for (const forbidden of ['confeti', 'trofeo', 'racha', 'mascota', 'panel de mando']) {
      expect(contract, `el contrato no prohíbe ${forbidden}`).toContain(forbidden);
    }
  });

  it('obliga a leer la escala de confianza de la tabla gobernada', () => {
    expect(contract).toContain('confidence_scales');
    expect(contract).toMatch(/no se escriben a mano en el código como autoridad/);
  });

  it('fija la precedencia de la corrección pendiente sobre el cursor', () => {
    expect(contract).toContain('corrección pendiente');
  });

  it('exige que el color nunca sea el único portador de significado', () => {
    expect(contract).toContain('nunca es el único portador de significado');
  });
});

describe('el checkpoint del FPS dice la verdad sobre su propio estado', () => {
  const checkpoint = read('docs/FPS_CHECKPOINT.md');

  it('declara los diez gates en PASS, y FPS-G10 solo por recorrido humano', () => {
    for (let gate = 1; gate <= 10; gate += 1) {
      expect(checkpoint, `falta FPS-G${gate}`).toMatch(
        new RegExp(String.raw`\| \*\*FPS-G${gate}\*\*[^\n]*\*\*PASS\*\*`),
      );
    }
    // Lo que cierra G10 es que una persona usó el producto, no una suite. El documento tiene
    // que decirlo, porque un gate humano declarado por una prueba automática no es un gate.
    expect(checkpoint).toMatch(/\| \*\*FPS-G10\*\*[^\n]*recorrido humano real/);
    expect(checkpoint).toContain('no una prueba automática');
  });

  it('registra la congelación con su merge y su tag', () => {
    expect(checkpoint).toContain('FPS · FROZEN · HUMAN ACCEPTED · PASS WITH OBSERVATIONS');
    expect(checkpoint).toContain('6bde0a045532c8ffb2769c0a24d4bbb94958dd57');
    expect(checkpoint).toContain('fps-v1.0');
    // El tag va sobre el merge de implementación, no sobre un commit documental posterior.
    expect(checkpoint).toContain('árbol idéntico al HEAD aceptado');
  });

  it('registra el recorrido humano con su decisión y su evidencia', () => {
    expect(checkpoint).toContain('FPS · HUMAN WALKTHROUGH: PASS');
    expect(checkpoint).toContain('PASS WITH OBSERVATIONS');
    expect(checkpoint).toContain('## WALKTHROUGH EVIDENCE RECONCILIATION');
    // La reconciliación es de solo lectura: no se repara ni se borra evidencia para cuadrar.
    expect(checkpoint).toContain('No se ha borrado, reparado ni maquillado ninguna fila');
  });

  it('el sub-gate de interrupción dice la verdad sobre lo que ocurrió', () => {
    expect(checkpoint).toContain('NOT OBSERVED IN HUMAN EVIDENCE');
    expect(checkpoint).toContain('MECHANICALLY PROVEN BY FPS-G6');
    expect(checkpoint).toContain('No se inventa evidencia');
  });

  it('las cuatro observaciones constan, no bloquean y no se corrigen', () => {
    for (const obs of ['FPS-OBS-01', 'FPS-OBS-02', 'FPS-OBS-03', 'FPS-OBS-04']) {
      expect(checkpoint, `falta ${obs}`).toContain(obs);
    }
    expect(checkpoint).toContain('no bloqueantes');
    expect(checkpoint).toContain('**no corregidas**');
    // La planitud visual es observación de producto, nunca deuda técnica.
    expect(checkpoint).toContain('**No es deuda técnica.**');
    // Y la aceptación no aprueba el diseño visual definitivo.
    expect(checkpoint).toMatch(
      /no\*\* aprueba el diseño visual definitivo|no.. aprueba el diseño visual definitivo/,
    );
  });

  it('la congelación no autoriza la fase siguiente', () => {
    const next = checkpoint.slice(checkpoint.indexOf('## NEXT AUTHORITY'));
    expect(next).toContain('no autoriza nada más');
    for (const forbidden of ['Phase 1B', 'Phase 3', 'Planner', 'PRODUCTION']) {
      expect(next, `la frontera no nombra ${forbidden}`).toContain(forbidden);
    }
    // Y WATCH-P2-1 viaja con la fase, sin mitigar.
    expect(next).toContain('WATCH-P2-1');
    expect(next).toContain('sin mitigar');
  });

  it('declara que el FPS no toca la frontera congelada', () => {
    expect(checkpoint).toContain('Migraciones nuevas | **0**');
    expect(checkpoint).toContain('RPC nuevas | **0**');
    expect(checkpoint).toContain('Grants nuevos | **0**');
  });

  it('incluye el guion del recorrido manual y no pide nada técnico', () => {
    const guion = checkpoint.slice(
      checkpoint.indexOf('## ANA WALKTHROUGH INSTRUCTIONS'),
      checkpoint.indexOf('## NEXT AUTHORITY'),
    );
    expect(guion).toContain('Doce pasos');
    for (const forbidden of ['consola', 'SQL', 'Supabase', 'GitHub']) {
      // Solo pueden aparecer en la frase que dice que **no** hay que abrirlos.
      const mentions = guion.split(forbidden).length - 1;
      expect(mentions, `«${forbidden}» aparece ${mentions} veces en el guion`).toBeLessThanOrEqual(
        1,
      );
    }
  });

  it('hereda WATCH-P2-1 y D-20 sin cerrarlas y sin añadir deuda nueva', () => {
    expect(checkpoint).toContain('**no añade deuda nueva**');
    expect(checkpoint).toContain('WATCH-P2-1');
    expect(checkpoint).toContain('ni cerrada ni ampliada');
  });
});
