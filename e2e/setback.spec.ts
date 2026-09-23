import { mkdirSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';
import type { RaceOptions } from './support';
import {
  SUCCESS_WAIT_MS,
  clickTaps,
  fillSetup,
  questionSource,
  readAttempts,
  startRace,
  tapPlan,
  watchErrors,
  wrongTapPlan,
} from './support';

const SHOTS = 'e2e/screenshots';
mkdirSync(SHOTS, { recursive: true });

// Year 1 operations at level 1 deals number pads, which the wrong-answer helper needs.
const BASE: RaceOptions = {
  seed: 'E2E-SETBACK',
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

/** Player 1 answers item `index` correctly and waits for the success animation. */
async function right(page: Page, o: RaceOptions, index: number): Promise<void> {
  const q = questionSource(o).question('p1', index);
  await clickTaps(page, tapPlan(q, viewport(page), o.players, 0));
  await page.waitForTimeout(SUCCESS_WAIT_MS);
}

async function wrong(page: Page, o: RaceOptions, index: number, times: number): Promise<void> {
  const q = questionSource(o).question('p1', index);
  for (let i = 0; i < times; i++) {
    await clickTaps(page, wrongTapPlan(q, viewport(page), o.players, 0));
    await page.waitForTimeout(60);
  }
}

test.describe('setback after 3 wrong answers', () => {
  test('the 3rd wrong answer moves the car back one step, once, and the next question is new', async ({
    page,
  }) => {
    const errors = await freshPage(page);
    await fillSetup(page, BASE);
    await startRace(page);

    // one step forward, captured mid-drive (exhaust trail, speed lines, spinning wheels)
    const first = questionSource(BASE).question('p1', 0);
    await clickTaps(page, tapPlan(first, viewport(page), BASE.players, 0));
    await page.waitForTimeout(130);
    await page.screenshot({ path: `${SHOTS}/07-forward-driving.png` });
    await page.waitForTimeout(SUCCESS_WAIT_MS);

    await wrong(page, BASE, 1, 2);
    let attempts = (await readAttempts(page)).filter((a) => a.playerId === 'p1');
    expect(attempts.every((a) => a.stepDelta >= 0)).toBe(true);

    await wrong(page, BASE, 1, 1); // the 3rd wrong answer on this question
    await page.waitForTimeout(200); // mid-slide
    await page.screenshot({ path: `${SHOTS}/08-setback-sliding.png` });
    await page.waitForTimeout(900);
    await page.screenshot({ path: `${SHOTS}/09-setback-settled.png` });

    attempts = (await readAttempts(page)).filter((a) => a.playerId === 'p1');
    const third = attempts.filter((a) => a.itemIndex === 1)[2];
    expect(third).toMatchObject({
      correct: false,
      attemptNumber: 3,
      stepDelta: -1,
      progressAfter: 0,
    });

    // more wrong answers on the same question cost nothing more
    await wrong(page, BASE, 1, 3);
    attempts = (await readAttempts(page)).filter((a) => a.playerId === 'p1');
    expect(attempts.filter((a) => a.stepDelta < 0)).toHaveLength(1);

    // the same question is still on the panel: answering it correctly moves forward by one...
    await right(page, BASE, 1);
    // ...and then a NEW question (index 2) is dealt, never one already solved
    await right(page, BASE, 2);
    attempts = (await readAttempts(page)).filter((a) => a.playerId === 'p1');
    const solved = attempts.filter((a) => a.correct);
    expect(solved.map((a) => a.itemIndex)).toEqual([0, 1, 2]);
    expect(solved.map((a) => a.progressAfter)).toEqual([1, 1, 2]);
    expect(new Set(solved.map((a) => a.questionId)).size).toBe(3);
    expect(errors).toEqual([]);
  });

  test('no setback when the teacher switches it off', async ({ page }) => {
    const errors = await freshPage(page);
    const o: RaceOptions = { ...BASE, seed: 'E2E-SETBACK-OFF', options: { setback: false } };
    await fillSetup(page, o);
    await startRace(page);
    await right(page, o, 0);
    await wrong(page, o, 1, 4);
    const attempts = (await readAttempts(page)).filter((a) => a.playerId === 'p1');
    expect(attempts.every((a) => a.stepDelta >= 0)).toBe(true);
    expect(attempts.at(-1)?.progressAfter).toBe(1);
    expect(errors).toEqual([]);
  });

  test('no setback in Practice mode', async ({ page }) => {
    const errors = await freshPage(page);
    const o: RaceOptions = { ...BASE, seed: 'E2E-SETBACK-PRACTICE', mode: 'practice', length: 5 };
    await fillSetup(page, o);
    await startRace(page);
    await right(page, o, 0);
    await wrong(page, o, 1, 4);
    const attempts = (await readAttempts(page)).filter((a) => a.playerId === 'p1');
    expect(attempts.every((a) => a.stepDelta >= 0)).toBe(true);
    expect(errors).toEqual([]);
  });

  test('never drops below the start line', async ({ page }) => {
    const errors = await freshPage(page);
    const o = { ...BASE, seed: 'E2E-SETBACK-ZERO' };
    await fillSetup(page, o);
    await startRace(page);
    await wrong(page, o, 0, 4);
    const attempts = (await readAttempts(page)).filter((a) => a.playerId === 'p1');
    expect(attempts.every((a) => a.stepDelta === 0 && a.progressAfter === 0)).toBe(true);
    expect(errors).toEqual([]);
  });

  test('reduced motion: the setback still happens and no errors occur', async ({ page }) => {
    const errors = await freshPage(page);
    const o: RaceOptions = {
      ...BASE,
      seed: 'E2E-SETBACK-REDUCED',
      options: { reducedMotion: true },
    };
    await fillSetup(page, o);
    await startRace(page);
    await right(page, o, 0);
    await wrong(page, o, 1, 3);
    await page.waitForTimeout(100);
    await page.screenshot({ path: `${SHOTS}/10-setback-reduced-motion.png` });
    const attempts = (await readAttempts(page)).filter((a) => a.playerId === 'p1');
    expect(attempts.filter((a) => a.stepDelta < 0)).toHaveLength(1);
    expect(errors).toEqual([]);
  });
});
