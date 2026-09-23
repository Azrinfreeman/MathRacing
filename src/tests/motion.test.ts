import { describe, expect, it } from 'vitest';
import { CarMotion } from '../game/ui/motion';

/** Run the motion for `ms` in frames of `frameMs`. */
function run(m: CarMotion, ms: number, frameMs: number, reduced = false): void {
  const frames = Math.round(ms / frameMs);
  for (let i = 0; i < frames; i++) m.step(frameMs, reduced);
}

describe('CarMotion', () => {
  it('starts still at 0', () => {
    const m = new CarMotion();
    expect(m.progress).toBe(0);
    expect(m.direction).toBe('still');
    expect(m.moving).toBe(false);
  });

  it('moves forward to its target without overshooting, and settles', () => {
    const m = new CarMotion();
    m.setTarget(1, false);
    expect(m.direction).toBe('forward');
    let max = 0;
    for (let i = 0; i < 200; i++) {
      m.step(16, false);
      max = Math.max(max, m.progress);
    }
    expect(max).toBeLessThanOrEqual(1);
    expect(m.progress).toBe(1);
    expect(m.direction).toBe('still');
    expect(m.velocity).toBe(0);
  });

  it('moves backward to its target, more slowly than forward', () => {
    const fwd = new CarMotion();
    fwd.setTarget(1, false);
    run(fwd, 300, 10);
    const forwardShare = fwd.progress; // fraction of 1 step covered in 300 ms

    const back = new CarMotion();
    back.setTarget(2, false, true);
    back.setTarget(1, false);
    expect(back.direction).toBe('backward');
    run(back, 300, 10);
    const backwardShare = 2 - back.progress; // fraction of the 1-step move covered in 300 ms
    expect(backwardShare).toBeLessThan(forwardShare);

    run(back, 3000, 10);
    expect(back.progress).toBe(1);
    expect(back.direction).toBe('still');
  });

  it('reaches the same position at 30, 60 and 144 fps', () => {
    const at = (fps: number): number => {
      const m = new CarMotion();
      m.setTarget(1, false);
      run(m, 500, 1000 / fps);
      return m.progress;
    };
    expect(at(60)).toBeCloseTo(at(30), 3);
    expect(at(60)).toBeCloseTo(at(144), 3);
  });

  it('survives a long stalled frame (tab in the background)', () => {
    const m = new CarMotion();
    m.setTarget(3, false);
    m.step(5000, false);
    expect(m.progress).toBeCloseTo(3, 3);
    expect(Number.isFinite(m.velocity)).toBe(true);
  });

  it('retargeting mid-move is continuous (no jump in position or speed)', () => {
    const m = new CarMotion();
    m.setTarget(1, false);
    run(m, 100, 10);
    const before = { p: m.progress, v: m.velocity };
    m.setTarget(2, false);
    expect(m.progress).toBe(before.p);
    expect(m.velocity).toBe(before.v);
    m.step(1, false);
    expect(Math.abs(m.progress - before.p)).toBeLessThan(0.02);
    run(m, 3000, 10);
    expect(m.progress).toBe(2);
  });

  it('turning around mid-move stays bounded', () => {
    const m = new CarMotion();
    m.setTarget(2, false);
    run(m, 120, 10);
    m.setTarget(1, false);
    const start = m.progress;
    let min = start;
    let max = start;
    for (let i = 0; i < 400; i++) {
      m.step(10, false);
      min = Math.min(min, m.progress);
      max = Math.max(max, m.progress);
    }
    expect(min).toBeGreaterThanOrEqual(start - 1e-9); // momentum carries it forward first, never further back
    expect(max).toBeLessThan(1.35); // bounded overshoot (rare in play: a pupil is locked while their car moves)
    expect(m.progress).toBe(1);
  });

  it('wheels roll with the direction of travel and in proportion to distance', () => {
    const m = new CarMotion();
    m.setTarget(2, false);
    run(m, 3000, 10);
    expect(m.travelled).toBeCloseTo(2, 2);
    m.setTarget(1, false);
    run(m, 3000, 10);
    expect(m.travelled).toBeCloseTo(1, 2); // 2 forward, then 1 back
  });

  it('wobbles only after a setback, then stops', () => {
    const m = new CarMotion();
    m.setTarget(2, false);
    run(m, 100, 10);
    expect(m.wobbleMs).toBe(0);
    m.setTarget(1, false);
    expect(m.wobbleMs).toBeGreaterThan(0);
    let peak = 0;
    for (let i = 0; i < 20; i++) {
      m.step(20, false);
      peak = Math.max(peak, Math.abs(m.wobble));
    }
    expect(peak).toBeGreaterThan(0.2);
    run(m, 1000, 20);
    expect(m.wobble).toBe(0);
  });

  it('leans nose-up when accelerating forward', () => {
    const m = new CarMotion();
    m.setTarget(1, false);
    m.step(30, false);
    expect(m.accel).toBeGreaterThan(0);
  });

  it('reduced motion snaps instantly with zero velocity, no wobble and no travel', () => {
    const m = new CarMotion();
    m.setTarget(1, true);
    expect(m.progress).toBe(1);
    expect(m.velocity).toBe(0);
    expect(m.direction).toBe('still');
    m.setTarget(0, true);
    expect(m.progress).toBe(0);
    expect(m.wobbleMs).toBe(0);
    expect(m.travelled).toBe(0);
    m.step(16, true);
    expect(m.progress).toBe(0);
  });

  it('reduced motion shows a short static highlight when the position changes', () => {
    const m = new CarMotion();
    m.setTarget(1, true);
    expect(m.highlightMs).toBeGreaterThan(0);
    run(m, 500, 16, true);
    expect(m.highlightMs).toBe(0);
  });

  it('immediate placement never highlights and never animates', () => {
    const m = new CarMotion();
    m.setTarget(3, true, true);
    expect(m.progress).toBe(3);
    expect(m.highlightMs).toBe(0);
  });

  it('turning reduced motion on mid-move snaps to the target', () => {
    const m = new CarMotion();
    m.setTarget(2, false);
    run(m, 50, 10);
    m.step(10, true);
    expect(m.progress).toBe(2);
    expect(m.velocity).toBe(0);
  });
});
