import { describe, expect, it } from 'vitest';
import type { CruiseBody, CruiseConfig } from '../game/core/cruise';
import {
  advanceCruise,
  applyBoost,
  applySlow,
  DEFAULT_CRUISE,
  speedAt,
  speedStateAt,
} from '../game/core/cruise';

const C: CruiseConfig = {
  cruiseStepMs: 1000,
  boostSteps: 1,
  boostMs: 500,
  slowFactor: 0.5,
  slowMs: 1000,
};
const body = (distance = 0): CruiseBody => ({ distance, boostLeft: 0, slowUntilMs: 0 });

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

  it('defaults: doing nothing never beats trying (1 right in 6 still beats idling)', () => {
    const idle = body();
    advanceCruise(idle, 0, 60000, 100, DEFAULT_CRUISE);
    const trier = body();
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
