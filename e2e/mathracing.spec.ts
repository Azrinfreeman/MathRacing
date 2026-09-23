import { mkdirSync, readFileSync } from 'node:fs';
import type { CDPSession, Page } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { computeStageLayout } from '../src/game/ui/layout';
import { computeTrackGeometry } from '../src/game/ui/trackGeometry';
import type { RaceOptions } from './support';
import {
  SUCCESS_WAIT_MS,
  answerItems,
  clickTaps,
  fillSetup,
  questionSource,
  readAttempts,
  readSessionCount,
  startRace,
  tapPlan,
  watchErrors,
} from './support';
// (tapPlan/clickTaps are used by the multi-touch and slide tests below)

const SHOTS = 'e2e/screenshots';
mkdirSync(SHOTS, { recursive: true });

async function freshPage(page: Page): Promise<string[]> {
  const errors = watchErrors(page);
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.getByTestId('start')).toBeVisible();
  return errors;
}

async function clearData(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        const req = indexedDB.deleteDatabase('mathracing-evidence');
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
        req.onblocked = () => resolve();
      }),
  );
}

const TWO: RaceOptions = {
  seed: 'E2E-TWO',
  topics: ['y1-operations'],
  level: 1,
  players: 2,
  length: 5,
  names: ['Aina', 'Budi'],
};

test.describe('classroom happy path', () => {
  test('two-player Year 1 race: winner, results, Main Lagi, back to setup', async ({ page }) => {
    const errors = await freshPage(page);
    await page.screenshot({ path: `${SHOTS}/01-setup.png`, fullPage: true });
    await fillSetup(page, TWO);
    await page.getByTestId('start').click();
    await expect(page.locator('canvas')).toBeVisible();
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${SHOTS}/02-ready-2p.png` });
    await page.getByTestId('skip-ready').click();
    await expect(page.getByTestId('pause')).toBeVisible({ timeout: 15_000 });
    await page.screenshot({ path: `${SHOTS}/03-race-2p.png` });

    await answerItems(page, TWO, 0, TWO.length); // Aina answers every item correctly and finishes first
    await expect(page.getByTestId('winner-banner')).toContainText('Aina', { timeout: 15_000 });
    await expect(page.getByTestId('standings')).toContainText('Aina');
    await expect(page.getByTestId('standings')).toContainText('Budi');
    await page.screenshot({ path: `${SHOTS}/04-results.png` });

    // teacher evidence is hidden until asked for, and is labelled as evidence, not a TP
    await expect(page.getByTestId('evidence')).toHaveCount(0);
    await page.getByTestId('toggle-evidence').click();
    await expect(page.getByTestId('evidence')).toBeVisible();
    await expect(page.getByTestId('evidence')).toContainText('bukan markah');
    await page.screenshot({ path: `${SHOTS}/05-results-evidence.png`, fullPage: true });

    // Main Lagi: a fresh race with the same setup (new questions), then out to setup
    await page.getByTestId('again').click();
    await expect(page.locator('canvas')).toBeVisible();
    await page.getByTestId('cancel-ready').click();
    await expect(page.getByTestId('setup-error')).toBeAttached();
    await expect(page.getByTestId('start')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('a winner can be reached from a pause-and-resume, and Esc pauses', async ({ page }) => {
    const errors = await freshPage(page);
    await fillSetup(page, { ...TWO, seed: 'E2E-PAUSE' });
    await startRace(page);
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('pause-overlay')).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/06-paused.png` });
    // taps on the pause backdrop (over the panels) reach nothing: no attempt may be recorded
    const vp = page.viewportSize() ?? { width: 1920, height: 1080 };
    for (const x of [120, 300, 500]) await page.mouse.click(x, vp.height - 120);
    await page.waitForTimeout(200);
    expect(await readAttempts(page)).toHaveLength(0);
    await page.getByTestId('resume').click();
    await expect(page.getByTestId('pause-overlay')).toBeHidden();
    await answerItems(page, { ...TWO, seed: 'E2E-PAUSE' }, 1, TWO.length); // Budi wins this time
    await expect(page.getByTestId('winner-banner')).toContainText('Budi', { timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('every widget type works end to end (mixed Year 1 numbers race)', async ({ page }) => {
    const errors = await freshPage(page);
    const o: RaceOptions = {
      seed: 'E2E-WIDGETS',
      topics: ['y1-numbers'],
      level: 2,
      players: 2,
      length: 8,
      names: ['Aina', 'Budi'],
    };
    const kinds = new Set(
      Array.from({ length: 8 }, (_, i) => questionSource(o).question('p1', i).widget),
    );
    expect(kinds.size).toBeGreaterThanOrEqual(4); // several widget kinds in one race
    await fillSetup(page, o);
    await startRace(page);
    await answerItems(page, o, 0, o.length);
    await expect(page.getByTestId('winner-banner')).toContainText('Aina', { timeout: 20_000 });
    const attempts = await readAttempts(page);
    expect(attempts.filter((a) => a.playerId === 'p1' && a.correct)).toHaveLength(o.length);
    expect(attempts.every((a) => a.correct)).toBe(true); // no stray taps
    expect(errors).toEqual([]);
  });

  test('Year 2 number-pad and English interface work', async ({ page }) => {
    const errors = await freshPage(page);
    const o: RaceOptions = {
      seed: 'E2E-Y2',
      year: 2,
      topics: ['y2-operations'],
      level: 2,
      players: 2,
      length: 5,
      language: 'en',
      names: ['Mei', 'Ravi'],
    };
    await fillSetup(page, o);
    await expect(page.getByRole('heading', { name: 'Set up the race' })).toBeVisible();
    await startRace(page);
    await answerItems(page, o, 0, o.length);
    await expect(page.getByTestId('winner-banner')).toContainText('Mei wins!', { timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('practice mode has no winner emphasis', async ({ page }) => {
    const errors = await freshPage(page);
    const o: RaceOptions = {
      seed: 'E2E-PRAC',
      topics: ['y1-operations'],
      level: 1,
      players: 2,
      length: 5,
      mode: 'practice',
      names: ['Aina', 'Budi'],
    };
    await fillSetup(page, o);
    await startRace(page);
    await answerItems(page, o, 0, o.length);
    await answerItems(page, o, 1, o.length);
    await expect(page.getByTestId('winner-banner')).toContainText('Tahniah', { timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('layout at classroom resolutions', () => {
  for (const [w, h] of [
    [1280, 720],
    [1920, 1080],
    [3840, 2160],
  ] as const) {
    test(`five-player race at ${w}x${h}: panels visible, no scrollbars, no overlap`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: w, height: h });
      const errors = await freshPage(page);
      await fillSetup(page, {
        seed: `E2E-LAYOUT-${w}`,
        topics: ['y1-operations'],
        level: 1,
        players: 5,
        length: 8,
      });
      await startRace(page);
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${SHOTS}/07-race-5p-${w}x${h}.png` });
      const canvas = await page.locator('canvas').boundingBox();
      expect(canvas).not.toBeNull();
      expect(Math.round(canvas?.width ?? 0)).toBe(w);
      expect(Math.round(canvas?.height ?? 0)).toBe(h);
      const overflow = await page.evaluate(() => ({
        x: document.documentElement.scrollWidth > window.innerWidth,
        y: document.documentElement.scrollHeight > window.innerHeight,
      }));
      expect(overflow).toEqual({ x: false, y: false });
      const layout = computeStageLayout(w, h, 5);
      layout.panels.forEach((p) => {
        expect(p.x).toBeGreaterThanOrEqual(0);
        expect(p.x + p.w).toBeLessThanOrEqual(w);
        expect(p.y + p.h).toBeLessThanOrEqual(h);
      });
      expect(errors).toEqual([]);
    });
  }

  test('big 2-player screen: after one correct answer the car nose sits on the first step mark', async ({
    page,
  }) => {
    const [w, h] = [2560, 1440];
    await page.setViewportSize({ width: w, height: h });
    const errors = await freshPage(page);
    const o: RaceOptions = { ...TWO, seed: 'E2E-MARKS', length: 8 };
    await fillSetup(page, o);
    await startRace(page);
    await clickTaps(page, tapPlan(questionSource(o).question('p1', 0), { w, h }, 2, 0));
    await page.waitForTimeout(SUCCESS_WAIT_MS);
    await page.screenshot({ path: `${SHOTS}/07-marks-2p-${w}x${h}.png` });

    const geo = computeTrackGeometry(computeStageLayout(w, h, 2).track, 2, o.length);
    const laneTop = Math.round(geo.top);
    const png = await page.screenshot({
      clip: { x: 0, y: laneTop, width: w, height: Math.round(geo.laneH) },
    });
    // Player 1 drives the orange rocket: its right-most orange pixel is the nose.
    const nose = await page.evaluate(async (b64) => {
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
    expect(Math.abs(nose - (geo.markXs[0] ?? 0))).toBeLessThan(geo.carSize * 0.08);
    expect(errors).toEqual([]);
  });
});

// Regression: on a narrow/tall window with 150% display scaling the giant "Mula!" label made Phaser throw while
// drawing, which killed the game loop and froze the screen on the countdown "1". Every child now confirms Ready
// by touch (the real classroom path) in several window shapes and the race must start with no errors.
const AWKWARD_SHAPES = [
  [1103, 887, 1.5],
  [800, 455, 1.5],
  [600, 900, 1],
  [1366, 768, 1.25],
] as const;
for (const [w, h, dsf] of AWKWARD_SHAPES) {
  test.describe(`window ${w}x${h} at ${dsf}x scaling`, () => {
    test.use({ viewport: { width: w, height: h }, deviceScaleFactor: dsf });

    test('all players confirm Ready by touch, the countdown finishes and the race starts', async ({
      page,
    }) => {
      const errors = await freshPage(page);
      await fillSetup(page, {
        seed: `E2E-SHAPE-${w}`,
        topics: ['y1-operations'],
        level: 1,
        players: 4,
        length: 5,
      });
      await page.getByTestId('start').click();
      await expect(page.locator('canvas')).toBeVisible();
      await page.waitForTimeout(600);
      // Game pixels are device pixels; the mouse works in CSS pixels.
      const layout = computeStageLayout(Math.round(w * dsf), Math.round(h * dsf), 4);
      for (const panel of layout.panels) {
        await page.mouse.click((panel.x + panel.w / 2) / dsf, (panel.y + panel.h * 0.8) / dsf);
        await page.waitForTimeout(120);
      }
      await expect(page.getByTestId('pause')).toBeVisible({ timeout: 15_000 });
      await page.screenshot({ path: `${SHOTS}/09-race-${w}x${h}-${dsf}x.png` });
      expect(errors).toEqual([]);
    });
  });
}

test.describe('2x display scaling (4K panel at 200 percent)', () => {
  test.use({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 2 });

  test('renders a 2x canvas and touches still land on the right control', async ({ page }) => {
    const errors = await freshPage(page);
    const o: RaceOptions = {
      seed: 'E2E-DPR',
      topics: ['y1-operations'],
      level: 1,
      players: 2,
      length: 5,
      names: ['Aina', 'Budi'],
    };
    await fillSetup(page, o);
    await startRace(page);
    const canvas = await page.evaluate(() => {
      const c = document.querySelector('canvas') as HTMLCanvasElement;
      const r = c.getBoundingClientRect();
      return { backing: [c.width, c.height], css: [Math.round(r.width), Math.round(r.height)] };
    });
    expect(canvas).toEqual({ backing: [1920, 1080], css: [960, 540] });
    await page.screenshot({ path: `${SHOTS}/08-race-2p-dpr2.png` });

    // Game coordinates are device pixels; the mouse works in CSS pixels, so halve the plan.
    const source = questionSource(o);
    for (let i = 0; i < o.length; i++) {
      const plan = tapPlan(source.question('p1', i), { w: 1920, h: 1080 }, 2, 0);
      await clickTaps(
        page,
        plan.map((p) => ({ x: p.x / 2, y: p.y / 2 })),
      );
      if (i < o.length - 1) await page.waitForTimeout(SUCCESS_WAIT_MS);
    }
    await expect(page.getByTestId('winner-banner')).toContainText('Aina', { timeout: 15_000 });
    const attempts = await readAttempts(page);
    expect(attempts.every((a) => a.correct)).toBe(true);
    expect(errors).toEqual([]);
  });
});

test.describe('multi-touch: pointers stay with the panel they started in', () => {
  async function touch(
    cdp: CDPSession,
    type: 'touchStart' | 'touchMove' | 'touchEnd',
    points: Array<{ x: number; y: number; id: number }>,
  ): Promise<void> {
    await cdp.send('Input.dispatchTouchEvent', {
      type,
      touchPoints: points.map((p) => ({ x: p.x, y: p.y, id: p.id })),
    });
  }

  test('five simultaneous fingers, one per panel, produce five independent correct answers', async ({
    page,
  }) => {
    const errors = await freshPage(page);
    const o: RaceOptions = {
      seed: 'E2E-FIVE',
      topics: ['y1-operations'],
      level: 1,
      players: 5,
      length: 5,
    };
    await fillSetup(page, o);
    await startRace(page);
    const cdp = await page.context().newCDPSession(page);
    const source = questionSource(o);
    const vp = page.viewportSize() ?? { width: 1920, height: 1080 };

    for (let item = 0; item < o.length; item++) {
      const plans = Array.from({ length: 5 }, (_, i) =>
        tapPlan(source.question(`p${i + 1}`, item), { w: vp.width, h: vp.height }, 5, i),
      );
      const steps = Math.max(...plans.map((p) => p.length));
      for (let k = 0; k < steps; k++) {
        // all fingers that still have a tap at this step go down together, then lift together
        const points = plans.flatMap((plan, i) =>
          plan[k]
            ? [{ x: (plan[k] as { x: number }).x, y: (plan[k] as { y: number }).y, id: i + 1 }]
            : [],
        );
        await touch(cdp, 'touchStart', points);
        await page.waitForTimeout(40);
        await touch(cdp, 'touchEnd', []);
        await page.waitForTimeout(40);
      }
      await page.waitForTimeout(SUCCESS_WAIT_MS);
      if (item === o.length - 1) break;
    }
    await expect(page.getByTestId('winner-banner')).toBeVisible({ timeout: 15_000 });
    const attempts = await readAttempts(page);
    // no attempt on any panel was wrong: nothing leaked between simultaneous fingers
    expect(attempts.length).toBeGreaterThanOrEqual(5);
    expect(attempts.filter((a) => !a.correct)).toEqual([]);
    for (const id of ['p1', 'p2', 'p3', 'p4', 'p5'])
      expect(attempts.some((a) => a.playerId === id)).toBe(true);
    expect(errors).toEqual([]);
  });

  test('a finger that starts outside a panel, or in another panel, cannot slide in and press Go', async ({
    page,
  }) => {
    const errors = await freshPage(page);
    const o: RaceOptions = {
      seed: 'E2E-SLIDE',
      topics: ['y1-operations'],
      level: 1,
      players: 2,
      length: 5,
    };
    await fillSetup(page, o);
    await startRace(page);
    const cdp = await page.context().newCDPSession(page);
    const vp = page.viewportSize() ?? { width: 1920, height: 1080 };
    const q = questionSource(o).question('p2', 0);
    if (q.widget !== 'number-pad') test.skip(true, 'seed produced a non number-pad first item');
    const plan = tapPlan(q, { w: vp.width, h: vp.height }, 2, 1);
    const go = plan.at(-1) as { x: number; y: number };

    // 1. type the correct answer on panel 2 but do NOT press Go
    await clickTaps(page, plan.slice(0, -1));
    // 2. a finger starting on the track slides onto panel 2's Go
    await touch(cdp, 'touchStart', [{ x: vp.width / 2, y: 40, id: 1 }]);
    await touch(cdp, 'touchMove', [{ x: go.x, y: go.y, id: 1 }]);
    await touch(cdp, 'touchEnd', []);
    // 3. a finger starting in panel 1 slides across onto panel 2's Go
    await touch(cdp, 'touchStart', [{ x: vp.width * 0.25, y: vp.height * 0.7, id: 2 }]);
    await touch(cdp, 'touchMove', [{ x: go.x, y: go.y, id: 2 }]);
    await touch(cdp, 'touchEnd', []);
    await page.waitForTimeout(300);
    expect(await readAttempts(page)).toHaveLength(0); // neither slide submitted the answer

    // a proper tap on Go from inside panel 2 does submit it
    await page.mouse.click(go.x, go.y);
    await expect.poll(async () => (await readAttempts(page)).length).toBe(1);
    expect((await readAttempts(page))[0]).toMatchObject({ playerId: 'p2', correct: true });
    expect(errors).toEqual([]);
  });
});

test.describe('evidence, export and deletion', () => {
  test('exports a CSV download, then deletes session data after confirmation', async ({ page }) => {
    const errors = await freshPage(page);
    await clearData(page);
    await page.reload();
    await fillSetup(page, TWO);
    await startRace(page);
    await answerItems(page, TWO, 0, TWO.length);
    await expect(page.getByTestId('winner-banner')).toBeVisible({ timeout: 15_000 });

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('export-csv').click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/^mathracing-\d{8}-\d{4}-.+\.csv$/);
    const path = await download.path();
    const csv = readFileSync(path, 'utf8');
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    const lines = csv.slice(1).trim().split('\r\n');
    expect(lines[0]).toContain('session_id,session_seed,pack_id');
    expect(lines).toHaveLength(1 + TWO.length); // header + one correct attempt per item
    expect(lines[1]).toContain('E2E-TWO');
    expect(lines[1]).toContain('Aina');

    expect(await readSessionCount(page)).toBe(1);
    await page.getByTestId('delete-session').click();
    await page.getByTestId('confirm-cancel').click(); // cancelling keeps the data
    expect(await readSessionCount(page)).toBe(1);
    await page.getByTestId('delete-session').click();
    await page.getByTestId('confirm-ok').click();
    await expect(page.getByTestId('results-status')).toContainText('dipadam');
    expect(await readSessionCount(page)).toBe(0);
    expect(await readAttempts(page)).toHaveLength(0);
    expect(errors).toEqual([]);
  });

  test('setup lists stored sessions and "delete all" clears them after confirmation', async ({
    page,
  }) => {
    const errors = await freshPage(page);
    await clearData(page);
    await page.reload();
    await fillSetup(page, { ...TWO, seed: 'E2E-KEEP' });
    await startRace(page);
    await answerItems(page, { ...TWO, seed: 'E2E-KEEP' }, 0, TWO.length);
    await expect(page.getByTestId('winner-banner')).toBeVisible({ timeout: 15_000 });
    await page.getByTestId('new-setup').click();
    await expect(page.getByTestId('session-count')).toContainText('1 sesi');
    await page.getByTestId('delete-all').click();
    await page.getByTestId('confirm-ok').click();
    await expect(page.getByTestId('session-count')).toContainText('0 sesi');
    expect(await readSessionCount(page)).toBe(0);
    expect(errors).toEqual([]);
  });
});

test.describe('offline and installability', () => {
  test('the app shell boots and races with the network disabled once cached', async ({
    page,
    context,
  }) => {
    const errors = await freshPage(page);
    // wait for the service worker to take control, then reload once so the page itself is SW-controlled
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    await page.reload();
    await expect
      .poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null))
      .toBe(true);
    const manifest = await page.evaluate(async () =>
      (await fetch('./manifest.webmanifest')).json(),
    );
    expect(manifest.name).toContain('MathRacing');
    expect(manifest.icons.some((i: { sizes: string }) => i.sizes === '512x512')).toBe(true);

    await context.setOffline(true);
    await page.reload();
    await expect(page.getByTestId('start')).toBeVisible();
    await fillSetup(page, { ...TWO, seed: 'E2E-OFFLINE' });
    await startRace(page);
    await answerItems(page, { ...TWO, seed: 'E2E-OFFLINE' }, 0, TWO.length);
    await expect(page.getByTestId('winner-banner')).toBeVisible({ timeout: 15_000 });
    await context.setOffline(false);
    expect(errors.filter((e) => !/Failed to load resource|net::ERR/.test(e))).toEqual([]);
  });

  test('no remote request is ever made during play', async ({ page }) => {
    const remote: string[] = [];
    page.on('request', (r) => {
      const url = new URL(r.url());
      if (!['localhost', '127.0.0.1'].includes(url.hostname) && url.protocol.startsWith('http'))
        remote.push(r.url());
    });
    await freshPage(page);
    await fillSetup(page, { ...TWO, seed: 'E2E-NET' });
    await startRace(page);
    await answerItems(page, { ...TWO, seed: 'E2E-NET' }, 0, TWO.length);
    await expect(page.getByTestId('winner-banner')).toBeVisible({ timeout: 15_000 });
    expect(remote).toEqual([]);
  });
});
