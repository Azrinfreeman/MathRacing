import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { createQuestionSource } from '../src/curriculum/blueprint';
import type { QuestionSource } from '../src/curriculum/blueprint';
import { getDefaultRegistry } from '../src/curriculum/registry';
import type { GeneratedQuestion, Level, Year } from '../src/curriculum/schema';
import type { AttemptRecord } from '../src/game/core/RaceState';
import type { Rect } from '../src/game/ui/geometry';
import type { TrackGeometry } from '../src/game/ui/trackGeometry';
import { computePanelZones, computeStageLayout } from '../src/game/ui/layout';
import { createWidget } from '../src/game/widgets';

export type RaceOptions = {
  seed: string;
  year?: Year;
  topics: string[];
  level: Level;
  players: number;
  length: number;
  names?: string[];
  mode?: 'quick' | 'practice';
  language?: 'bm' | 'en';
  /** Teacher settings to switch on or off, by their `opt-*` test id suffix. */
  options?: Partial<
    Record<'sound' | 'reducedMotion' | 'hints' | 'support' | 'setback' | 'cruise', boolean>
  >;
};

export type Point = { x: number; y: number };

/** Collects console errors and uncaught page errors so a test can assert the happy path is clean. */
export function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console.error: ${m.text()}`);
  });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  return errors;
}

/**
 * From the main menu, set everything up the way a teacher would: language on the menu, seed and options on
 * the teacher screen, then the four setup steps. Ends on the "Ready?" step with Start visible (does not start).
 */
export async function fillSetup(page: Page, o: RaceOptions): Promise<void> {
  if (o.language === 'en') await page.getByTestId('lang-en').click();
  await page.getByTestId('menu-teacher').click();
  await page.getByTestId('seed').fill(o.seed);
  for (const [key, on] of Object.entries(o.options ?? {}))
    await page.getByTestId(`opt-${key}`).setChecked(on);
  await page.getByTestId('teacher-back').click();
  await page.getByTestId(o.mode === 'practice' ? 'menu-practice' : 'menu-race').click();
  // step 1: tapping a year moves straight on to step 2
  await page.getByTestId(`year-${o.year ?? 1}`).click();
  await expect(page.getByTestId('step-2')).toHaveAttribute('aria-current', 'step');
  await page.getByTestId('topics-none').click();
  for (const topic of o.topics) await page.getByTestId(`topic-${topic}`).click();
  await page.getByTestId(`level-${o.level}`).click();
  await page.getByTestId('setup-next').click();
  // step 3: players
  await page.getByTestId(`count-${o.players}`).click();
  for (const [i, name] of (o.names ?? []).entries()) await page.getByTestId(`name-${i}`).fill(name);
  await page.getByTestId('setup-next').click();
  // step 4: mode and race length
  await page.getByTestId(`mode-${o.mode ?? 'quick'}`).click();
  await page.getByTestId(`length-${o.length}`).click();
}

/** Start the race and get past the Ready screen (teacher "start now"), ending with the race live. */
export async function startRace(page: Page): Promise<void> {
  await page.getByTestId('start').click();
  await expect(page.locator('canvas')).toBeVisible();
  await page.getByTestId('skip-ready').click();
  // the pause control appears when the countdown has finished and the race is running
  await expect(page.getByTestId('pause')).toBeVisible({ timeout: 15_000 });
}

export function questionSource(o: RaceOptions): QuestionSource {
  const registry = getDefaultRegistry();
  const year = o.year ?? 1;
  return createQuestionSource(registry, {
    seed: o.seed,
    packId: registry.packForYear(year).packId,
    topicIds: o.topics,
    level: o.level,
    raceLength: o.length,
    language: o.language ?? 'bm',
  });
}

/** The taps (in canvas pixels) that answer a question correctly on a given player's panel. */
export function tapPlan(
  q: GeneratedQuestion,
  viewport: { w: number; h: number },
  players: number,
  playerIndex: number,
): Point[] {
  const layout = computeStageLayout(viewport.w, viewport.h, players);
  const panel = layout.panels[playerIndex] as Rect;
  const widget = createWidget(q);
  const zones = computePanelZones(panel, {
    hasVisual: q.prompt.visual !== undefined,
    showAnswerField: widget.showAnswerField,
  });
  const controls = widget.layout(zones.widget);
  const centre = (id: string): Point => {
    const c = controls.find((x) => x.id === id);
    if (!c) throw new Error(`no control ${id} for ${q.templateId}`);
    return { x: c.rect.x + c.rect.w / 2, y: c.rect.y + c.rect.h / 2 };
  };
  const a = q.acceptedAnswer;
  const opts = q.options ?? [];
  switch (q.widget) {
    case 'number-pad':
      if (a.kind !== 'number') throw new Error('number-pad needs a number answer');
      return [...a.value.split('').map((d) => centre(`d${d}`)), centre('submit')];
    case 'choice-tiles':
      if (a.kind !== 'choice') throw new Error('choice needs a choice answer');
      return [centre(a.optionId)];
    case 'tap-picture':
      if (a.kind === 'choice') return [centre(a.optionId)];
      if (a.kind === 'set') return [...a.optionIds.map(centre), centre('submit')];
      if (a.kind === 'count')
        return [...opts.slice(0, a.count).map((o) => centre(o.id)), centre('submit')];
      throw new Error('tap-picture answer kind');
    case 'order-strip':
      if (a.kind !== 'sequence') throw new Error('order needs a sequence');
      return [...a.optionIds.map(centre), centre('submit')];
    case 'build-value': {
      if (a.kind !== 'number') throw new Error('build needs a number');
      let left = Number(a.value);
      const taps: Point[] = [];
      for (const part of [...opts].sort((p, r) => (r.value ?? 0) - (p.value ?? 0))) {
        const v = part.value ?? 0;
        while (v > 0 && left >= v) {
          taps.push(centre(part.id));
          left -= v;
        }
      }
      if (left !== 0) throw new Error(`build-value target ${a.value} not reachable`);
      return [...taps, centre('submit')];
    }
  }
}

/**
 * Taps for a wrong (but complete) number-pad answer: one digit that is not the answer. Only number-pad
 * questions are supported, so tests that need wrong answers pick a topic and seed that deal number pads.
 */
export function wrongTapPlan(
  q: GeneratedQuestion,
  viewport: { w: number; h: number },
  players: number,
  playerIndex: number,
): Point[] {
  const a = q.acceptedAnswer;
  if (q.widget !== 'number-pad' || a.kind !== 'number')
    throw new Error(`wrongTapPlan needs a number-pad question, got ${q.widget}`);
  const layout = computeStageLayout(viewport.w, viewport.h, players);
  const panel = layout.panels[playerIndex] as Rect;
  const widget = createWidget(q);
  const zones = computePanelZones(panel, {
    hasVisual: q.prompt.visual !== undefined,
    showAnswerField: widget.showAnswerField,
  });
  const controls = widget.layout(zones.widget);
  const centre = (id: string): Point => {
    const c = controls.find((x) => x.id === id);
    if (!c) throw new Error(`no control ${id} for ${q.templateId}`);
    return { x: c.rect.x + c.rect.w / 2, y: c.rect.y + c.rect.h / 2 };
  };
  const last = Number(a.value.slice(-1));
  return [centre(`d${(last + 1) % 10}`), centre('submit')];
}

export const SUCCESS_WAIT_MS = 900;

/** Click a sequence of points with the mouse (one player, one finger). */
export async function clickTaps(page: Page, taps: readonly Point[]): Promise<void> {
  for (const t of taps) await page.mouse.click(t.x, t.y);
}

/** Answer `count` items for one player with the mouse, waiting for each success animation. */
export async function answerItems(
  page: Page,
  o: RaceOptions,
  playerIndex: number,
  count: number,
): Promise<void> {
  const source = questionSource(o);
  const vp = page.viewportSize() ?? { width: 1920, height: 1080 };
  for (let i = 0; i < count; i++) {
    const q = source.question(`p${playerIndex + 1}`, i);
    await clickTaps(page, tapPlan(q, { w: vp.width, h: vp.height }, o.players, playerIndex));
    if (i < count - 1) await page.waitForTimeout(SUCCESS_WAIT_MS);
  }
}

/**
 * The x of player 1's vehicle nose, in page pixels: player 1 drives the orange rocket, so its right-most
 * orange pixel in lane 1 is the nose. Returns -1 when no orange pixel is found.
 */
export async function rocketNoseX(page: Page, geo: TrackGeometry): Promise<number> {
  const vp = page.viewportSize() ?? { width: 1920, height: 1080 };
  const png = await page.screenshot({
    clip: { x: 0, y: Math.round(geo.top), width: vp.width, height: Math.round(geo.laneH) },
  });
  return page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext('2d');
    if (!ctx) return -1;
    ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    let max = -1;
    for (let i = 0; i < d.length; i += 4) {
      const [r, g, b] = [d[i] ?? 0, d[i + 1] ?? 0, d[i + 2] ?? 0];
      if (r > 170 && g > 45 && g < 110 && b < 40) max = Math.max(max, (i / 4) % c.width);
    }
    return max;
  }, png.toString('base64'));
}

/** Read every stored attempt straight from IndexedDB (the same evidence the CSV export uses). */
export async function readAttempts(page: Page): Promise<AttemptRecord[]> {
  return page.evaluate(
    () =>
      new Promise<AttemptRecord[]>((resolve, reject) => {
        const open = indexedDB.open('mathracing-evidence');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          if (!db.objectStoreNames.contains('attempts')) {
            resolve([]);
            return;
          }
          const req = db.transaction('attempts').objectStore('attempts').getAll();
          req.onsuccess = () => resolve(req.result as AttemptRecord[]);
          req.onerror = () => reject(req.error);
        };
      }),
  );
}

export async function readSessionCount(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      new Promise<number>((resolve, reject) => {
        const open = indexedDB.open('mathracing-evidence');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          if (!db.objectStoreNames.contains('sessions')) {
            resolve(0);
            return;
          }
          const req = db.transaction('sessions').objectStore('sessions').count();
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        };
      }),
  );
}
