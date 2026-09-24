import { describe, expect, it } from 'vitest';
import type { CruiseBody, CruiseConfig } from '../game/core/cruise';
import {
  advanceCruise,
  applyBoost,
  applySlow,
  DEFAULT_CRUISE,
  noteAnswer,
  speedAt,
  speedStateAt,
} from '../game/core/cruise';

const C: CruiseConfig = {
  cruiseStepMs: 1000,
  boostSteps: 1,
  boostMs: 500,
  slowFactor: 0.5,
  slowMs: 1000,
  // The crawl has its own tests below (config I); here it never starts.
  idleAfterMs: 1e12,
  idleFactor: 0.25,
};
/** Crawls after 2 s without an answer, at a quarter of the pace. */
const I: CruiseConfig = { ...C, idleAfterMs: 2000, idleFactor: 0.25 };
const body = (distance = 0, idleFromMs = Infinity): CruiseBody => ({
  distance,
  boostLeft: 0,
  slowUntilMs: 0,
  idleFromMs,
});

/** Advance in frames of `frameMs` from `from` to `to`; returns the crossing time, if any. */
function run(
  b: CruiseBody,
  from: number,
  to: number,
  frameMs: number,
  finish = 100,
): number | null {
  for (let t = from; t < to; t += frameMs) {
    const cross = advanceCruise(b, t, Math.min(to, t + frameMs), finish, C);
    if (cross !== null) return cross;
  }
  return null;
}

describe('cruise movement', () => {
  it('cruises at the base pace with no answers', () => {
    const b = body();
    advanceCruise(b, 0, 2500, 100, C);
    expect(b.distance).toBeCloseTo(2.5, 10);
    expect(speedStateAt(b, 2500)).toBe('cruise');
  });

  it('a boost adds exactly boostSteps on top of cruising, over boostMs', () => {
    const b = body();
    applyBoost(b, 0, C);
    expect(speedStateAt(b, 0)).toBe('boost');
    expect(speedAt(b, 0, C)).toBeCloseTo(1 / 1000 + 1 / 500, 12);
    advanceCruise(b, 0, 250, 100, C);
    expect(b.distance).toBeCloseTo(0.25 + 0.5, 10);
    advanceCruise(b, 250, 2000, 100, C);
    expect(b.distance).toBeCloseTo(2 + 1, 10);
    expect(b.boostLeft).toBe(0);
    expect(speedStateAt(b, 2000)).toBe('cruise');
  });

  it('boosts add up: a second correct answer mid-boost loses nothing', () => {
    const b = body();
    applyBoost(b, 0, C);
    advanceCruise(b, 0, 100, 100, C);
    applyBoost(b, 100, C);
    advanceCruise(b, 100, 3000, 100, C);
    expect(b.distance).toBeCloseTo(3 + 2, 10);
  });

  it('a slow-down slows for slowMs, restarts on another wrong answer, and never stacks', () => {
    const b = body();
    applySlow(b, 0, C);
    expect(speedStateAt(b, 0)).toBe('slow');
    advanceCruise(b, 0, 500, 100, C);
    applySlow(b, 500, C); // restarts: slowed until 1500, still at half speed
    advanceCruise(b, 500, 2000, 100, C);
    // 1500 ms at half speed, then 500 ms at full speed.
    expect(b.distance).toBeCloseTo(0.75 + 0.5, 10);
    expect(speedStateAt(b, 2000)).toBe('cruise');
  });

  it('a correct answer cancels the slow-down', () => {
    const b = body();
    applySlow(b, 0, C);
    advanceCruise(b, 0, 200, 100, C);
    applyBoost(b, 200, C);
    expect(speedAt(b, 200, C)).toBeCloseTo(1 / 1000 + 1 / 500, 12);
    advanceCruise(b, 200, 1200, 100, C);
    expect(b.distance).toBeCloseTo(0.1 + 1 + 1, 10);
  });

  it('returns the exact crossing time and stops at the finish', () => {
    const b = body(2);
    expect(advanceCruise(b, 0, 500, 3, C)).toBeNull();
    const cross = advanceCruise(b, 500, 5000, 3, C);
    expect(cross).toBeCloseTo(1000, 9);
    expect(b.distance).toBe(3);
  });

  it('finds the crossing time inside a boost', () => {
    const b = body(2.5);
    applyBoost(b, 0, C);
    // speed 3 steps per second: 0.5 steps take 1000/6 ms.
    expect(advanceCruise(b, 0, 1000, 3, C)).toBeCloseTo(1000 / 6, 9);
  });

  it('is identical however time is sliced into frames', () => {
    const script = (frameMs: number): { d: number; cross: number | null } => {
      const b = body();
      let cross = run(b, 0, 700, frameMs);
      applySlow(b, 700, C);
      cross ??= run(b, 700, 1333, frameMs);
      applyBoost(b, 1333, C);
      cross ??= run(b, 1333, 1500, frameMs);
      applyBoost(b, 1500, C);
      cross ??= run(b, 1500, 9000, frameMs, 6);
      return { d: b.distance, cross };
    };
    const whole = script(100000);
    for (const frame of [1000 / 30, 1000 / 60, 1000 / 144, 7]) {
      const sliced = script(frame);
      expect(sliced.d).toBeCloseTo(whole.d, 9);
      expect(sliced.cross).toBeCloseTo(whole.cross as number, 6);
    }
  });

  it('crawls from idleAfterMs without an answer; any answer ends the crawl', () => {
    const b = body(0, 2000);
    expect(speedStateAt(b, 1999)).toBe('cruise');
    advanceCruise(b, 0, 4000, 100, I);
    expect(b.distance).toBeCloseTo(2 + 0.5, 10);
    expect(speedStateAt(b, 4000)).toBe('crawl');
    noteAnswer(b, 4000, I);
    expect(speedStateAt(b, 4000)).toBe('cruise');
    advanceCruise(b, 4000, 7000, 100, I);
    expect(b.distance).toBeCloseTo(2.5 + 2 + 0.25, 10);
  });

  it('a wrong answer while crawling slows for a moment, then returns to full pace, not the crawl', () => {
    const b = body(0, 0);
    applySlow(b, 0, I);
    expect(speedStateAt(b, 0)).toBe('slow');
    advanceCruise(b, 0, 2000, 100, I);
    expect(b.distance).toBeCloseTo(0.5 + 1, 10);
    expect(speedStateAt(b, 2000)).toBe('crawl'); // 2 s after that answer: idle again
  });

  it('a correct answer while crawling boosts at once', () => {
    const b = body(0, 0);
    applyBoost(b, 0, I);
    expect(speedStateAt(b, 0)).toBe('boost');
    advanceCruise(b, 0, 1000, 100, I);
    expect(b.distance).toBeCloseTo(1 + 1, 10);
  });

  it('with the crawl, the result is still identical however time is sliced into frames', () => {
    const script = (frameMs: number): number => {
      const b = body(0, 2000);
      const run2 = (from: number, to: number): void => {
        for (let t = from; t < to; t += frameMs)
          advanceCruise(b, t, Math.min(to, t + frameMs), 100, I);
      };
      run2(0, 3333);
      applySlow(b, 3333, I);
      run2(3333, 7777);
      applyBoost(b, 7777, I);
      run2(7777, 12000);
      return b.distance;
    };
    const whole = script(100000);
    for (const frame of [1000 / 30, 1000 / 60, 1000 / 144, 7]) {
      expect(script(frame)).toBeCloseTo(whole, 9);
    }
  });

  it('defaults: a pupil who never answers is far slower than one who only answers wrongly', () => {
    const idle = body(0, DEFAULT_CRUISE.idleAfterMs);
    advanceCruise(idle, 0, 120000, 100, DEFAULT_CRUISE);
    const guesser = body(0, DEFAULT_CRUISE.idleAfterMs);
    for (let t = 0; t < 120000; t += 8000) {
      applySlow(guesser, t, DEFAULT_CRUISE);
      advanceCruise(guesser, t, t + 8000, 100, DEFAULT_CRUISE);
    }
    expect(idle.distance).toBeLessThan(2.5); // about 0.67 + 110 s at a crawl
    expect(guesser.distance).toBeGreaterThan(idle.distance * 2);
  });

  it('defaults: doing nothing never beats trying (1 right in 6 still beats idling)', () => {
    const idle = body(0, DEFAULT_CRUISE.idleAfterMs);
    advanceCruise(idle, 0, 60000, 100, DEFAULT_CRUISE);
    const trier = body(0, DEFAULT_CRUISE.idleAfterMs);
    let t = 0;
    for (let i = 0; i < 5; i++) {
      advanceCruise(trier, t, t + 3000, 100, DEFAULT_CRUISE);
      t += 3000;
      applySlow(trier, t, DEFAULT_CRUISE);
    }
    applyBoost(trier, t, DEFAULT_CRUISE);
    advanceCruise(trier, t, 60000, 100, DEFAULT_CRUISE);
    expect(trier.distance).toBeGreaterThan(idle.distance);
  });
});
