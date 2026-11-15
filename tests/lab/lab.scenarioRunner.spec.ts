import { describe, expect, it } from 'vitest';

import {
  MAX_SCREEN_VISITS,
  QUESTION_STEM,
  ScenarioAborted,
  runScenario,
  type CampaignPage,
  type RunnerContext,
} from '../../lab/src/runner';
import { INTERRUPTION_ORDINALS } from '../../lab/src/profile';
import type { SyntheticIdentity } from '../../lab/src/harness';

/**
 * Scenario Runner · CP4 · §5–6.
 *
 * El runner se prueba contra una página falsa **guionizada**: no para simular el producto, sino
 * para comprobar que el recorrido obedece al perfil congelado, que usa los selectores reales y
 * que aborta donde el escenario dice que debe abortar.
 *
 * Que estos casos pasen no prueba nada sobre STUDY OS. Eso lo prueba la campaña, contra la
 * instancia efímera, y es otra suite.
 */

interface PageScript {
  readonly path: string;
  readonly visible?: readonly string[];
  readonly options?: readonly string[];
  readonly texts?: Readonly<Record<string, string>>;
}

class FakePage implements CampaignPage {
  readonly clicks: string[] = [];
  readonly fills: Array<[string, string]> = [];
  readonly selects: Array<[string, string]> = [];
  private index = 0;

  constructor(private readonly script: readonly PageScript[]) {}

  private get current(): PageScript {
    return this.script[Math.min(this.index, this.script.length - 1)]!;
  }

  private advance(): void {
    this.index = Math.min(this.index + 1, this.script.length - 1);
  }

  async goto(url: string): Promise<unknown> {
    const path = new URL(url).pathname;
    const next = this.script.findIndex((page, i) => i >= this.index && page.path === path);
    this.index = next >= 0 ? next : Math.min(this.index + 1, this.script.length - 1);
    return undefined;
  }

  url(): string {
    return `http://127.0.0.1:3000${this.current.path}`;
  }

  async fill(selector: string, value: string): Promise<void> {
    this.fills.push([selector, value]);
  }

  async click(selector: string): Promise<void> {
    if (
      !(this.current.visible ?? []).includes(selector) &&
      !selector.includes('opcion-') &&
      !selector.includes('confianza-')
    ) {
      throw new Error(`se pulsó «${selector}», que no está visible en ${this.current.path}`);
    }
    this.clicks.push(selector);
    this.advance();
  }

  async selectOption(selector: string, value: string): Promise<void> {
    this.selects.push([selector, value]);
  }

  async textContent(selector: string): Promise<string | null> {
    return this.current.texts?.[selector] ?? null;
  }

  async isVisible(selector: string): Promise<boolean> {
    return (this.current.visible ?? []).includes(selector);
  }

  async offeredOptionKeys(): Promise<readonly string[]> {
    return this.current.options ?? [];
  }

  /** El guion avanza con cada pulsación, así que aquí basta con no bloquear. */
  async waitForUrlChange(): Promise<boolean> {
    return true;
  }

  async waitForVisible(selector: string): Promise<boolean> {
    return this.isVisible(selector);
  }
}

const IDENTITY: SyntheticIdentity = {
  email: 'lab-synthetic-mvp-0000@study-os.test',
  password: 'contraseña-sintetica-del-laboratorio',
  label: 'mvp',
};

function contextFor(script: readonly PageScript[]): { context: RunnerContext; page: FakePage } {
  const page = new FakePage(script);
  return {
    page,
    context: {
      page,
      baseUrl: 'http://127.0.0.1:3000',
      identity: IDENTITY,
      packLabel: 'Laboratorio · corpus sintetico controlado',
      targetDate: '2027-01-01',
      now: () => '2026-11-14T21:00:00Z',
    },
  };
}

/** Itinerario mínimo: alta, ajustes, objetivo, una lectura, una comprobación y cierre. */
const HAPPY: readonly PageScript[] = [
  { path: '/registro', visible: ['[data-testid="submit-button"]'] },
  { path: '/hoy', visible: [] },
  {
    path: '/ajustes',
    visible: [
      '[data-testid="ajustes-zona-select"]',
      '[data-testid="ajustes-zona-guardar"]',
      '[data-testid="ajustes-defecto"]',
      '[data-testid="ajustes-guardar"]',
    ],
  },
  {
    path: '/ajustes',
    visible: ['[data-testid="ajustes-defecto"]', '[data-testid="ajustes-guardar"]'],
  },
  { path: '/ajustes', visible: [] },
  {
    path: '/onboarding',
    visible: [
      '[data-testid="onboarding-form"]',
      '[data-testid="pack-select"]',
      '[data-testid="daily-minutes-input"]',
      '[data-testid="target-date-input"]',
      '[data-testid="onboarding-submit"]',
    ],
  },
  { path: '/hoy', visible: ['[data-testid="hoy-primaria"]'] },
  {
    path: '/aprender/1',
    visible: ['[data-testid="aprender-continuar"]', '[data-testid="dejarlo"]'],
    texts: {
      '[data-testid="accion-posicion"]': 'Acción 1 de 2',
      '[data-testid="accion-fase"]': 'Aprender',
      '[data-testid="aprender-titulo"]': 'Unidad sintética 1',
    },
  },
  { path: '/hoy', visible: ['[data-testid="hoy-primaria"]'] },
  {
    path: '/comprobar/1',
    visible: ['[data-testid="comprobar"]'],
    options: ['A', 'B', 'C', 'D'],
    texts: {
      '[data-testid="accion-posicion"]': 'Acción 1 de 2',
      [QUESTION_STEM]: '¿Enunciado sintético 1?',
    },
  },
  { path: '/comprobar/1', visible: ['[data-testid="comprobar"]'], options: ['A', 'B', 'C', 'D'] },
  { path: '/comprobar/1', visible: ['[data-testid="comprobar"]'], options: ['A', 'B', 'C', 'D'] },
  {
    path: '/comprobar/1',
    visible: ['[data-testid="feedback"]', '[data-testid="feedback-siguiente"]'],
    texts: { [QUESTION_STEM]: '¿Enunciado sintético 1?' },
  },
  {
    path: '/comprobar/1',
    visible: ['[data-testid="feedback"]', '[data-testid="feedback-siguiente"]'],
    texts: { [QUESTION_STEM]: '¿Enunciado sintético 1?' },
  },
  { path: '/hoy', visible: ['[data-testid="hoy-nada-elegible"]'] },
];

describe('el recorrido pasa por superficies reales', () => {
  it('se da de alta por el formulario y exige llegar a HOY', async () => {
    const { context, page } = contextFor(HAPPY);
    await runScenario(context);
    expect(page.fills).toContainEqual(['[data-testid="email-input"]', IDENTITY.email]);
    expect(page.clicks[0]).toBe('[data-testid="submit-button"]');
  });

  it('declara zona horaria y disponibilidad donde el producto las pide', async () => {
    const { context, page } = contextFor(HAPPY);
    await runScenario(context);
    expect(page.selects).toContainEqual(['[data-testid="ajustes-zona-select"]', 'Europe/Madrid']);
    expect(page.fills).toContainEqual(['[data-testid="ajustes-defecto"]', '30']);
  });

  it('elige el objetivo por el nombre visible del pack, no por su identificador', async () => {
    const { context, page } = contextFor(HAPPY);
    await runScenario(context);
    expect(page.selects).toContainEqual([
      '[data-testid="pack-select"]',
      'Laboratorio · corpus sintetico controlado',
    ]);
  });

  it('declara la zona horaria en el onboarding, que la exige: sin ella no existe «hoy»', async () => {
    const { context, page } = contextFor(HAPPY);
    await runScenario(context);
    expect(page.selects).toContainEqual(['[data-testid="timezone-select"]', 'Europe/Madrid']);
  });

  it('nunca invoca una RPC ni escribe estado: solo abre, rellena, elige y pulsa', async () => {
    const { context, page } = contextFor(HAPPY);
    await runScenario(context);
    for (const selector of page.clicks) {
      expect(selector.startsWith('[data-testid=') || selector.includes('opcion-')).toBe(true);
    }
  });
});

describe('las decisiones las toma el perfil, no el runner', () => {
  it('elige la primera opción ofrecida y la confianza que su política dicta', async () => {
    const { context, page } = contextFor(HAPPY);
    await runScenario(context);
    expect(page.clicks).toContain('[data-testid="opcion-A"]');
    // Ordinal 1 es impar: confianza 3.
    expect(page.clicks).toContain('[data-testid="confianza-3"]');
    expect(page.clicks).toContain('[data-testid="comprobar"]');
  });

  it('en una lectura con ordinal de interrupción, abandona en vez de continuar', async () => {
    const ordinal = INTERRUPTION_ORDINALS[0]!;
    const script = HAPPY.map((page) =>
      page.path.startsWith('/aprender')
        ? {
            ...page,
            texts: { ...page.texts, '[data-testid="accion-posicion"]': `Acción ${ordinal} de 3` },
          }
        : page,
    );
    const { context, page } = contextFor(script);
    await runScenario(context);
    expect(page.clicks).toContain('[data-testid="dejarlo"]');
    expect(page.clicks).not.toContain('[data-testid="aprender-continuar"]');
  });

  it('la interrupción se gasta: al retomar el mismo punto, continúa en vez de reinterrumpir', async () => {
    const ordinal = INTERRUPTION_ORDINALS[0]!;
    const lectura: PageScript = {
      path: '/aprender/2',
      visible: ['[data-testid="aprender-continuar"]', '[data-testid="dejarlo"]'],
      texts: { '[data-testid="accion-posicion"]': `Acción ${ordinal} de 3` },
    };
    // El producto ofrece retomar justo donde se dejó, así que el aprendiz vuelve al mismo
    // ordinal. Una política que reinterrumpiera sin condición no cerraría el día nunca.
    const script: readonly PageScript[] = [
      { path: '/registro', visible: ['[data-testid="submit-button"]'] },
      { path: '/hoy', visible: [] },
      { path: '/ajustes', visible: [] },
      { path: '/onboarding', visible: [] },
      { path: '/hoy', visible: ['[data-testid="hoy-primaria"]'] },
      lectura,
      { path: '/hoy', visible: ['[data-testid="hoy-primaria"]'] },
      lectura,
      { path: '/hoy', visible: ['[data-testid="hoy-nada-elegible"]'] },
    ];
    const { context, page } = contextFor(script);
    const result = await runScenario(context);
    expect(page.clicks.filter((c) => c === '[data-testid="dejarlo"]')).toHaveLength(1);
    expect(page.clicks).toContain('[data-testid="aprender-continuar"]');
    expect(result.completed).toBe(true);
  });

  it('en una lectura sin ordinal de interrupción, continúa', async () => {
    const { context, page } = contextFor(HAPPY);
    await runScenario(context);
    expect(page.clicks).toContain('[data-testid="aprender-continuar"]');
  });
});

describe('el diario registra lo que el aprendiz vio, y solo eso', () => {
  it('guarda enunciado, opciones ofrecidas, elección y confianza', async () => {
    const { context } = contextFor(HAPPY);
    const result = await runScenario(context);
    const check = result.log.visits.find((visit) => visit.path.startsWith('/comprobar'));
    expect(check?.questionStem).toBe('¿Enunciado sintético 1?');
    expect(check?.optionKeysOffered).toEqual(['A', 'B', 'C', 'D']);
    expect(check?.chosenOptionKey).toBe('A');
    expect(check?.confidenceEntered).toBe(3);
    expect(check?.submitted).toBe(true);
  });

  it('no registra ningún identificador interno: el Actor no los conoce', async () => {
    const { context } = contextFor(HAPPY);
    const result = await runScenario(context);
    const serialized = JSON.stringify(result.log);
    expect(serialized).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}/);
  });

  it('observa que la corrección no estaba antes de enviar', async () => {
    const { context } = contextFor(HAPPY);
    const result = await runScenario(context);
    const check = result.log.visits.find((visit) => visit.submitted);
    expect(check?.answerKeyVisibleBeforeSubmit).toBe(false);
  });

  it('y lo denuncia si estaba', async () => {
    const script = HAPPY.map((page) =>
      page.path === '/comprobar/1' && page.options
        ? { ...page, visible: [...(page.visible ?? []), '[data-testid="respuesta-correcta"]'] }
        : page,
    );
    const { context } = contextFor(script);
    const result = await runScenario(context);
    const check = result.log.visits.find((visit) => visit.submitted);
    expect(check?.answerKeyVisibleBeforeSubmit).toBe(true);
  });
});

describe('el runner no decide el final: lo observa', () => {
  it('termina cuando HOY decide un vacío veraz, y registra qué decidió', async () => {
    const { context } = contextFor(HAPPY);
    const result = await runScenario(context);
    expect(result.completed).toBe(true);
    expect(result.finalPath).toBe('/hoy');
    expect(result.todayTerminalState).toBe('NOTHING_ELIGIBLE');
  });

  it('un presupuesto en el que nada cabe también cierra el día, y se distingue', async () => {
    const script = HAPPY.map((page, index) =>
      index === HAPPY.length - 1 ? { ...page, visible: ['[data-testid="hoy-nada-cabe"]'] } : page,
    );
    const result = await runScenario(contextFor(script).context);
    expect(result.completed).toBe(true);
    expect(result.todayTerminalState).toBe('NOTHING_FITS');
  });

  it('un fallo de planificación NO cierra el día: no es una ejecución satisfactoria', async () => {
    const script = HAPPY.map((page, index) =>
      index === HAPPY.length - 1 ? { ...page, visible: ['[data-testid="hoy-sin-plan"]'] } : page,
    );
    const result = await runScenario(contextFor(script).context);
    expect(result.completed).toBe(false);
    expect(result.todayTerminalState).toBe('CANNOT_PLAN');
  });

  it('una superficie de HOY que no reconocemos es desviación, no cierre', async () => {
    const script = HAPPY.map((page, index) =>
      index === HAPPY.length - 1 ? { ...page, visible: [] } : page,
    );
    const result = await runScenario(contextFor(script).context);
    expect(result.completed).toBe(false);
    expect(result.todayTerminalState).toBe('UNKNOWN');
  });

  it('no da por completada una ejecución que HOY devuelve a configuración', async () => {
    const script: readonly PageScript[] = [
      { path: '/registro', visible: ['[data-testid="submit-button"]'] },
      { path: '/hoy', visible: [] },
      { path: '/ajustes', visible: [] },
      { path: '/onboarding', visible: [] },
      { path: '/hoy', visible: ['[data-testid="hoy-primaria"]'] },
      { path: '/ajustes', visible: [] },
    ];
    const { context } = contextFor(script);
    const result = await runScenario(context);
    expect(result.completed).toBe(false);
    expect(result.finalPath).toBe('/ajustes');
  });
});

describe('las condiciones de aborto abortan', () => {
  it('si el alta no lleva a HOY, el escenario no sigue', async () => {
    const script: readonly PageScript[] = [
      { path: '/registro', visible: ['[data-testid="submit-button"]'] },
      { path: '/cuenta', visible: [] },
    ];
    const { context } = contextFor(script);
    await expect(runScenario(context)).rejects.toThrow(ScenarioAborted);
  });

  it('si el onboarding no ofrece packs, el corpus no está publicado y se aborta', async () => {
    const script: readonly PageScript[] = [
      { path: '/registro', visible: ['[data-testid="submit-button"]'] },
      { path: '/hoy', visible: [] },
      { path: '/ajustes', visible: [] },
      { path: '/onboarding', visible: ['[data-testid="onboarding-sin-packs"]'] },
    ];
    const { context } = contextFor(script);
    await expect(runScenario(context)).rejects.toThrow(/corpus no está publicado/);
  });

  it('un bucle del producto agota el tope y aborta: no es un final satisfactorio', async () => {
    const script: readonly PageScript[] = [
      { path: '/registro', visible: ['[data-testid="submit-button"]'] },
      { path: '/hoy', visible: [] },
      { path: '/ajustes', visible: [] },
      { path: '/onboarding', visible: [] },
      { path: '/fin', visible: [] },
    ];
    const { context } = contextFor(script);
    await expect(runScenario(context)).rejects.toThrow(
      new RegExp(`tope de ${MAX_SCREEN_VISITS} pantallas`),
    );
  });
});
