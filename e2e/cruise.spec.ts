import { mkdirSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { computeStageLayout } from '../src/game/ui/layout';
import { computeTrackGeometry } from '../src/game/ui/trackGeometry';
import type { RaceOptions } from './support';
import {
  answerItems,
  clickTaps,
  fillSetup,
  questionSource,
  readAttempts,
  rocketNoseX,
  startRace,
  tapPlan,
  watchErrors,
  wrongTapPlan,
} from './support';

const SHOTS = 'e2e/screenshots';
mkdirSync(SHOTS, { recursive: true });

// Cruise is the default, so no option is needed. Year 1 operations at level 1 deals number pads.
const BASE: RaceOptions = {
  seed: 'E2E-CRUISE',
  topics: ['y1-operations'],
  level: 1,
  players: 2,
  length: 8,
  names: ['Aina', 'Budi'],
};

async function freshPage(page: Page): Promise<string[]> {
  const errors = watchErrors(page);
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.getByTestId('menu-race')).toBeVisible();
  return errors;
}

function viewport(page: Page): { w: number; h: number } {
  const vp = page.viewportSize() ?? { width: 1920, height: 1080 };
  return { w: vp.width, h: vp.height };
}

test.describe('cruise: cars drive on their own', () => {
  test('a car moves with no answers, and a correct answer boosts it past the first mark', async ({
    page,
  }) => {
    const errors = await freshPage(page);
    await fillSetup(page, BASE);
    await startRace(page);
    const vp = viewport(page);
    const geo = computeTrackGeometry(computeStageLayout(vp.w, vp.h, 2).track, 2, BASE.length);

    // No input: after a few seconds the car has left the start line on its own.
    await page.waitForTimeout(3000);
    const idleNose = await rocketNoseX(page, geo);
    expect(idleNose).toBeGreaterThan(geo.startLineX + geo.stepPx * 0.1);
    expect(idleNose).toBeLessThan(geo.markXs[0] ?? 0);

    // One correct answer: a boost worth one step, on top of cruising.
    await clickTaps(page, tapPlan(questionSource(BASE).question('p1', 0), vp, 2, 0));
    await page.waitForTimeout(250);
    await page.screenshot({ path: `${SHOTS}/11-cruise-boost.png` });
    await page.waitForTimeout(1500);
    expect(await rocketNoseX(page, geo)).toBeGreaterThan(geo.markXs[0] ?? 0);

    const [attempt] = await readAttempts(page);
    expect(attempt).toMatchObject({ correct: true, stepDelta: 1, speedEffect: 'boost' });
    expect(attempt?.progressAfter).toBeGreaterThan(0.1); // the car had already cruised forward
    expect(errors).toEqual([]);
  });

  test('a wrong answer only slows the car: it never moves back and there is no setback', async ({
    page,
  }) => {
    const errors = await freshPage(page);
    // This seed deals a number pad first (the wrong-answer helper needs one), as in setback.spec.ts.
    const o = { ...BASE, seed: 'E2E-SETBACK-ZERO' };
    await fillSetup(page, o);
    await startRace(page);
    const q = questionSource(o).question('p1', 0);
    for (let i = 0; i < 4; i++) {
      await clickTaps(page, wrongTapPlan(q, viewport(page), 2, 0));
      await page.waitForTimeout(400);
    }
    const attempts = await readAttempts(page);
    expect(attempts).toHaveLength(4);
    expect(attempts.every((a) => a.speedEffect === 'slow' && a.stepDelta === 0)).toBe(true);
    const positions = attempts.map((a) => a.progressAfter);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions); // never backwards
    expect(errors).toEqual([]);
  });

  test('answering every question wins the race', async ({ page }) => {
    const errors = await freshPage(page);
    const o = { ...BASE, seed: 'E2E-CRUISE-WIN', length: 5 };
    await fillSetup(page, o);
    await startRace(page);
    // Boosts land over time, so a few more answers than the race length may be needed to arrive.
    await answerItems(page, o, 0, o.length);
    await expect(page.getByTestId('winner-banner')).toContainText('Aina', { timeout: 20_000 });
    expect(errors).toEqual([]);
  });

  test('reduced motion: cars still cruise and boost, with no errors', async ({ page }) => {
    const errors = await freshPage(page);
    const o: RaceOptions = {
      ...BASE,
      seed: 'E2E-CRUISE-REDUCED',
      options: { reducedMotion: true },
    };
    await fillSetup(page, o);
    await startRace(page);
    const vp = viewport(page);
    const geo = computeTrackGeometry(computeStageLayout(vp.w, vp.h, 2).track, 2, o.length);
    await page.waitForTimeout(2000);
    expect(await rocketNoseX(page, geo)).toBeGreaterThan(geo.startLineX + geo.stepPx * 0.05);
    await clickTaps(page, tapPlan(questionSource(o).question('p1', 0), vp, 2, 0));
    await page.waitForTimeout(1600);
    expect(await rocketNoseX(page, geo)).toBeGreaterThan(geo.markXs[0] ?? 0);
    expect(errors).toEqual([]);
  });

  test('a car whose pupil stops answering crawls; one answer brings full speed back', async ({
    page,
  }) => {
    const errors = await freshPage(page);
    const o = { ...BASE, seed: 'E2E-CRUISE-IDLE' };
    await fillSetup(page, o);
    await startRace(page);
    const vp = viewport(page);
    const geo = computeTrackGeometry(computeStageLayout(vp.w, vp.h, 2).track, 2, o.length);
    // After 10 s without an answer the car crawls at a fifth of the pace: 4 s of crawling moves it about
    // 0.05 steps, where cruising would move it about 0.27 steps.
    await page.waitForTimeout(11_000);
    const before = await rocketNoseX(page, geo);
    await page.waitForTimeout(4000);
    const after = await rocketNoseX(page, geo);
    await page.screenshot({ path: `${SHOTS}/12-cruise-idle-crawl.png` });
    expect(after).toBeGreaterThanOrEqual(before);
    expect(after - before).toBeLessThan(geo.stepPx * 0.14);
    await clickTaps(page, tapPlan(questionSource(o).question('p1', 0), vp, 2, 0));
    await page.waitForTimeout(1600);
    expect(await rocketNoseX(page, geo)).toBeGreaterThan(after + geo.stepPx * 0.9);
    expect(errors).toEqual([]);
  });
});
